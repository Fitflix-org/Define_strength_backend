import { Router } from 'express';
import { adminAuth, AdminRequest } from '../middleware/adminAuth';
import { adminIpWhitelist } from '../middleware/security';
import prisma from '../utils/prisma';

const router = Router();

// Apply IP whitelist to all admin routes
router.use(adminIpWhitelist);

// Get current admin user profile
router.get('/profile', adminAuth, async (req: AdminRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Admin profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard overview
router.get('/dashboard', adminAuth, async (req: AdminRequest, res) => {
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get total counts
    const [totalUsers, totalOrders, totalProducts, recentOrders] = await Promise.all([
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.order.count(),
      prisma.product.count(),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true }
          },
          payments: {
            select: { status: true, amount: true, paymentMethod: true }
          }
        }
      })
    ]);

    // Get revenue summary for last 30 days
    const payments = await prisma.payment.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: thirtyDaysAgo }
      },
      _sum: {
        amount: true,
        gatewayFee: true,
        netAmount: true
      },
      _count: true
    });

    // Get revenue by day for chart
    const dailyRevenue = await prisma.payment.groupBy({
      by: ['createdAt'],
      where: {
        status: 'COMPLETED',
        createdAt: { gte: thirtyDaysAgo }
      },
      _sum: { amount: true },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      success: true,
      data: {
        overview: {
        totalUsers,
        totalOrders,
        totalProducts,
        totalRevenue: payments._sum.amount || 0,
        netRevenue: payments._sum.netAmount || 0,
        gatewayFees: payments._sum.gatewayFee || 0,
        successfulPayments: payments._count
      },
      recentOrders: recentOrders.map(order => ({
        id: order.id,
        customerName: `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || order.user.email,
        total: order.total,
        status: order.status,
        paymentStatus: order.payments[0]?.status || 'PENDING',
        paymentMethod: order.payments[0]?.paymentMethod,
        createdAt: order.createdAt
      })),
      dailyRevenue: dailyRevenue.map(day => ({
        date: day.createdAt.toISOString().split('T')[0],
        revenue: day._sum.amount || 0
      }))
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all orders with filters
router.get('/orders', adminAuth, async (req: AdminRequest, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { id: { contains: search as string, mode: 'insensitive' } },
        { user: { email: { contains: search as string, mode: 'insensitive' } } },
        { user: { firstName: { contains: search as string, mode: 'insensitive' } } },
        { user: { lastName: { contains: search as string, mode: 'insensitive' } } }
      ];
    }

    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true }
          },
          items: {
            include: {
              product: {
                select: { name: true, images: true }
              }
            }
          },
          payments: {
            select: { status: true, amount: true, paymentMethod: true, createdAt: true }
          }
        }
      }),
      prisma.order.count({ where })
    ]);

    res.json({
      orders: orders.map(order => ({
        id: order.id,
        orderNumber: `ORD-${order.id.slice(-8).toUpperCase()}`,
        customer: {
          name: `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || order.user.email,
          email: order.user.email
        },
        total: order.total,
        status: order.status,
        payment: order.payments[0] ? {
          status: order.payments[0].status,
          method: order.payments[0].paymentMethod,
          amount: order.payments[0].amount
        } : null,
        itemCount: order.items.length,
        shippingAddress: {
          name: `${order.shippingFirstName} ${order.shippingLastName}`,
          address: order.shippingAddress,
          city: order.shippingCity,
          state: order.shippingState,
          zipCode: order.shippingZipCode,
          country: order.shippingCountry
        },
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit))
      }
    });
  } catch (error) {
    console.error('Admin orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update order status
router.patch('/orders/:orderId/status', adminAuth, async (req: AdminRequest, res) => {
  try {
    const { orderId } = req.params;
    const { status, trackingNumber, notes } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateData: any = { status };
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
    if (notes !== undefined) updateData.notes = notes;

    const order = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true }
        },
        items: {
          include: {
            product: {
              select: { name: true, images: true, price: true }
            }
          }
        },
        payments: {
          select: { status: true, amount: true, paymentMethod: true }
        }
      }
    });

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Retry payment for an order
router.post('/orders/:orderId/retry-payment', adminAuth, async (req: AdminRequest, res) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: true,
        user: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const lastPayment = order.payments[order.payments.length - 1];
    if (lastPayment && lastPayment.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Payment already completed' });
    }

    // Create a new payment attempt
    const newPayment = await prisma.payment.create({
      data: {
        orderId: order.id,
        userId: order.userId,
        amount: order.total,
        currency: 'INR',
        status: 'PENDING',
        paymentMethod: lastPayment?.paymentMethod || 'CARD',
        gatewayFee: 0,
        netAmount: order.total,
        metadata: {
          retryAttempt: true,
          originalPaymentId: lastPayment?.id
        }
      }
    });

    res.json({
      success: true,
      message: 'Payment retry initiated successfully',
      data: {
        paymentId: newPayment.id,
        orderId: order.id,
        amount: order.total
      }
    });
  } catch (error) {
    console.error('Retry payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk update order status
router.patch('/orders/bulk-status', adminAuth, async (req: AdminRequest, res) => {
  try {
    const { orderIds, status } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: 'Invalid order IDs' });
    }

    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await prisma.order.updateMany({
      where: {
        id: { in: orderIds }
      },
      data: { status }
    });

    res.json({
      success: true,
      message: `${result.count} orders updated successfully`,
      data: {
        updatedCount: result.count,
        status
      }
    });
  } catch (error) {
    console.error('Bulk update orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export orders as CSV
router.get('/orders/export/csv', adminAuth, async (req: AdminRequest, res) => {
  try {
    const { status, search, dateFrom, dateTo } = req.query;

    const where: any = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { id: { contains: search as string, mode: 'insensitive' } },
        { user: { email: { contains: search as string, mode: 'insensitive' } } },
        { user: { firstName: { contains: search as string, mode: 'insensitive' } } },
        { user: { lastName: { contains: search as string, mode: 'insensitive' } } }
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true }
        },
        items: {
          include: {
            product: {
              select: { name: true, price: true }
            }
          }
        },
        payments: {
          select: { status: true, amount: true, paymentMethod: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Generate CSV content
    const csvHeaders = [
      'Order ID',
      'Customer Name',
      'Customer Email',
      'Status',
      'Total Amount',
      'Payment Status',
      'Payment Method',
      'Items',
      'Created Date',
      'Tracking Number',
      'Notes'
    ];

    const csvRows = orders.map(order => [
      order.id,
      `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || 'N/A',
      order.user.email,
      order.status,
      order.total.toString(),
      order.payments[0]?.status || 'N/A',
      order.payments[0]?.paymentMethod || 'N/A',
      order.items.map(item => `${item.product.name} (${item.quantity})`).join('; '),
      order.createdAt.toISOString().split('T')[0],
      order.trackingNumber || 'N/A',
      order.notes || 'N/A'
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export orders CSV error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export orders as Excel
router.get('/orders/export/excel', adminAuth, async (req: AdminRequest, res) => {
  try {
    const { status, search, dateFrom, dateTo } = req.query;

    const where: any = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { id: { contains: search as string, mode: 'insensitive' } },
        { user: { email: { contains: search as string, mode: 'insensitive' } } },
        { user: { firstName: { contains: search as string, mode: 'insensitive' } } },
        { user: { lastName: { contains: search as string, mode: 'insensitive' } } }
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true }
        },
        items: {
          include: {
            product: {
              select: { name: true, price: true }
            }
          }
        },
        payments: {
          select: { status: true, amount: true, paymentMethod: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // For now, return CSV format with Excel MIME type
    // In production, you might want to use a library like 'exceljs' for proper Excel format
    const csvHeaders = [
      'Order ID',
      'Customer Name',
      'Customer Email',
      'Status',
      'Total Amount',
      'Payment Status',
      'Payment Method',
      'Items',
      'Created Date',
      'Tracking Number',
      'Notes'
    ];

    const csvRows = orders.map(order => [
      order.id,
      `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || 'N/A',
      order.user.email,
      order.status,
      order.total.toString(),
      order.payments[0]?.status || 'N/A',
      order.payments[0]?.paymentMethod || 'N/A',
      order.items.map(item => `${item.product.name} (${item.quantity})`).join('; '),
      order.createdAt.toISOString().split('T')[0],
      order.trackingNumber || 'N/A',
      order.notes || 'N/A'
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export orders Excel error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get revenue analytics
router.get('/revenue', adminAuth, async (req: AdminRequest, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let startDate = new Date();
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const [revenue, paymentMethods, topProducts] = await Promise.all([
      // Revenue summary
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: startDate }
        },
        _sum: {
          amount: true,
          gatewayFee: true,
          netAmount: true
        },
        _count: true
      }),
      
      // Payment methods breakdown
      prisma.payment.groupBy({
        by: ['paymentMethod'],
        where: {
          status: 'COMPLETED',
          createdAt: { gte: startDate }
        },
        _sum: { amount: true },
        _count: true
      }),
      
      // Top selling products
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {
            createdAt: { gte: startDate },
            status: { not: 'CANCELLED' }
          }
        },
        _sum: { quantity: true, price: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5
      })
    ]);

    // Get product details for top products
    const productIds = topProducts.map(item => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, images: true }
    });

    res.json({
      revenue: {
        total: revenue._sum.amount || 0,
        net: revenue._sum.netAmount || 0,
        fees: revenue._sum.gatewayFee || 0,
        transactions: revenue._count
      },
      paymentMethods: paymentMethods.map(pm => ({
        method: pm.paymentMethod,
        amount: pm._sum.amount || 0,
        count: pm._count
      })),
      topProducts: topProducts.map(item => {
        const product = products.find(p => p.id === item.productId);
        return {
          product: product || { id: item.productId, name: 'Unknown Product', images: [] },
          quantity: item._sum.quantity || 0,
          revenue: item._sum.price || 0
        };
      })
    });
  } catch (error) {
    console.error('Admin revenue error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get admin profile
router.get('/profile', adminAuth, async (req: AdminRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Admin profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all payments with filters
router.get('/payments', adminAuth, async (req: AdminRequest, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { id: { contains: search as string, mode: 'insensitive' } },
        { gatewayTransactionId: { contains: search as string, mode: 'insensitive' } },
        { 
          order: {
            user: {
              OR: [
                { email: { contains: search as string, mode: 'insensitive' } },
                { firstName: { contains: search as string, mode: 'insensitive' } },
                { lastName: { contains: search as string, mode: 'insensitive' } }
              ]
            }
          }
        }
      ];
    }

    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: { 
              id: true, 
              total: true,
              user: {
                select: { firstName: true, lastName: true, email: true }
              }
            }
          }
        }
      }),
      prisma.payment.count({ where })
    ]);

    res.json({
      payments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / Number(limit))
      }
    });
  } catch (error) {
    console.error('Admin payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Contact Messages Management
router.get('/contact-messages', adminAuth, async (req: AdminRequest, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      category, 
      priority, 
      search,
      assignedTo
    } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (category && category !== 'all') {
      where.category = category;
    }
    
    if (priority && priority !== 'all') {
      where.priority = priority;
    }
    
    if (assignedTo && assignedTo !== 'all') {
      where.assignedTo = assignedTo;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { subject: { contains: search as string, mode: 'insensitive' } },
        { message: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [messages, totalCount] = await Promise.all([
      prisma.contactMessage.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.contactMessage.count({ where })
    ]);

    res.json({
      success: true,
      data: messages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get contact messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update contact message status
router.patch('/contact-messages/:messageId/status', adminAuth, async (req: AdminRequest, res) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body;

    const validStatuses = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const message = await prisma.contactMessage.update({
      where: { id: messageId },
      data: { status }
    });

    res.json({
      success: true,
      message: 'Contact message status updated successfully',
      data: message
    });
  } catch (error) {
    console.error('Update contact message status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update contact message priority
router.patch('/contact-messages/:messageId/priority', adminAuth, async (req: AdminRequest, res) => {
  try {
    const { messageId } = req.params;
    const { priority } = req.body;

    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }

    const message = await prisma.contactMessage.update({
      where: { id: messageId },
      data: { priority }
    });

    res.json({
      success: true,
      message: 'Contact message priority updated successfully',
      data: message
    });
  } catch (error) {
    console.error('Update contact message priority error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign contact message
router.patch('/contact-messages/:messageId/assign', adminAuth, async (req: AdminRequest, res) => {
  try {
    const { messageId } = req.params;
    const { assignedTo } = req.body;

    const message = await prisma.contactMessage.update({
      where: { id: messageId },
      data: { assignedTo }
    });

    res.json({
      success: true,
      message: 'Contact message assigned successfully',
      data: message
    });
  } catch (error) {
    console.error('Assign contact message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add reply to contact message
router.post('/contact-messages/:messageId/reply', adminAuth, async (req: AdminRequest, res) => {
  try {
    const { messageId } = req.params;
    const { message: replyMessage } = req.body;

    if (!replyMessage || replyMessage.trim().length === 0) {
      return res.status(400).json({ error: 'Reply message is required' });
    }

    // Get admin user details
    const admin = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { firstName: true, lastName: true, email: true }
    });

    const adminName = admin ? 
      `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.email :
      'Admin';

    const reply = await prisma.contactReply.create({
      data: {
        contactMessageId: messageId,
        adminUserId: req.userId!,
        message: replyMessage
      }
    });

    // Update message status to in-progress if it's still new
    await prisma.contactMessage.update({
      where: { id: messageId },
      data: {
        status: 'IN_PROGRESS'
      }
    });

    res.json({
      success: true,
      message: 'Reply added successfully',
      data: reply
    });
  } catch (error) {
    console.error('Add contact reply error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export contact messages as CSV
router.get('/contact-messages/export/csv', adminAuth, async (req: AdminRequest, res) => {
  try {
    const { status, category, priority, search, dateFrom, dateTo } = req.query;

    const where: any = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (category && category !== 'all') {
      where.category = category;
    }
    
    if (priority && priority !== 'all') {
      where.priority = priority;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { subject: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    const messages = await prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    // Generate CSV content
    const csvHeaders = [
      'Message ID',
      'Name',
      'Email',
      'Phone',
      'Category',
      'Priority',
      'Subject',
      'Message',
      'Status',
      'Assigned To',
      'Google Sheets Ref',
      'Created Date'
    ];

    const csvRows = messages.map(message => [
      message.id,
      message.name,
      message.email,
      message.phone || 'N/A',
      message.category,
      message.priority || 'MEDIUM',
      message.subject,
      message.message.substring(0, 100) + (message.message.length > 100 ? '...' : ''),
      message.status,
      message.assignedTo || 'Unassigned',
      message.googleSheetsRef || 'N/A',
      message.createdAt.toISOString().split('T')[0]
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="contact-messages-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export contact messages CSV error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
