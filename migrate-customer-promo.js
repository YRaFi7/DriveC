const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "firstRidePromoUsed" BOOLEAN DEFAULT false;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "firstRidePromoUsedAt" TIMESTAMP;`);
    console.log('Successfully added firstRidePromoUsed columns to customers table');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
