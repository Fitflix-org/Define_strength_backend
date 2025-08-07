import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { adminAuth, AdminRequest } from '../middleware/adminAuth';

const router = Router();
const prisma = new PrismaClient();

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
    const { status } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true }
        }
      }
    });

    res.json({
      message: 'Order status updated successfully',
      order: {
        id: order.id,
        status: order.status,
        customer: `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || order.user.email
      }
    });
  } catch (error) {
    console.error('Update order status error:', error);
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

export default router;
