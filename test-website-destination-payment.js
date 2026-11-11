// test-website-destination-payment.js
// Verification of Website "Pay for Ride" flow after driver clicks "Destination Reached"

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('========================================================================');
  console.log('DRIVEC VERIFICATION: WEBSITE DESTINATION REACHED & PAY FOR RIDE BUTTON');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;
  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Get an approved online driver and a customer
  const driversRes = await fetch(`${BASE_URL}/api/drivers`);
  const drivers = await driversRes.json();
  const driver = drivers.find(d => d.approvalStatus === 'approved' && d.isOnline) || drivers[0];

  const custRes = await fetch(`${BASE_URL}/api/customers`);
  const customers = await custRes.json();
  const customer = customers[0];

  console.log(`Driver: ${driver.name} (${driver.id}), Wallet: ₹${driver.walletBalance}`);
  console.log(`Customer: ${customer.name} (${customer.id})\n`);

  // [TEST SCENARIO 1: Website Booking Flow]
  console.log('[SCENARIO 1] Website Booking: Driver clicks Destination Reached -> Customer pays via website');
  
  const websiteBookingPayload = {
    refCode: `DC-WEB-${Math.floor(10000 + Math.random() * 90000)}`,
    bookingType: 'driver_booking',
    bookingChannel: 'website',
    selectedDriverExclusive: true,
    driverSelectionMode: 'specific',
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    serviceType: 'one_way',
    vehicleCategory: 'sedan',
    transmission: 'manual',
    fuelType: 'petrol',
    pickupLocation: 'Marine Drive, Kochi',
    destinationLocation: 'Infopark Phase 2, Kakkanad',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '15:00',
    fareBreakdown: {
      baseFare: 450,
      totalFare: 525,
      platformFee: 25,
      serviceTaxGST: 50
    },
    rideStartOtp: '4821',
    driverId: driver.id,
    driverName: driver.name,
    driverPhone: driver.phone,
    driverVehicle: 'Customer-Provided Vehicle',
    paymentMethod: 'upi',
    paymentStatus: 'pending',
    passengerPaid: false,
    driverPaymentReceived: false,
  };

  const createRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(websiteBookingPayload)
  });
  const webBooking = await createRes.json();
  assert(createRes.status === 201 && webBooking.id, `Website booking created: ${webBooking.refCode} (ID: ${webBooking.id})`);
  assert(webBooking.bookingChannel === 'website', 'Booking channel is recorded as website');
  assert(webBooking.status === 'pending', 'Initial status is pending');

  // Driver accepts booking
  const acceptRes = await fetch(`${BASE_URL}/api/bookings/${webBooking.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'driver',
      'x-driver-id': driver.id
    },
    body: JSON.stringify({ status: 'accepted', driverId: driver.id })
  });
  assert(acceptRes.status === 200, 'Driver accepts website booking (HTTP 200)');

  // Driver starts ride with OTP
  const startRes = await fetch(`${BASE_URL}/api/bookings/${webBooking.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'driver',
      'x-driver-id': driver.id
    },
    body: JSON.stringify({ status: 'in_progress', enteredOtp: '4821' })
  });
  assert(startRes.status === 200, 'Driver verifies Ride-Start OTP and starts ride (HTTP 200)');

  // Driver clicks "Destination Reached • Complete Ride"
  const reachRes = await fetch(`${BASE_URL}/api/bookings/${webBooking.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'driver',
      'x-driver-id': driver.id
    },
    body: JSON.stringify({ status: 'completed' })
  });
  const completedBooking = (await reachRes.json()).booking;
  assert(reachRes.status === 200 && completedBooking.status === 'completed', 'Driver completes ride on reaching destination (status: completed)');
  assert(completedBooking.passengerPaid === false, 'Ride is completed but passenger payment is not yet done (passengerPaid: false)');

  // Driver attempts to credit salary immediately -> MUST BE BLOCKED
  const prematureCredit = await fetch(`${BASE_URL}/api/bookings/${webBooking.id}/credit-salary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'driver',
      'x-driver-id': driver.id
    },
    body: JSON.stringify({ driverId: driver.id })
  });
  const prematureData = await prematureCredit.json();
  assert(prematureCredit.status === 400, 'Driver salary credit blocked when passenger has not paid (HTTP 400)');
  assert(prematureData.error === "Passenger hasn't paid yet", 'Correct block popup error message: "Passenger hasn\'t paid yet"');

  // Customer on website clicks "Pay for Ride" button
  const payRes = await fetch(`${BASE_URL}/api/bookings/${webBooking.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'customer',
      'x-user-id': customer.id
    },
    body: JSON.stringify({ passengerPaid: true, paymentMethod: 'upi' })
  });
  const paidBooking = (await payRes.json()).booking;
  assert(payRes.status === 200, 'Website Pay for Ride button completes payment via UPI (HTTP 200)');
  assert(paidBooking.passengerPaid === true, 'passengerPaid is now true');
  assert(paidBooking.paymentStatus === 'completed', 'paymentStatus is marked completed');
  assert(paidBooking.paymentMethod === 'upi', 'paymentMethod recorded as upi');

  // Driver now clicks "Payment Received • Credit Salary to Wallet"
  const initialBal = driver.walletBalance;
  const legitCredit = await fetch(`${BASE_URL}/api/bookings/${webBooking.id}/credit-salary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'driver',
      'x-driver-id': driver.id
    },
    body: JSON.stringify({ driverId: driver.id })
  });
  const creditData = await legitCredit.json();
  assert(legitCredit.status === 200, 'Driver salary credit SUCCEEDS after customer payment on website (HTTP 200)');
  assert(creditData.success === true, 'creditData.success is true');
  assert(creditData.creditedSalary === Math.round(525 * 0.40), `Driver received 40% salary (₹${creditData.creditedSalary})`);

  console.log('\n[SCENARIO 2] WhatsApp Booking: Driver clicks Destination Reached -> Customer pays via website Pay for Ride');
  
  const waBookingPayload = {
    refCode: `DC-WA-${Math.floor(10000 + Math.random() * 90000)}`,
    bookingType: 'driver_booking',
    bookingChannel: 'whatsapp',
    selectedDriverExclusive: true,
    driverSelectionMode: 'specific',
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    serviceType: 'one_way',
    vehicleCategory: 'sedan',
    transmission: 'manual',
    fuelType: 'petrol',
    pickupLocation: 'Aluva Metro Station',
    destinationLocation: 'Fort Kochi Beach',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '16:00',
    fareBreakdown: {
      baseFare: 600,
      totalFare: 700,
      platformFee: 25,
      serviceTaxGST: 75
    },
    rideStartOtp: '9134',
    driverId: driver.id,
    driverName: driver.name,
    driverPhone: driver.phone,
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    passengerPaid: false,
    driverPaymentReceived: false,
  };

  const createWa = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(waBookingPayload)
  });
  const waBooking = await createWa.json();
  assert(createWa.status === 201 && waBooking.id, `WhatsApp booking created: ${waBooking.refCode}`);
  assert(waBooking.bookingChannel === 'whatsapp', 'bookingChannel is whatsapp');

  // Accept & Start
  await fetch(`${BASE_URL}/api/bookings/${waBooking.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-user-role': 'driver', 'x-driver-id': driver.id },
    body: JSON.stringify({ status: 'accepted', driverId: driver.id })
  });
  await fetch(`${BASE_URL}/api/bookings/${waBooking.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-user-role': 'driver', 'x-driver-id': driver.id },
    body: JSON.stringify({ status: 'in_progress', enteredOtp: '9134' })
  });

  // Destination reached
  await fetch(`${BASE_URL}/api/bookings/${waBooking.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-user-role': 'driver', 'x-driver-id': driver.id },
    body: JSON.stringify({ status: 'completed' })
  });

  // Customer pays via website with Cash
  const waPayRes = await fetch(`${BASE_URL}/api/bookings/${waBooking.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-user-role': 'customer', 'x-user-id': customer.id },
    body: JSON.stringify({ passengerPaid: true, paymentMethod: 'cash' })
  });
  const waPaidBooking = (await waPayRes.json()).booking;
  assert(waPaidBooking.passengerPaid === true, 'WhatsApp booking paid via website (passengerPaid: true)');
  assert(waPaidBooking.paymentMethod === 'cash', 'Payment method is cash');

  // Driver credits salary
  const waCredit = await fetch(`${BASE_URL}/api/bookings/${waBooking.id}/credit-salary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-role': 'driver', 'x-driver-id': driver.id },
    body: JSON.stringify({ driverId: driver.id })
  });
  assert(waCredit.status === 200, 'Driver successfully credits salary for WhatsApp booking completed on website');

  console.log('\n========================================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
