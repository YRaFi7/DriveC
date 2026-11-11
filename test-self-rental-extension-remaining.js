// test-self-rental-extension-remaining.js
// Verification of Self Rental Extension: Extension amount added along with Remaining Payment upon Admin Approval

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('========================================================================');
  console.log('DRIVEC VERIFICATION: SELF-DRIVE RENTAL EXTENSION ADDED TO REMAINING DUE');
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

  // 1. Get a rental vehicle and a customer
  const vehRes = await fetch(`${BASE_URL}/api/rental-vehicles`);
  const vehicles = await vehRes.json();
  const vehicle = vehicles.find(v => v.isAvailable) || vehicles[0];

  const custRes = await fetch(`${BASE_URL}/api/customers`);
  const customers = await custRes.json();
  const customer = customers[0];

  console.log(`Using Vehicle: ${vehicle.model} (${vehicle.licensePlate}), Daily Rate: ₹${vehicle.pricePerDay || 1500}`);
  console.log(`Using Customer: ${customer.name} (${customer.id})\n`);

  // [STEP 1] Create Self-Drive Rental Booking
  console.log('[STEP 1] Creating Self-Drive Rental Reservation...');
  const dailyRate = vehicle.pricePerDay || 1500;
  const initialDays = 3;
  const initialTotal = dailyRate * initialDays; // e.g. 4500
  const advanceAmount = 1000;
  const initialRemaining = initialTotal - advanceAmount; // e.g. 3500

  const today = new Date();
  const pickupDate = today.toISOString().split('T')[0];
  const returnDateObj = new Date(today.getTime() + initialDays * 24 * 60 * 60 * 1000);
  const scheduledReturnDate = returnDateObj.toISOString().split('T')[0];

  const bookingPayload = {
    refCode: `DC-RENT-${Math.floor(10000 + Math.random() * 90000)}`,
    bookingType: 'self_drive_rental',
    serviceType: 'self-drive',
    bookingChannel: 'website',
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    rentalVehicleId: vehicle.id,
    rentalVehicleModel: vehicle.model,
    vehicleCategory: 'suv',
    transmission: 'automatic',
    fuelType: 'petrol',
    pickupLocation: 'Cochin Airport Hub',
    destinationLocation: 'Cochin Airport Hub',
    scheduledDate: pickupDate,
    scheduledTime: '10:00',
    returnDate: scheduledReturnDate,
    fareBreakdown: {
      dailyRate,
      rentalDays: initialDays,
      totalFare: initialTotal,
      advanceAmount,
      remainingAmount: initialRemaining,
    },
    advanceAmount,
    remainingAmount: initialRemaining,
    status: 'pending',
    paymentStatus: 'pending',
    advancePaid: true,
    remainingPaid: false,
    passengerPaid: false,
    driverPaymentReceived: false,
  };

  const createRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bookingPayload)
  });
  const booking = await createRes.json();
  assert(createRes.status === 201 && booking.id, `Rental reservation created: ${booking.refCode} (ID: ${booking.id})`);
  assert(booking.advanceAmount === advanceAmount, `Advance amount recorded as ₹${advanceAmount}`);
  assert(booking.remainingAmount === initialRemaining, `Initial remaining due recorded as ₹${initialRemaining}`);
  assert(booking.returnDate === scheduledReturnDate, `Scheduled return date recorded as ${scheduledReturnDate}`);

  // [STEP 2] Admin Approves Rental Booking
  console.log('\n[STEP 2] Admin approves rental reservation...');
  const approveBookingRes = await fetch(`${BASE_URL}/api/bookings/${booking.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'admin'
    },
    body: JSON.stringify({ status: 'approved' })
  });
  const approvedBookingData = (await approveBookingRes.json()).booking;
  assert(approveBookingRes.status === 200 && approvedBookingData.status === 'approved', 'Admin approves rental booking (status: approved)');

  // [STEP 3] Customer requests Extension (+2 days)
  console.log('\n[STEP 3] Customer requests +2 days extension...');
  const extDays = 2;
  const extFee = dailyRate * extDays; // e.g. 3000
  const extendedDateObj = new Date(returnDateObj.getTime() + extDays * 24 * 60 * 60 * 1000);
  const requestedNewReturnDate = extendedDateObj.toISOString().split('T')[0];

  const extRes = await fetch(`${BASE_URL}/api/rental-extensions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': customer.id,
      'x-user-role': 'customer'
    },
    body: JSON.stringify({
      bookingId: booking.id,
      requestedReturnDate: requestedNewReturnDate,
      notes: 'Family road trip extension across Wayanad'
    })
  });
  const extension = await extRes.json();
  assert(extRes.status === 201 && extension.id, `Extension requested: ID ${extension.id}, New return date: ${requestedNewReturnDate}`);
  assert(extension.additionalDays === extDays, `Additional days calculated as ${extDays}`);
  assert(extension.extensionPrice === extFee, `Extension fee calculated as ₹${extFee}`);
  assert(extension.status === 'pending', 'Extension status is initially pending Admin review');

  // [STEP 4] Admin Approves Rental Extension
  console.log('\n[STEP 4] Admin approves rental extension...');
  const adminApproveExtRes = await fetch(`${BASE_URL}/api/rental-extensions/${extension.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'admin'
    },
    body: JSON.stringify({
      action: 'approve',
      adminNotes: 'Fleet availability verified, extended return approved.'
    })
  });
  const adminApproveData = await adminApproveExtRes.json();
  assert(adminApproveExtRes.status === 200 && adminApproveData.success, 'Admin approves rental extension (HTTP 200)');
  assert(adminApproveData.extension.status === 'approved', 'Extension status is now approved');

  // [STEP 5] Verify Booking has Extension Amount added to Remaining Due
  console.log('\n[STEP 5] Verifying Extension Amount added along with Remaining Payment in Booking...');
  const getBookingRes = await fetch(`${BASE_URL}/api/bookings`);
  const allBookings = await getBookingRes.json();
  const updatedBooking = allBookings.find(b => b.id === booking.id);

  const expectedNewRemaining = initialRemaining + extFee; // e.g. 3500 + 3000 = 6500
  const expectedNewTotal = initialTotal + extFee;          // e.g. 4500 + 3000 = 7500

  assert(updatedBooking.returnDate === requestedNewReturnDate, `Booking returnDate updated to ${requestedNewReturnDate}`);
  assert(updatedBooking.extensionFee === extFee, `Booking extensionFee recorded as ₹${extFee}`);
  assert(updatedBooking.remainingAmount === expectedNewRemaining, `Booking remainingAmount is now ₹${expectedNewRemaining} (₹${initialRemaining} initial + ₹${extFee} extension)`);
  assert(updatedBooking.fareBreakdown.totalFare === expectedNewTotal, `Total rental tariff updated to ₹${expectedNewTotal}`);
  assert(updatedBooking.fareBreakdown.remainingAmount === expectedNewRemaining, `Fare breakdown remainingAmount updated to ₹${expectedNewRemaining}`);

  // [STEP 6] Customer Completes Ride & Pays Remaining Payment (includes Extension)
  console.log('\n[STEP 6] Customer completes ride and pays remaining balance on vehicle return...');
  const completeReturnRes = await fetch(`${BASE_URL}/api/bookings/${booking.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'customer',
      'x-user-id': customer.id
    },
    body: JSON.stringify({
      status: 'completed',
      remainingPaid: true,
      passengerPaid: true,
      paymentMethod: 'upi',
      remainingAmount: expectedNewRemaining
    })
  });
  const completeData = await completeReturnRes.json();
  assert(completeReturnRes.status === 200, 'Remaining payment completed on vehicle return (HTTP 200)');
  assert(completeData.booking.status === 'completed', 'Booking status is marked completed');
  assert(completeData.booking.remainingPaid === true, 'remainingPaid is marked true');
  assert(completeData.booking.passengerPaid === true, 'passengerPaid is marked true');
  assert(completeData.booking.paymentStatus === 'completed', 'paymentStatus is completed');

  // [STEP 7] Verify Rental Extension is also marked completed automatically
  console.log('\n[STEP 7] Verifying approved rental extension is settled automatically...');
  const getExtRes = await fetch(`${BASE_URL}/api/rental-extensions/${extension.id}`, {
    headers: {
      'x-user-id': customer.id,
      'x-user-role': 'customer'
    }
  });
  const finalExt = await getExtRes.json();
  assert(finalExt.status === 'approved', 'Rental extension remains approved');
  assert(finalExt.paymentStatus === 'completed', 'Rental extension paymentStatus is marked completed along with remaining payment');

  console.log('\n========================================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
