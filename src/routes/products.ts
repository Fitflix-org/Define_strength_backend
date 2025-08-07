import { Router } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "clxy123abc"
 *         name:
 *           type: string
 *           example: "Adjustable Dumbbell Set"
 *         description:
 *           type: string
 *           example: "High-quality adjustable dumbbells for home workouts"
 *         price:
 *           type: number
 *           format: decimal
 *           example: 299.99
 *         salePrice:
 *           type: number
 *           format: decimal
 *           example: 249.99
 *         sku:
 *           type: string
 *           example: "ADJDB001"
 *         stock:
 *           type: integer
 *           example: 50
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           example: ["image1.jpg", "image2.jpg"]
 *         categoryId:
 *           type: string
 *           example: "clxy456def"
 *         spaceType:
 *           type: string
 *           enum: [home, office, commercial]
 *           example: "home"
 *         featured:
 *           type: boolean
 *           example: true
 *         active:
 *           type: boolean
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         category:
 *           $ref: '#/components/schemas/Category'
 *     Category:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "clxy456def"
 *         name:
 *           type: string
 *           example: "Dumbbells"
 *         description:
 *           type: string
 *           example: "All types of dumbbells"
 *         slug:
 *           type: string
 *           example: "dumbbells"
 *     ProductListResponse:
 *       type: object
 *       properties:
 *         products:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Product'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *               example: 1
 *             limit:
 *               type: integer
 *               example: 12
 *             total:
 *               type: integer
 *               example: 100
 *             pages:
 *               type: integer
 *               example: 9
 * tags:
 *   - name: Products
 *     description: Product management endpoints
 */

const router = Router();
const prisma = new PrismaClient();

// Get all products with filtering
/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products with filtering and pagination
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category slug
 *         example: "dumbbells"
 *       - in: query
 *         name: spaceType
 *         schema:
 *           type: string
 *           enum: [home, office, commercial, all]
 *         description: Filter by space type
 *         example: "home"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in product name and description
 *         example: "dumbbell"
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *         example: 100
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *         example: 500
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *         description: Filter featured products only
 *         example: true
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *         description: Number of products per page
 *         example: 12
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductListResponse'
 *       500:
 *         description: Internal server error
 */
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
