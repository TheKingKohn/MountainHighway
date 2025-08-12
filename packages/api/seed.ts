import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedData() {
  console.log('🌱 Seeding test data...');

  // First, create test users
  const testUsers = [
    {
      id: 'test-seller-1',
      email: 'seller1@test.com',
      passwordHash: 'test-hash-1',
      username: 'AppleFan',
      fullName: 'John Apple',
      location: 'San Francisco'
    },
    {
      id: 'test-seller-2',
      email: 'seller2@test.com',
      passwordHash: 'test-hash-2',
      username: 'VintageStyle',
      fullName: 'Jane Vintage',
      location: 'New York'
    },
    {
      id: 'test-seller-3',
      email: 'seller3@test.com',
      passwordHash: 'test-hash-3',
      username: 'GreenThumb',
      fullName: 'Bob Garden',
      location: 'Seattle'
    },
    {
      id: 'test-seller-4',
      email: 'seller4@test.com',
      passwordHash: 'test-hash-4',
      username: 'GamerGuru',
      fullName: 'Alice Gaming',
      location: 'Los Angeles'
    },
    {
      id: 'test-seller-5',
      email: 'seller5@test.com',
      passwordHash: 'test-hash-5',
      username: 'CardCollector',
      fullName: 'Charlie Cards',
      location: 'Chicago'
    },
    {
      id: 'test-seller-6',
      email: 'seller6@test.com',
      passwordHash: 'test-hash-6',
      username: 'BikeRider',
      fullName: 'David Bike',
      location: 'Denver'
    }
  ];

  console.log('👥 Creating test users...');
  for (const user of testUsers) {
    try {
      await prisma.user.upsert({
        where: { id: user.id },
        update: {},
        create: user
      });
      console.log(`✅ Created user: ${user.username}`);
    } catch (error) {
      console.error(`❌ Failed to create user: ${user.username}`, error);
    }
  }

  // Then create test listings
  const testListings = [
    {
      title: 'iPhone 13 Pro',
      description: 'Excellent condition iPhone 13 Pro, 128GB, unlocked. Includes original box and charger.',
      priceCents: 75000,
      photos: JSON.stringify(['https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400']),
      category: 'electronics',
      condition: 'like_new',
      brand: 'Apple',
      location: 'San Francisco',
      status: 'ACTIVE',
      sellerId: 'test-seller-1'
    },
    {
      title: 'Vintage Leather Jacket',
      description: 'Classic brown leather jacket from the 90s. Size M, genuine leather, some wear but adds character.',
      priceCents: 12000,
      photos: JSON.stringify(['https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400']),
      category: 'fashion',
      condition: 'good',
      brand: 'Vintage',
      location: 'New York',
      status: 'ACTIVE',
      sellerId: 'test-seller-2'
    },
    {
      title: 'Home Garden Tools Set',
      description: 'Complete gardening tools set including spade, rake, hoe, and watering can. Perfect for home gardening.',
      priceCents: 8500,
      photos: JSON.stringify(['https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400']),
      category: 'home',
      condition: 'new',
      brand: 'GardenPro',
      location: 'Seattle',
      status: 'ACTIVE',
      sellerId: 'test-seller-3'
    },
    {
      title: 'Gaming Laptop',
      description: 'High-performance gaming laptop with RTX 4060, perfect for gaming and work.',
      priceCents: 120000,
      photos: JSON.stringify(['https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=400']),
      category: 'electronics',
      condition: 'good',
      brand: 'ASUS',
      location: 'Los Angeles',
      status: 'ACTIVE',
      sellerId: 'test-seller-4'
    },
    {
      title: 'Collectible Baseball Cards',
      description: 'Rare 1980s baseball card collection in mint condition. Great investment pieces.',
      priceCents: 25000,
      photos: JSON.stringify(['https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400']),
      category: 'collectibles',
      condition: 'new',
      brand: 'Topps',
      location: 'Chicago',
      status: 'ACTIVE',
      sellerId: 'test-seller-5'
    },
    {
      title: 'Mountain Bike',
      description: 'Trek mountain bike, great for trails. Recently serviced with new tires.',
      priceCents: 45000,
      photos: JSON.stringify(['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400']),
      category: 'automotive',
      condition: 'good',
      brand: 'Trek',
      location: 'Denver',
      status: 'ACTIVE',
      sellerId: 'test-seller-6'
    }
  ];

  console.log('📦 Creating test listings...');
  for (const listing of testListings) {
    try {
      await prisma.listing.create({
        data: listing
      });
      console.log(`✅ Created listing: ${listing.title}`);
    } catch (error) {
      console.error(`❌ Failed to create listing: ${listing.title}`, error);
    }
  }

  console.log('🎉 Test data seeding completed!');
}

seedData()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
