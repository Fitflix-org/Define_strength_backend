import { Router } from 'express';
import { PrismaClient, OrderStatus } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Create order schema
const createOrderSchema = z.object({
  shippingAddress: z.object({
    firstName: z.string(),
    lastName: z.string(),
    address: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string(),
    phone: z.string().optional(),
  })
});

// Create order from cart
router.post('/create', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { shippingAddress } = createOrderSchema.parse(req.body);
    const userId = req.userId!;

    // Get user's cart with items
    const cart = await prisma.cart.findFirst({
      where: { userId },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Validate stock for all items
    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${item.product.name}` 
        });
      }
    }

    // Calculate totals
    const subtotal = cart.items.reduce((sum, item) => {
      const price = item.product.salePrice || item.product.price;
      return sum + (parseFloat(price.toString()) * item.quantity);
    }, 0);

    const shippingCost = subtotal > 100 ? 0 : 9.99; // Free shipping over $100
    const tax = subtotal * 0.08; // 8% tax
    const total = subtotal + shippingCost + tax;

    // Create order within transaction
    const [order] = await prisma.$transaction([
      prisma.order.create({
        data: {
          userId,
          total: parseFloat(total.toFixed(2)),
          shippingCost: parseFloat(shippingCost.toFixed(2)),
          tax: parseFloat(tax.toFixed(2)),
          status: OrderStatus.PENDING,
          shippingFirstName: shippingAddress.firstName,
          shippingLastName: shippingAddress.lastName,
          shippingAddress: shippingAddress.address,
          shippingCity: shippingAddress.city,
          shippingState: shippingAddress.state,
          shippingZipCode: shippingAddress.zipCode,
          shippingCountry: shippingAddress.country,
          shippingPhone: shippingAddress.phone,
          items: {
            create: cart.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.product.salePrice || item.product.price
            }))
          }
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      }),
      ...cart.items.map(item =>
        prisma.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } }
        })
      ),
      prisma.cartItem.deleteMany({
        where: { cartId: cart.id }
      })
    ]);

    // Set order expiration in 30 minutes
    await prisma.orderExpiry.create({
      data: {
        orderId: order.id,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      }
    });

    // Transform order to match frontend interface
    const transformedOrder = {
      id: order.id,
      orderNumber: `ORD-${order.id.slice(-8).toUpperCase()}`,
      userId: order.userId,
      status: order.status.toLowerCase(),
      total: parseFloat(order.total.toString()),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map(item => ({
        id: item.id,
        orderId: item.orderId,
        productId: item.productId,
        quantity: item.quantity,
        price: parseFloat(item.price.toString()),
        product: {
          id: item.product.id,
          name: item.product.name,
          images: item.product.images
        }
      }))
    };

    res.status(201).json({
      message: 'Order created successfully',
      order: transformedOrder
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error',
        redirect: '/checkout',
        details: error.errors 
      });
    }
    console.error('Order creation failed:', error);
    
    // Revert inventory on failure
    if (order?.id) {
      await prisma.$transaction([
        prisma.order.delete({ where: { id: order.id } }),
        ...cart.items.map(item =>
          prisma.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } }
          })
        )
      ]);
    }
    
    res.status(500).json({ 
      error: 'Payment processing failed',
      redirect: '/checkout',
      message: 'Could not complete order. Please try again.'
    });
  }
});

// Get user's orders
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { page = '1', limit = '10' } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: true
                }
              }
            }
          }
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.order.count({ where: { userId } })
    ]);

    // Transform orders to match frontend interface
    const transformedOrders = orders.map(order => ({
      id: order.id,
      orderNumber: `ORD-${order.id.slice(-8).toUpperCase()}`, // Generate order number from ID
      userId: order.userId,
      status: order.status.toLowerCase(), // Convert to lowercase for frontend
      total: parseFloat(order.total.toString()),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map(item => ({
        id: item.id,
        orderId: item.orderId,
        productId: item.productId,
        quantity: item.quantity,
        price: parseFloat(item.price.toString()),
        product: {
          id: item.product.id,
          name: item.product.name,
          images: item.product.images
        }
      }))
    }));

    // Return just the orders array (not wrapped in an object) for compatibility with frontend
    res.json(transformedOrders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single order
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const order = await prisma.order.findFirst({
      where: { 
        id,
        userId
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Transform order to match frontend interface
    const transformedOrder = {
      id: order.id,
      orderNumber: `ORD-${order.id.slice(-8).toUpperCase()}`,
      userId: order.userId,
      status: order.status.toLowerCase(),
      total: parseFloat(order.total.toString()),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map(item => ({
        id: item.id,
        orderId: item.orderId,
        productId: item.productId,
        quantity: item.quantity,
        price: parseFloat(item.price.toString()),
        product: {
          id: item.product.id,
          name: item.product.name,
          images: item.product.images
        }
      }))
    };

    res.json(transformedOrder);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update order status
const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
});

router.patch('/:id/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = updateOrderStatusSchema.parse(req.body);
    const userId = req.userId!;

    // Convert status to uppercase for database
    const statusMap: Record<string, OrderStatus> = {
      'pending': OrderStatus.PENDING,
      'processing': OrderStatus.PROCESSING, 
      'shipped': OrderStatus.SHIPPED,
      'delivered': OrderStatus.DELIVERED,
      'cancelled': OrderStatus.CANCELLED
    };
    const dbStatus = statusMap[status];

    const order = await prisma.order.findFirst({
      where: { 
        id,
        userId
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { 
        status: dbStatus,
        updatedAt: new Date()
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true
              }
            }
          }
        }
      }
    });

    // Transform response to match frontend interface
    const transformedOrder = {
      id: updatedOrder.id,
      orderNumber: `ORD-${updatedOrder.id.slice(-8).toUpperCase()}`,
      userId: updatedOrder.userId,
      status: updatedOrder.status.toLowerCase(),
      total: parseFloat(updatedOrder.total.toString()),
      createdAt: updatedOrder.createdAt.toISOString(),
      updatedAt: updatedOrder.updatedAt.toISOString(),
      items: updatedOrder.items.map(item => ({
        id: item.id,
        orderId: item.orderId,
        productId: item.productId,
        quantity: item.quantity,
        price: parseFloat(item.price.toString()),
        product: {
          id: item.product.id,
          name: item.product.name,
          images: item.product.images
        }
      }))
    };

    res.json({
      message: 'Order status updated successfully',
      order: transformedOrder
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
