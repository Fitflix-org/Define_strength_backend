// ...existing code...
dotenv.config();
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/orders';
import addressRoutes from './routes/addresses';
import paymentRoutes from './routes/payments';
import razorpayRoutes from './routes/razorpay';
import adminRoutes from './routes/admin';
import privacyRoutes from './routes/privacy';
import contactRoutes from './routes/contact';
import wishlistRoutes from './routes/wishlist';
import reviewRoutes from './routes/reviews';
import analyticsRoutes from './routes/analytics';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { securityHeaders, securityLogger, adminRateLimit } from './middleware/security';

// Load environment variables

const app = express();
const PORT = process.env.PORT || 3001;

// Custom security headers
app.use(securityHeaders);

// Security logging
app.use(securityLogger);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:8081',
    'http://localhost:8080',
    'http://localhost:3000',
    process.env.CORS_ORIGIN || 'http://localhost:5173'
  ],
  credentials: true,
}));

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payments', razorpayRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/analytics', analyticsRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});
