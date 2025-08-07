import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Date range schema for analytics queries
const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  period: z.enum(['day', 'week', 'month', 'year']).optional().default('month')
});

// Get revenue overview
router.get('/overview', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, period } = dateRangeSchema.parse(req.query);
    
    // Calculate date range
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : (() => {
      const date = new Date();
      switch (period) {
        case 'day': date.setDate(date.getDate() - 1); break;
        case 'week': date.setDate(date.getDate() - 7); break;
        case 'month': date.setMonth(date.getMonth() - 1); break;
        case 'year': date.setFullYear(date.getFullYear() - 1); break;
      }
      return date;
    })();

    // Get revenue reports for the period
    const revenueReports = await prisma.revenueReport.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        }
      },
      orderBy: { date: 'desc' }
    });

    // Calculate totals
    const totals = revenueReports.reduce((acc, report) => ({
      totalRevenue: acc.totalRevenue + parseFloat(report.totalRevenue.toString()),
      netRevenue: acc.netRevenue + parseFloat(report.netRevenue.toString()),
      gatewayFees: acc.gatewayFees + parseFloat(report.gatewayFees.toString()),
      refundAmount: acc.refundAmount + parseFloat(report.refundAmount.toString()),
      totalOrders: acc.totalOrders + report.totalOrders,
      successfulPayments: acc.successfulPayments + report.successfulPayments,
      failedPayments: acc.failedPayments + report.failedPayments,
      refundCount: acc.refundCount + report.refundCount,
      totalItemsSold: acc.totalItemsSold + report.totalItemsSold,
    }), {
      totalRevenue: 0,
      netRevenue: 0,
      gatewayFees: 0,
      refundAmount: 0,
      totalOrders: 0,
      successfulPayments: 0,
      failedPayments: 0,
      refundCount: 0,
      totalItemsSold: 0,
    });

    // Calculate derived metrics
    const averageOrderValue = totals.totalOrders > 0 ? totals.totalRevenue / totals.totalOrders : 0;
    const conversionRate = (totals.successfulPayments + totals.failedPayments) > 0 
      ? (totals.successfulPayments / (totals.successfulPayments + totals.failedPayments)) * 100 
      : 0;

    res.json({
      period: { start, end },
      totals: {
        ...totals,
        averageOrderValue,
        conversionRate,
      },
      dailyReports: revenueReports
    });
  } catch (error) {
    console.error('Revenue overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get payment analytics
router.get('/payments', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = dateRangeSchema.parse(req.query);
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Get payment method breakdown
    const paymentMethods = await prisma.payment.groupBy({
      by: ['paymentMethod'],
      where: {
        createdAt: { gte: start, lte: end },
        status: 'COMPLETED'
      },
      _sum: { amount: true },
      _count: { id: true }
    });

    // Get payment status breakdown
    const paymentStatuses = await prisma.payment.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: start, lte: end }
      },
      _sum: { amount: true },
      _count: { id: true }
    });

    // Get gateway fee analysis
    const gatewayAnalysis = await prisma.payment.groupBy({
      by: ['gatewayProvider'],
      where: {
        createdAt: { gte: start, lte: end },
        status: 'COMPLETED',
        gatewayProvider: { not: null }
      },
      _sum: { 
        amount: true,
        gatewayFee: true,
        netAmount: true
      },
      _count: { id: true }
    });

    res.json({
      period: { start, end },
      paymentMethods: paymentMethods.map(pm => ({
        method: pm.paymentMethod,
        totalAmount: pm._sum.amount || 0,
        transactionCount: pm._count.id,
        averageAmount: pm._count.id > 0 ? (parseFloat(pm._sum.amount?.toString() || '0') / pm._count.id) : 0
      })),
      paymentStatuses: paymentStatuses.map(ps => ({
        status: ps.status,
        totalAmount: ps._sum.amount || 0,
        transactionCount: ps._count.id
      })),
      gatewayAnalysis: gatewayAnalysis.map(ga => ({
        provider: ga.gatewayProvider,
        totalAmount: ga._sum.amount || 0,
        totalFees: ga._sum.gatewayFee || 0,
        netAmount: ga._sum.netAmount || 0,
        transactionCount: ga._count.id,
        feePercentage: ga._sum.amount ? (parseFloat(ga._sum.gatewayFee?.toString() || '0') / parseFloat(ga._sum.amount.toString())) * 100 : 0
      }))
    });
  } catch (error) {
    console.error('Payment analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get top-selling products
router.get('/products', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = dateRangeSchema.parse(req.query);
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get top-selling products
    const topProducts = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          createdAt: { gte: start, lte: end },
          status: { not: 'CANCELLED' }
        }
      },
      _sum: { 
        quantity: true,
        price: true
      },
      _count: { id: true },
      orderBy: {
        _sum: { quantity: 'desc' }
      },
      take: 10
    });

    // Get product details
    const productDetails = await Promise.all(
      topProducts.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true, images: true, price: true, salePrice: true }
        });
        
        return {
          product,
          quantitySold: item._sum.quantity || 0,
          revenue: item._sum.price || 0,
          orderCount: item._count.id
        };
      })
    );

    res.json({
      period: { start, end },
      topProducts: productDetails.filter(item => item.product !== null)
    });
  } catch (error) {
    console.error('Product analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get refund analytics
router.get('/refunds', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = dateRangeSchema.parse(req.query);
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get refund summary
    const refundSummary = await prisma.refund.aggregate({
      where: {
        createdAt: { gte: start, lte: end }
      },
      _sum: { amount: true },
      _count: { id: true }
    });

    // Get refund reasons breakdown
    const refundReasons = await prisma.refund.groupBy({
      by: ['reason'],
      where: {
        createdAt: { gte: start, lte: end }
      },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: {
        _count: { id: 'desc' }
      }
    });

    // Get refund status breakdown
    const refundStatuses = await prisma.refund.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: start, lte: end }
      },
      _sum: { amount: true },
      _count: { id: true }
    });

    res.json({
      period: { start, end },
      summary: {
        totalRefundAmount: refundSummary._sum.amount || 0,
        totalRefundCount: refundSummary._count.id || 0
      },
      refundReasons: refundReasons.map(rr => ({
        reason: rr.reason,
        amount: rr._sum.amount || 0,
        count: rr._count.id
      })),
      refundStatuses: refundStatuses.map(rs => ({
        status: rs.status,
        amount: rs._sum.amount || 0,
        count: rs._count.id
      }))
    });
  } catch (error) {
    console.error('Refund analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
