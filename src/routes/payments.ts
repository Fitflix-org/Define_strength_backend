import { Router } from 'express';
import { PrismaClient, PaymentStatus, RefundStatus } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Create payment schema
const createPaymentSchema = z.object({
  orderId: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('INR'),
  paymentMethod: z.enum(['card', 'upi', 'netbanking', 'wallet']),
  gatewayProvider: z.string().optional(),
  gatewayPaymentId: z.string().optional(),
  gatewayOrderId: z.string().optional(),
  cardLast4: z.string().optional(),
  cardBrand: z.string().optional(),
  bankName: z.string().optional(),
});

// Update payment status schema
const updatePaymentSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  gatewayPaymentId: z.string().optional(),
  gatewaySignature: z.string().optional(),
  transactionId: z.string().optional(),
  bankRefNumber: z.string().optional(),
  gatewayFee: z.number().optional(),
  failureReason: z.string().optional(),
});

// Create payment
router.post('/create', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const paymentData = createPaymentSchema.parse(req.body);
    const userId = req.userId!;

    // Verify order belongs to user
    const order = await prisma.order.findFirst({
      where: { 
        id: paymentData.orderId,
        userId: userId
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if payment already exists for this order
    const existingPayment = await prisma.payment.findFirst({
      where: { 
        orderId: paymentData.orderId,
        status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] }
      }
    });

    if (existingPayment) {
      return res.status(400).json({ error: 'Payment already exists for this order' });
    }

    // Calculate net amount (assuming 2.5% gateway fee)
    const gatewayFeeRate = 0.025;
    const gatewayFee = paymentData.amount * gatewayFeeRate;
    const netAmount = paymentData.amount - gatewayFee;

    const payment = await prisma.payment.create({
      data: {
        orderId: paymentData.orderId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        paymentMethod: paymentData.paymentMethod,
        gatewayProvider: paymentData.gatewayProvider,
        gatewayPaymentId: paymentData.gatewayPaymentId,
        gatewayOrderId: paymentData.gatewayOrderId,
        gatewayFee: gatewayFee,
        netAmount: netAmount,
        cardLast4: paymentData.cardLast4,
        cardBrand: paymentData.cardBrand,
        bankName: paymentData.bankName,
        status: PaymentStatus.PENDING,
      }
    });

    res.status(201).json({
      message: 'Payment created successfully',
      payment: {
        id: payment.id,
        orderId: payment.orderId,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        gatewayPaymentId: payment.gatewayPaymentId,
        createdAt: payment.createdAt,
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update payment status
router.patch('/:paymentId/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { paymentId } = req.params;
    const updateData = updatePaymentSchema.parse(req.body);
    const userId = req.userId!;

    // Verify payment belongs to user
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId },
      include: { order: true }
    });

    if (!payment || payment.order.userId !== userId) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Prepare update data
    const updatePayload: any = {
      status: updateData.status,
      gatewayPaymentId: updateData.gatewayPaymentId,
      gatewaySignature: updateData.gatewaySignature,
      transactionId: updateData.transactionId,
      bankRefNumber: updateData.bankRefNumber,
      failureReason: updateData.failureReason,
    };

    // Calculate net amount if gateway fee provided
    if (updateData.gatewayFee !== undefined) {
      updatePayload.gatewayFee = updateData.gatewayFee;
      updatePayload.netAmount = Number(payment.amount) - updateData.gatewayFee;
    }

    // Set timestamps based on status
    if (updateData.status === 'COMPLETED') {
      updatePayload.paidAt = new Date();
    } else if (updateData.status === 'FAILED') {
      updatePayload.failedAt = new Date();
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: updatePayload
    });

    // Update order status if payment completed
    if (updateData.status === 'COMPLETED') {
      await prisma.order.update({
        where: { id: payment.orderId },
        data: { status: 'CONFIRMED' }
      });

      // Update daily revenue report
      await updateRevenueReport(Number(payment.amount), updateData.gatewayFee || 0);
    }

    res.json({
      message: 'Payment status updated successfully',
      payment: updatedPayment
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get payment by ID
router.get('/:paymentId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.userId!;

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId },
      include: { 
        order: true,
        refunds: true
      }
    });

    if (!payment || payment.order.userId !== userId) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({ payment });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get payments for an order
router.get('/order/:orderId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId!;

    // Verify order belongs to user
    const order = await prisma.order.findFirst({
      where: { 
        id: orderId,
        userId: userId
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const payments = await prisma.payment.findMany({
      where: { orderId },
      include: { refunds: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ payments });
  } catch (error) {
    console.error('Get order payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create refund
router.post('/:paymentId/refund', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;
    const userId = req.userId!;

    // Verify payment belongs to user and is completed
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId },
      include: { order: true, refunds: true }
    });

    if (!payment || payment.order.userId !== userId) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Can only refund completed payments' });
    }

    // Calculate total refunded amount
    const totalRefunded = payment.refunds.reduce((sum, refund) => 
      refund.status === 'COMPLETED' ? sum + parseFloat(refund.amount.toString()) : sum, 0
    );

    if (totalRefunded + amount > parseFloat(payment.amount.toString())) {
      return res.status(400).json({ error: 'Refund amount exceeds payment amount' });
    }

    const refund = await prisma.refund.create({
      data: {
        paymentId,
        amount,
        reason,
        status: RefundStatus.PENDING,
      }
    });

    res.status(201).json({
      message: 'Refund request created successfully',
      refund
    });
  } catch (error) {
    console.error('Create refund error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Retry failed payment
router.post('/:paymentId/retry', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { paymentId } = req.params;
    const { paymentMethod, gatewayProvider } = req.body;

    // Find the failed payment
    const existingPayment = await prisma.payment.findFirst({
      where: { 
        id: paymentId,
        status: 'FAILED'
      },
      include: {
        order: {
          include: {
            user: true
          }
        }
      }
    });

    if (!existingPayment) {
      return res.status(404).json({ error: 'Failed payment not found' });
    }

    // Verify the payment belongs to the authenticated user
    if (existingPayment.order.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Create a new payment record for retry
    const gatewayFeeRate = 0.025;
    const amount = Number(existingPayment.amount);
    const gatewayFee = amount * gatewayFeeRate;
    const netAmount = amount - gatewayFee;

    // Generate new gateway payment ID for simulation
    const gatewayPaymentId = `sim_${Date.now()}`;

    const newPayment = await prisma.payment.create({
      data: {
        orderId: existingPayment.orderId,
        amount: existingPayment.amount,
        currency: existingPayment.currency,
        paymentMethod: paymentMethod || existingPayment.paymentMethod,
        gatewayProvider: gatewayProvider || 'simulation',
        gatewayPaymentId: gatewayPaymentId,
        gatewayFee: gatewayFee,
        netAmount: netAmount,
        status: PaymentStatus.PENDING,
      }
    });

    res.status(201).json({
      message: 'Payment retry initiated successfully',
      payment: {
        id: newPayment.id,
        orderId: newPayment.orderId,
        amount: newPayment.amount,
        currency: newPayment.currency,
        paymentMethod: newPayment.paymentMethod,
        status: newPayment.status,
        gatewayPaymentId: newPayment.gatewayPaymentId,
        createdAt: newPayment.createdAt,
      }
    });
  } catch (error) {
    console.error('Retry payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to update daily revenue report
async function updateRevenueReport(amount: number, gatewayFee: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const netAmount = amount - gatewayFee;

  await prisma.revenueReport.upsert({
    where: { date: today },
    update: {
      totalRevenue: { increment: amount },
      netRevenue: { increment: netAmount },
      gatewayFees: { increment: gatewayFee },
      successfulPayments: { increment: 1 },
    },
    create: {
      date: today,
      totalRevenue: amount,
      netRevenue: netAmount,
      gatewayFees: gatewayFee,
      successfulPayments: 1,
    }
  });
}

export default router;
