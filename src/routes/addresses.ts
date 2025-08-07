import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const addressSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  addressLine1: z.string().min(1, 'Address line 1 is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(1, 'Zip code is required'),
  country: z.string().default('India'),
  isDefault: z.boolean().default(false),
});

// GET /api/addresses - Get user's addresses
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json({ addresses });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
});

// POST /api/addresses - Create new address
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const validatedData = addressSchema.parse(req.body);

    // If this is being set as default, remove default from other addresses
    if (validatedData.isDefault) {
      await prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false }
      });
    }

    const address = await prisma.address.create({
      data: {
        ...validatedData,
        userId
      }
    });

    res.status(201).json({ address });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create address error:', error);
    res.status(500).json({ error: 'Failed to create address' });
  }
});

// PUT /api/addresses/:id - Update address
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const addressId = req.params.id;
    const validatedData = addressSchema.parse(req.body);

    // Check if address belongs to user
    const existingAddress = await prisma.address.findFirst({
      where: { id: addressId, userId }
    });

    if (!existingAddress) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // If this is being set as default, remove default from other addresses
    if (validatedData.isDefault) {
      await prisma.address.updateMany({
        where: { userId, isDefault: true, id: { not: addressId } },
        data: { isDefault: false }
      });
    }

    const address = await prisma.address.update({
      where: { id: addressId },
      data: validatedData
    });

    res.json({ address });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update address error:', error);
    res.status(500).json({ error: 'Failed to update address' });
  }
});

// DELETE /api/addresses/:id - Delete address
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const addressId = req.params.id;

    // Check if address belongs to user
    const existingAddress = await prisma.address.findFirst({
      where: { id: addressId, userId }
    });

    if (!existingAddress) {
      return res.status(404).json({ error: 'Address not found' });
    }

    await prisma.address.delete({
      where: { id: addressId }
    });

    res.json({ message: 'Address deleted successfully' });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

// POST /api/addresses/:id/set-default - Set address as default
router.post('/:id/set-default', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const addressId = req.params.id;

    // Check if address belongs to user
    const existingAddress = await prisma.address.findFirst({
      where: { id: addressId, userId }
    });

    if (!existingAddress) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // Remove default from all other addresses
    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false }
    });

    // Set this address as default
    const address = await prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true }
    });

    res.json({ address });
  } catch (error) {
    console.error('Set default address error:', error);
    res.status(500).json({ error: 'Failed to set default address' });
  }
});

export default router;
