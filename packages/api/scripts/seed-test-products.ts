import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Creating test products for general marketplace...')

  // First, let's find an existing user to be the seller, or create one
  let testUser = await prisma.user.findFirst({
    where: { email: 'test@example.com' }
  })

  if (!testUser) {
    console.log('Creating test user...')
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        passwordHash: '$2a$10$example', // dummy hash
        fullName: 'Test Seller',
        location: 'Mountain View, CA'
      }
    })
  }

  const testProducts = [
    // Electronics
    {
      title: 'iPhone 14 Pro - Excellent Condition',
      description: 'Barely used iPhone 14 Pro in Space Black. Includes original box, charger, and screen protector already applied. No scratches or damage.',
      priceCents: 65000, // $650
      photos: '["iphone14pro.jpg"]',
      sellerId: testUser.id
    },
    {
      title: 'Gaming Laptop - RTX 3070',
      description: 'High-performance gaming laptop perfect for work and play. ASUS ROG with RTX 3070, 16GB RAM, 1TB SSD. Great for gaming, streaming, and productivity.',
      priceCents: 89900, // $899
      photos: '["gaming_laptop.jpg"]',
      sellerId: testUser.id
    },
    {
      title: 'AirPods Pro 2nd Generation',
      description: 'Like new AirPods Pro with active noise cancellation. Includes charging case and all original accessories. Perfect sound quality.',
      priceCents: 18000, // $180
      photos: '["airpods_pro.jpg"]',
      sellerId: testUser.id
    },

    // Fashion
    {
      title: 'Vintage Leather Jacket - Size M',
      description: 'Authentic vintage leather jacket from the 80s. Genuine leather, perfect patina, size Medium. A true classic piece that never goes out of style.',
      priceCents: 8500, // $85
      photos: '["leather_jacket.jpg"]',
      sellerId: testUser.id
    },
    {
      title: 'Designer Sneakers - Limited Edition',
      description: 'Rare limited edition sneakers, size 10. Only worn twice, excellent condition. Comes with original box and authentication card.',
      priceCents: 32000, // $320
      photos: '["designer_sneakers.jpg"]',
      sellerId: testUser.id
    },
    {
      title: 'Cashmere Scarf - Luxury Brand',
      description: 'Beautiful cashmere scarf from a luxury brand. Soft, warm, and elegant. Perfect accessory for any outfit. Barely used.',
      priceCents: 7500, // $75
      photos: '["cashmere_scarf.jpg"]',
      sellerId: testUser.id
    },

    // Home & Garden
    {
      title: 'Vintage Mid-Century Coffee Table',
      description: 'Beautiful mid-century modern coffee table in excellent condition. Solid wood with original finish. A perfect centerpiece for any living room.',
      priceCents: 24000, // $240
      photos: '["coffee_table.jpg"]',
      sellerId: testUser.id
    },
    {
      title: 'Indoor Plant Collection - 5 Plants',
      description: 'Collection of 5 healthy indoor plants including snake plant, pothos, and rubber tree. Perfect for beginners. Includes decorative pots.',
      priceCents: 4500, // $45
      photos: '["plant_collection.jpg"]',
      sellerId: testUser.id
    },
    {
      title: 'Artisan Ceramic Dinner Set',
      description: 'Handmade ceramic dinner set for 4 people. Includes plates, bowls, mugs, and serving pieces. Beautiful glazed finish in earth tones.',
      priceCents: 12000, // $120
      photos: '["ceramic_set.jpg"]',
      sellerId: testUser.id
    },

    // Collectibles
    {
      title: 'Vintage Comic Book Collection',
      description: 'Collection of 20 vintage comic books from the 1980s. Includes Marvel and DC titles. Well-preserved in protective sleeves.',
      priceCents: 15000, // $150
      photos: '["comic_collection.jpg"]',
      sellerId: testUser.id
    },
    {
      title: 'Limited Edition Art Print - Signed',
      description: 'Limited edition art print (#47/100) by local artist. Professionally framed and signed. Perfect for art collectors.',
      priceCents: 8000, // $80
      photos: '["art_print.jpg"]',
      sellerId: testUser.id
    },
    {
      title: 'Antique Pocket Watch',
      description: 'Beautiful antique pocket watch from the early 1900s. Still works perfectly. Comes with original chain and presentation box.',
      priceCents: 18500, // $185
      photos: '["pocket_watch.jpg"]',
      sellerId: testUser.id
    },

    // Automotive
    {
      title: 'Car Detailing Kit - Professional',
      description: 'Complete professional car detailing kit. Includes wax, polish, microfiber cloths, and all tools needed for a showroom finish.',
      priceCents: 6500, // $65
      photos: '["detailing_kit.jpg"]',
      sellerId: testUser.id
    },
    {
      title: 'Motorcycle Helmet - DOT Approved',
      description: 'High-quality motorcycle helmet, DOT approved. Size Large, excellent safety rating. Barely used, no damage or scratches.',
      priceCents: 12000, // $120
      photos: '["motorcycle_helmet.jpg"]',
      sellerId: testUser.id
    },

    // Services
    {
      title: 'Professional Photography Session',
      description: 'Professional photography services for portraits, events, or products. Includes 2-hour session and 10 edited high-resolution photos.',
      priceCents: 25000, // $250
      photos: '["photography_service.jpg"]',
      sellerId: testUser.id
    },
    {
      title: 'Home Cleaning Service',
      description: 'Reliable and thorough home cleaning service. Includes all supplies and equipment. Available for one-time or recurring cleaning.',
      priceCents: 8000, // $80
      photos: '["cleaning_service.jpg"]',
      sellerId: testUser.id
    }
  ]

  for (const product of testProducts) {
    try {
      await prisma.listing.create({
        data: product
      })
      console.log(`✅ Created: ${product.title}`)
    } catch (error) {
      console.log(`❌ Failed to create: ${product.title}`, error)
    }
  }

  console.log('✅ Test products created successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
