# Fit Space Forge API Documentation

## Overview

This is a comprehensive e-commerce API for fitness equipment built with Node.js, Express, TypeScript, and Prisma. The API provides complete functionality for product management, user authentication, shopping cart, orders, payments, and admin operations.

**Base URL:** `http://localhost:3001` (Development) | `https://api.fitspaceforge.com` (Production)
**API Documentation:** `/api-docs` (Swagger UI)
**Health Check:** `/health`

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Rate Limiting

- **General API calls:** 100 requests per 15 minutes (production), 1000 requests per 15 minutes (development)
- **Speed limiting:** After 50 requests in 15 minutes, each subsequent request gets a 100ms delay

## API Endpoints

### 🔐 Authentication (`/api/auth`)

#### POST `/api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201):**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "clxy123abc",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST `/api/auth/login`
Authenticate user and get access token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "clxy123abc",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### GET `/api/auth/me`
Get current authenticated user information.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "user": {
    "id": "clxy123abc",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "role": "USER",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 🛍️ Products (`/api/products`)

#### GET `/api/products`
Get all products with filtering and pagination.

**Query Parameters:**
- `category` (string): Filter by category slug
- `spaceType` (string): Filter by space type (home, office, commercial)
- `search` (string): Search in product name and description
- `minPrice` (number): Minimum price filter
- `maxPrice` (number): Maximum price filter
- `featured` (boolean): Show only featured products
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 12)

**Response (200):**
```json
{
  "products": [
    {
      "id": "clxy123abc",
      "name": "Adjustable Dumbbell Set",
      "description": "High-quality adjustable dumbbells for home workouts",
      "price": 299.99,
      "salePrice": 249.99,
      "sku": "ADJDB001",
      "stock": 50,
      "images": ["image1.jpg", "image2.jpg"],
      "categoryId": "clxy456def",
      "spaceType": "home",
      "featured": true,
      "active": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "category": {
        "id": "clxy456def",
        "name": "Dumbbells",
        "slug": "dumbbells"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 100,
    "pages": 9
  }
}
```

#### GET `/api/products/:id`
Get a single product by ID.

**Response (200):**
```json
{
  "product": {
    "id": "clxy123abc",
    "name": "Adjustable Dumbbell Set",
    "description": "High-quality adjustable dumbbells for home workouts",
    "price": 299.99,
    "salePrice": 249.99,
    "sku": "ADJDB001",
    "stock": 50,
    "images": ["image1.jpg", "image2.jpg"],
    "category": {
      "id": "clxy456def",
      "name": "Dumbbells",
      "slug": "dumbbells"
    }
  }
}
```

#### GET `/api/products/categories/all`
Get all product categories.

**Response (200):**
```json
{
  "categories": [
    {
      "id": "clxy456def",
      "name": "Dumbbells",
      "description": "All types of dumbbells",
      "slug": "dumbbells"
    }
  ]
}
```

#### GET `/api/products/:id/related`
Get related products for a specific product.

**Query Parameters:**
- `limit` (number): Number of related products (default: 4)

**Response (200):**
```json
{
  "products": [
    {
      "id": "clxy789ghi",
      "name": "Related Product",
      "price": 199.99,
      "images": ["related1.jpg"],
      "category": {
        "name": "Dumbbells"
      }
    }
  ]
}
```

---

### 🛒 Shopping Cart (`/api/cart`)

All cart endpoints require authentication.

#### POST `/api/cart/add`
Add item to cart.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "productId": "clxy123abc",
  "quantity": 2
}
```

**Response (200):**
```json
{
  "message": "Item added to cart successfully"
}
```

#### GET `/api/cart`
Get current user's cart.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "cart": {
    "id": "clxyabc123",
    "items": [
      {
        "id": "clxydef456",
        "cartId": "clxyabc123",
        "productId": "clxy123abc",
        "quantity": 2,
        "product": {
          "id": "clxy123abc",
          "name": "Adjustable Dumbbell Set",
          "price": 299.99,
          "salePrice": 249.99,
          "images": ["image1.jpg"],
          "category": {
            "name": "Dumbbells"
          }
        }
      }
    ],
    "total": 499.98
  }
}
```

#### PUT `/api/cart/items/:itemId`
Update cart item quantity.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "quantity": 3
}
```

**Response (200):**
```json
{
  "message": "Cart item updated successfully"
}
```

#### DELETE `/api/cart/items/:itemId`
Remove item from cart.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Item removed from cart successfully"
}
```

#### DELETE `/api/cart/clear`
Clear entire cart.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Cart cleared successfully"
}
```

---

### 📦 Orders (`/api/orders`)

All order endpoints require authentication.

#### POST `/api/orders/create`
Create order from cart.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "shippingAddress": {
    "firstName": "John",
    "lastName": "Doe",
    "address": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA",
    "phone": "+1234567890"
  }
}
```

**Response (201):**
```json
{
  "message": "Order created successfully",
  "order": {
    "id": "clxyord123",
    "orderNumber": "ORD-RD123ABC",
    "userId": "clxyuser123",
    "status": "pending",
    "total": 599.97,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "items": [
      {
        "id": "clxyitem123",
        "productId": "clxy123abc",
        "quantity": 2,
        "price": 249.99,
        "product": {
          "id": "clxy123abc",
          "name": "Adjustable Dumbbell Set",
          "images": ["image1.jpg"]
        }
      }
    ]
  }
}
```

#### GET `/api/orders`
Get user's orders with pagination.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10)

**Response (200):**
```json
[
  {
    "id": "clxyord123",
    "orderNumber": "ORD-RD123ABC",
    "userId": "clxyuser123",
    "status": "pending",
    "total": 599.97,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "items": [
      {
        "id": "clxyitem123",
        "quantity": 2,
        "price": 249.99,
        "product": {
          "id": "clxy123abc",
          "name": "Adjustable Dumbbell Set",
          "images": ["image1.jpg"]
        }
      }
    ]
  }
]
```

#### GET `/api/orders/:id`
Get single order by ID.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "id": "clxyord123",
  "orderNumber": "ORD-RD123ABC",
  "status": "pending",
  "total": 599.97,
  "items": [
    {
      "id": "clxyitem123",
      "quantity": 2,
      "price": 249.99,
      "product": {
        "name": "Adjustable Dumbbell Set",
        "images": ["image1.jpg"]
      }
    }
  ]
}
```

#### PATCH `/api/orders/:id/status`
Update order status.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "status": "shipped"
}
```

**Valid statuses:** `pending`, `processing`, `shipped`, `delivered`, `cancelled`

**Response (200):**
```json
{
  "message": "Order status updated successfully",
  "order": {
    "id": "clxyord123",
    "status": "shipped",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 📍 Addresses (`/api/addresses`)

All address endpoints require authentication.

#### GET `/api/addresses`
Get user's saved addresses.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "addresses": [
    {
      "id": "clxyaddr123",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+1234567890",
      "addressLine1": "123 Main St",
      "addressLine2": "Apt 4B",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA",
      "isDefault": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### POST `/api/addresses`
Create new address.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "addressLine1": "123 Main St",
  "addressLine2": "Apt 4B",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001",
  "country": "USA",
  "isDefault": false
}
```

**Response (201):**
```json
{
  "address": {
    "id": "clxyaddr123",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "addressLine1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA",
    "isDefault": false
  }
}
```

#### PUT `/api/addresses/:id`
Update existing address.

**Headers:** `Authorization: Bearer <token>`

**Request Body:** Same as POST

**Response (200):**
```json
{
  "address": {
    "id": "clxyaddr123",
    "firstName": "John",
    "lastName": "Doe",
    "isDefault": true
  }
}
```

#### DELETE `/api/addresses/:id`
Delete address.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Address deleted successfully"
}
```

#### POST `/api/addresses/:id/set-default`
Set address as default.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "address": {
    "id": "clxyaddr123",
    "isDefault": true
  }
}
```

---

### 💳 Payments (`/api/payments`)

All payment endpoints require authentication.

#### POST `/api/payments/create`
Create payment for an order.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "orderId": "clxyord123",
  "amount": 599.97,
  "currency": "INR",
  "paymentMethod": "card",
  "gatewayProvider": "razorpay",
  "cardLast4": "1234",
  "cardBrand": "visa"
}
```

**Response (201):**
```json
{
  "message": "Payment created successfully",
  "payment": {
    "id": "clxypay123",
    "orderId": "clxyord123",
    "amount": 599.97,
    "currency": "INR",
    "paymentMethod": "card",
    "status": "PENDING",
    "gatewayPaymentId": "pay_abc123",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### PATCH `/api/payments/:paymentId/status`
Update payment status.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "status": "COMPLETED",
  "gatewayPaymentId": "pay_abc123",
  "transactionId": "txn_xyz789",
  "gatewayFee": 14.99
}
```

**Valid statuses:** `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`

**Response (200):**
```json
{
  "message": "Payment status updated successfully",
  "payment": {
    "id": "clxypay123",
    "status": "COMPLETED",
    "paidAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET `/api/payments/:paymentId`
Get payment details.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "payment": {
    "id": "clxypay123",
    "orderId": "clxyord123",
    "amount": 599.97,
    "status": "COMPLETED",
    "paymentMethod": "card",
    "gatewayFee": 14.99,
    "netAmount": 584.98,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "refunds": []
  }
}
```

#### POST `/api/payments/:paymentId/refund`
Create refund request.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "amount": 100.00,
  "reason": "Product damaged"
}
```

**Response (201):**
```json
{
  "message": "Refund request created successfully",
  "refund": {
    "id": "clxyref123",
    "paymentId": "clxypay123",
    "amount": 100.00,
    "reason": "Product damaged",
    "status": "PENDING"
  }
}
```

---

### 📊 Analytics (`/api/analytics`)

All analytics endpoints require authentication.

#### GET `/api/analytics/overview`
Get revenue overview and metrics.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `startDate` (string): Start date (YYYY-MM-DD)
- `endDate` (string): End date (YYYY-MM-DD)
- `period` (string): Period type (day, week, month, year)

**Response (200):**
```json
{
  "period": {
    "start": "2024-01-01T00:00:00.000Z",
    "end": "2024-01-31T23:59:59.999Z"
  },
  "totals": {
    "totalRevenue": 50000.00,
    "netRevenue": 47500.00,
    "gatewayFees": 2500.00,
    "totalOrders": 150,
    "successfulPayments": 145,
    "averageOrderValue": 333.33,
    "conversionRate": 96.67
  },
  "dailyReports": [
    {
      "date": "2024-01-01T00:00:00.000Z",
      "totalRevenue": 1500.00,
      "totalOrders": 5
    }
  ]
}
```

#### GET `/api/analytics/payments`
Get payment analytics and breakdowns.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "paymentMethods": [
    {
      "method": "card",
      "totalAmount": 30000.00,
      "transactionCount": 100,
      "averageAmount": 300.00
    }
  ],
  "paymentStatuses": [
    {
      "status": "COMPLETED",
      "totalAmount": 45000.00,
      "transactionCount": 145
    }
  ],
  "gatewayAnalysis": [
    {
      "provider": "razorpay",
      "totalAmount": 45000.00,
      "totalFees": 2250.00,
      "feePercentage": 5.0
    }
  ]
}
```

---

### 👑 Admin (`/api/admin`)

All admin endpoints require admin authentication (role: ADMIN).

#### GET `/api/admin/dashboard`
Get admin dashboard overview.

**Headers:** `Authorization: Bearer <admin-token>`

**Response (200):**
```json
{
  "overview": {
    "totalUsers": 1000,
    "totalOrders": 500,
    "totalProducts": 100,
    "totalRevenue": 150000.00,
    "successfulPayments": 480
  },
  "recentOrders": [
    {
      "id": "clxyord123",
      "customerName": "John Doe",
      "total": 599.97,
      "status": "PENDING",
      "paymentStatus": "COMPLETED",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### GET `/api/admin/orders`
Get all orders with admin filters.

**Headers:** `Authorization: Bearer <admin-token>`

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Filter by order status
- `search` (string): Search by order ID or customer info

**Response (200):**
```json
{
  "orders": [
    {
      "id": "clxyord123",
      "orderNumber": "ORD-RD123ABC",
      "customer": {
        "name": "John Doe",
        "email": "john@example.com"
      },
      "total": 599.97,
      "status": "PENDING",
      "payment": {
        "status": "COMPLETED",
        "method": "card",
        "amount": 599.97
      },
      "itemCount": 2,
      "shippingAddress": {
        "name": "John Doe",
        "address": "123 Main St",
        "city": "New York"
      },
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500,
    "totalPages": 25
  }
}
```

#### PATCH `/api/admin/orders/:orderId/status`
Update order status (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Request Body:**
```json
{
  "status": "SHIPPED"
}
```

**Valid statuses:** `PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`

**Response (200):**
```json
{
  "message": "Order status updated successfully",
  "order": {
    "id": "clxyord123",
    "status": "SHIPPED",
    "customer": "John Doe"
  }
}
```

---

## Error Handling

The API uses standard HTTP status codes and returns consistent error responses:

```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "details": "Additional error details (validation errors, etc.)"
}
```

### Common HTTP Status Codes

- **200** - Success
- **201** - Created
- **400** - Bad Request (validation errors)
- **401** - Unauthorized (missing/invalid token)
- **403** - Forbidden (insufficient permissions)
- **404** - Not Found
- **409** - Conflict (duplicate resource)
- **429** - Too Many Requests (rate limit exceeded)
- **500** - Internal Server Error

### Common Error Types

- **Validation Error** - Invalid input data
- **Unauthorized** - Authentication required
- **Forbidden** - Access denied
- **Not Found** - Resource not found
- **Conflict** - Resource already exists
- **Too Many Requests** - Rate limit exceeded

## Database Schema

The API uses PostgreSQL with Prisma ORM. Key models include:

- **User** - User accounts and authentication
- **Product** - Product catalog with categories
- **Cart/CartItem** - Shopping cart functionality
- **Order/OrderItem** - Order management
- **Payment** - Payment processing and tracking
- **Address** - User shipping addresses
- **Category** - Product categorization
- **Refund** - Refund management
- **RevenueReport** - Daily revenue analytics

## Environment Variables

Required environment variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/fitspace

# JWT
JWT_SECRET=your-secret-key

# CORS
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173

# Node Environment
NODE_ENV=development

# Server
PORT=3001
```

## Deployment Considerations

### Production Checklist

- ✅ Rate limiting enabled
- ✅ Security headers (Helmet)
- ✅ CORS configured
- ✅ Request compression
- ✅ Error handling
- ✅ Input validation
- ✅ JWT authentication
- ✅ API documentation
- ✅ Health checks
- ✅ Graceful shutdown
- ✅ Process monitoring

### Security Features

- JWT token authentication
- Rate limiting (100 req/15min in production)
- Speed limiting (progressive delays)
- CORS protection
- Helmet security headers
- Input validation with Zod
- SQL injection prevention (Prisma)
- Password hashing (bcrypt)

### Performance Features

- Response compression
- Database query optimization
- Pagination for large datasets
- Efficient database indexing
- Connection pooling

## Support

For API support, contact: support@fitspaceforge.com

## Version History

- **v1.0.0** - Initial release with full e-commerce functionality
