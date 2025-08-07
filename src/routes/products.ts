import { Router } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// Get all products with filtering
router.get('/', async (req, res) => {
  try {
    const {
      category,
      spaceType,
      search,
      minPrice,
      maxPrice,
      featured,
      page = '1',
      limit = '12'
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: Prisma.ProductWhereInput = {
      active: true,
    };

    if (category && category !== 'all') {
      where.category = {
        slug: category as string
      };
    }

    if (spaceType && spaceType !== 'all') {
      where.spaceType = spaceType as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice as string);
      if (maxPrice) where.price.lte = parseFloat(maxPrice as string);
    }

    if (featured === 'true') {
      where.featured = true;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.product.count({ where })
    ]);

    res.json({
      products,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
      }
    });

    if (!product || !product.active) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get categories
router.get('/categories/all', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' }
    });

    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get related products
router.get('/:id/related', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = '4' } = req.query;

    // First get the current product to find related ones
    const currentProduct = await prisma.product.findUnique({
      where: { id },
      include: { category: true }
    });

    if (!currentProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Find related products in the same category or space type
    const relatedProducts = await prisma.product.findMany({
      where: {
        AND: [
          { id: { not: id } }, // Exclude current product
          { active: true },
          {
            OR: [
              { categoryId: currentProduct.categoryId },
              { spaceType: currentProduct.spaceType }
            ]
          }
        ]
      },
      include: {
        category: true
      },
      take: parseInt(limit as string),
      orderBy: { createdAt: 'desc' }
    });

    res.json({ products: relatedProducts });
  } catch (error) {
    console.error('Get related products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
