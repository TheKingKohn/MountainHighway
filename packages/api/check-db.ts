import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkListings() {
  console.log('🔍 Checking database listings...');
  
  const count = await prisma.listing.count();
  console.log(`📊 Total listings in database: ${count}`);
  
  const listings = await prisma.listing.findMany({
    take: 10,
    select: {
      id: true,
      title: true,
      priceCents: true,
      status: true
    }
  });
  
  console.log('📋 Listings found:');
  listings.forEach(listing => {
    console.log(`  - ${listing.title} ($${listing.priceCents/100}) - ${listing.status}`);
  });
}

checkListings()
  .catch((e) => {
    console.error('❌ Query failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
