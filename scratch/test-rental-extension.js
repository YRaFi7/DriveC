// test-rental-extension.js
// Automated verification suite for DriveC Self-Drive Rental: Pickup Date, Return Date & Admin-Approved Rental Extension

const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

const BASE_HOST = 'localhost';
const BASE_PORT = 3000;

async function runTests() {
  console.log('================================================================');
  console.log('🚀 DRIVEC SELF-DRIVE RENTAL & EXTENSION WORKFLOW TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✕ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Step 1: Fetch active rental vehicles to inspect rates and license plates
    console.log('Step 1: Inspecting Rental Vehicles from DB...');
    const vehRes = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: '/api/rental-vehicles',
      method: 'GET'
    });
    const vehicles = Array.isArray(vehRes.body) ? vehRes.body : (vehRes.body?.vehicles || []);
    assert(vehRes.status === 200 && vehicles.length > 0, `Fetched ${vehicles.length} rental vehicles from backend`);
    const vehicle = vehicles[0];
    assert(vehicle && vehicle.dailyRate > 0, `Selected test fleet vehicle: ${vehicle?.model} (Daily Rate: ₹${vehicle?.dailyRate}, Plate: ${vehicle?.licensePlate || 'KL-07-CD-4567'})`);

    const dailyRate = vehicle.dailyRate || 2500;
    const testCustomerId = 'cust-ext-test-' + Date.now();
    const testCustomerName = 'Rahul Menon';
    const testCustomerPhone = '+91 98470 54321';

    // Step 2: Create a self-drive rental booking with advance payment
    console.log('\nStep 2: Submitting Self-Drive Rental Reservation with Advance Payment...');
    const randOffset = Math.floor(Math.random() * 8000) + 100;
    const d1 = new Date(Date.now() + randOffset * 86400000);
    const d2 = new Date(d1.getTime() + 3 * 86400000);
    const dExt = new Date(d1.getTime() + 6 * 86400000);
    const dEarlier = new Date(d1.getTime() + 2 * 86400000);

    const pickupDate = d1.toISOString().split('T')[0];
    const scheduledReturnDate = d2.toISOString().split('T')[0];
    const newRequestedReturnDate = dExt.toISOString().split('T')[0];
    const invalidReturnDate = dEarlier.toISOString().split('T')[0];

    const rentalDays = 3;
    const advanceAmount = 1000;
    const totalFare = rentalDays * dailyRate;

    const createBookingRes = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: '/api/bookings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': testCustomerId,
        'x-user-role': 'customer'
      }
    }, {
      customerId: testCustomerId,
      customerName: testCustomerName,
      customerPhone: testCustomerPhone,
      passengerName: testCustomerName,
      passengerPhone: testCustomerPhone,
      bookingType: 'self_drive_rental',
      serviceType: 'self_drive',
      vehicleCategory: vehicle.category || 'suv',
      rentalVehicleId: vehicle.id,
      rentalVehicleModel: vehicle.model,
      rentalVehiclePlate: vehicle.licensePlate || 'KL-07-CD-4567',
      rentalDays: rentalDays,
      scheduledDate: pickupDate,
      scheduledTime: '10:00 AM',
      returnDate: scheduledReturnDate,
      advanceAmount: advanceAmount,
      advancePaid: true,
      pickupLocation: 'Cochin Airport Depot (Internal Depot)', // internal depot
      dropoffLocation: 'Cochin Airport Depot (Internal Depot)',
      status: 'pending',
      fareBreakdown: {
        baseFare: totalFare,
        totalFare: totalFare,
        advanceAmount: advanceAmount,
        remainingAmount: totalFare - advanceAmount
      }
    });

    assert(createBookingRes.status === 200 || createBookingRes.status === 201, `Rental reservation submitted (HTTP ${createBookingRes.status})`);
    const booking = createBookingRes.body.booking || createBookingRes.body;
    const bookingId = booking.id;
    const actualCustomerId = booking.customerId || testCustomerId;
    const refCode = booking.refCode || bookingId.slice(0, 8);
    console.log(`  Created Booking ID: ${bookingId}, Customer ID: ${actualCustomerId}, Ref: ${refCode}`);

    // Step 3: Admin Approves the Rental Reservation
    console.log('\nStep 3: Admin Approving the Rental Reservation...');
    const approveBookingRes = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: `/api/bookings/${bookingId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'admin',
        'x-user-role': 'admin'
      }
    }, {
      status: 'approved',
      actorRole: 'admin',
      notificationMessage: 'Your self-drive rental vehicle has been successfully approved by Admin.'
    });
    assert(approveBookingRes.status === 200, 'Admin approved rental reservation');

    // Step 4: Verify Invalid Extension Dates (Date <= current return date)
    console.log('\nStep 4: Testing Extension Validation - Date <= Current Return Date...');
    const invalidDateRes = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: '/api/rental-extensions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': actualCustomerId,
        'x-user-role': 'customer'
      }
    }, {
      bookingId: bookingId,
      requestedReturnDate: invalidReturnDate
    });
    assert(invalidDateRes.status === 400, `Rejected extension date on or before current return date (HTTP ${invalidDateRes.status}: "${invalidDateRes.body.message || invalidDateRes.body.error}")`);

    // Step 5: Customer Submits Valid Rental Extension Request (+3 days)
    console.log('\nStep 5: Customer Submitting Valid Extension Request (+3 Days)...');
    const extRes = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: '/api/rental-extensions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': actualCustomerId,
        'x-user-role': 'customer'
      }
    }, {
      bookingId: bookingId,
      requestedReturnDate: newRequestedReturnDate
    });

    assert(extRes.status === 201, `Extension request created (HTTP ${extRes.status})`);
    const extension = extRes.body.extension || extRes.body;
    assert(extension && extension.id, `Extension assigned unique ID: ${extension?.id}`);
    assert(extension.status === 'pending', `Extension initial status is 'pending'`);
    assert(extension.additionalDays === 3, `Correct additional days calculated: ${extension.additionalDays} days`);
    const expectedExtPrice = 3 * dailyRate;
    assert(extension.extensionPrice === expectedExtPrice, `Backend-validated extension price: ₹${extension.extensionPrice} (Expected ₹${expectedExtPrice})`);
    assert(extension.updatedTotalAmount === totalFare + expectedExtPrice, `Updated total rental amount: ₹${extension.updatedTotalAmount} (Original: ₹${totalFare})`);

    // Step 6: Test Duplicate Extension Request Prevention
    console.log('\nStep 6: Testing Duplicate Extension Request Prevention...');
    const dupRes = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: '/api/rental-extensions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': actualCustomerId,
        'x-user-role': 'customer'
      }
    }, {
      bookingId: bookingId,
      requestedReturnDate: '2026-11-18'
    });
    assert(dupRes.status === 409, `Duplicate pending extension blocked (HTTP ${dupRes.status}: "${dupRes.body.message || dupRes.body.error}")`);

    // Step 7: Admin Fetches Fleet Extension Requests
    console.log('\nStep 7: Admin Fetching Fleet Extension Requests...');
    const adminFetchRes = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: '/api/rental-extensions',
      method: 'GET',
      headers: {
        'x-user-id': 'admin',
        'x-user-role': 'admin'
      }
    });
    const adminExtensions = Array.isArray(adminFetchRes.body) ? adminFetchRes.body : (adminFetchRes.body?.extensions || []);
    assert(adminFetchRes.status === 200 && adminExtensions.length > 0, `Admin retrieved ${adminExtensions.length} extensions`);
    const adminFoundExt = adminExtensions.find(e => e.id === extension.id);
    assert(Boolean(adminFoundExt), `Found extension #${extension.id.slice(0, 8)} in Admin Fleet Extension Requests`);

    // Step 8: Test Fleet Overlap / Maintenance Conflict Validation
    console.log('\nStep 8: Testing Fleet Conflict Validation (Simulated Maintenance Overlap)...');
    // Set vehicle in maintenance during the extension window
    const maintDate = new Date(dExt.getTime() + 86400000).toISOString().split('T')[0];
    await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: `/api/rental-vehicles/${vehicle.id}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'admin',
        'x-user-role': 'admin'
      }
    }, {
      isAvailable: false,
      offlineUntil: maintDate,
      offlineReason: 'Engine transmission overhaul'
    });

    const conflictApproveRes = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: `/api/rental-extensions/${extension.id}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'admin',
        'x-user-role': 'admin'
      }
    }, {
      action: 'approve'
    });
    assert(conflictApproveRes.status === 409, `Admin approval blocked due to fleet maintenance conflict (HTTP ${conflictApproveRes.status}: "${conflictApproveRes.body.message}")`);

    // Restore vehicle availability
    await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: `/api/rental-vehicles/${vehicle.id}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'admin',
        'x-user-role': 'admin'
      }
    }, {
      isAvailable: true,
      offlineUntil: null,
      offlineReason: null
    });

    // Step 9: Admin Approves the Extension Request
    console.log('\nStep 9: Admin Approving Non-Conflicting Extension...');
    const approveExtRes = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: `/api/rental-extensions/${extension.id}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'admin',
        'x-user-role': 'admin'
      }
    }, {
      action: 'approve',
      adminNotes: 'Fleet capacity confirmed. Approved.'
    });
    assert(approveExtRes.status === 200, `Admin approved extension (HTTP ${approveExtRes.status})`);
    assert(approveExtRes.body.extension?.status === 'approved', `Extension status updated to 'approved'`);

    // Verify booking return date updated in database
    const checkBookingRes = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: `/api/bookings?id=${bookingId}`,
      method: 'GET',
      headers: {
        'x-user-id': 'admin',
        'x-user-role': 'admin'
      }
    });
    const updatedBooking = (checkBookingRes.body || []).find(b => b.id === bookingId);
    assert(updatedBooking?.returnDate === newRequestedReturnDate, `Booking returnDate updated in database to: ${updatedBooking?.returnDate}`);

    // Step 10: Customer Completes Extension Payment
    console.log('\nStep 10: Customer Completing Payment for Approved Extension...');
    const payRes = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: `/api/rental-extensions/${extension.id}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': actualCustomerId,
        'x-user-role': 'customer'
      }
    }, {
      action: 'pay',
      paymentMethod: 'upi',
      transactionRef: 'UPI-RENT-EXT-' + Date.now()
    });
    assert(payRes.status === 200, `Extension payment processed successfully (HTTP ${payRes.status})`);
    assert(payRes.body.extension.paymentStatus === 'completed', `Extension paymentStatus marked as 'completed'`);
    assert(payRes.body.extension.paidAt !== null, `Extension paidAt timestamp recorded: ${payRes.body.extension.paidAt}`);

    // Step 11: Test Decline Workflow with a Second Rental
    console.log('\nStep 11: Testing Decline Extension Workflow (Preserves Original Return Date)...');
    const d2_start = new Date(dExt.getTime() + 10 * 86400000);
    const d2_end = new Date(d2_start.getTime() + 2 * 86400000);
    const d2_ext = new Date(d2_start.getTime() + 5 * 86400000);

    const b2_start = d2_start.toISOString().split('T')[0];
    const b2_end = d2_end.toISOString().split('T')[0];
    const b2_ext = d2_ext.toISOString().split('T')[0];

    const booking2Res = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: '/api/bookings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': actualCustomerId,
        'x-user-role': 'customer'
      }
    }, {
      customerId: actualCustomerId,
      customerName: testCustomerName,
      customerPhone: testCustomerPhone,
      bookingType: 'self_drive_rental',
      serviceType: 'self_drive',
      vehicleCategory: vehicle.category || 'suv',
      pickupLocation: 'Cochin Airport Depot (Internal Depot)',
      scheduledTime: '09:00 AM',
      rentalVehicleId: vehicle.id,
      rentalVehicleModel: vehicle.model,
      rentalVehiclePlate: vehicle.licensePlate || 'KL-07-CD-4567',
      rentalDays: 2,
      scheduledDate: b2_start,
      returnDate: b2_end,
      advanceAmount: 1000,
      advancePaid: true,
      status: 'approved',
      fareBreakdown: {
        baseFare: 2 * dailyRate,
        totalFare: 2 * dailyRate,
        advanceAmount: 1000,
        remainingAmount: (2 * dailyRate) - 1000
      }
    });
    const booking2 = booking2Res.body.booking || booking2Res.body;
    const actualCustomer2Id = booking2.customerId || actualCustomerId;

    const ext2Res = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: '/api/rental-extensions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': actualCustomer2Id,
        'x-user-role': 'customer'
      }
    }, {
      bookingId: booking2.id,
      requestedReturnDate: b2_ext
    });
    assert(ext2Res.status === 201, 'Extension request 2 created');
    const ext2Id = ext2Res.body.extension.id;

    // Admin declines extension 2
    const declineRes = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: `/api/rental-extensions/${ext2Id}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'admin',
        'x-user-role': 'admin'
      }
    }, {
      action: 'decline',
      adminNotes: 'High demand during festival weekend; vehicle pre-allocated.'
    });
    assert(declineRes.status === 200, `Admin declined extension 2 (HTTP ${declineRes.status})`);
    assert(declineRes.body.extension.status === 'declined', `Extension 2 status set to 'declined'`);
    assert(declineRes.body.booking.returnDate === b2_end, `Original returnDate preserved unchanged: ${declineRes.body.booking.returnDate}`);

    console.log('\n================================================================');
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during test run:', err);
    process.exit(1);
  }
}

runTests();
