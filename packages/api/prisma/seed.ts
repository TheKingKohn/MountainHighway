import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create or find test user
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  let user = await prisma.user.findUnique({
    where: { email: 'test@example.com' }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        passwordHash: hashedPassword,
        stripeAccountId: null,
      },
    });
    console.log('✅ Created test user:', user.email);
  } else {
    console.log('👤 Test user already exists:', user.email);
  }

  // Check if listing already exists
  const existingListing = await prisma.listing.findFirst({
    where: { 
      sellerId: user.id,
      title: 'Vintage Mountain Bike'
    }
  });

  if (!existingListing) {
    // Create a test listing
    const listing = await prisma.listing.create({
      data: {
        sellerId: user.id,
        title: 'Vintage Mountain Bike',
        description: 'A beautiful vintage mountain bike in excellent condition. Perfect for weekend adventures!',
        priceCents: 45000, // $450.00
        photos: JSON.stringify([
          'https://example.com/bike1.jpg',
          'https://example.com/bike2.jpg',
        ]),
        status: 'ACTIVE',
      },
    });
    console.log('✅ Created test listing:', listing.title);
  } else {
    console.log('📋 Test listing already exists:', existingListing.title);
  }

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
