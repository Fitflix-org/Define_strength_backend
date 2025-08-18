import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { createRazorpayOrder, verifyRazorpaySignature, convertToPaise } from '../utils/razorpayUtils';

const router = Router();

// Schemas
const createOrderSchema = z.object({
    items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
    })).min(1),
    shippingAddress: z.object({
        firstName: z.string(),
        lastName: z.string(),
        address: z.string(),
        city: z.string(),
        state: z.string(),
        zipCode: z.string(),
        country: z.string(),
        phone: z.string().optional(),
    }),
});

const verifySchema = z.object({
    razorpay_order_id: z.string(),
    razorpay_payment_id: z.string(),
    razorpay_signature: z.string(),
    orderId: z.string().optional(),
});

const paymentFailedSchema = z.object({
    orderId: z.string().optional(),
    razorpay_order_id: z.string().optional(),
    error: z.any().optional(),
});

const retrySchema = z.object({
    orderId: z.string(),
});

// POST /orders/create → Create order in DB + Razorpay order
router.post('/create', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { items, shippingAddress } = createOrderSchema.parse(req.body);

        // Fetch products and validate stock
        const productIds = items.map(i => i.productId);
        const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
        if (products.length !== items.length) {
            return res.status(400).json({ error: 'One or more products not found' });
        }
        for (const item of items) {
            const product = products.find(p => p.id === item.productId)!;
            if (product.stock < item.quantity) {
                return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
            }
        }

        // Compute totals
        const subtotal = items.reduce((sum, item) => {
            const product = products.find(p => p.id === item.productId)!;
            const price = product.salePrice || product.price;
            return sum + Number(price) * item.quantity;
        }, 0);
        const tax = 0; // Include tax/shipping in product prices for simplicity
        const total = Number((subtotal + tax).toFixed(2));

        // 1) Create order in DB (PENDING)
        const order = await prisma.order.create({
            data: {
                userId,
                orderNumber: `ORD-${Date.now()}`,
                status: 'PENDING' as any,
                total,
                shippingFirstName: shippingAddress.firstName,
                shippingLastName: shippingAddress.lastName,
                shippingAddress: shippingAddress.address,
                shippingCity: shippingAddress.city,
                shippingState: shippingAddress.state,
                shippingZipCode: shippingAddress.zipCode,
                shippingCountry: shippingAddress.country,
                shippingPhone: shippingAddress.phone,
                items: {
                    create: items.map(i => ({
                        productId: i.productId,
                        quantity: i.quantity,
                        price: products.find(p => p.id === i.productId)!.salePrice || products.find(p => p.id === i.productId)!.price,
                    })),
                },
            },
            include: { items: true },
        });

        // 2) Create Razorpay order
        const rp = await createRazorpayOrder({
            amount: convertToPaise(total),
            currency: 'INR',
            receipt: order.id,
            notes: { orderId: order.id, userId },
        });

        if (!rp.success || !rp.order) {
            // Compensate: delete order if Razorpay creation failed
            await prisma.order.delete({ where: { id: order.id } });
            return res.status(502).json({ error: 'Failed to create Razorpay order', details: rp.error });
        }

        // 3) Update order with Razorpay order ID and mark payment initiated
        const updated = await prisma.order.update({
            where: { id: order.id },
            data: {
                status: 'PAYMENT_INITIATED' as any,
                razorpayOrderId: rp.order.id,
            },
            include: { items: { include: { product: true } } },
        });

        return res.status(201).json({
            order: {
                id: updated.id,
                orderNumber: updated.orderNumber,
                userId: updated.userId,
                status: 'payment_initiated',
                total: Number(updated.total),
                items: updated.items.map((item) => ({
                    id: item.id,
                    orderId: item.orderId,
                    productId: item.productId,
                    quantity: item.quantity,
                    price: Number(item.price),
                    product: {
                        id: item.product.id,
                        name: item.product.name,
                        images: item.product.images,
                    },
                })),
                razorpayOrderId: updated.razorpayOrderId,
                createdAt: updated.createdAt,
            },
            razorpay: {
                orderId: rp.order.id,
                amount: rp.order.amount,
                currency: rp.order.currency,
                key: process.env.RAZORPAY_KEY_ID,
            },
        });
    } catch (error) {
        console.error('Create order error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /orders/verify → Verify Razorpay payment signature and confirm order
router.post('/verify', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = verifySchema.parse(req.body);

        // Find order by provided orderId or by razorpayOrderId
        const order = await prisma.order.findFirst({
            where: orderId ? { id: orderId, userId } : { razorpayOrderId: razorpay_order_id, userId },
            include: { items: true },
        });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const valid = verifyRazorpaySignature({
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        });
        if (!valid) {
            await prisma.order.update({
                where: { id: order.id },
                data: { status: 'FAILED' as any, razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature },
            });
            return res.status(400).json({ error: 'Invalid signature' });
        }

        // On success: decrement stock, clear cart, confirm order
        await prisma.$transaction(async (tx) => {
            // Decrement stock per item
            for (const item of order.items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { decrement: item.quantity } },
                });
            }

            // Confirm order and store payment fields
            await tx.order.update({
                where: { id: order.id },
                data: {
                    status: 'CONFIRMED' as any,
                    razorpayPaymentId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature,
                },
            });

            // Clear user's cart
            await tx.cartItem.deleteMany({ where: { cart: { userId } } });
        });

        return res.json({ success: true });
    } catch (error) {
        console.error('Verify order error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /orders/payment-failed → Mark initiated payments as failed (user cancelled or gateway failure)
router.post('/payment-failed', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { orderId, razorpay_order_id, error } = paymentFailedSchema.parse(req.body);

        const order = await prisma.order.findFirst({
            where: orderId ? { id: orderId, userId } : { razorpayOrderId: razorpay_order_id || '', userId },
        });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        if (String(order.status) !== 'PAYMENT_INITIATED') {
            return res.status(400).json({ error: 'Order is not in payment initiated state' });
        }

        await prisma.order.update({
            where: { id: order.id },
            data: { status: 'FAILED' as any },
        });

        return res.json({ success: true });
    } catch (e) {
        console.error('Payment failed handler error:', e);
        if (e instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: e.errors });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /orders/:id/retry → Recreate Razorpay order for a failed/pending order
router.post('/:id/retry', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { id } = req.params;
        const order = await prisma.order.findFirst({ where: { id, userId } });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const status = String(order.status);
        if (!['PENDING', 'FAILED', 'PAYMENT_INITIATED'].includes(status)) {
            return res.status(400).json({ error: 'Order not eligible for retry' });
        }

        // Create new Razorpay order
        const rp = await createRazorpayOrder({
            amount: convertToPaise(Number(order.total)),
            currency: 'INR',
            receipt: order.id,
            notes: { orderId: order.id, userId },
        });
        if (!rp.success || !rp.order) {
            return res.status(502).json({ error: 'Failed to create Razorpay order', details: rp.error });
        }

        // Update order to PAYMENT_INITIATED and set new razorpayOrderId
        await prisma.order.update({
            where: { id: order.id },
            data: { status: 'PAYMENT_INITIATED' as any, razorpayOrderId: rp.order.id },
        });

        return res.json({
            success: true,
            order: {
                id: order.id,
                orderNumber: order.orderNumber,
                userId: order.userId,
                status: 'payment_initiated',
                total: Number(order.total),
                razorpayOrderId: rp.order.id,
            },
            razorpay: {
                orderId: rp.order.id,
                amount: rp.order.amount,
                currency: rp.order.currency,
                key: process.env.RAZORPAY_KEY_ID,
            },
        });
    } catch (e) {
        console.error('Retry order error:', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /orders/:id → Fetch order details for user
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { id } = req.params;

        const order = await prisma.order.findFirst({
            where: { id, userId },
            include: { items: { include: { product: true } } },
        });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        return res.json({
            id: order.id,
            orderNumber: order.orderNumber,
            userId: order.userId,
            status: String(order.status).toLowerCase(),
            total: Number(order.total),
            items: order.items.map((item) => ({
                id: item.id,
                orderId: item.orderId,
                productId: item.productId,
                quantity: item.quantity,
                price: Number(item.price),
                product: { id: item.product.id, name: item.product.name, images: item.product.images },
            })),
            razorpayOrderId: order.razorpayOrderId,
            razorpayPaymentId: order.razorpayPaymentId || undefined,
            razorpaySignature: order.razorpaySignature || undefined,
            createdAt: order.createdAt,
        });
    } catch (error) {
        console.error('Get order error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /orders/user/:userId → Fetch all orders for a user
router.get('/user/:userId', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const authUserId = (req.userId || req.user?.id) as string | undefined;
        let { userId } = req.params as { userId: string };
        if (userId === 'me') userId = authUserId || '';
        if (!authUserId || authUserId !== userId) return res.status(403).json({ error: 'Forbidden' });

        const orders = await prisma.order.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: { items: { include: { product: true } } },
        });

        return res.json(orders.map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            userId: order.userId,
            status: String(order.status).toLowerCase(),
            total: Number(order.total),
            items: order.items.map((item) => ({
                id: item.id,
                orderId: item.orderId,
                productId: item.productId,
                quantity: item.quantity,
                price: Number(item.price),
                product: { id: item.product.id, name: item.product.name, images: item.product.images },
            })),
            razorpayOrderId: order.razorpayOrderId,
            createdAt: order.createdAt,
        })));
    } catch (error) {
        console.error('Get user orders error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;


