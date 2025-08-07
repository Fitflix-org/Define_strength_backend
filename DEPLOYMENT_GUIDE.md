# 🚀 Deployment Guide

## Quick Deployment Options (Recommended for Beginners)

### 1. Railway (Easiest)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy
railway deploy
```

**Steps:**
1. Push code to GitHub
2. Connect Railway to your GitHub repo
3. Add environment variables in Railway dashboard
4. Deploy automatically on push

### 2. Render (Free Tier Available)
1. Connect GitHub repository
2. Choose "Web Service"
3. Set build command: `npm run build`
4. Set start command: `npm start`
5. Add environment variables
6. Deploy

### 3. DigitalOcean App Platform
1. Connect GitHub repository
2. Choose Node.js app
3. Set environment variables
4. Auto-deploy on push

## Docker Deployment (Production Ready)

### 1. Build and Deploy with Docker
```bash
# Build production image
docker build -t fitspace-backend:latest .

# Run with environment file
docker run -d \
  --name fitspace-api \
  -p 3001:3001 \
  --env-file .env.production \
  fitspace-backend:latest

# Or use Docker Compose
docker-compose -f docker-compose.production.yml up -d
```

### 2. Production Docker Compose
```yaml
# docker-compose.production.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=${CORS_ORIGIN}
    depends_on:
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api
    restart: unless-stopped

volumes:
  redis_data:
```

### 3. Nginx Configuration
```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream api {
        server api:3001;
    }

    server {
        listen 80;
        server_name yourdomain.com;
        
        # Redirect HTTP to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl;
        server_name yourdomain.com;

        ssl_certificate /etc/nginx/ssl/certificate.crt;
        ssl_certificate_key /etc/nginx/ssl/private.key;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";

        location / {
            proxy_pass http://api;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

## Cloud Deployment (Advanced)

### 1. AWS ECS Deployment
```json
# task-definition.json
{
  "family": "fitspace-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "fitspace-api",
      "image": "your-account.dkr.ecr.region.amazonaws.com/fitspace-backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:prod/fitspace/db"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/fitspace-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### 2. Kubernetes Deployment
```yaml
# k8s-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fitspace-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: fitspace-backend
  template:
    metadata:
      labels:
        app: fitspace-backend
    spec:
      containers:
      - name: api
        image: fitspace-backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: fitspace-backend-service
spec:
  selector:
    app: fitspace-backend
  ports:
  - port: 80
    targetPort: 3001
  type: LoadBalancer
```

## SSL Certificate Setup

### 1. Let's Encrypt (Free)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 2. Cloudflare SSL (Recommended)
1. Add your domain to Cloudflare
2. Update nameservers
3. Enable SSL/TLS encryption
4. Set SSL mode to "Full (Strict)"
5. Enable "Always Use HTTPS"

## CI/CD Pipeline

### 1. GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Railway
        uses: railway-sh/cli@v2
        with:
          railway-token: ${{ secrets.RAILWAY_TOKEN }}
        run: railway deploy
```

### 2. Deployment Scripts
```bash
#!/bin/bash
# deploy.sh

echo "Starting deployment..."

# Build Docker image
docker build -t fitspace-backend:latest .

# Stop existing container
docker stop fitspace-api || true
docker rm fitspace-api || true

# Run new container
docker run -d \
  --name fitspace-api \
  -p 3001:3001 \
  --env-file .env.production \
  --restart unless-stopped \
  fitspace-backend:latest

# Check health
sleep 10
if curl -f http://localhost:3001/health; then
  echo "Deployment successful!"
else
  echo "Deployment failed!"
  exit 1
fi
```

## Database Migration in Production

### 1. Migration Strategy
```bash
# Create backup before migration
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
npx prisma migrate deploy

# Verify migration
npx prisma db pull
```

### 2. Zero-downtime Deployment
```bash
# 1. Deploy new version alongside old
docker run -d --name fitspace-api-new -p 3002:3001 fitspace-backend:latest

# 2. Health check new version
curl -f http://localhost:3002/health

# 3. Update load balancer to new port
# 4. Stop old version
docker stop fitspace-api
docker rm fitspace-api

# 5. Rename new container
docker rename fitspace-api-new fitspace-api
```

## Post-Deployment Checklist

- [ ] **Health check endpoint responding**
- [ ] **Database migrations applied**
- [ ] **Environment variables set correctly**
- [ ] **SSL certificate installed and working**
- [ ] **CORS configured for production domain**
- [ ] **Rate limiting working**
- [ ] **Error monitoring (Sentry) reporting**
- [ ] **Backup system configured**
- [ ] **Monitoring dashboards setup**
- [ ] **API documentation accessible**
- [ ] **Admin endpoints secured**
- [ ] **Payment gateway configured**
- [ ] **Email service working**
- [ ] **File upload/CDN working**
- [ ] **All endpoints tested in production**
