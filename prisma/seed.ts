import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const categories = [
  {
    name: 'Strength Equipment',
    slug: 'strength',
    description: 'Build muscle and strength with our premium strength training equipment'
  },
  {
    name: 'Cardio Machines',
    slug: 'cardio',
    description: 'Get your heart pumping with our top-of-the-line cardio equipment'
  },
  {
    name: 'Free Weights',
    slug: 'free-weights',
    description: 'Classic free weights for versatile strength training'
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    description: 'Essential accessories to complement your workout'
  },
  {
    name: 'Gym Flooring',
    slug: 'flooring',
    description: 'Professional gym flooring for safety and performance'
  },
  {
    name: 'Equipment Bundles',
    slug: 'bundles',
    description: 'Complete workout solutions at great value'
  },
  {
    name: 'Dumbbells',
    slug: 'dumbbells',
    description: 'Free weights for strength training'
  },
  {
    name: 'Plates',
    slug: 'plates',
    description: 'Weight plates for barbells and machines'
  },
  {
    name: 'Barbells',
    slug: 'barbells',
    description: 'Olympic and standard barbells'
  },
  {
    name: 'Functional Machines',
    slug: 'functional',
    description: 'Cable machines and functional trainers'
  },
  {
    name: 'Urethane Free Weights',
    slug: 'urethane',
    description: 'Premium urethane coated weights'
  }
];

const products = [
  // Strength Equipment
  {
    name: 'Professional Power Rack',
    description: 'Heavy-duty power rack with pull-up bar and safety bars. Perfect for home and commercial gyms.',
    price: 899.99,
    salePrice: 799.99,
    sku: 'PWR-001',
    stock: 15,
    images: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'],
    categorySlug: 'strength',
    spaceType: 'home',
    featured: true
  },
  {
    name: 'Kong Double Rack Rig',
    description: 'Ultimate strength training rig with dual rack stations. Perfect for high-intensity training and multiple users. Features pull-up bars, plate storage, and versatile attachment points.',
    price: 1899.99,
    salePrice: 1699.99,
    sku: 'KNG-001',
    stock: 8,
    images: [
      '/src/assets/Gemini_Generated_Image_2zty5x2zty5x2zty.png',
      '/src/assets/5_Gorilla_power_rack_6-post.jpg'
    ],
    categorySlug: 'strength',
    spaceType: 'commercial',
    featured: true
  },
  {
    name: 'Olympic Barbell Set',
    description: 'Professional Olympic barbell with 300lbs of weight plates.',
    price: 599.99,
    sku: 'OLY-001',
    stock: 25,
    images: ['https://images.unsplash.com/photo-1581009137042-c552e485697a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'],
    categorySlug: 'strength',
    spaceType: 'home',
    featured: true
  },
  {
    name: 'Adjustable Dumbbells',
    description: 'Space-saving adjustable dumbbells from 5-50lbs each.',
    price: 299.99,
    salePrice: 249.99,
    sku: 'ADJ-001',
    stock: 30,
    images: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'],
    categorySlug: 'free-weights',
    spaceType: 'home',
    featured: true
  },

  // Cardio Machines
  {
    name: 'Commercial Treadmill',
    description: 'Heavy-duty commercial treadmill with advanced console and heart rate monitoring.',
    price: 2499.99,
    sku: 'TRD-001',
    stock: 8,
    images: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'],
    categorySlug: 'cardio',
    spaceType: 'commercial',
    featured: false
  },
  {
    name: 'Rowing Machine',
    description: 'Air resistance rowing machine for full-body cardio workout.',
    price: 899.99,
    salePrice: 799.99,
    sku: 'ROW-001',
    stock: 12,
    images: ['https://images.unsplash.com/photo-1544966503-7e9e1d9b6f1c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'],
    categorySlug: 'cardio',
    spaceType: 'home',
    featured: true
  },
  {
    name: 'Exercise Bike',
    description: 'Magnetic resistance exercise bike with digital display.',
    price: 499.99,
    sku: 'BIK-001',
    stock: 20,
    images: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'],
    categorySlug: 'cardio',
    spaceType: 'office',
    featured: false
  },

  // Accessories
  {
    name: 'Yoga Mat Premium',
    description: 'Non-slip premium yoga mat, 6mm thick for extra comfort.',
    price: 49.99,
    sku: 'YOG-001',
    stock: 100,
    images: ['https://images.unsplash.com/photo-1506629905607-46e9e69aa0c6?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'],
    categorySlug: 'accessories',
    spaceType: 'home',
    featured: false
  },
  {
    name: 'Resistance Bands Set',
    description: 'Complete set of resistance bands with door anchor and handles.',
    price: 29.99,
    salePrice: 24.99,
    sku: 'RES-001',
    stock: 150,
    images: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'],
    categorySlug: 'accessories',
    spaceType: 'office',
    featured: false
  },
  {
    name: 'Kettlebell Set',
    description: 'Cast iron kettlebell set - 15, 25, 35 lbs.',
    price: 149.99,
    sku: 'KET-001',
    stock: 40,
    images: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'],
    categorySlug: 'free-weights',
    spaceType: 'home',
    featured: false
  },

  // Flooring
  {
    name: 'Rubber Gym Flooring',
    description: 'Interlocking rubber gym flooring tiles, 20 sq ft pack.',
    price: 89.99,
    sku: 'FLR-001',
    stock: 50,
    images: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'],
    categorySlug: 'flooring',
    spaceType: 'home',
    featured: false
  },

  // Bundles
  {
    name: 'Home Gym Starter Bundle',
    description: 'Complete home gym starter bundle with adjustable dumbbells, bench, and mat.',
    price: 699.99,
    salePrice: 599.99,
    sku: 'BUN-001',
    stock: 10,
    images: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'],
    categorySlug: 'bundles',
    spaceType: 'home',
    featured: true
  },
  {
    name: 'Office Fitness Bundle',
    description: 'Perfect for office wellness programs - resistance bands, stability ball, and desk pedaler.',
    price: 199.99,
    sku: 'BUN-002',
    stock: 25,
    images: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'],
    categorySlug: 'bundles',
    spaceType: 'office',
    featured: false
  }
];

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  await prisma.refund.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.revenueReport.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // Create admin user
  console.log('👤 Creating admin user...');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.create({
    data: {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@fitspaceforge.com',
      password: hashedPassword,
      role: 'ADMIN'
    }
  });

  // Create demo regular user
  console.log('👤 Creating demo user...');
  const demoPassword = await bcrypt.hash('demo123', 10);
  const demoUser = await prisma.user.create({
    data: {
      firstName: 'Demo',
      lastName: 'User',
      email: 'demo@fitspaceforge.com',
      password: demoPassword,
      role: 'USER'
    }
  });

  // Create categories
  console.log('📦 Creating categories...');
  const createdCategories = await Promise.all(
    categories.map(category =>
      prisma.category.create({
        data: category
      })
    )
  );

  // Create products
  console.log('🏋️ Creating products...');
  for (const product of products) {
    const category = createdCategories.find(c => c.slug === product.categorySlug);
    if (category) {
      await prisma.product.create({
        data: {
          name: product.name,
          description: product.description,
          price: product.price,
          salePrice: product.salePrice,
          sku: product.sku,
          stock: product.stock,
          images: product.images,
          categoryId: category.id,
          spaceType: product.spaceType,
          featured: product.featured,
          active: true
        }
      });
    }
  }

  // Create demo orders and payments
  console.log('🧾 Creating demo orders and payments...');
  const seededProducts = await prisma.product.findMany({ take: 3, orderBy: { createdAt: 'asc' } });
  if (seededProducts.length >= 2) {
    // Order 1 for demo user
    const order1Total = Number(seededProducts[0].price) * 1 + Number(seededProducts[1].price) * 2;
    const order1 = await prisma.order.create({
      data: {
        orderNumber: 'ORD-SEED-001',
        userId: demoUser.id,
        status: 'CONFIRMED',
        total: order1Total,
        shippingCost: 0,
        tax: 0,
        shippingFirstName: demoUser.firstName || 'Demo',
        shippingLastName: demoUser.lastName || 'User',
        shippingAddress: '123 Demo Street',
        shippingCity: 'Mumbai',
        shippingState: 'MH',
        shippingZipCode: '400001',
        shippingCountry: 'India',
        items: {
          create: [
            {
              productId: seededProducts[0].id,
              quantity: 1,
              price: Number(seededProducts[0].price)
            },
            {
              productId: seededProducts[1].id,
              quantity: 2,
              price: Number(seededProducts[1].price)
            }
          ]
        }
      }
    });

    await prisma.payment.create({
      data: {
        orderId: order1.id,
        userId: demoUser.id,
        status: 'COMPLETED',
        amount: order1Total,
        currency: 'INR',
        paymentMethod: 'CARD',
        gatewayProvider: 'razorpay',
        gatewayFee: 49.99,
        netAmount: order1Total - 49.99,
        transactionId: `TXN-${order1.id.slice(-6).toUpperCase()}`,
        paidAt: new Date(),
      }
    });

    // Order 2 for admin user
    const basePrice = Number(seededProducts[0].price);
    const order2Total = basePrice * 1;
    const order2 = await prisma.order.create({
      data: {
        orderNumber: 'ORD-SEED-002',
        userId: adminUser.id,
        status: 'CONFIRMED',
        total: order2Total,
        shippingCost: 0,
        tax: 0,
        shippingFirstName: adminUser.firstName || 'Admin',
        shippingLastName: adminUser.lastName || 'User',
        shippingAddress: '456 Admin Avenue',
        shippingCity: 'Bengaluru',
        shippingState: 'KA',
        shippingZipCode: '560001',
        shippingCountry: 'India',
        items: {
          create: [
            {
              productId: seededProducts[0].id,
              quantity: 1,
              price: basePrice
            }
          ]
        }
      }
    });

    await prisma.payment.create({
      data: {
        orderId: order2.id,
        userId: adminUser.id,
        status: 'COMPLETED',
        amount: order2Total,
        currency: 'INR',
        paymentMethod: 'UPI',
        gatewayProvider: 'razorpay',
        gatewayFee: 19.99,
        netAmount: order2Total - 19.99,
        transactionId: `TXN-${order2.id.slice(-6).toUpperCase()}`,
        paidAt: new Date(),
      }
    });
  }

  console.log('✅ Database seeded successfully!');
  console.log(`👥 Created 2 users (1 admin, 1 demo)`);
  console.log(`📦 Created ${categories.length} categories`);
  console.log(`🏋️ Created ${products.length} products`);
  console.log('🧾 Created 2 demo orders and payments');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
