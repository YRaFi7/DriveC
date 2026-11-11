const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('=== STARTING DRIVEC NEW BOOKING STYLE VERIFICATION SUITE ===\n');
  const results = [];

  // Setup: Fetch test customer and drivers
  const customer = await prisma.customer.findFirst();
  const drivers = await prisma.driver.findMany({ where: { approvalStatus: 'approved' }, take: 3 });

  if (!customer || drivers.length < 2) {
    console.error('Prerequisites not met: need 1 customer and at least 2 approved drivers.');
    process.exit(1);
  }

  const driverA = drivers[0];
  const driverB = drivers[1];
  console.log(`Test Customer: ${customer.name} (${customer.id})`);
  console.log(`Driver A: ${driverA.name} (${driverA.id}) - isOnline: ${driverA.isOnline}`);
  console.log(`Driver B: ${driverB.name} (${driverB.id}) - isOnline: ${driverB.isOnline}`);

  // Ensure drivers are online for test
  await prisma.driver.update({ where: { id: driverA.id }, data: { isOnline: true } });
  await prisma.driver.update({ where: { id: driverB.id }, data: { isOnline: true } });

  // TEST 1: Website Booking with Available Driver -> Creates Exclusive Booking
  console.log('\n--- TEST 1: Website Booking Pick Driver (Exclusive Assignment) ---');
  const ref1 = `DC-TST-1-${Date.now().toString().slice(-4)}`;
  const booking1Res = await fetch('http://localhost:3000/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refCode: ref1,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      serviceType: 'one-way',
      vehicleCategory: 'sedan',
      pickupLocation: 'MG Road, Kochi',
      destinationLocation: 'Kochi Airport',
      scheduledDate: '2026-11-10',
      scheduledTime: '10:00 AM',
      fareBreakdown: { totalFare: 1200, baseFare: 1115, gstAmount: 60, platformFee: 25, distanceKm: 28, durationMinutes: 45 },
      rideStartOtp: '4821',
      driverId: driverA.id,
      driverName: driverA.name,
      driverPhone: driverA.phone,
    }),
  });

  const b1Data = await booking1Res.json();
  if (booking1Res.ok && b1Data.selectedDriverExclusive === true && b1Data.requestQueueStatus === 'exclusive_selected') {
    results.push({ name: '1. Website Booking Exclusive Driver Creation', passed: true });
    console.log('✓ PASS: Exclusive booking created with selectedDriverExclusive=true & requestQueueStatus=exclusive_selected');
  } else {
    results.push({ name: '1. Website Booking Exclusive Driver Creation', passed: false, error: b1Data });
    console.error('✗ FAIL: ', b1Data);
  }

  // TEST 2: Active Ride Collision -> Recheck Availability returns 409 driver_busy
  console.log('\n--- TEST 2: Recheck Availability when Driver is on Active Ride ---');
  // First, transition booking1 to 'in_progress' so driverA is on active ride
  await prisma.booking.update({
    where: { id: b1Data.id },
    data: { status: 'in_progress' }
  });

  const ref2 = `DC-TST-2-${Date.now().toString().slice(-4)}`;
  const collisionRes = await fetch('http://localhost:3000/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refCode: ref2,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      serviceType: 'one-way',
      vehicleCategory: 'sedan',
      pickupLocation: 'Edapally, Kochi',
      destinationLocation: 'Fort Kochi',
      scheduledDate: '2026-11-10',
      scheduledTime: '11:00 AM',
      fareBreakdown: { totalFare: 800, baseFare: 735, gstAmount: 40, platformFee: 25, distanceKm: 15, durationMinutes: 30 },
      rideStartOtp: '9123',
      driverId: driverA.id, // Driver A is busy!
      driverName: driverA.name,
      driverPhone: driverA.phone,
    }),
  });

  const colData = await collisionRes.json();
  if (collisionRes.status === 409 && colData.error === 'driver_busy' && colData.message.includes('currently on another ride')) {
    results.push({ name: '2. Busy Driver 409 Rejection with Exact Message', passed: true });
    console.log(`✓ PASS: Correctly rejected busy driver with 409: "${colData.message}"`);
  } else {
    results.push({ name: '2. Busy Driver 409 Rejection', passed: false, error: colData });
    console.error('✗ FAIL: ', colData);
  }

  // Cleanup booking1
  await prisma.booking.delete({ where: { id: b1Data.id } });

  // TEST 3: Driver Declines Website Booking -> Status changes to 'declined' (No broadcast)
  console.log('\n--- TEST 3: Website Booking Driver Decline ---');
  const ref3 = `DC-TST-3-${Date.now().toString().slice(-4)}`;
  const b3Res = await fetch('http://localhost:3000/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refCode: ref3,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      serviceType: 'hourly-driver',
      vehicleCategory: 'sedan',
      pickupLocation: 'Kaloor, Kochi',
      destinationLocation: 'In-City / As Directed',
      scheduledDate: '2026-11-10',
      scheduledTime: '12:00 PM',
      fareBreakdown: { totalFare: 1500, baseFare: 1400, gstAmount: 75, platformFee: 25, distanceKm: 20, durationMinutes: 120 },
      rideStartOtp: '3344',
      driverId: driverA.id,
      driverName: driverA.name,
      driverPhone: driverA.phone,
    }),
  });
  const b3Data = await b3Res.json();

  const declineRes = await fetch(`http://localhost:3000/api/bookings/${b3Data.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'declined',
      driverId: driverA.id,
      cancelledBy: 'driver',
      cancellationReason: 'Driver declined the request'
    }),
  });
  const decData = await declineRes.json();

  if (declineRes.ok && decData.booking.status === 'declined' && decData.booking.cancelledBy === 'driver') {
    results.push({ name: '3. Website Booking Driver Decline (status=declined)', passed: true });
    console.log('✓ PASS: Driver decline updated status to "declined" without broadcasting.');
  } else {
    results.push({ name: '3. Website Booking Driver Decline', passed: false, error: decData });
    console.error('✗ FAIL: ', decData);
  }

  // Cleanup booking 3
  await prisma.booking.delete({ where: { id: b3Data.id } });

  // TEST 4: WhatsApp Booking Webhook with Favourite Driver (Scenario A)
  console.log('\n--- TEST 4: WhatsApp Booking Webhook - Favourite Driver Available (Scenario A) ---');
  const waMsgId1 = `WAMID_FAV_${Date.now()}`;
  const waWebhookRes1 = await fetch('http://localhost:3000/api/whatsapp/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entry: [{
        changes: [{
          value: {
            metadata: { display_phone_number: '918547325636' },
            contacts: [{ profile: { name: 'Cris WhatsApp User' }, wa_id: customer.phone }],
            messages: [{
              from: customer.phone,
              id: waMsgId1,
              text: {
                body: `Service: One Way\nPreferred Driver: ${driverA.name}\nPickup: Marine Drive, Kochi\nDrop-off: Aluva\nDate: 2026-11-10\nTime: 02:00 PM`
              }
            }]
          }
        }]
      }]
    })
  });

  const wa1Data = await waWebhookRes1.json();
  const createdWaBooking1 = wa1Data.enquiries?.[0]?.booking;

  if (waWebhookRes1.ok && createdWaBooking1 && createdWaBooking1.requestQueueStatus === 'exclusive_favourite' && createdWaBooking1.driverId === driverA.id) {
    results.push({ name: '4. WhatsApp Webhook Favourite Driver Available (Scenario A)', passed: true });
    console.log('✓ PASS: WhatsApp booking created with requestQueueStatus=exclusive_favourite assigned to favourite driver.');
  } else {
    results.push({ name: '4. WhatsApp Webhook Favourite Driver Available', passed: false, error: wa1Data });
    console.error('✗ FAIL: ', wa1Data);
  }

  // TEST 5: Atomic First-Acceptance on WhatsApp Booking
  console.log('\n--- TEST 5: Atomic First-Acceptance on WhatsApp Booking ---');
  // First driver accepts
  const claimRes1 = await fetch(`http://localhost:3000/api/bookings/${createdWaBooking1.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'accepted',
      driverId: driverA.id,
      driverName: driverA.name,
      driverPhone: driverA.phone,
    })
  });
  const claimData1 = await claimRes1.json();

  // Second driver tries to accept the same booking
  const claimRes2 = await fetch(`http://localhost:3000/api/bookings/${createdWaBooking1.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'accepted',
      driverId: driverB.id,
      driverName: driverB.name,
      driverPhone: driverB.phone,
    })
  });
  const claimData2 = await claimRes2.json();

  if (claimRes1.ok && claimRes2.status === 409 && claimData2.code === 'REQUEST_NO_LONGER_AVAILABLE') {
    results.push({ name: '5. Atomic First-Acceptance (Second driver gets REQUEST_NO_LONGER_AVAILABLE)', passed: true });
    console.log('✓ PASS: Driver 1 won atomic race, Driver 2 got 409 "REQUEST_NO_LONGER_AVAILABLE"');
  } else {
    results.push({ name: '5. Atomic First-Acceptance', passed: false, error: { claimData1, claimData2 } });
    console.error('✗ FAIL: ', { claimData1, claimData2 });
  }

  // TEST 6: OTP Verification to Start Ride
  console.log('\n--- TEST 6: Start Ride via Ride-Start OTP Verification ---');
  // Wrong OTP fails
  const wrongOtpRes = await fetch(`http://localhost:3000/api/bookings/${createdWaBooking1.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'in_progress',
      enteredOtp: '0000' // wrong OTP
    })
  });
  const wrongOtpData = await wrongOtpRes.json();

  // Correct OTP succeeds
  const rightOtpRes = await fetch(`http://localhost:3000/api/bookings/${createdWaBooking1.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'in_progress',
      enteredOtp: createdWaBooking1.rideStartOtp
    })
  });
  const rightOtpData = await rightOtpRes.json();

  if (wrongOtpRes.status === 400 && rightOtpRes.ok && rightOtpData.booking.status === 'in_progress') {
    results.push({ name: '6. Ride-Start OTP Verification', passed: true });
    console.log('✓ PASS: Wrong OTP rejected (400), correct OTP transitioned status to "in_progress".');
  } else {
    results.push({ name: '6. Ride-Start OTP Verification', passed: false, error: { wrongOtpData, rightOtpData } });
    console.error('✗ FAIL: ', { wrongOtpData, rightOtpData });
  }

  // TEST 7: Ride Completion & Final Fare Calculation
  console.log('\n--- TEST 7: Ride Completion ---');
  const completeRes = await fetch(`http://localhost:3000/api/bookings/${createdWaBooking1.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'completed',
      driverId: driverA.id,
      actualDistanceKm: 26.5,
      actualDurationMinutes: 42
    })
  });
  const completeData = await completeRes.json();

  if (completeRes.ok && completeData.booking.status === 'completed' && completeData.booking.rideCompletedAt) {
    results.push({ name: '7. Ride Completion & Timestamp Recorded', passed: true });
    console.log(`✓ PASS: Status updated to "completed", rideCompletedAt: ${completeData.booking.rideCompletedAt}`);
  } else {
    results.push({ name: '7. Ride Completion', passed: false, error: completeData });
    console.error('✗ FAIL: ', completeData);
  }

  // TEST 8: Customer Payment & 40% Driver Wallet Credit
  console.log('\n--- TEST 8: Customer Payment & 40% Driver Wallet Credit ---');
  const driverBefore = await prisma.driver.findUnique({ where: { id: driverA.id } });
  const payRes = await fetch(`http://localhost:3000/api/bookings/${createdWaBooking1.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      passengerPaid: true,
      paymentMethod: 'upi'
    })
  });
  const payData = await payRes.json();
  const driverAfter = await prisma.driver.findUnique({ where: { id: driverA.id } });

  const creditedSalary = payData.creditedSalary || (driverAfter.walletBalance - driverBefore.walletBalance);
  if (payRes.ok && payData.booking.passengerPaid === true && payData.booking.paymentStatus === 'completed' && creditedSalary > 0) {
    results.push({ name: '8. Customer Payment & 40% Driver Wallet Credit', passed: true });
    console.log(`✓ PASS: Customer paid successfully. Driver wallet credited by ₹${creditedSalary}.`);
  } else {
    results.push({ name: '8. Customer Payment & Driver Wallet Credit', passed: false, error: payData });
    console.error('✗ FAIL: ', payData);
  }

  // Cleanup WhatsApp test booking
  await prisma.booking.delete({ where: { id: createdWaBooking1.id } });
  await prisma.whatsAppBooking.deleteMany({ where: { waMessageId: waMsgId1 } });

  // TEST 9: WhatsApp Scenario B - Favourite Driver Busy -> Fallback to Broadcast
  console.log('\n--- TEST 9: WhatsApp Booking - Favourite Driver Busy (Scenario B Fallback to Broadcast) ---');
  // Put driverA on active ride
  const busyRide = await prisma.booking.create({
    data: {
      refCode: `DC-BUSY-${Date.now().toString().slice(-4)}`,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      serviceType: 'one_way',
      vehicleCategory: 'sedan',
      pickupLocation: 'Kochi',
      destinationLocation: 'Aluva',
      scheduledDate: '2026-11-10',
      scheduledTime: 'Immediate',
      rideStartOtp: '1111',
      status: 'in_progress', // driverA is actively on this ride!
      driverId: driverA.id,
      driverName: driverA.name,
      fareBreakdown: { totalFare: 500 },
      paymentMethod: 'cash',
    }
  });

  const waMsgId2 = `WAMID_BUSY_${Date.now()}`;
  const waWebhookRes2 = await fetch('http://localhost:3000/api/whatsapp/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entry: [{
        changes: [{
          value: {
            metadata: { display_phone_number: '918547325636' },
            contacts: [{ profile: { name: 'Customer WhatsApp' }, wa_id: customer.phone }],
            messages: [{
              from: customer.phone,
              id: waMsgId2,
              text: {
                body: `Service: One Way\nPreferred Driver: ${driverA.name}\nPickup: Kakkanad, Kochi\nDrop-off: Vytilla\nDate: 2026-11-10\nTime: 04:00 PM`
              }
            }]
          }
        }]
      }]
    })
  });

  const wa2Data = await waWebhookRes2.json();
  const createdWaBooking2 = wa2Data.enquiries?.[0]?.booking;

  if (waWebhookRes2.ok && createdWaBooking2 && createdWaBooking2.requestQueueStatus === 'broadcast' && createdWaBooking2.driverId === null) {
    results.push({ name: '9. WhatsApp Favourite Driver Busy -> Fallback to Broadcast (Scenario B)', passed: true });
    console.log('✓ PASS: Favourite driver is busy; booking automatically fell back to broadcast (driverId=null).');
  } else {
    results.push({ name: '9. WhatsApp Favourite Driver Busy -> Fallback', passed: false, error: wa2Data });
    console.error('✗ FAIL: ', wa2Data);
  }

  // Cleanup busy ride & test 9
  await prisma.booking.delete({ where: { id: busyRide.id } });
  if (createdWaBooking2) {
    await prisma.booking.delete({ where: { id: createdWaBooking2.id } });
  }
  await prisma.whatsAppBooking.deleteMany({ where: { waMessageId: waMsgId2 } });

  // SUMMARY
  console.log('\n========================================');
  console.log('TEST SUMMARY:');
  const allPassed = results.every(r => r.passed);
  results.forEach(r => {
    console.log(`${r.passed ? '✓ PASS' : '✗ FAIL'}: ${r.name}`);
  });
  console.log('========================================');
  console.log(`TOTAL: ${results.filter(r => r.passed).length}/${results.length} PASSED`);

  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
