const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('========================================================================');
  console.log('DRIVEC VERIFICATION SUITE: WALLET SECURITY, TRIP SHARING & BOOK FOR OTHERS');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc, condition, details = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  try {
    // 0. Verify server health
    const health = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'GET'
    });
    assert('Next.js dev server is reachable on port 3000', health.status === 200);

    // Fetch existing drivers and customers
    const driversRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/drivers',
      method: 'GET'
    });
    const drivers = Array.isArray(driversRes.body) ? driversRes.body : (driversRes.body.drivers || []);
    const testDriver = drivers[0] || { id: 'drv-test-1', name: 'Suresh Kumar', phone: '+919847123456' };
    const initialWalletBalance = testDriver.walletBalance || 0;
    console.log(`Using driver: ${testDriver.name} (${testDriver.id}), Initial Wallet: ₹${initialWalletBalance}`);

    // Free up driver from any stale pending/in_progress test rides
    const staleRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/bookings?driverId=${testDriver.id}`,
      method: 'GET'
    });
    const staleBookings = Array.isArray(staleRes.body) ? staleRes.body : [];
    for (const b of staleBookings) {
      if (['pending', 'accepted', 'driver_arriving', 'arrived', 'in_progress'].includes(b.status)) {
        await request({
          hostname: 'localhost',
          port: 3000,
          path: `/api/bookings/${b.id}/status`,
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }
        }, { status: 'completed', passengerPaid: true });
      }
    }

    const customersRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/customers',
      method: 'GET'
    });
    const customers = Array.isArray(customersRes.body) ? customersRes.body : (customersRes.body.customers || []);
    const testCustomer = customers[0] || { id: 'cust-1', name: 'Rahul Nair', phone: '+918547325636' };
    console.log(`Using customer: ${testCustomer.name} (${testCustomer.id})\n`);

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 1: BOOKING FOR SOMEONE ELSE FROM ANYWHERE
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[TEST 1] Booking for Someone Else with Distinct Identities...');
    const bookingForOthersPayload = {
      bookingType: 'driver',
      serviceType: 'one-way',
      vehicleCategory: 'sedan',
      transmission: 'manual',
      fuelType: 'petrol',
      pickupLocation: 'Calicut Railway Station, Kozhikode',
      destinationLocation: 'Kochi Airport, Nedumbassery',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '14:30',
      durationHours: 4,
      customerId: testCustomer.id,
      customerName: testCustomer.name,
      customerPhone: testCustomer.phone,
      // Book for Someone Else fields
      bookingFor: 'someone_else',
      passengerName: 'Anjali Menon',
      passengerPhone: '+919876543210',
      passengerRelationship: 'Family - Sister',
      passengerSpecialInstructions: 'Senior passenger with luggage, please assist at arrival gate 2',
      fareBreakdown: {
        totalFare: 1500,
        baseFare: 1300,
        platformFee: 25,
        serviceTaxGST: 75
      },
      driverId: testDriver.id,
      driverName: testDriver.name,
      driverPhone: testDriver.phone,
      paymentMethod: 'upi',
      status: 'accepted'
    };

    const createBookingRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, bookingForOthersPayload);

    console.log('POST /api/bookings response:', createBookingRes.status, createBookingRes.body);

    assert('Booking for someone else created successfully', createBookingRes.status === 201 || createBookingRes.status === 200);
    const booking = createBookingRes.body.booking || createBookingRes.body;
    assert(`Booking customer saved as ${testCustomer.name}`, booking.customerName === testCustomer.name);
    assert('Travelling passenger saved as Anjali Menon', booking.passengerName === 'Anjali Menon');
    assert('Travelling passenger phone saved as +919876543210', booking.passengerPhone === '+919876543210');
    assert('bookingFor marked as someone_else', booking.bookingFor === 'someone_else');
    assert('passengerRelationship preserved', booking.passengerRelationship === 'Family - Sister');
    assert('passengerSpecialInstructions preserved', booking.passengerSpecialInstructions.includes('gate 2'));

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 2: FREE REAL-TIME TRIP SHARING (NO GOOGLE MAPS, LEAFLET/OSM)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 2] Free Real-Time Trip Sharing via OpenStreetMap...');
    // Advance booking to active in_progress
    await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/bookings/${booking.id}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { status: 'in_progress', enteredOtp: booking.rideStartOtp });

    // Generate Share Token
    const shareRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/bookings/${booking.id}/share`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'customer',
        'x-user-id': testCustomer.id,
        'x-customer-id': testCustomer.id,
        'x-customer-phone': testCustomer.phone
      }
    });
    console.log('shareRes:', shareRes.status, shareRes.body);
    assert('Trip sharing link generated successfully (HTTP 200)', shareRes.status === 200);
    assert('Secure share token generated', Boolean(shareRes.body.shareToken));
    assert('shareUrl contains /track/[token]', shareRes.body.shareUrl && shareRes.body.shareUrl.includes('/track/'));
    assert('isSharingActive is true', shareRes.body.isSharingActive === true);

    const shareToken = shareRes.body.shareToken;

    // Public read-only tracking endpoint without any authentication
    const publicTrackRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/track/${shareToken}`,
      method: 'GET'
    });
    assert('Public tracking endpoint accessible without login (HTTP 200)', publicTrackRes.status === 200);
    assert('Tracking trip status matches in_progress', publicTrackRes.body.status === 'in_progress');
    assert('Passenger name visible to tracker', publicTrackRes.body.passengerName === 'Anjali Menon');
    assert('Driver details included in tracking response', publicTrackRes.body.driver && publicTrackRes.body.driver.name === testDriver.name);
    assert('Sensitive driver phone number is masked for privacy', publicTrackRes.body.driver.phone && publicTrackRes.body.driver.phone.includes('***'));

    // Driver transmits live GPS coordinates
    const gpsRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/bookings/${booking.id}/location`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'driver',
        'x-driver-id': testDriver.id
      }
    }, {
      lat: 9.9312,
      lng: 76.2673,
      heading: 180,
      speed: 48
    });
    assert('Driver transmits live GPS coordinates (HTTP 200)', gpsRes.status === 200);

    // Verify public tracking endpoint delivers the updated live GPS
    const trackAfterGps = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/track/${shareToken}`,
      method: 'GET'
    });
    assert('Public tracking reflects driver live latitude', trackAfterGps.body.liveLocation && trackAfterGps.body.liveLocation.lat === 9.9312);
    assert('Public tracking reflects driver live speed', trackAfterGps.body.liveLocation && trackAfterGps.body.liveLocation.speed === 48);

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 3: DRIVER SALARY WALLET SECURITY
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 3] Driver Salary Wallet Security (Credit Only After Customer Payment)...');
    
    // Step 3A: Complete the ride while passenger has NOT paid
    await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/bookings/${booking.id}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { status: 'completed' });

    // Driver attempts to credit salary BEFORE customer payment
    const unearnedCreditRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/bookings/${booking.id}/credit-salary`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'driver',
        'x-driver-id': testDriver.id
      }
    });

    assert('Salary credit is BLOCKED before customer payment (HTTP 400)', unearnedCreditRes.status === 400);
    assert('Error message is exactly "Passenger hasn\'t paid yet"', unearnedCreditRes.body.error === "Passenger hasn't paid yet");
    assert('Error code is PASSENGER_NOT_PAID', unearnedCreditRes.body.code === 'PASSENGER_NOT_PAID');

    // Verify driver wallet balance remains unchanged
    const driversCheck1 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/drivers',
      method: 'GET'
    });
    const updatedDriver1 = (driversCheck1.body || []).find(d => d.id === testDriver.id) || {};
    const walletAfterBlock = updatedDriver1.walletBalance || 0;
    assert('Driver wallet balance remained completely unchanged while unpaid', walletAfterBlock === initialWalletBalance);

    // Step 3B: Customer completes payment
    console.log('\n[TEST 3B] Customer completes payment for the ride...');
    const payRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/bookings/${booking.id}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, {
      passengerPaid: true,
      paymentMethod: 'upi',
      paymentTransactionRef: 'UPI-TXN-KERA-998811'
    });
    assert('Customer payment recorded successfully (HTTP 200)', payRes.status === 200);

    // Step 3C: Driver credits salary AFTER customer payment
    console.log('\n[TEST 3C] Driver credits salary after verified customer payment...');
    const authorizedCreditRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/bookings/${booking.id}/credit-salary`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'driver',
        'x-driver-id': testDriver.id
      }
    });

    assert('Driver salary credit SUCCEEDS after customer payment (HTTP 200)', authorizedCreditRes.status === 200);
    const expectedSalary = Math.round(1500 * 0.40); // 600
    assert(`Credited salary matches 40% driver share (₹${expectedSalary})`, authorizedCreditRes.body.creditedSalary === expectedSalary || authorizedCreditRes.body.creditedAmount === expectedSalary);
    assert('DriverWalletTransaction audit record created with transaction ID', Boolean(authorizedCreditRes.body.salaryCreditTxId || (authorizedCreditRes.body.transaction && authorizedCreditRes.body.transaction.id)));

    // Verify driver wallet balance was incremented
    const driversCheck2 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/drivers',
      method: 'GET'
    });
    const updatedDriver2 = (driversCheck2.body || []).find(d => d.id === testDriver.id) || {};
    const finalWalletBalance = updatedDriver2.walletBalance;
    assert(`Driver wallet incremented by ₹${expectedSalary} (From ₹${initialWalletBalance} to ₹${finalWalletBalance})`, finalWalletBalance === initialWalletBalance + expectedSalary);

    // Step 3D: Attempt duplicate salary credit (Double-credit prevention)
    console.log('\n[TEST 3D] Attempt duplicate salary credit for same ride...');
    const duplicateCreditRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/bookings/${booking.id}/credit-salary`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'driver',
        'x-driver-id': testDriver.id
      }
    });

    assert('Duplicate salary credit is BLOCKED by idempotency check (HTTP 409 Conflict)', duplicateCreditRes.status === 409);
    assert('Duplicate credit code is ALREADY_CREDITED', duplicateCreditRes.body.code === 'ALREADY_CREDITED');

    // Step 3E: Tracking Link Expiration Check
    console.log('\n[TEST 3E] Verifying public tracking link expiration after ride completed...');
    const expiredTrackRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/track/${shareToken}`,
      method: 'GET'
    });
    assert('Tracking link expired or reports completed state upon completion', expiredTrackRes.status === 410 || expiredTrackRes.body.status === 'completed');

    // ──────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n========================================================================');
    console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
