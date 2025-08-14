import express, { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  getPaymentDetails,
  getOrderDetails,
  createRefund,
  convertToPaise,
  convertToINR,
} from '../utils/razorpayUtils';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createOrderSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, 'Razorpay order ID is required'),
  razorpay_payment_id: z.string().min(1, 'Razorpay payment ID is required'),
  razorpay_signature: z.string().min(1, 'Razorpay signature is required'),
});

const refundSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  amount: z.number().optional(),
  reason: z.string().min(1, 'Refund reason is required'),
});

/**
 * @swagger
 * /api/payments/create-razorpay-order:
 *   post:
 *     summary: Create a Razorpay order for payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: ID of the order to create payment for
 *     responses:
 *       200:
 *         description: Razorpay order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 razorpayOrder:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     currency:
 *                       type: string
 *                     receipt:
 *                       type: string
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.post('/create-razorpay-order', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = createOrderSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Get the order details
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: userId,
        status: 'PENDING',
      },
      include: {
        payments: true,
        items: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not eligible for payment',
      });
    }

    // Check if payment already exists and is successful
    const existingPayment = order.payments.find(p => p.status === 'COMPLETED');
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: 'Order has already been paid',
      });
    }

    // Create Razorpay order
    const razorpayResult = await createRazorpayOrder({
      amount: convertToPaise(Number(order.total)),
      currency: 'INR',
      receipt: `order_${orderId}`,
      notes: {
        orderId: orderId,
        userId: userId,
      },
    });

    if (!razorpayResult.success || !razorpayResult.order) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create payment order',
        error: razorpayResult.error,
      });
    }

    // Create payment record in database
    const payment = await prisma.payment.create({
      data: {
        orderId: orderId,
        amount: order.total,
        currency: 'INR',
        paymentMethod: 'online',
        gatewayProvider: 'razorpay',
        gatewayOrderId: razorpayResult.order.id,
        status: 'PENDING',
      },
    });

    res.json({
      success: true,
      message: 'Payment order created successfully',
      razorpayOrder: {
        id: razorpayResult.order.id,
        amount: razorpayResult.order.amount,
        currency: razorpayResult.order.currency,
        receipt: razorpayResult.order.receipt,
      },
      paymentId: payment.id,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Error creating payment order:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * @swagger
 * /api/payments/verify-payment:
 *   post:
 *     summary: Verify Razorpay payment signature and complete payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - razorpay_order_id
 *               - razorpay_payment_id
 *               - razorpay_signature
 *             properties:
 *               razorpay_order_id:
 *                 type: string
 *               razorpay_payment_id:
 *                 type: string
 *               razorpay_signature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment verified and completed successfully
 *       400:
 *         description: Invalid payment signature or request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Payment not found
 *       500:
 *         description: Internal server error
 */
router.post('/verify-payment', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = 
      verifyPaymentSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Get order details from Razorpay to extract orderId from notes
    const orderDetailsResult = await getOrderDetails(razorpay_order_id);
    
    if (!orderDetailsResult.success || !orderDetailsResult.order) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Razorpay order ID',
      });
    }

    const orderId = String(orderDetailsResult.order.notes?.orderId);
    
    if (!orderId || orderId === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Order ID not found in Razorpay order notes',
      });
    }

    // Find the payment record
    const payment = await prisma.payment.findFirst({
      where: {
        order: {
          id: orderId,
          userId: userId,
        },
        gatewayOrderId: razorpay_order_id,
        status: { in: ['PENDING', 'COMPLETED'] },
      },
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found or already processed',
      });
    }

    // Verify signature
    const isValidSignature = verifyRazorpaySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (!isValidSignature) {
      // Update payment status to failed
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: 'Invalid signature verification',
        },
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature',
      });
    }

    // Get payment details from Razorpay
    const paymentDetailsResult = await getPaymentDetails(razorpay_payment_id);
    
    if (!paymentDetailsResult.success || !paymentDetailsResult.payment) {
      return res.status(500).json({
        success: false,
        message: 'Failed to verify payment details',
      });
    }

    const paymentDetails = paymentDetailsResult.payment;

    // Update payment record
    await prisma.$transaction(async (tx) => {
      // Update payment status
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          gatewayPaymentId: razorpay_payment_id,
          gatewaySignature: razorpay_signature,
          transactionId: paymentDetails.id,
          paymentMethod: paymentDetails.method,
          cardLast4: paymentDetails.card?.last4,
          cardBrand: paymentDetails.card?.network,
          bankName: paymentDetails.bank,
          gatewayFee: paymentDetails.fee ? convertToINR(paymentDetails.fee) : null,
          netAmount: paymentDetails.fee 
            ? Number(payment.amount) - convertToINR(paymentDetails.fee)
            : Number(payment.amount),
          paidAt: new Date(),
        },
        include: {
          order: {
            include: {
              items: true,
            },
          },
        },
      });

      // Update order status
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CONFIRMED' },
      });

      // Update daily revenue report
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await tx.revenueReport.upsert({
        where: { date: today },
        create: {
          date: today,
          totalRevenue: Number(payment.amount),
          netRevenue: paymentDetails.fee 
            ? Number(payment.amount) - convertToINR(paymentDetails.fee)
            : Number(payment.amount),
          gatewayFees: paymentDetails.fee ? convertToINR(paymentDetails.fee) : 0,
          totalOrders: 1,
          successfulPayments: 1,
          totalItemsSold: updatedPayment.order.items?.length || 0,
          averageOrderValue: Number(payment.amount),
        },
        update: {
          totalRevenue: {
            increment: Number(payment.amount),
          },
          netRevenue: {
            increment: paymentDetails.fee 
              ? Number(payment.amount) - convertToINR(paymentDetails.fee)
              : Number(payment.amount),
          },
          gatewayFees: {
            increment: paymentDetails.fee ? convertToINR(paymentDetails.fee) : 0,
          },
          totalOrders: {
            increment: 1,
          },
          successfulPayments: {
            increment: 1,
          },
          totalItemsSold: {
            increment: updatedPayment.order.items?.length || 0,
          },
        },
      });
    });

    res.json({
      success: true,
      message: 'Payment verified and completed successfully',
      payment: {
        id: payment.id,
        status: 'COMPLETED',
        amount: payment.amount,
        transactionId: razorpay_payment_id,
        paidAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * @swagger
 * /api/v1/payments/payment-failed:
 *   post:
 *     summary: Handle failed payment notification
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - razorpay_order_id
 *               - error
 *             properties:
 *               orderId:
 *                 type: string
 *               razorpay_order_id:
 *                 type: string
 *               error:
 *                 type: object
 *     responses:
 *       200:
 *         description: Payment failure recorded successfully
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Payment not found
 *       500:
 *         description: Internal server error
 */
router.post('/payment-failed', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, razorpay_order_id, error } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Find the payment record
    const payment = await prisma.payment.findFirst({
      where: {
        order: {
          id: orderId,
          userId: userId,
        },
        gatewayOrderId: razorpay_order_id,
        status: 'PENDING',
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    // Update payment status to failed
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: error.description || 'Payment failed',
      },
    });

    // Update daily revenue report for failed payments
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.revenueReport.upsert({
      where: { date: today },
      create: {
        date: today,
        failedPayments: 1,
      },
      update: {
        failedPayments: {
          increment: 1,
        },
      },
    });

    res.json({
      success: true,
      message: 'Payment failure recorded successfully',
    });
  } catch (error) {
    console.error('Error handling payment failure:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * @swagger
 * /api/v1/payments/refund:
 *   post:
 *     summary: Create a refund for a payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentId
 *               - reason
 *             properties:
 *               paymentId:
 *                 type: string
 *               amount:
 *                 type: number
 *                 description: Refund amount (if partial refund)
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Refund initiated successfully
 *       400:
 *         description: Invalid request data
 *       403:
 *         description: Unauthorized to refund this payment
 *       404:
 *         description: Payment not found
 *       500:
 *         description: Internal server error
 */
router.post('/refund', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { paymentId, amount, reason } = refundSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Find the payment record
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        order: {
          userId: userId,
        },
        status: 'COMPLETED',
      },
      include: {
        order: true,
        refunds: true,
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found or not eligible for refund',
      });
    }

    if (!payment.gatewayPaymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID not found for refund',
      });
    }

    // Calculate refund amount
    const totalRefunded = payment.refunds.reduce((sum, refund) => {
      return refund.status === 'COMPLETED' ? sum + Number(refund.amount) : sum;
    }, 0);

    const maxRefundAmount = Number(payment.amount) - totalRefunded;
    const refundAmount = amount ? Math.min(amount, maxRefundAmount) : maxRefundAmount;

    if (refundAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No amount available for refund',
      });
    }

    // Create refund with Razorpay
    const refundResult = await createRefund(
      payment.gatewayPaymentId,
      convertToPaise(refundAmount),
      { reason, orderId: payment.orderId }
    );

    if (!refundResult.success || !refundResult.refund) {
      return res.status(500).json({
        success: false,
        message: 'Failed to initiate refund',
        error: refundResult.error,
      });
    }

    // Create refund record in database
    const refund = await prisma.refund.create({
      data: {
        paymentId: paymentId,
        amount: refundAmount,
        reason: reason,
        status: 'PROCESSING',
        gatewayRefundId: refundResult.refund.id,
      },
    });

    // Update payment status if fully refunded
    const newTotalRefunded = totalRefunded + refundAmount;
    const isFullyRefunded = newTotalRefunded >= Number(payment.amount);

    if (isFullyRefunded) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'REFUNDED',
          refundedAt: new Date(),
        },
      });
    } else {
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'PARTIAL_REFUND',
        },
      });
    }

    res.json({
      success: true,
      message: 'Refund initiated successfully',
      refund: {
        id: refund.id,
        amount: refund.amount,
        status: refund.status,
        gatewayRefundId: refund.gatewayRefundId,
      },
    });
  } catch (error) {
    console.error('Error creating refund:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * @swagger
 * /api/v1/payments/status/{paymentId}:
 *   get:
 *     summary: Get payment status and details
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment ID
 *     responses:
 *       200:
 *         description: Payment details retrieved successfully
 *       404:
 *         description: Payment not found
 *       500:
 *         description: Internal server error
 */
router.get('/status/:paymentId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        order: {
          userId: userId,
        },
      },
      include: {
        order: {
          select: {
            id: true,
            total: true,
            status: true,
          },
        },
        refunds: true,
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    res.json({
      success: true,
      payment: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        transactionId: payment.transactionId,
        paidAt: payment.paidAt,
        failedAt: payment.failedAt,
        failureReason: payment.failureReason,
        refunds: payment.refunds.map(refund => ({
          id: refund.id,
          amount: refund.amount,
          status: refund.status,
          reason: refund.reason,
          processedAt: refund.processedAt,
        })),
        order: payment.order,
      },
    });
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     summary: Handle Razorpay webhook events
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *               payload:
 *                 type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook payload
 *       500:
 *         description: Internal server error
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { event, payload } = req.body;

    console.log('Received Razorpay webhook:', { event, payload });

    // Verify webhook signature (optional but recommended)
    // const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    // if (webhookSecret) {
    //   const signature = req.headers['x-razorpay-signature'];
    //   const expectedSignature = crypto.createHmac('sha256', webhookSecret)
    //     .update(JSON.stringify(req.body))
    //     .digest('hex');
    //   
    //   if (signature !== expectedSignature) {
    //     return res.status(400).json({ success: false, message: 'Invalid signature' });
    //   }
    // }

    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payload.payment.entity);
        break;
      case 'payment.failed':
        await handlePaymentFailed(payload.payment.entity);
        break;
      case 'refund.created':
        await handleRefundCreated(payload.refund.entity);
        break;
      default:
        console.log('Unhandled webhook event:', event);
    }

    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Webhook handler functions
async function handlePaymentCaptured(payment: any) {
  try {
    await prisma.payment.updateMany({
      where: {
        gatewayPaymentId: payment.id,
      },
      data: {
        status: 'COMPLETED',
        paidAt: new Date(),
        transactionId: payment.acquirer_data?.bank_transaction_id,
        bankRefNumber: payment.acquirer_data?.rrn,
        cardLast4: payment.card?.last4,
        cardBrand: payment.card?.network,
        bankName: payment.card?.issuer,
      },
    });

    // Update order status
    const paymentRecord = await prisma.payment.findFirst({
      where: { gatewayPaymentId: payment.id },
      include: { order: true },
    });

    if (paymentRecord) {
      await prisma.order.update({
        where: { id: paymentRecord.orderId },
        data: { status: 'CONFIRMED' },
      });
    }
  } catch (error) {
    console.error('Error handling payment captured webhook:', error);
  }
}

async function handlePaymentFailed(payment: any) {
  try {
    await prisma.payment.updateMany({
      where: {
        gatewayPaymentId: payment.id,
      },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: payment.error_description || 'Payment failed',
      },
    });

    // Update order status
    const paymentRecord = await prisma.payment.findFirst({
      where: { gatewayPaymentId: payment.id },
      include: { order: true },
    });

    if (paymentRecord) {
      await prisma.order.update({
        where: { id: paymentRecord.orderId },
        data: { status: 'CANCELLED' },
      });
    }
  } catch (error) {
    console.error('Error handling payment failed webhook:', error);
  }
}

async function handleRefundCreated(refund: any) {
  try {
    const payment = await prisma.payment.findFirst({
      where: { gatewayPaymentId: refund.payment_id },
    });

    if (payment) {
      await prisma.refund.create({
        data: {
          paymentId: payment.id,
          amount: refund.amount,
          status: refund.status.toUpperCase(),
          reason: 'Webhook refund',
          gatewayRefundId: refund.id,
          processedAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error('Error handling refund created webhook:', error);
  }
}

export default router;
