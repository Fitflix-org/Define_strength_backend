# 💼 Essential Business Features for Production

## Payment Integration

### 1. Payment Gateway Setup
```javascript
// Razorpay Integration (for Indian market)
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create order
app.post('/api/payments/create-order', async (req, res) => {
  const { amount, currency = 'INR' } = req.body;
  
  const options = {
    amount: amount * 100, // Amount in smallest currency unit
    currency,
    receipt: `receipt_${Date.now()}`,
  };

  try {
    const order = await razorpay.orders.create(options);
    res.json({ orderId: order.id, amount: order.amount });
  } catch (error) {
    res.status(500).json({ error: 'Payment order creation failed' });
  }
});

// Verify payment
app.post('/api/payments/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  
  const generated_signature = hmac_sha256(
    razorpay_order_id + "|" + razorpay_payment_id,
    process.env.RAZORPAY_KEY_SECRET
  );

  if (generated_signature === razorpay_signature) {
    // Payment verified, update order status
    await updateOrderPaymentStatus(razorpay_order_id, 'COMPLETED');
    res.json({ status: 'success' });
  } else {
    res.status(400).json({ error: 'Payment verification failed' });
  }
});
```

### 2. International Payment (Stripe)
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/api/payments/stripe/create-intent', async (req, res) => {
  const { amount, currency = 'usd' } = req.body;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount * 100,
    currency,
    metadata: { orderId: req.body.orderId },
  });

  res.json({ clientSecret: paymentIntent.client_secret });
});
```

## Email Notifications

### 1. Email Service Setup
```bash
npm install nodemailer
```

```javascript
// email.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendOrderConfirmation = async (order, userEmail) => {
  const mailOptions = {
    from: process.env.SMTP_USER,
    to: userEmail,
    subject: `Order Confirmation - ${order.orderNumber}`,
    html: `
      <h2>Order Confirmed!</h2>
      <p>Thank you for your order. Your order number is: <strong>${order.orderNumber}</strong></p>
      <p>Order Total: ₹${order.total}</p>
      <p>We'll notify you when your order ships.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};

const sendShippingNotification = async (order, userEmail, trackingNumber) => {
  const mailOptions = {
    from: process.env.SMTP_USER,
    to: userEmail,
    subject: `Your Order Has Shipped - ${order.orderNumber}`,
    html: `
      <h2>Your Order Has Shipped!</h2>
      <p>Order Number: <strong>${order.orderNumber}</strong></p>
      <p>Tracking Number: <strong>${trackingNumber}</strong></p>
      <p>Expected Delivery: 3-5 business days</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};
```

### 2. Email Templates
- [ ] **Welcome Email** - New user registration
- [ ] **Order Confirmation** - After successful order
- [ ] **Payment Confirmation** - Payment received
- [ ] **Shipping Notification** - Order dispatched
- [ ] **Delivery Confirmation** - Order delivered
- [ ] **Password Reset** - Reset password link
- [ ] **Order Cancellation** - Order cancelled

## File Upload & Image Management

### 1. AWS S3 Integration
```bash
npm install aws-sdk multer multer-s3
```

```javascript
// upload.js
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET,
    acl: 'public-read',
    key: function (req, file, cb) {
      cb(null, `products/${Date.now()}_${file.originalname}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Product image upload endpoint
app.post('/api/admin/products/:id/images', 
  adminAuth, 
  upload.array('images', 5), 
  async (req, res) => {
    const productId = req.params.id;
    const imageUrls = req.files.map(file => file.location);

    await prisma.product.update({
      where: { id: productId },
      data: { images: imageUrls },
    });

    res.json({ images: imageUrls });
  }
);
```

### 2. Image Optimization
```javascript
// Image processing with Sharp
const sharp = require('sharp');

const processImage = async (buffer) => {
  return await sharp(buffer)
    .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
};
```

## Inventory Management

### 1. Stock Management
```javascript
// inventory.js
const updateStock = async (productId, quantity, operation = 'decrease') => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { stock: true },
  });

  if (!product) {
    throw new Error('Product not found');
  }

  const newStock = operation === 'decrease' 
    ? product.stock - quantity 
    : product.stock + quantity;

  if (newStock < 0) {
    throw new Error('Insufficient stock');
  }

  await prisma.product.update({
    where: { id: productId },
    data: { stock: newStock },
  });

  // Send low stock alert
  if (newStock <= 5) {
    await sendLowStockAlert(productId, newStock);
  }
};

// Stock reservation for orders
const reserveStock = async (orderItems) => {
  for (const item of orderItems) {
    await updateStock(item.productId, item.quantity, 'decrease');
  }
};
```

### 2. Automated Alerts
```javascript
const sendLowStockAlert = async (productId, currentStock) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { name: true, sku: true },
  });

  // Send email to admin
  await sendEmail({
    to: 'admin@fitspaceforge.com',
    subject: 'Low Stock Alert',
    html: `
      <h2>Low Stock Alert</h2>
      <p>Product: ${product.name} (${product.sku})</p>
      <p>Current Stock: ${currentStock}</p>
      <p>Please restock immediately.</p>
    `,
  });
};
```

## Customer Support Features

### 1. Support Ticket System
```javascript
// Add to Prisma schema
model SupportTicket {
  id          String   @id @default(cuid())
  userId      String
  subject     String
  message     String
  status      String   @default("OPEN") // OPEN, IN_PROGRESS, RESOLVED, CLOSED
  priority    String   @default("MEDIUM") // LOW, MEDIUM, HIGH, URGENT
  category    String   // ORDER, PAYMENT, PRODUCT, TECHNICAL, OTHER
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user        User     @relation(fields: [userId], references: [id])
  responses   SupportResponse[]
}

model SupportResponse {
  id        String   @id @default(cuid())
  ticketId  String
  message   String
  isAdmin   Boolean  @default(false)
  createdAt DateTime @default(now())
  
  ticket    SupportTicket @relation(fields: [ticketId], references: [id])
}
```

### 2. Live Chat Integration
```javascript
// Simple chat system with Socket.IO
const { Server } = require('socket.io');

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  socket.on('join-support', (userId) => {
    socket.join(`support_${userId}`);
  });

  socket.on('send-message', async (data) => {
    // Save message to database
    await prisma.chatMessage.create({
      data: {
        userId: data.userId,
        message: data.message,
        isAdmin: data.isAdmin || false,
      },
    });

    // Broadcast to support room
    io.to(`support_${data.userId}`).emit('new-message', data);
  });
});
```

## SEO & Marketing Features

### 1. Product Reviews
```javascript
// Add to Prisma schema
model ProductReview {
  id        String   @id @default(cuid())
  productId String
  userId    String
  rating    Int      // 1-5 stars
  title     String?
  comment   String?
  verified  Boolean  @default(false) // Verified purchase
  helpful   Int      @default(0) // Helpful votes
  createdAt DateTime @default(now())
  
  product   Product  @relation(fields: [productId], references: [id])
  user      User     @relation(fields: [userId], references: [id])
  
  @@unique([productId, userId])
}
```

### 2. Wishlist Feature
```javascript
// Wishlist endpoints
app.post('/api/wishlist/add', auth, async (req, res) => {
  const { productId } = req.body;
  
  await prisma.wishlist.upsert({
    where: {
      userId_productId: {
        userId: req.user.id,
        productId,
      },
    },
    create: {
      userId: req.user.id,
      productId,
    },
    update: {},
  });

  res.json({ message: 'Added to wishlist' });
});
```

## Admin Dashboard Features

### 1. Sales Analytics
```javascript
app.get('/api/admin/analytics/sales', adminAuth, async (req, res) => {
  const { startDate, endDate } = req.query;

  const salesData = await prisma.order.groupBy({
    by: ['createdAt'],
    where: {
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
      status: 'COMPLETED',
    },
    _sum: {
      total: true,
    },
    _count: {
      id: true,
    },
  });

  res.json({ salesData });
});
```

### 2. Bulk Operations
```javascript
app.post('/api/admin/products/bulk-update', adminAuth, async (req, res) => {
  const { productIds, updates } = req.body;

  await prisma.product.updateMany({
    where: {
      id: { in: productIds },
    },
    data: updates,
  });

  res.json({ message: 'Products updated successfully' });
});
```
