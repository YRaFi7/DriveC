const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const result = await prisma.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_name = 'rental_extensions'");
  console.log('Result:', result);
  await prisma.$disconnect();
}

check().catch(console.error);
