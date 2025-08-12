import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPhotos() {
  try {
    const listing = await prisma.listing.findFirst();
    console.log('Found listing:', listing?.title);
    console.log('Photos field:', listing?.photos);
    console.log('Photos type:', typeof listing?.photos);
    
    if (listing?.photos) {
      try {
        const parsed = JSON.parse(listing.photos);
        console.log('Parsed photos:', parsed);
      } catch (e) {
        console.log('Failed to parse photos as JSON:', e.message);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPhotos();
