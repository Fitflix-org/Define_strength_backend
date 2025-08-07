# 📊 Monitoring & Logging Setup

## Error Tracking & Monitoring

### 1. Sentry Integration (Recommended)
```bash
npm install @sentry/node @sentry/tracing
```

```javascript
// Add to server.ts
const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Tracing.Integrations.Express({ app }),
  ],
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});

// Add Sentry middleware
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// Error handler (add before your error middleware)
app.use(Sentry.Handlers.errorHandler());
```

### 2. Structured Logging
```bash
npm install winston winston-daily-rotate-file
```

```javascript
// logger.js
const winston = require('winston');
require('winston-daily-rotate-file');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'fitspace-api' },
  transports: [
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

## Health Checks & Uptime Monitoring

### 1. Enhanced Health Check
```javascript
// Add to server.ts
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV,
  };

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.database = 'connected';
  } catch (error) {
    health.database = 'disconnected';
    health.status = 'error';
  }

  // Check Redis connection (if using)
  if (process.env.REDIS_URL) {
    try {
      await redisClient.ping();
      health.cache = 'connected';
    } catch (error) {
      health.cache = 'disconnected';
    }
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

### 2. Uptime Monitoring Services
- [ ] **UptimeRobot** - Free uptime monitoring
- [ ] **Pingdom** - Comprehensive monitoring
- [ ] **StatusCake** - Website monitoring
- [ ] **New Relic** - Full APM solution

## Business Metrics Tracking

### 1. Custom Analytics
```javascript
// analytics.js
const trackEvent = async (event, properties) => {
  try {
    await prisma.analyticsEvent.create({
      data: {
        event,
        properties: JSON.stringify(properties),
        timestamp: new Date(),
        userId: properties.userId || null,
      },
    });
  } catch (error) {
    logger.error('Analytics tracking failed', error);
  }
};

// Usage in routes
app.post('/api/orders/create', async (req, res) => {
  // ... order creation logic

  // Track successful order
  await trackEvent('order_created', {
    orderId: order.id,
    userId: req.user.id,
    total: order.total,
    itemCount: order.items.length,
  });
});
```

### 2. Key Metrics to Track
- [ ] **User Registration Rate**
- [ ] **Order Conversion Rate**
- [ ] **Average Order Value**
- [ ] **Payment Success Rate**
- [ ] **API Response Times**
- [ ] **Error Rates by Endpoint**
- [ ] **Daily/Monthly Active Users**

## Alerting System

### 1. Critical Alerts
```javascript
// alerts.js
const sendAlert = async (severity, message, data) => {
  if (severity === 'critical') {
    // Send to Slack/Discord/Email
    await notificationService.send({
      channel: '#alerts',
      message: `🚨 CRITICAL: ${message}`,
      data,
    });
  }
};

// Example usage
app.use((error, req, res, next) => {
  if (error.status >= 500) {
    sendAlert('critical', 'Server Error', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
    });
  }
  next(error);
});
```

### 2. Alert Thresholds
- [ ] **Response time > 2 seconds**
- [ ] **Error rate > 5%**
- [ ] **Database connection failures**
- [ ] **Memory usage > 80%**
- [ ] **Disk space < 10%**
- [ ] **Failed payment rate > 2%**

## Dashboard Setup

### 1. Grafana Dashboard (Recommended)
```yaml
# docker-compose.monitoring.yml
version: '3.8'
services:
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

volumes:
  grafana-data:
```

### 2. Simple Status Page
```javascript
// Simple status dashboard endpoint
app.get('/status', async (req, res) => {
  const stats = await prisma.$queryRaw`
    SELECT 
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM orders) as total_orders,
      (SELECT COUNT(*) FROM orders WHERE status = 'PENDING') as pending_orders,
      (SELECT SUM(total) FROM orders WHERE status = 'COMPLETED') as total_revenue
  `;

  res.json({
    stats: stats[0],
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV,
  });
});
```
