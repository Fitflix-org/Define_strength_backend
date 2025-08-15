// src/routes/payments.routes.ts
import express, { Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { PrismaClient, RefundStatus } from "@prisma/client";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import {
  createRazorpayOrder,
  getPaymentDetails,
  getOrderDetails,
  createRefund,
  convertToPaise,
  convertToINR,
} from "../utils/razorpayUtils";

const router = express.Router();
const prisma = new PrismaClient();

/* ----------------------------- Zod Schemas ----------------------------- */

const createOrderSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
});

const verifyPaymentSchema = z.object({
<<<<<<< Updated upstream
  razorpay_order_id: z.string().min(1, 'Razorpay order ID is required'),
  razorpay_payment_id: z.string().min(1, 'Razorpay payment ID is required'),
  razorpay_signature: z.string().min(1, 'Razorpay signature is required'),
=======
  order_id: z.string().min(1, "Order ID is required"),
  razorpay_order_id: z.string().min(1, "Razorpay order ID is required"),
  razorpay_payment_id: z.string().min(1, "Razorpay payment ID is required"),
  razorpay_signature: z.string().min(1, "Razorpay signature is required"),
});

const paymentFailedSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  razorpay_order_id: z.string().min(1, "Razorpay order ID is required"),
  error: z
    .object({
      code: z.string().optional(),
      description: z.string().optional(),
      source: z.string().optional(),
      step: z.string().optional(),
      reason: z.string().optional(),
      metadata: z.record(z.any()).optional(),
    })
    .passthrough(),
>>>>>>> Stashed changes
});

const refundSchema = z.object({
  paymentId: z.string().min(1, "Payment ID is required"),
  amount: z.number().positive("Amount must be positive").optional(),
  reason: z.string().min(1, "Refund reason is required"),
});

/* ------------------------------ Utilities ------------------------------ */

function verifyRazorpaySignature({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return expectedSignature === razorpay_signature;
}

function startOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ----------------------------- Create Order ---------------------------- */
/**
 * POST /api/payments/create-razorpay-order
 * Body: { order_id }
 */
router.post(
  "/create-razorpay-order",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const data = req.body.data;
      console.log(data);
      const { order_id } = createOrderSchema.parse(data); // zodd verifying schema
      const userId = data.userId;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
      }

      const order = await prisma.order.findFirst({
        where: { id: order_id, userId, status: "PENDING" },
        include: { payments: true, items: true },
      });

      if (!order) {
        return res
          .status(404)
          .json({
            success: false,
            message: "Order not found or not eligible for payment",
          });
      }

      // Idempotency: if a completed payment exists, block re-creation
      if (order.payments.some((p) => p.status === "COMPLETED")) {
        return res
          .status(400)
          .json({ success: false, message: "Order has already been paid" });
      }

<<<<<<< Updated upstream
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
=======
      // If a pending payment already exists for this order & gateway order, you may reuse it.
      const existingPending = order.payments.find(
        (p) => p.status === "PENDING"
      );
      if (existingPending?.gatewayOrderId) {
        return res.json({
          success: true,
          message: "Reusing existing pending payment",
          razorpayOrder: {
            id: existingPending.gatewayOrderId,
            amount: convertToPaise(Number(order.total)),
            currency: "INR",
            receipt: `order_${order_id}`,
>>>>>>> Stashed changes
          },
          paymentId: existingPending.id,
          key: process.env.RAZORPAY_KEY_ID,
        });
      }

      // Create Razorpay order
      const rzp = await createRazorpayOrder({
        amount: convertToPaise(Number(order.total)),
        currency: "INR",
        receipt: `order_${order_id}`,
        notes: { order_id, userId },
      });

      if (!rzp.success || !rzp.order) {
        return res.status(502).json({
          success: false,
          message: "Failed to create payment order with Razorpay",
          error: rzp.error,
        });
      }

      const payment = await prisma.payment.create({
        data: {
          orderId: order_id,
          amount: order.total,
          currency: "INR",
          paymentMethod: "online",
          gatewayProvider: "razorpay",
          gatewayOrderId: rzp.order.id, // IMPORTANT: matches field used elsewhere
          status: "PENDING",
        },
      });

      return res.json({
        success: true,
        message: "Payment order created successfully",
        razorpayOrder: {
          id: rzp.order.id,
          amount: rzp.order.amount,
          currency: rzp.order.currency,
          receipt: rzp.order.receipt,
        },
        paymentId: payment.id,
        key: process.env.RAZORPAY_KEY_ID,
      });
    } catch (error) {
      console.error("Error creating payment order:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid request data",
          errors: error.errors,
        });
      }
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }
);

/* ---------------------------- Verify Payment --------------------------- */
/**
 * POST /api/payments/verify-payment
 * Body: { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
router.post(
  "/verify-payment",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        order_id,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = verifyPaymentSchema.parse(req.body);

      const userId = req.user?.id;
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
      }

      // Find the pending payment record for this order
      const payment = await prisma.payment.findFirst({
        where: {
          order: { id: order_id, userId },
          gatewayOrderId: razorpay_order_id,
          // Accept PENDING or already COMPLETED to ensure idempotent verification
          status: { in: ["PENDING", "COMPLETED"] },
        },
        include: { order: { include: { items: true } } },
      });

      if (!payment) {
        return res
          .status(404)
          .json({
            success: false,
            message: "Payment not found or already processed",
          });
      }

<<<<<<< Updated upstream
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
=======
      // If already completed, respond idempotently
      if (payment.status === "COMPLETED") {
        return res.json({
          success: true,
          message: "Payment already verified",
          payment: {
            id: payment.id,
            status: payment.status,
            amount: payment.amount,
            transactionId: payment.gatewayPaymentId,
            paidAt: payment.paidAt,
          },
        });
      }

      // Verify signature
      const valid = verifyRazorpaySignature({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      });

      if (!valid) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "FAILED",
            failedAt: new Date(),
            failureReason: "Invalid signature verification",
          },
        });
        return res
          .status(400)
          .json({ success: false, message: "Invalid payment signature" });
      }

      // Fetch payment details from Razorpay
      const paymentDetailsResult = await getPaymentDetails(razorpay_payment_id);
      if (!paymentDetailsResult.success || !paymentDetailsResult.payment) {
        return res.status(502).json({
          success: false,
          message: "Failed to fetch payment details from Razorpay",
        });
      }

      const details = paymentDetailsResult.payment;
      const gatewayFeeInINR = details.fee ? convertToINR(details.fee) : 0;
      const netAmount = Number(payment.amount) - gatewayFeeInINR;

      // Update DB atomically
      await prisma.$transaction(async (tx) => {
        // Update payment
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "COMPLETED",
            gatewayPaymentId: razorpay_payment_id,
            gatewaySignature: razorpay_signature,
            transactionId: details.id,
            paymentMethod: details.method,
            cardLast4: details.card?.last4 || null,
            cardBrand: details.card?.network || null,
            bankName: details.bank || null,
            gatewayFee: gatewayFeeInINR || null,
            netAmount,
            paidAt: new Date(),
          },
        });

        // Update order
        await tx.order.update({
          where: { id: order_id },
          data: { status: "CONFIRMED" },
        });

        // Upsert revenue report
        const day = startOfDay();
        await tx.revenueReport.upsert({
          where: { date: day },
          create: {
            date: day,
            totalRevenue: Number(payment.amount),
            netRevenue: netAmount,
            gatewayFees: gatewayFeeInINR,
            totalOrders: 1,
            successfulPayments: 1,
            failedPayments: 0,
            totalItemsSold: payment.order.items?.length || 0,
            averageOrderValue: Number(payment.amount),
          },
          update: {
            totalRevenue: { increment: Number(payment.amount) },
            netRevenue: { increment: netAmount },
            gatewayFees: { increment: gatewayFeeInINR },
            totalOrders: { increment: 1 },
            successfulPayments: { increment: 1 },
            totalItemsSold: { increment: payment.order.items?.length || 0 },
          },
        });
      });

      return res.json({
        success: true,
        message: "Payment verified and completed successfully",
        payment: {
          id: payment.id,
          status: "COMPLETED",
          amount: payment.amount,
          transactionId: razorpay_payment_id,
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream

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
=======
    } catch (error) {
      console.error("Error verifying payment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid request data",
          errors: error.errors,
        });
      }
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
>>>>>>> Stashed changes
    }
  }
);

/* -------------------------- Record Payment Failed -------------------------- */
/**
 * POST /api/payments/payment-failed
 * Body: { order_id, razorpay_order_id, error }
 */
router.post(
  "/payment-failed",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { order_id, razorpay_order_id, error } = paymentFailedSchema.parse(
        req.body
      );
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
      }

      const payment = await prisma.payment.findFirst({
        where: {
          order: { id: order_id, userId },
          gatewayOrderId: razorpay_order_id,
          status: "PENDING",
        },
      });

      // If not found, respond 200 to avoid client retries spamming
      if (!payment) {
        return res.status(200).json({
          success: true,
          message: "No pending payment found to mark as failed",
        });
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          failureReason:
            error?.description ||
            error?.reason ||
            error?.code ||
            "Payment failed (client reported)",
        },
      });

      // Increment failedPayments counter
      const day = startOfDay();
      await prisma.revenueReport.upsert({
        where: { date: day },
        create: { date: day, failedPayments: 1 },
        update: { failedPayments: { increment: 1 } },
      });

      return res.json({
        success: true,
        message: "Payment failure recorded successfully",
      });
    } catch (error) {
      console.error("Error handling payment failure:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid request data",
          errors: error.errors,
        });
      }
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }
);

/* --------------------------------- Refund --------------------------------- */
/**
 * POST /api/payments/refund
 * Body: { paymentId, amount?, reason }
 */
router.post(
  "/refund",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { paymentId, amount, reason } = refundSchema.parse(req.body);
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
      }

      const payment = await prisma.payment.findFirst({
        where: { id: paymentId, order: { userId }, status: "COMPLETED" },
        include: { order: true, refunds: true },
      });

      if (!payment) {
        return res
          .status(404)
          .json({
            success: false,
            message: "Payment not found or not eligible for refund",
          });
      }

      if (!payment.gatewayPaymentId) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Payment gateway ID not found for refund",
          });
      }

      // Calculate allowable refund
      const totalRefunded = payment.refunds.reduce(
        (sum, r) => (r.status === "COMPLETED" ? sum + Number(r.amount) : sum),
        0
      );
      const maxRefundAmount = Number(payment.amount) - totalRefunded;
      const refundAmount = amount
        ? Math.min(amount, maxRefundAmount)
        : maxRefundAmount;

      if (refundAmount <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "No amount available for refund" });
      }

      const result = await createRefund(
        payment.gatewayPaymentId,
        convertToPaise(refundAmount),
        { reason, order_id: payment.orderId }
      );

      if (!result.success || !result.refund) {
        return res.status(502).json({
          success: false,
          message: "Failed to initiate refund with Razorpay",
          error: result.error,
        });
      }

      const refund = await prisma.refund.create({
        data: {
          paymentId,
          amount: refundAmount,
          reason,
          status: "PROCESSING",
          gatewayRefundId: result.refund.id,
        },
      });

      // Update payment status if fully refunded
      const newTotalRefunded = totalRefunded + refundAmount;
      const fullyRefunded = newTotalRefunded >= Number(payment.amount);

      await prisma.payment.update({
        where: { id: paymentId },
        data: fullyRefunded
          ? { status: "REFUNDED", refundedAt: new Date() }
          : { status: "PARTIAL_REFUND" },
      });

      return res.json({
        success: true,
        message: "Refund initiated successfully",
        refund: {
          id: refund.id,
          amount: refund.amount,
          status: refund.status,
          gatewayRefundId: refund.gatewayRefundId,
        },
      });
    } catch (error) {
      console.error("Error creating refund:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid request data",
          errors: error.errors,
        });
      }
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }
);

/* ------------------------------- Get Status ------------------------------- */
/**
 * GET /api/payments/status/:paymentId
 */
router.get(
  "/status/:paymentId",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { paymentId } = z
        .object({ paymentId: z.string().min(1) })
        .parse(req.params);
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
      }

      const payment = await prisma.payment.findFirst({
        where: { id: paymentId, order: { userId } },
        include: {
          order: { select: { id: true, total: true, status: true } },
          refunds: true,
        },
      });

      if (!payment) {
        return res
          .status(404)
          .json({ success: false, message: "Payment not found" });
      }

      return res.json({
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
          refunds: payment.refunds.map((r) => ({
            id: r.id,
            amount: r.amount,
            status: r.status,
            reason: r.reason,
            processedAt: r.processedAt,
          })),
          order: payment.order,
        },
      });
    } catch (error) {
      console.error("Error getting payment status:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }
);

/* -------------------------------- Webhook -------------------------------- */
/**
 * POST /api/payments/webhook
 * (Optional signature verification included; enable by setting RAZORPAY_WEBHOOK_SECRET)
 */
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const { event, payload } = req.body || {};

    // Optional: verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers["x-razorpay-signature"] as
        | string
        | undefined;
      const expected = crypto
        .createHmac("sha256", webhookSecret)
        .update(JSON.stringify(req.body))
        .digest("hex");
      if (!signature || signature !== expected) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid webhook signature" });
      }
    }

    switch (event) {
      case "payment.captured":
        await handlePaymentCaptured(payload?.payment?.entity);
        break;
      case "payment.failed":
        await handlePaymentFailed(payload?.payment?.entity);
        break;
      case "refund.created":
        await handleRefundCreated(payload?.refund?.entity);
        break;
      default:
        console.log("Unhandled webhook event:", event);
    }

    return res
      .status(200)
      .json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
});

/* --------------------------- Webhook Handlers ---------------------------- */

async function handlePaymentCaptured(payment: any) {
  if (!payment?.id) return;
  try {
    await prisma.payment.updateMany({
      where: { gatewayPaymentId: payment.id },
      data: {
        status: "COMPLETED",
        paidAt: new Date(),
        transactionId: payment.acquirer_data?.bank_transaction_id,
        bankRefNumber: payment.acquirer_data?.rrn,
        cardLast4: payment.card?.last4 ?? null,
        cardBrand: payment.card?.network ?? null,
        bankName: payment.card?.issuer ?? null,
      },
    });

    const paymentRecord = await prisma.payment.findFirst({
      where: { gatewayPaymentId: payment.id },
      include: { order: true },
    });

    if (paymentRecord?.orderId) {
      await prisma.order.update({
        where: { id: paymentRecord.orderId },
        data: { status: "CONFIRMED" },
      });
    }
  } catch (error) {
    console.error("Error handling payment captured webhook:", error);
  }
}

async function handlePaymentFailed(payment: any) {
  if (!payment?.id) return;
  try {
    await prisma.payment.updateMany({
      where: { gatewayPaymentId: payment.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason: payment.error_description || "Payment failed",
      },
    });

    const paymentRecord = await prisma.payment.findFirst({
      where: { gatewayPaymentId: payment.id },
      include: { order: true },
    });

    if (paymentRecord?.orderId) {
      await prisma.order.update({
        where: { id: paymentRecord.orderId },
        data: { status: "CANCELLED" },
      });
    }
  } catch (error) {
    console.error("Error handling payment failed webhook:", error);
  }
}

async function handleRefundCreated(refund: any) {
  if (!refund?.id || !refund?.payment_id) return;
  try {
    const payment = await prisma.payment.findFirst({
      where: { gatewayPaymentId: refund.payment_id },
    });

    if (payment) {
      await prisma.refund.create({
        data: {
          paymentId: payment.id,
          amount: convertToINR(refund.amount),
          status: refund.status
            ? (refund.status as RefundStatus)
            : ("PROCESSED" as RefundStatus),
          reason: "Webhook refund",
          gatewayRefundId: refund.id,
          processedAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error("Error handling refund created webhook:", error);
  }
}

export default router;
