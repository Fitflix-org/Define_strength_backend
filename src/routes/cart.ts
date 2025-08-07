import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Add item to cart
const addToCartSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(1).default(1),
});

router.post('/add', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { productId, quantity } = addToCartSchema.parse(req.body);
    const userId = req.userId!;

    // Check if product exists and is active
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product || !product.active) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check stock
    if (product.stock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    // Find or create user's cart
    let cart = await prisma.cart.findFirst({
      where: { userId }
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId }
      });
    }

    // Check if item already exists in cart
    const existingCartItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId
        }
      }
    });

    if (existingCartItem) {
      // Update quantity
      const newQuantity = existingCartItem.quantity + quantity;
      
      if (newQuantity > product.stock) {
        return res.status(400).json({ error: 'Cannot add more items than available stock' });
      }

      await prisma.cartItem.update({
        where: { id: existingCartItem.id },
        data: { quantity: newQuantity }
      });
    } else {
      // Create new cart item
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity
        }
      });
    }

    res.json({ message: 'Item added to cart successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get cart items
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const cart = await prisma.cart.findFirst({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    if (!cart) {
      return res.json({ cart: { items: [], total: 0 } });
    }

    // Calculate total
    const total = cart.items.reduce((sum, item) => {
      const price = item.product.salePrice || item.product.price;
      return sum + (parseFloat(price.toString()) * item.quantity);
    }, 0);

    res.json({
      cart: {
        id: cart.id,
        items: cart.items,
        total: parseFloat(total.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update cart item quantity
const updateQuantitySchema = z.object({
  quantity: z.number().min(0),
});

router.put('/items/:itemId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = updateQuantitySchema.parse(req.body);
    const userId = req.userId!;

    // Find cart item and verify ownership
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId }
      },
      include: {
        product: true
      }
    });

    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    if (quantity === 0) {
      // Remove item from cart
      await prisma.cartItem.delete({
        where: { id: itemId }
      });
      return res.json({ message: 'Item removed from cart' });
    }

    // Check stock
    if (quantity > cartItem.product.stock) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    // Update quantity
    await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity }
    });

    res.json({ message: 'Cart item updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update cart item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove item from cart
router.delete('/items/:itemId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.userId!;

    // Find cart item and verify ownership
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId }
      }
    });

    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    await prisma.cartItem.delete({
      where: { id: itemId }
    });

    res.json({ message: 'Item removed from cart successfully' });
  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear cart
router.delete('/clear', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const cart = await prisma.cart.findFirst({
      where: { userId }
    });

    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id }
      });
    }

    res.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
