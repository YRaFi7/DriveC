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
  console.log('====================================================');
  console.log('DRIVEC E2E TEST SUITE: RENTAL RESERVATION & PROMOCODE');
  console.log('====================================================\n');

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
    // 1. Check Server Status
    console.log('[STEP 1] Testing Server Connection...');
    const health = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'GET'
    });
    assert('Server is responding on port 3000', health.status === 200, `status ${health.status}`);

    // 2. Test Rental Reservation Submission
    console.log('\n[STEP 2] Testing Rental Reservation Creation...');
    const testRentalVehicleId = 'car-rent-thar-' + Date.now();
    const rentalBookingPayload = {
      refCode: `DC-RNT-${Math.floor(10000 + Math.random() * 90000)}`,
      rideStartOtp: '5678',
      customerId: 'cust-rental-' + Date.now(),
      customerName: 'Anoop Varma',
      customerPhone: '+91 98471 ' + Math.floor(10000 + Math.random() * 90000),
      bookingType: 'self_drive_rental',
      serviceType: 'self_drive',
      vehicleCategory: 'suv',
      rentalVehicleId: testRentalVehicleId,
      rentalVehicleModel: 'Mahindra Thar 4x4 (Hard Top)',
      scheduledDate: '2026-11-25',
      scheduledTime: '09:00',
      returnDate: '2026-11-28',
      returnTime: '18:00',
      rentalDays: 3,
      advanceAmount: 1000,
      remainingAmount: 7997,
      advancePaid: true,
      paymentMethod: 'upi',
      pickupLocation: 'Cochin International Airport (COK)',
      destinationLocation: 'Cochin International Airport (COK) (Return Depot)',
      fareBreakdown: {
        baseFare: 8997,
        totalFare: 8997,
        advanceAmount: 1000,
        remainingAmount: 7997
      }
    };

    const rentalRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, rentalBookingPayload);

    assert('Rental reservation successfully created with HTTP 201', rentalRes.status === 201, `Status: ${rentalRes.status}`);
    const createdRental = rentalRes.body;
    assert('Booking status is "pending" (Pending Admin Approval)', createdRental.status === 'pending', `status: ${createdRental.status}`);
    assert('Advance amount is recorded as ₹1,000', createdRental.advanceAmount === 1000, `advance: ${createdRental.advanceAmount}`);
    assert('Advance paid status is true', createdRental.advancePaid === true, `advancePaid: ${createdRental.advancePaid}`);
    assert('Admin notification message is generated', typeof createdRental.notificationMessage === 'string' && createdRental.notificationMessage.includes('Pending Admin Approval'), `notification: ${createdRental.notificationMessage}`);
    assert('Unique reference code is assigned', typeof createdRental.refCode === 'string' && createdRental.refCode.startsWith('DC-'), `refCode: ${createdRental.refCode}`);

    // 3. Validation: Advance payment failure rejected
    console.log('\n[STEP 3] Testing Advance Payment Failure Rejection...');
    const unpaidRentalRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      ...rentalBookingPayload,
      refCode: `DC-RNT-${Math.floor(10000 + Math.random() * 90000)}`,
      advancePaid: false,
      paymentFailed: true
    });
    assert('Rejects booking when advance payment fails (HTTP 400)', unpaidRentalRes.status === 400, `status: ${unpaidRentalRes.status}`);
    assert('Error message specifies advance payment failure', unpaidRentalRes.body.error === 'advance_payment_failed', `error: ${unpaidRentalRes.body.error}`);

    // 4. Validation: Invalid Return Date rejected
    console.log('\n[STEP 4] Testing Invalid Return Date Rejection...');
    const invalidDatesRentalRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      ...rentalBookingPayload,
      refCode: `DC-RNT-${Math.floor(10000 + Math.random() * 90000)}`,
      scheduledDate: '2026-11-28',
      returnDate: '2026-11-25' // return before pickup
    });
    assert('Rejects booking when return date is earlier than pickup date (HTTP 400)', invalidDatesRentalRes.status === 400, `status: ${invalidDatesRentalRes.status}`);

    // 5. Admin Approves Rental Reservation
    console.log('\n[STEP 5] Testing Admin Approval Workflow...');
    const approveRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/bookings/${createdRental.id}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, {
      status: 'approved',
      notificationMessage: 'Your vehicle has been successfully booked.'
    });
    assert('Admin approves reservation (HTTP 200)', approveRes.status === 200, `status: ${approveRes.status}`);
    const approvedBooking = approveRes.body.booking || approveRes.body;
    assert('Booking status updated to "approved"', approvedBooking.status === 'approved', `status: ${approvedBooking.status}`);
    assert('Customer notification message delivered: "Your vehicle has been successfully booked."', approvedBooking.notificationMessage === 'Your vehicle has been successfully booked.', `notification: ${approvedBooking.notificationMessage}`);

    // 6. Test Promocode: First-Ride Eligibility and Restriction
    console.log('\n[STEP 6] Testing First-Ride 50% Off Promocode Restrictions...');
    const testCustomerPhone = '+91 99955 ' + Math.floor(10000 + Math.random() * 90000);
    const testCustomerId = 'cust-promo-user-' + Date.now();

    // 6.1 First Ride with DRIVECFIRST (50% off) should succeed
    const firstRideRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      refCode: `DC-DRV-${Math.floor(10000 + Math.random() * 90000)}`,
      rideStartOtp: '1234',
      customerId: testCustomerId,
      customerName: 'Sanjay Nair',
      customerPhone: testCustomerPhone,
      serviceType: 'one-way',
      vehicleCategory: 'sedan',
      pickupLocation: 'Marine Drive, Kochi',
      destinationLocation: 'Fort Kochi',
      scheduledDate: '2026-11-20',
      scheduledTime: '14:00',
      promoCode: 'DRIVECFIRST',
      fareBreakdown: {
        baseFare: 600,
        discountAmount: 300,
        totalFare: 300
      }
    });

    assert('New customer can successfully use 50% off DRIVECFIRST on their first ride (HTTP 201)', firstRideRes.status === 201, `status: ${firstRideRes.status}`);
    const firstRideBooking = firstRideRes.body;

    // 6.2 Complete the first ride
    console.log('\n[STEP 7] Completing the Customer\'s First Ride...');
    const completeFirstRideRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/bookings/${firstRideBooking.id}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, {
      status: 'completed'
    });
    assert('First ride marked as completed (HTTP 200)', completeFirstRideRes.status === 200, `status: ${completeFirstRideRes.status}`);

    // Verify customer record updated in backend
    const customersListRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/customers',
      method: 'GET'
    });
    const updatedCustomer = customersListRes.body.find(c => c.phone === testCustomerPhone || c.id === testCustomerId);
    assert('Customer profile reflects completed ride count >= 1', updatedCustomer && updatedCustomer.completedRidesCount >= 1, `count: ${updatedCustomer?.completedRidesCount}`);
    assert('Customer has firstRidePromoUsed flag set to true', updatedCustomer && updatedCustomer.firstRidePromoUsed === true, `firstRidePromoUsed: ${updatedCustomer?.firstRidePromoUsed}`);

    // 6.3 Attempt second ride with 50% off promo DRIVECFIRST — MUST BE REJECTED BY BACKEND
    console.log('\n[STEP 8] Testing Second Ride Attempt with Expired First-Ride Promocode...');
    const secondRidePromoRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      refCode: `DC-DRV-${Math.floor(10000 + Math.random() * 90000)}`,
      rideStartOtp: '4321',
      customerId: testCustomerId,
      customerName: 'Sanjay Nair',
      customerPhone: testCustomerPhone,
      serviceType: 'one-way',
      vehicleCategory: 'sedan',
      pickupLocation: 'Fort Kochi',
      destinationLocation: 'Ernakulam South Railway Station',
      scheduledDate: '2026-11-21',
      scheduledTime: '16:00',
      promoCode: 'DRIVECFIRST',
      fareBreakdown: {
        baseFare: 600,
        discountAmount: 300,
        totalFare: 300
      }
    });

    assert('Backend rejects second ride with expired first-ride promocode (HTTP 400)', secondRidePromoRes.status === 400, `status: ${secondRidePromoRes.status}`);
    assert('Error message states first-ride 50% offer already used', 
      secondRidePromoRes.body.error === 'first_ride_promo_expired' && 
      secondRidePromoRes.body.message === 'Your first-ride 50% off offer has already been used.',
      `error: ${JSON.stringify(secondRidePromoRes.body)}`
    );

    // 6.4 Verify that a different, fresh customer CAN still use DRIVECFIRST
    console.log('\n[STEP 9] Testing DRIVECFIRST with a Fresh, Different Customer...');
    const freshCustomerPhone = '+91 97455 ' + Math.floor(10000 + Math.random() * 90000);
    const freshCustomerRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      refCode: `DC-DRV-${Math.floor(10000 + Math.random() * 90000)}`,
      rideStartOtp: '9876',
      customerId: 'cust-fresh-' + Date.now(),
      customerName: 'Divya Pillai',
      customerPhone: freshCustomerPhone,
      serviceType: 'round-trip',
      vehicleCategory: 'sedan',
      pickupLocation: 'Kaloor, Kochi',
      destinationLocation: 'Edappally Lulu Mall',
      scheduledDate: '2026-11-22',
      scheduledTime: '11:00',
      promoCode: 'DRIVECFIRST',
      fareBreakdown: {
        baseFare: 500,
        discountAmount: 250,
        totalFare: 250
      }
    });

    assert('Fresh customer successfully redeems their first-ride 50% discount (HTTP 201)', freshCustomerRes.status === 201, `status: ${freshCustomerRes.status}, details: ${JSON.stringify(freshCustomerRes.body)}`);

    console.log('\n====================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
