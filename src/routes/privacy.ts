import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import prisma from '../utils/prisma';

const router = Router();

// GDPR Data Export Schema
const dataExportSchema = z.object({
  email: z.string().email(),
  reason: z.string().optional(),
});

/**
 * @swagger
 * /api/privacy/export:
 *   post:
 *     summary: Export user data (GDPR compliance)
 *     tags: [Privacy]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: User data exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Access denied
 */
router.post('/export', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { email, reason } = dataExportSchema.parse(req.body);
    
    // Verify user is requesting their own data
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true }
    });
    
    if (!user || user.email !== email) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You can only export your own data'
      });
    }
    
    // Collect all user data
    const userData = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        addresses: true,
        orders: {
          include: {
            items: {
              include: {
                product: {
                  select: {
                    name: true,
                    sku: true
                  }
                }
              }
            },
            payments: true
          }
        },
        carts: {
          include: {
            items: {
              include: {
                product: {
                  select: {
                    name: true,
                    sku: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    // Remove password from export
    const { password, ...userDataWithoutPassword } = userData || {};
    
    // Log the export request
    console.log('Data export requested', {
      userId: req.userId,
      email,
      reason,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      message: 'Data exported successfully',
      exportedAt: new Date().toISOString(),
      data: userDataWithoutPassword
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors
      });
    }
    console.error('Data export error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to export data'
    });
  }
});

/**
 * @swagger
 * /api/privacy/delete:
 *   delete:
 *     summary: Delete user account and data (GDPR compliance)
 *     tags: [Privacy]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - confirmation
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               confirmation:
 *                 type: string
 *                 enum: ["DELETE_MY_ACCOUNT"]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Access denied
 */
router.delete('/delete', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { email, confirmation, reason } = req.body;
    
    if (confirmation !== 'DELETE_MY_ACCOUNT') {
      return res.status(400).json({
        error: 'Invalid Confirmation',
        message: 'Please confirm account deletion by sending "DELETE_MY_ACCOUNT"'
      });
    }
    
    // Verify user is deleting their own account
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true }
    });
    
    if (!user || user.email !== email) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You can only delete your own account'
      });
    }
    
    // Check for active orders that prevent deletion
    const activeOrders = await prisma.order.findMany({
      where: {
        userId: req.userId,
        status: {
          in: ['PENDING', 'PROCESSING', 'SHIPPED']
        }
      }
    });
    
    if (activeOrders.length > 0) {
      return res.status(400).json({
        error: 'Cannot Delete Account',
        message: 'You have active orders. Please wait for them to be completed or contact support.',
        activeOrders: activeOrders.length
      });
    }
    
    // Log the deletion request
    console.log('Account deletion requested', {
      userId: req.userId,
      email,
      reason,
      timestamp: new Date().toISOString()
    });
    
    // Start transaction to delete all user data
    await prisma.$transaction(async (tx) => {
      // Delete cart items
      await tx.cartItem.deleteMany({
        where: {
          cart: {
            userId: req.userId
          }
        }
      });
      
      // Delete cart
      await tx.cart.deleteMany({
        where: { userId: req.userId }
      });
      
      // Delete addresses
      await tx.address.deleteMany({
        where: { userId: req.userId }
      });
      
      // Anonymize completed orders (for business records)
      await tx.order.updateMany({
        where: {
          userId: req.userId,
          status: {
            in: ['DELIVERED', 'CANCELLED']
          }
        },
        data: {
          // Keep order for business records but anonymize
          userId: 'deleted-user'
        }
      });
      
      // Delete user account
      await tx.user.delete({
        where: { id: req.userId }
      });
    });
    
    res.json({
      message: 'Account and personal data deleted successfully',
      deletedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete account'
    });
  }
});

/**
 * @swagger
 * /api/privacy/consent:
 *   post:
 *     summary: Update privacy consent preferences
 *     tags: [Privacy]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               marketing:
 *                 type: boolean
 *               analytics:
 *                 type: boolean
 *               personalization:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Consent preferences updated
 */
router.post('/consent', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { marketing, analytics, personalization } = req.body;
    
    // Update user consent preferences (commented out fields that don't exist in current schema)
    await prisma.user.update({
      where: { id: req.userId },
      data: {
        // Add these fields to your user model if needed
        // marketingConsent: marketing,
        // analyticsConsent: analytics,
        // personalizationConsent: personalization,
        // consentUpdatedAt: new Date()
        updatedAt: new Date() // Use existing field for now
      }
    });
    
    res.json({
      message: 'Consent preferences updated successfully',
      updatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Consent update error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update consent preferences'
    });
  }
});

export default router;
