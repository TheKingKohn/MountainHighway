import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testListingsQuery() {
  try {
    console.log('Testing listings query...');
    
    const listings = await prisma.listing.findMany({
      where: { status: 'ACTIVE' },
      include: {
        seller: {
          select: {
            id: true,
            email: true
          }
        }
      },
      take: 5
    });
    
    console.log(`Found ${listings.length} listings`);
    
    if (listings.length > 0) {
      const first = listings[0];
      console.log('First listing:');
      console.log('- Title:', first.title);
      console.log('- Category:', first.category);
      console.log('- Condition:', first.condition);
      console.log('- Brand:', first.brand);
      console.log('- Location:', first.location);
      console.log('- Photos type:', typeof first.photos);
      console.log('- Photos value:', first.photos);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testListingsQuery();
