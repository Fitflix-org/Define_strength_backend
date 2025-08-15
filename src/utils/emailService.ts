import nodemailer from 'nodemailer';

// Email transporter configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email using configured SMTP
 */
export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('SMTP credentials not configured. Email not sent.');
      return false;
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Define Strength" <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

/**
 * Send welcome email to new users
 */
export const sendWelcomeEmail = async (userEmail: string, firstName: string): Promise<boolean> => {
  const subject = 'Welcome to Define Strength!';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome to Define Strength!</h1>
                <p>Your journey to fitness excellence starts here</p>
            </div>
            <div class="content">
                <h2>Hi ${firstName}!</h2>
                <p>Thank you for joining Define Strength - your premier destination for professional fitness equipment.</p>
                <p>We're excited to help you build your perfect workout space with our high-quality fitness equipment designed for:</p>
                <ul>
                    <li>🏠 Home gyms</li>
                    <li>🏢 Office fitness areas</li>
                    <li>🏋️ Commercial facilities</li>
                </ul>
                <p>Start exploring our collection and find the perfect equipment for your fitness goals.</p>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="button">Browse Products</a>
                <p>If you have any questions, our support team is here to help!</p>
            </div>
            <div class="footer">
                <p>© 2025 Define Strength. All rights reserved.</p>
                <p>This email was sent to ${userEmail}</p>
            </div>
        </div>
    </body>
    </html>
  `;

  return await sendEmail({ to: userEmail, subject, html });
};

/**
 * Send order confirmation email
 */
export const sendOrderConfirmationEmail = async (
  userEmail: string,
  order: any,
  user: any
): Promise<boolean> => {
  const subject = `Order Confirmation - #${order.id.slice(-8)}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .item { border-bottom: 1px solid #eee; padding: 15px 0; display: flex; justify-content: space-between; }
            .total { font-weight: bold; font-size: 18px; color: #28a745; border-top: 2px solid #28a745; padding-top: 15px; margin-top: 15px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✅ Order Confirmed!</h1>
                <p>Thank you for your purchase</p>
            </div>
            <div class="content">
                <h2>Hi ${user.firstName || 'Valued Customer'}!</h2>
                <p>Your order has been confirmed and is being processed. Here are the details:</p>
                
                <div class="order-details">
                    <h3>Order #${order.id.slice(-8)}</h3>
                    <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
                    <p><strong>Status:</strong> ${order.status}</p>
                    
                    <h4>Shipping Address:</h4>
                    <p>
                        ${order.shippingFirstName} ${order.shippingLastName}<br>
                        ${order.shippingAddress}<br>
                        ${order.shippingCity}, ${order.shippingState} ${order.shippingZipCode}<br>
                        ${order.shippingCountry}
                    </p>
                    
                    <h4>Order Summary:</h4>
                    ${order.items?.map((item: any) => `
                        <div class="item">
                            <span>${item.product?.name || 'Product'} (Qty: ${item.quantity})</span>
                            <span>₹${Number(item.price).toLocaleString()}</span>
                        </div>
                    `).join('') || ''}
                    
                    <div class="item">
                        <span>Shipping</span>
                        <span>₹${Number(order.shippingCost).toLocaleString()}</span>
                    </div>
                    
                    <div class="item">
                        <span>Tax</span>
                        <span>₹${Number(order.tax).toLocaleString()}</span>
                    </div>
                    
                    <div class="total">
                        <span>Total: ₹${Number(order.total).toLocaleString()}</span>
                    </div>
                </div>
                
                <p>We'll send you another email when your order ships with tracking information.</p>
                <p>If you have any questions about your order, please contact our support team.</p>
            </div>
            <div class="footer">
                <p>© 2025 Define Strength. All rights reserved.</p>
                <p>Order confirmation sent to ${userEmail}</p>
            </div>
        </div>
    </body>
    </html>
  `;

  return await sendEmail({ to: userEmail, subject, html });
};

/**
 * Send payment confirmation email
 */
export const sendPaymentConfirmationEmail = async (
  userEmail: string,
  payment: any,
  order: any
): Promise<boolean> => {
  const subject = `Payment Received - Order #${order.id.slice(-8)}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #17a2b8 0%, #6f42c1 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .payment-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .success { color: #28a745; font-weight: bold; font-size: 18px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>💳 Payment Successful!</h1>
                <p>Your payment has been processed</p>
            </div>
            <div class="content">
                <div class="success">✅ Payment Confirmed</div>
                <p>Thank you! Your payment has been successfully processed for Order #${order.id.slice(-8)}.</p>
                
                <div class="payment-details">
                    <h3>Payment Details</h3>
                    <p><strong>Amount Paid:</strong> ₹${Number(payment.amount).toLocaleString()}</p>
                    <p><strong>Payment Method:</strong> ${payment.paymentMethod}</p>
                    <p><strong>Transaction ID:</strong> ${payment.transactionId}</p>
                    <p><strong>Payment Date:</strong> ${new Date(payment.paidAt).toLocaleString()}</p>
                    <p><strong>Status:</strong> <span class="success">${payment.status}</span></p>
                </div>
                
                <p>Your order is now being processed and will be shipped soon. You'll receive a shipping confirmation with tracking details.</p>
                <p>Keep this email for your records.</p>
            </div>
            <div class="footer">
                <p>© 2025 Define Strength. All rights reserved.</p>
                <p>Payment confirmation sent to ${userEmail}</p>
            </div>
        </div>
    </body>
    </html>
  `;

  return await sendEmail({ to: userEmail, subject, html });
};

/**
 * Send shipping notification email
 */
export const sendShippingNotificationEmail = async (
  userEmail: string,
  order: any,
  trackingNumber: string,
  estimatedDelivery: string = '3-5 business days'
): Promise<boolean> => {
  const subject = `Your Order Has Shipped - #${order.id.slice(-8)}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #fd7e14 0%, #e83e8c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .tracking { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .tracking-number { background: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 18px; font-weight: bold; margin: 15px 0; }
            .button { display: inline-block; background: #fd7e14; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📦 Your Order Has Shipped!</h1>
                <p>Your fitness equipment is on its way</p>
            </div>
            <div class="content">
                <p>Great news! Your order #${order.id.slice(-8)} has been shipped and is on its way to you.</p>
                
                <div class="tracking">
                    <h3>Tracking Information</h3>
                    <p><strong>Tracking Number:</strong></p>
                    <div class="tracking-number">${trackingNumber}</div>
                    <p><strong>Estimated Delivery:</strong> ${estimatedDelivery}</p>
                    <a href="#" class="button">Track Your Package</a>
                </div>
                
                <p><strong>Shipping Address:</strong><br>
                ${order.shippingFirstName} ${order.shippingLastName}<br>
                ${order.shippingAddress}<br>
                ${order.shippingCity}, ${order.shippingState} ${order.shippingZipCode}</p>
                
                <p>You'll receive a delivery confirmation email once your package arrives.</p>
                <p>If you have any questions about your shipment, please contact our support team.</p>
            </div>
            <div class="footer">
                <p>© 2025 Define Strength. All rights reserved.</p>
                <p>Shipping notification sent to ${userEmail}</p>
            </div>
        </div>
    </body>
    </html>
  `;

  return await sendEmail({ to: userEmail, subject, html });
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (
  userEmail: string,
  resetToken: string,
  firstName: string
): Promise<boolean> => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
  const subject = 'Reset Your Password - Define Strength';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #dc3545 0%, #6f42c1 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 Password Reset Request</h1>
                <p>Reset your Define Strength account password</p>
            </div>
            <div class="content">
                <h2>Hi ${firstName}!</h2>
                <p>We received a request to reset your password for your Define Strength account.</p>
                <p>Click the button below to reset your password:</p>
                
                <a href="${resetUrl}" class="button">Reset Password</a>
                
                <div class="warning">
                    <strong>⚠️ Important:</strong>
                    <ul>
                        <li>This link will expire in 1 hour</li>
                        <li>If you didn't request this reset, please ignore this email</li>
                        <li>Your password will remain unchanged until you create a new one</li>
                    </ul>
                </div>
                
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px;">${resetUrl}</p>
                
                <p>If you have any questions, please contact our support team.</p>
            </div>
            <div class="footer">
                <p>© 2025 Define Strength. All rights reserved.</p>
                <p>Password reset email sent to ${userEmail}</p>
            </div>
        </div>
    </body>
    </html>
  `;

  return await sendEmail({ to: userEmail, subject, html });
};

/**
 * Send low stock alert to admin
 */
export const sendLowStockAlert = async (
  product: any,
  currentStock: number
): Promise<boolean> => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@definestrength.com';
  const subject = `🚨 Low Stock Alert - ${product.name}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); color: #212529; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .alert { background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .critical { background: #f8d7da; border: 1px solid #f5c6cb; }
            .product-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>⚠️ Low Stock Alert</h1>
                <p>Immediate attention required</p>
            </div>
            <div class="content">
                <div class="alert ${currentStock === 0 ? 'critical' : ''}">
                    <h3>${currentStock === 0 ? '🚨 OUT OF STOCK' : '📉 LOW STOCK WARNING'}</h3>
                    <p>The following product requires immediate restocking:</p>
                </div>
                
                <div class="product-info">
                    <h3>Product Details</h3>
                    <p><strong>Product Name:</strong> ${product.name}</p>
                    <p><strong>SKU:</strong> ${product.sku}</p>
                    <p><strong>Current Stock:</strong> <span style="color: ${currentStock === 0 ? '#dc3545' : '#ffc107'}; font-weight: bold;">${currentStock} units</span></p>
                    <p><strong>Category:</strong> ${product.category?.name || 'N/A'}</p>
                    <p><strong>Price:</strong> ₹${Number(product.price).toLocaleString()}</p>
                </div>
                
                <p><strong>Action Required:</strong></p>
                <ul>
                    <li>Contact suppliers for immediate restock</li>
                    <li>Update product availability on website</li>
                    <li>Consider temporarily hiding product if out of stock</li>
                    <li>Notify customers with pending orders</li>
                </ul>
                
                <p>This alert was automatically generated when stock levels reached the minimum threshold.</p>
            </div>
            <div class="footer">
                <p>© 2025 Define Strength. All rights reserved.</p>
                <p>Stock alert sent to ${adminEmail}</p>
            </div>
        </div>
    </body>
    </html>
  `;

  return await sendEmail({ to: adminEmail, subject, html });
};
