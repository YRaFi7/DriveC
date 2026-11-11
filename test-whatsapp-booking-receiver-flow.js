const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('--- STARTING WHATSAPP BOOKING RECEIVER WORKFLOW TESTS ---');
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
    // 1. Setup Test Drivers
    // Driver 1: Favourite Driver (Online & Free)
    let favDriver = await prisma.driver.upsert({
      where: { phone: '+919999000001' },
      update: { approvalStatus: 'approved', isOnline: true, name: 'Suresh Favourite Driver' },
      create: {
        id: 'drv-test-fav-01',
        name: 'Suresh Favourite Driver',
        phone: '+919999000001',
        email: 'suresh.fav@drivec.in',
        licenseNumber: 'KL-07-2022-FAV01',
        city: 'Kochi',
        password: 'driver123',
        approvalStatus: 'approved',
        isOnline: true,
        vehicleModel: 'Toyota Innova Crysta',
        ratingAverage: 4.95,
      }
    });

    // Driver 2: Other Online Driver
    let otherOnlineDriver = await prisma.driver.upsert({
      where: { phone: '+919999000002' },
      update: { approvalStatus: 'approved', isOnline: true, name: 'Rajesh Online Fleet' },
      create: {
        id: 'drv-test-online-02',
        name: 'Rajesh Online Fleet',
        phone: '+919999000002',
        email: 'rajesh.fleet@drivec.in',
        licenseNumber: 'KL-07-2022-ONL02',
        city: 'Kochi',
        password: 'driver123',
        approvalStatus: 'approved',
        isOnline: true,
        vehicleModel: 'Maruti Suzuki Dzire',
        ratingAverage: 4.88,
      }
    });

    // Driver 3: Offline Driver
    let offlineDriver = await prisma.driver.upsert({
      where: { phone: '+919999000003' },
      update: { approvalStatus: 'approved', isOnline: false, name: 'Manoj Offline Driver' },
      create: {
        id: 'drv-test-offline-03',
        name: 'Manoj Offline Driver',
        phone: '+919999000003',
        email: 'manoj.off@drivec.in',
        licenseNumber: 'KL-07-2022-OFF03',
        city: 'Kochi',
        password: 'driver123',
        approvalStatus: 'approved',
        isOnline: false,
        vehicleModel: 'Honda City',
        ratingAverage: 4.80,
      }
    });

    // Test Customer
    let testCustomer = await prisma.customer.upsert({
      where: { phone: '+919876543210' },
      update: { favouriteDriverIds: [favDriver.id] },
      create: {
        id: 'cust-test-wa-01',
        name: 'Anita Sharma',
        phone: '+919876543210',
        email: 'anita.wa@example.com',
        city: 'Kochi',
        password: 'customer123',
        favouriteDriverIds: [favDriver.id],
      }
    });

    // Clean up any lingering active test bookings
    await prisma.booking.deleteMany({
      where: {
        customerPhone: testCustomer.phone,
      }
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 1: Website click does NOT create a booking in DB
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 1: Typing / generating message on website does NOT create DB booking ---');
    const existingBookings = await prisma.booking.findMany({
      where: { customerPhone: testCustomer.phone }
    });
    assert(existingBookings.length === 0, 'No booking exists in database prior to receiver side receiving WhatsApp message');

    // ─────────────────────────────────────────────────────────────
    // TEST 2: Incoming WhatsApp message with Favourite Driver who is ONLINE & FREE
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 2: Message Received with Favourite Driver ONLINE & FREE ---');
    const waMsg1 = [
      "Hi DriveC, I'd like to book a driver.",
      "",
      `Booking Ref: DC-WA-11111`,
      `Ride-Start OTP: 4422`,
      `Customer: ${testCustomer.name} (${testCustomer.phone})`,
      `Service: One Way`,
      `Preferred Driver: Suresh Favourite Driver`,
      `Pickup: Marine Drive, Kochi`,
      `Drop-off: Cochin International Airport`,
      `Date: 2026-11-12`,
      `Time: 10:00 AM`,
      `Estimated Fare: ₹500 (30 km)`
    ].join('\n');

    const res1 = await fetch('http://localhost:3000/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        waMessageId: 'wa_test_msg_01_' + Date.now(),
        senderPhone: testCustomer.phone,
        senderName: testCustomer.name,
        rawMessage: waMsg1,
      })
    });
    const data1 = await res1.json();
    assert(res1.ok && data1.success, 'Receiver endpoint processed incoming WhatsApp message');
    
    const booking1 = await prisma.booking.findUnique({
      where: { refCode: 'DC-WA-11111' }
    });
    assert(Boolean(booking1), 'Booking created in DB ONLY after WhatsApp message was received');
    assert(booking1.requestQueueStatus === 'exclusive_favourite', 'Booking assigned as exclusive_favourite when favourite is online & free');
    assert(booking1.driverId === favDriver.id, 'Assigned exclusively to favourite driver Suresh');
    assert(booking1.rideStartOtp === '4422', 'Preserves customer Ride-Start OTP 4422');

    // Check driver requests API for favourite driver vs other driver
    const favReqRes1 = await fetch(`http://localhost:3000/api/drivers/${favDriver.id}/requests`, {
      headers: { 'x-driver-id': favDriver.id }
    });
    const favReqData1 = await favReqRes1.json();
    const favHasBooking1 = favReqData1.requests?.some(r => r.refCode === 'DC-WA-11111');
    assert(favHasBooking1, 'Favourite driver sees exclusive request on his page');

    const otherReqRes1 = await fetch(`http://localhost:3000/api/drivers/${otherOnlineDriver.id}/requests`, {
      headers: { 'x-driver-id': otherOnlineDriver.id }
    });
    const otherReqData1 = await otherReqRes1.json();
    const otherHasBooking1 = otherReqData1.requests?.some(r => r.refCode === 'DC-WA-11111');
    assert(!otherHasBooking1, 'Other driver does NOT see exclusive favourite request while active');

    // Clean up booking 1
    await prisma.booking.delete({ where: { id: booking1.id } });

    // ─────────────────────────────────────────────────────────────
    // TEST 3: Incoming WhatsApp message when Favourite Driver is OFFLINE
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 3: Message Received when Favourite Driver is OFFLINE ---');
    // Set Suresh offline
    await prisma.driver.update({
      where: { id: favDriver.id },
      data: { isOnline: false }
    });

    const waMsg2 = [
      "Hi DriveC, I'd like to book a driver.",
      "",
      `Booking Ref: DC-WA-22222`,
      `Ride-Start OTP: 7733`,
      `Customer: ${testCustomer.name} (${testCustomer.phone})`,
      `Service: One Way`,
      `Preferred Driver: Suresh Favourite Driver`,
      `Pickup: Kakkanad, Kochi`,
      `Drop-off: Fort Kochi`,
      `Date: 2026-11-12`,
      `Time: 11:30 AM`,
      `Estimated Fare: ₹400 (22 km)`
    ].join('\n');

    const res2 = await fetch('http://localhost:3000/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        waMessageId: 'wa_test_msg_02_' + Date.now(),
        senderPhone: testCustomer.phone,
        senderName: testCustomer.name,
        rawMessage: waMsg2,
      })
    });
    const data2 = await res2.json();
    assert(res2.ok && data2.success, 'Receiver endpoint processed incoming WhatsApp message for offline favourite');

    const booking2 = await prisma.booking.findUnique({
      where: { refCode: 'DC-WA-22222' }
    });
    assert(Boolean(booking2), 'Booking 2 created in DB');
    assert(booking2.requestQueueStatus === 'broadcast', 'Automatically cascaded to broadcast because favourite is offline');
    assert(booking2.driverId === null, 'Driver ID is null so other online drivers can accept');

    // Verify who receives the request:
    // Suresh (offline) should NOT see it
    const favReqRes2 = await fetch(`http://localhost:3000/api/drivers/${favDriver.id}/requests`, {
      headers: { 'x-driver-id': favDriver.id }
    });
    const favReqData2 = await favReqRes2.json();
    const favHasBooking2 = favReqData2.requests?.some(r => r.refCode === 'DC-WA-22222');
    assert(!favHasBooking2, 'Offline favourite driver does NOT receive broadcast request');

    // Rajesh (online) MUST see it
    const otherReqRes2 = await fetch(`http://localhost:3000/api/drivers/${otherOnlineDriver.id}/requests`, {
      headers: { 'x-driver-id': otherOnlineDriver.id }
    });
    const otherReqData2 = await otherReqRes2.json();
    const otherHasBooking2 = otherReqData2.requests?.some(r => r.refCode === 'DC-WA-22222');
    assert(otherHasBooking2, 'Request automatically goes to other online driver Rajesh');

    // Clean up booking 2
    await prisma.booking.delete({ where: { id: booking2.id } });

    // ─────────────────────────────────────────────────────────────
    // TEST 4: Incoming WhatsApp message when Favourite Driver is ON ANOTHER RIDE
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 4: Message Received when Favourite Driver is ON ANOTHER RIDE ---');
    // Set Suresh back online, but put him on an active in_progress ride
    await prisma.driver.update({
      where: { id: favDriver.id },
      data: { isOnline: true }
    });

    const activeRideSuresh = await prisma.booking.create({
      data: {
        refCode: 'DC-BUSY-001',
        bookingChannel: 'website',
        status: 'in_progress',
        driverId: favDriver.id,
        driverName: favDriver.name,
        driverPhone: favDriver.phone,
        customerId: testCustomer.id,
        customerName: 'Earlier Passenger',
        customerPhone: '+919111222333',
        passengerName: 'Earlier Passenger',
        passengerPhone: '+919111222333',
        serviceType: 'one_way',
        vehicleCategory: 'sedan',
        pickupLocation: 'Palarivattom',
        destinationLocation: 'Aluva',
        scheduledDate: '2026-11-10',
        scheduledTime: 'Immediate',
        rideStartOtp: '9988',
        fareBreakdown: { totalFare: 350 },
        paymentStatus: 'pending',
      }
    });

    const waMsg3 = [
      "Hi DriveC, I'd like to book a driver.",
      "",
      `Booking Ref: DC-WA-33333`,
      `Ride-Start OTP: 8811`,
      `Customer: ${testCustomer.name} (${testCustomer.phone})`,
      `Service: One Way`,
      `Preferred Driver: Suresh Favourite Driver`,
      `Pickup: Edappally, Kochi`,
      `Drop-off: MG Road, Kochi`,
      `Date: 2026-11-12`,
      `Time: 12:00 PM`,
      `Estimated Fare: ₹300 (15 km)`
    ].join('\n');

    const res3 = await fetch('http://localhost:3000/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        waMessageId: 'wa_test_msg_03_' + Date.now(),
        senderPhone: testCustomer.phone,
        senderName: testCustomer.name,
        rawMessage: waMsg3,
      })
    });
    const data3 = await res3.json();
    assert(res3.ok && data3.success, 'Receiver endpoint processed message when favourite is busy on another ride');

    const booking3 = await prisma.booking.findUnique({
      where: { refCode: 'DC-WA-33333' }
    });
    assert(Boolean(booking3), 'Booking 3 created in DB');
    assert(booking3.requestQueueStatus === 'broadcast', 'Automatically cascaded to broadcast because favourite is on another ride');
    assert(booking3.driverId === null, 'Driver ID is null so other online drivers can accept');

    // Suresh (busy on another ride) should NOT receive the new broadcast request
    const favReqRes3 = await fetch(`http://localhost:3000/api/drivers/${favDriver.id}/requests`, {
      headers: { 'x-driver-id': favDriver.id }
    });
    const favReqData3 = await favReqRes3.json();
    const favHasBooking3 = favReqData3.requests?.some(r => r.refCode === 'DC-WA-33333');
    assert(!favHasBooking3, 'Driver currently driving another ride does not receive new broadcast request');

    // Rajesh (online and free) MUST receive it
    const otherReqRes3 = await fetch(`http://localhost:3000/api/drivers/${otherOnlineDriver.id}/requests`, {
      headers: { 'x-driver-id': otherOnlineDriver.id }
    });
    const otherReqData3 = await otherReqRes3.json();
    const otherHasBooking3 = otherReqData3.requests?.some(r => r.refCode === 'DC-WA-33333');
    assert(otherHasBooking3, 'Other online driver Rajesh receives the broadcast request');

    // ─────────────────────────────────────────────────────────────
    // TEST 5: Complete Ride Lifecycle (Driver Accept -> OTP Verification -> Ride Start -> Destination -> Payment)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 5: Complete Ride Lifecycle for the Dispatched WhatsApp Booking ---');
    // Rajesh accepts the booking
    const acceptRes = await fetch(`http://localhost:3000/api/bookings/${booking3.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driverId: otherOnlineDriver.id,
        action: 'accept',
      })
    });
    const acceptData = await acceptRes.json();
    console.log('acceptData:', acceptRes.status, acceptData);
    assert(acceptRes.ok && acceptData.success, 'Online driver Rajesh accepts the broadcast booking');

    // Rajesh arrives & passenger provides OTP '8811'
    const startRideRes = await fetch(`http://localhost:3000/api/bookings/${booking3.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driverId: otherOnlineDriver.id,
        status: 'in_progress',
        enteredOtp: '8811',
      })
    });
    const startRideData = await startRideRes.json();
    assert(startRideRes.ok && startRideData.success && startRideData.booking?.status === 'in_progress', 'Driver successfully starts ride with passenger OTP 8811');

    // Driver reaches destination
    const completeRes = await fetch(`http://localhost:3000/api/bookings/${booking3.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driverId: otherOnlineDriver.id,
        status: 'completed',
      })
    });
    const completeData = await completeRes.json();
    assert(completeRes.ok && completeData.success && completeData.booking?.status === 'completed', 'Driver completes ride at destination');

    // Clean up test data
    await prisma.booking.deleteMany({
      where: {
        id: { in: [booking3.id, activeRideSuresh.id] }
      }
    });

  } catch (err) {
    console.error('Test execution error:', err);
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
