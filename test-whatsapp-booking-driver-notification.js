const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('--- TESTING REAL-TIME WHATSAPP DISPATCH & DRIVER PORTAL NOTIFICATION ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, desc) {
    if (condition) {
      console.log(`✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${desc}`);
      failed++;
    }
  }

  try {
    // 1. Pick an approved, online driver (e.g. Parthibhan Das or Rajesh)
    const driver = await prisma.driver.findFirst({
      where: { approvalStatus: 'approved', isOnline: true },
    });
    assert(Boolean(driver), `Active approved driver found: ${driver?.name} (${driver?.id})`);

    // 2. Pick or create a customer
    const customer = await prisma.customer.findFirst();
    assert(Boolean(customer), `Customer found: ${customer?.name} (${customer?.phone})`);

    // 3. Simulate customer clicking "Book on WhatsApp" (which opens WhatsApp and delivers to /api/whatsapp/webhook)
    const refCode = `DC-WA-${Math.floor(10000 + Math.random() * 90000)}`;
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

    const rawMessage = [
      "Hi DriveC, I'd like to book a driver.",
      "",
      `Booking Ref: ${refCode}`,
      `Ride-Start OTP: ${otpCode}`,
      `Customer: ${customer.name} (${customer.phone})`,
      `Service: One Way`,
      `Preferred Driver: ${driver.name}`,
      `Pickup: Marine Drive, Kochi`,
      `Drop-off: Lulu Mall, Edappally`,
      `Date: 2026-11-12`,
      `Time: 02:00 PM`,
      `Estimated Fare: ₹450 (18 km)`
    ].join('\n');

    // Deliver sent message to receiver webhook
    const webhookRes = await fetch('http://localhost:3000/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        waMessageId: 'wa_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        senderPhone: customer.phone,
        senderName: customer.name,
        rawMessage,
      })
    });
    const webhookData = await webhookRes.json();
    assert(webhookRes.ok && webhookData.success, 'Receiver endpoint successfully received WhatsApp message');

    const createdBooking = webhookData.enquiries?.[0]?.booking;
    assert(Boolean(createdBooking), `Booking created in PostgreSQL: ID ${createdBooking?.id}, Ref ${createdBooking?.refCode}`);
    assert(createdBooking.bookingChannel === 'whatsapp', 'Booking channel is whatsapp');
    assert(createdBooking.rideStartOtp === otpCode, `Preserved matching OTP: ${otpCode}`);

    // 4. Test driver portal request retrieval
    const driverReqRes = await fetch(`http://localhost:3000/api/drivers/${driver.id}/requests`, {
      headers: {
        'x-user-id': driver.id,
        'x-user-role': 'driver',
        'x-driver-id': driver.id,
      }
    });
    assert(driverReqRes.ok, 'Driver portal requests endpoint responds HTTP 200');
    const driverReqData = await driverReqRes.json();
    const matchingRequest = driverReqData.requests?.find(r => r.refCode === refCode);
    assert(Boolean(matchingRequest), `Driver request received in Driver Portal for driver ${driver.name} (Ref ${refCode})`);

    // Clean up
    if (createdBooking?.id) {
      await prisma.booking.delete({ where: { id: createdBooking.id } });
    }

  } catch (err) {
    console.error('Test error:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
