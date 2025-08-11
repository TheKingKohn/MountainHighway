// Simple database test
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDB() {
  try {
    console.log('🔍 Testing database connection...');
    const userCount = await prisma.user.count();
    console.log(`✅ Database connected! Found ${userCount} users`);
    
    // Test a simple query
    const users = await prisma.user.findMany({
      take: 2,
      select: { id: true, email: true, createdAt: true }
    });
    console.log('📋 Sample users:', users);
    
  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await prisma.$disconnect();
    console.log('👋 Database disconnected');
  }
}

testDB();
