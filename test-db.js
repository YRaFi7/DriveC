const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const customers = await prisma.customer.findMany();
    const drivers = await prisma.driver.findMany();
    const bookings = await prisma.booking.findMany();
    console.log('PostgreSQL Connection SUCCESS:');
    console.log('- Customers:', customers.length);
    console.log('- Drivers:', drivers.length);
    console.log('- Bookings:', bookings.length);
  } catch (err) {
    console.error('PostgreSQL Connection ERROR:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
