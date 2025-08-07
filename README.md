# Fit Space Forge Backend API

A production-ready e-commerce backend API for fitness equipment built with Node.js, Express, TypeScript, Prisma, and PostgreSQL.

## 🚀 Features

- **Complete E-commerce Functionality**: Products, cart, orders, payments, and user management
- **JWT Authentication**: Secure user authentication with role-based access control
- **Production-Ready**: Rate limiting, security headers, compression, and error handling
- **API Documentation**: Comprehensive Swagger/OpenAPI documentation
- **Database**: PostgreSQL with Prisma ORM for type-safe database operations
- **Validation**: Request validation with Zod schemas
- **Containerized**: Docker and Docker Compose support
- **Monitoring**: Health checks and error tracking

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 13+
- npm or yarn
- Docker (optional, for containerized deployment)

## 🛠️ Installation

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Fitflix-org/Define_strength_backend.git
   cd Define_strength_backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database Setup**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run migrations
   npm run db:migrate
   
   # Seed database (optional)
   npm run db:seed
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3001`

### Docker Development

1. **Clone and configure**
   ```bash
   git clone https://github.com/Fitflix-org/Define_strength_backend.git
   cd Define_strength_backend
   cp .env.example .env
   ```

2. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

This will start PostgreSQL, Redis, and the API server.

## 🏗️ Production Deployment

### Docker Production

1. **Build production image**
   ```bash
   docker build -t fitspace-backend .
   ```

2. **Run production containers**
   ```bash
   docker-compose --profile production up -d
   ```

### Manual Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Run migrations**
   ```bash
   npm run db:migrate:deploy
   ```

3. **Start production server**
   ```bash
   npm run start:prod
   ```

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/fitspace

# JWT
JWT_SECRET=your-super-secret-jwt-key

# CORS
CORS_ORIGIN=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Server
NODE_ENV=production
PORT=3001
```

### Key Configuration Options

- **Rate Limiting**: 100 requests per 15 minutes (production)
- **JWT Expiration**: 7 days
- **Request Size Limit**: 10MB
- **CORS**: Configurable origins
- **Security**: Helmet security headers enabled

## 📚 API Documentation

### Interactive Documentation
Visit `/api-docs` when the server is running for Swagger UI documentation.

### Health Check
- **Endpoint**: `GET /health`
- **Response**: Server status, uptime, and environment info

### Authentication Required
Most endpoints require JWT authentication. Include the token in headers:
```
Authorization: Bearer <your-jwt-token>
```

### Main Endpoints

- **Auth**: `/api/auth` - Registration, login, user management
- **Products**: `/api/products` - Product catalog with filtering
- **Cart**: `/api/cart` - Shopping cart management
- **Orders**: `/api/orders` - Order processing and tracking
- **Payments**: `/api/payments` - Payment processing and refunds
- **Addresses**: `/api/addresses` - User address management
- **Admin**: `/api/admin` - Admin dashboard and management
- **Analytics**: `/api/analytics` - Revenue and performance analytics

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete endpoint documentation.

## 🗄️ Database Schema

The application uses PostgreSQL with Prisma ORM. Key models:

- **User**: User accounts with role-based access
- **Product**: Product catalog with categories and inventory
- **Cart/CartItem**: Shopping cart functionality
- **Order/OrderItem**: Order management with status tracking
- **Payment/Refund**: Payment processing and refund handling
- **Address**: User shipping addresses
- **Category**: Product categorization
- **RevenueReport**: Daily analytics and reporting

### Database Commands

```bash
# Generate Prisma client
npm run db:generate

# Create and run migration
npm run db:migrate

# Deploy migrations (production)
npm run db:migrate:deploy

# Reset database
npm run db:reset

# Seed database
npm run db:seed

# Open Prisma Studio
npm run db:studio
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Request rate limiting and speed limiting
- **Input Validation**: Comprehensive request validation with Zod
- **Security Headers**: Helmet middleware for security headers
- **CORS Protection**: Configurable CORS policies
- **SQL Injection Prevention**: Prisma ORM provides built-in protection
- **Password Hashing**: bcrypt for secure password storage

## 🚨 Error Handling

The API provides consistent error responses:

```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "details": "Additional error context"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## 📊 Monitoring and Logging

### Health Checks
- **Application**: `GET /health`
- **Database**: Automatic connection health checks
- **Docker**: Built-in health check containers

### Logging
- **Development**: Detailed console logging
- **Production**: Structured logging with Morgan
- **Error Tracking**: Console error logging (Sentry integration ready)

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 📦 Available Scripts

```bash
# Development
npm run dev              # Start development server with hot reload
npm run build            # Build for production
npm run start            # Start production server
npm run type-check       # TypeScript type checking

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed database with sample data
npm run db:studio        # Open Prisma Studio

# Docker
npm run docker:build     # Build Docker image
npm run docker:run       # Run Docker container

# Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run test             # Run tests
npm run test:coverage    # Run tests with coverage
```

## 🏗️ Architecture

```
src/
├── middleware/          # Custom middleware (auth, validation, error handling)
├── routes/             # API route handlers
├── server.ts           # Main application server
└── types/              # TypeScript type definitions

prisma/
├── schema.prisma       # Database schema
├── migrations/         # Database migration files
└── seed.ts            # Database seeding script
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [Frontend Application](https://github.com/Fitflix-org/Define_strength_frontend) - React frontend for this API
- [Admin Dashboard](https://github.com/Fitflix-org/Define_strength_admin) - Admin panel for management

## 📞 Support

For support and questions:
- **Email**: support@fitspaceforge.com
- **Documentation**: `/api-docs` endpoint
- **Issues**: GitHub Issues page

## 🚀 Deployment Platforms

This API can be deployed on:
- **Docker**: Using provided Dockerfile and docker-compose.yml
- **Railway**: One-click deployment with Railway
- **Heroku**: Deploy with Heroku Postgres addon
- **Vercel**: Serverless deployment
- **DigitalOcean**: App Platform or Droplets
- **AWS**: EC2, ECS, or Lambda
- **Google Cloud**: Cloud Run or Compute Engine

## 📈 Performance

- **Response Time**: < 100ms for most endpoints
- **Throughput**: 1000+ requests per minute
- **Database**: Optimized queries with Prisma
- **Caching**: Redis support for session caching
- **Compression**: Gzip compression enabled

## 🔄 API Versioning

Current API version: `v1.0.0`

Future versions will maintain backward compatibility or provide migration guides.

---

**Built with ❤️ by the Fitflix team**
