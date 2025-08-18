import { Router } from 'express';
import { adminAuth, AdminRequest } from '../middleware/adminAuth';
import { adminIpWhitelist } from '../middleware/security';
import prisma from '../utils/prisma';
import os from 'os';

const router = Router();

// Apply IP whitelist to all system routes
router.use(adminIpWhitelist);
router.use(adminAuth);

// Get system health status
router.get('/health', async (req: AdminRequest, res) => {
  try {
    const startTime = Date.now();
    
    // Test database connection
    let dbStatus = 'connected';
    let dbResponseTime = 0;
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbResponseTime = Date.now() - dbStart;
    } catch (error) {
      dbStatus = 'disconnected';
      dbResponseTime = -1;
    }

    // Get system metrics
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    // Get CPU usage (simplified)
    const cpuUsage = os.loadavg()[0] * 10; // Rough estimation

    // Check service status (simplified for demo)
    const services = {
      api: true, // API is running if we reach this point
      payment: true, // Would check payment gateway connectivity in production
      email: true, // Would check email service status
      storage: true, // Would check file storage service
    };

    // Determine overall health status
    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    if (dbStatus === 'disconnected' || memoryPercentage > 90 || cpuUsage > 80) {
      status = 'error';
    } else if (memoryPercentage > 75 || cpuUsage > 60 || dbResponseTime > 1000) {
      status = 'warning';
    }

    const healthData = {
      status,
      uptime: process.uptime(),
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: memoryPercentage,
      },
      cpu: {
        usage: Math.min(cpuUsage, 100), // Cap at 100%
      },
      database: {
        status: dbStatus,
        responseTime: dbResponseTime,
      },
      services,
      lastChecked: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: healthData,
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system health',
      data: {
        status: 'error',
        lastChecked: new Date().toISOString(),
      },
    });
  }
});

// Get system logs
router.get('/logs', async (req: AdminRequest, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      level,
      service,
      startDate,
      endDate,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    
    // For demo purposes, generate some mock logs
    // In production, you would fetch from a logging service or database
    const mockLogs = [
      {
        id: '1',
        level: 'info',
        message: 'User logged in successfully',
        service: 'auth',
        userId: req.userId,
        metadata: { ip: req.ip, userAgent: req.get('User-Agent') },
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      },
      {
        id: '2',
        level: 'warn',
        message: 'High memory usage detected',
        service: 'system',
        metadata: { memoryUsage: '85%' },
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      },
      {
        id: '3',
        level: 'error',
        message: 'Payment gateway timeout',
        service: 'payment',
        metadata: { gateway: 'razorpay', timeout: '30s' },
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      },
      {
        id: '4',
        level: 'info',
        message: 'Order created successfully',
        service: 'orders',
        metadata: { orderId: 'ord_12345', amount: 2500 },
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      },
      {
        id: '5',
        level: 'debug',
        message: 'Database query executed',
        service: 'database',
        metadata: { query: 'SELECT * FROM orders', duration: '25ms' },
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      },
    ];

    // Filter logs based on query parameters
    let filteredLogs = mockLogs;
    
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    
    if (service) {
      filteredLogs = filteredLogs.filter(log => log.service === service);
    }
    
    if (startDate) {
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) >= new Date(startDate as string)
      );
    }
    
    if (endDate) {
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) <= new Date(endDate as string)
      );
    }

    // Paginate results
    const total = filteredLogs.length;
    const paginatedLogs = filteredLogs.slice(skip, skip + Number(limit));

    res.json({
      success: true,
      data: paginatedLogs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system logs',
    });
  }
});

// Get performance metrics
router.get('/performance', async (req: AdminRequest, res) => {
  try {
    const { period = 'hour' } = req.query;
    
    // Generate mock performance data
    // In production, this would come from monitoring tools like Prometheus, DataDog, etc.
    const now = new Date();
    const dataPoints = period === 'hour' ? 12 : period === 'day' ? 24 : period === 'week' ? 7 : 30;
    const interval = period === 'hour' ? 5 * 60 * 1000 : // 5 minutes
                    period === 'day' ? 60 * 60 * 1000 : // 1 hour
                    period === 'week' ? 24 * 60 * 60 * 1000 : // 1 day
                    24 * 60 * 60 * 1000; // 1 day for month

    const generateTimeSeries = (baseValue: number, variance: number) => {
      return Array.from({ length: dataPoints }, (_, i) => ({
        timestamp: new Date(now.getTime() - (dataPoints - 1 - i) * interval).toISOString(),
        value: Math.max(0, baseValue + (Math.random() - 0.5) * variance),
      }));
    };

    const metrics = {
      responseTime: generateTimeSeries(150, 100), // Base 150ms ± 50ms
      throughput: generateTimeSeries(50, 20), // Base 50 req/min ± 10
      errorRate: generateTimeSeries(2, 3), // Base 2% ± 1.5%
      activeUsers: Math.floor(Math.random() * 100) + 50, // 50-150 active users
      serverLoad: Math.random() * 60 + 20, // 20-80% server load
    };

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Get performance metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance metrics',
    });
  }
});

// Get security events
router.get('/security/events', async (req: AdminRequest, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      startDate,
      endDate,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    
    // Mock security events
    const mockEvents = [
      {
        id: '1',
        type: 'failed_login',
        severity: 'medium',
        message: 'Multiple failed login attempts',
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0...',
        metadata: { attempts: 5, email: 'admin@test.com' },
        timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      },
      {
        id: '2',
        type: 'suspicious_activity',
        severity: 'high',
        message: 'Unusual API access pattern detected',
        ip: '10.0.0.50',
        userAgent: 'Bot/1.0',
        metadata: { requests: 1000, duration: '5min' },
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      },
      {
        id: '3',
        type: 'admin_access',
        severity: 'low',
        message: 'Admin panel accessed',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { userId: req.userId, action: 'login' },
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      },
    ];

    // Filter events
    let filteredEvents = mockEvents;
    
    if (type) {
      filteredEvents = filteredEvents.filter(event => event.type === type);
    }
    
    if (startDate) {
      filteredEvents = filteredEvents.filter(event => 
        new Date(event.timestamp) >= new Date(startDate as string)
      );
    }
    
    if (endDate) {
      filteredEvents = filteredEvents.filter(event => 
        new Date(event.timestamp) <= new Date(endDate as string)
      );
    }

    // Paginate results
    const total = filteredEvents.length;
    const paginatedEvents = filteredEvents.slice(skip, skip + Number(limit));

    res.json({
      success: true,
      data: paginatedEvents,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get security events error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get security events',
    });
  }
});

export default router;
