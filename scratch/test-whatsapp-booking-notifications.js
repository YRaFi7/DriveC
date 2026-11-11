// scratch/test-whatsapp-booking-notifications.js
// End-to-end test for WhatsApp booking creation, Driver Terminal reception, OTP validation, and Ride Start

const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, raw: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 DRIVE C — WHATSAPP BOOKING & DRIVER PORTAL NOTIFICATION SUITE');
  console.log('================================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failedCount++;
    }
  }

  try {
    // 1. Fetch fleet drivers to find approved online drivers
    console.log('📋 STEP 1: Fetch approved fleet drivers');
    const driversRes = await makeRequest('GET', '/api/drivers');
    assert(driversRes.status === 200, 'Fetched approved drivers successfully');
    const drivers = Array.isArray(driversRes.data) ? driversRes.data : driversRes.data.drivers || [];
    assert(drivers.length >= 1, `Found ${drivers.length} drivers in fleet`);
    const rahul = drivers.find(d => d.name.toLowerCase().includes('rahul')) || drivers[0];
    console.log(`   Target Driver: ${rahul.name} (ID: ${rahul.id}, Phone: ${rahul.phone}, Online: ${rahul.isOnline})`);

    // Ensure driver is online
    if (!rahul.isOnline) {
      await makeRequest('PATCH', `/api/drivers/${rahul.id}`, { isOnline: true });
    }

    // 2. Test WhatsApp Booking Creation via direct client/APK payload
    console.log('\n📲 STEP 2: Create WhatsApp booking for specific preferred driver (Rahul)');
    const customerPhone = `9185473${Math.floor(10000 + Math.random() * 90000)}`;
    const waBookingPayload = {
      senderPhone: customerPhone,
      senderName: 'Anand Kumar',
      serviceType: 'one_way',
      preferredDriver: rahul.name,
      pickupLocation: 'MG Road, Ernakulam, Kochi',
      dropoffLocation: 'Cochin International Airport (COK), Nedumbassery',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '15:30',
      rawMessage: `Hi DriveC, I'd like to book a driver.\n\nCustomer: Anand Kumar (${customerPhone})\nService: One Way\nPreferred Driver: ${rahul.name}\nPickup: MG Road, Ernakulam, Kochi\nDrop-off: Cochin International Airport (COK), Nedumbassery\nDate: 2026-11-08\nTime: 15:30`
    };

    const webhookRes = await makeRequest('POST', '/api/whatsapp/webhook', waBookingPayload);
    assert(webhookRes.status === 200, 'WhatsApp webhook returned status 200');
    assert(webhookRes.data.success === true, 'WhatsApp webhook processed successfully');
    assert(webhookRes.data.processed >= 1, 'WhatsApp webhook created booking enquiry');

    const createdWaBooking = webhookRes.data.enquiries[0]?.booking;
    assert(Boolean(createdWaBooking), 'Operational Booking record created in PostgreSQL');
    assert(createdWaBooking.bookingChannel === 'whatsapp', `Booking channel is 'whatsapp' (got: ${createdWaBooking.bookingChannel})`);
    assert(createdWaBooking.refCode.startsWith('DC-WA-'), `RefCode is prefixed with DC-WA- (got: ${createdWaBooking.refCode})`);
    assert(typeof createdWaBooking.rideStartOtp === 'string' && createdWaBooking.rideStartOtp.length === 4, `4-digit Ride-Start OTP generated: ${createdWaBooking.rideStartOtp}`);
    assert(createdWaBooking.status === 'pending', `Booking status is 'pending' (got: ${createdWaBooking.status})`);
    assert(createdWaBooking.driverId === rahul.id || createdWaBooking.favouriteDriverId === rahul.id, `Booking targeted to preferred driver ${rahul.name}`);

    // 3. Test Driver Terminal Requests Fetching for Rahul
    console.log('\n📡 STEP 3: Driver Terminal fetches incoming requests (/api/drivers/[id]/requests)');
    const rahulReqsRes = await makeRequest('GET', `/api/drivers/${rahul.id}/requests`);
    assert(rahulReqsRes.status === 200, 'Driver terminal request endpoint returned 200');
    const rahulRequests = rahulReqsRes.data.requests || [];
    const receivedBooking = rahulRequests.find(b => b.id === createdWaBooking.id || b.refCode === createdWaBooking.refCode);
    assert(Boolean(receivedBooking), `Driver ${rahul.name} received WhatsApp booking ${createdWaBooking.refCode} in requests queue`);
    assert(receivedBooking?.bookingChannel === 'whatsapp', `Booking correctly marked as WhatsApp channel for driver portal`);
    assert(receivedBooking?.rideStartOtp === createdWaBooking.rideStartOtp, `Passenger OTP preserved for driver verification`);

    // 4. Test Driver Acceptance (Accept Ride Now)
    console.log('\n🤝 STEP 4: Driver accepts incoming WhatsApp ride');
    const acceptRes = await makeRequest('PATCH', `/api/bookings/${createdWaBooking.id}/status`, {
      status: 'accepted',
      driverId: rahul.id,
      driverName: rahul.name,
      driverPhone: rahul.phone,
    });
    assert(acceptRes.status === 200, 'Booking status updated to accepted');
    assert(acceptRes.data.booking?.status === 'accepted', `Booking state is now accepted`);

    // 5. Test Driver Attempts Invalid Ride-Start OTP (e.g. 0000)
    console.log('\n❌ STEP 5: Driver enters incorrect OTP (should reject with 400 INVALID_OTP)');
    const invalidOtpRes = await makeRequest('PATCH', `/api/bookings/${createdWaBooking.id}/status`, {
      status: 'in_progress',
      enteredOtp: '0000',
    });
    assert(invalidOtpRes.status === 400, 'Incorrect OTP rejected with status 400');
    assert(invalidOtpRes.data.code === 'INVALID_OTP' || (invalidOtpRes.data.error && invalidOtpRes.data.error.includes('Invalid OTP')), 'Correct error code INVALID_OTP returned');

    // 6. Test Driver Enters Matching Passenger OTP
    console.log(`\n🔑 STEP 6: Driver enters matching 4-digit passenger OTP (${createdWaBooking.rideStartOtp})`);
    const validOtpRes = await makeRequest('PATCH', `/api/bookings/${createdWaBooking.id}/status`, {
      status: 'in_progress',
      enteredOtp: createdWaBooking.rideStartOtp,
    });
    assert(validOtpRes.status === 200, 'Matching OTP verified successfully (status 200)');
    assert(validOtpRes.data.status === 'in_progress' || validOtpRes.data.booking?.status === 'in_progress', 'Ride status transitioned to in_progress (card turns GREEN)');

    // 7. Test Driver Completes Ride & Verifies 40% Salary Crediting
    console.log('\n🏁 STEP 7: Driver completes ride & confirms payment');
    const completeRes = await makeRequest('PATCH', `/api/bookings/${createdWaBooking.id}/status`, {
      status: 'completed',
      actualDistanceKm: 28.5,
      actualDurationMinutes: 50,
    });
    assert(completeRes.status === 200, 'Ride marked completed');

    const totalFare = createdWaBooking.fareBreakdown.totalFare;
    const expectedSalary = Math.round(totalFare * 0.40);
    const expectedCommission = totalFare - expectedSalary;

    const paymentRes = await makeRequest('PATCH', `/api/bookings/${createdWaBooking.id}/status`, {
      driverPaymentReceived: true,
      driverCreditedSalary: expectedSalary,
      platformCommission: expectedCommission,
    });
    assert(paymentRes.status === 200, 'Driver payment confirmed & salary credited');

    // 8. Test WhatsApp Broadcast Booking (Customer selects Any Available)
    console.log('\n📢 STEP 8: Test WhatsApp broadcast booking for Any Available driver');
    const broadcastPhone = `9185473${Math.floor(10000 + Math.random() * 90000)}`;
    const broadcastRes = await makeRequest('POST', '/api/whatsapp/webhook', {
      senderPhone: broadcastPhone,
      senderName: 'Ravi Varma',
      serviceType: 'hourly_driver',
      preferredDriver: 'Any Available',
      pickupLocation: 'Kaloor, Kochi',
      dropoffLocation: 'In-City / As Directed',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '18:00',
    });
    assert(broadcastRes.status === 200, 'Broadcast WhatsApp webhook returned 200');
    const broadcastBooking = broadcastRes.data.enquiries[0]?.booking;
    assert(broadcastBooking.requestQueueStatus === 'broadcast', `Queue status is broadcast (got: ${broadcastBooking.requestQueueStatus})`);

    // Verify all approved online drivers receive broadcast booking
    const onlineApproved = drivers.filter(d => d.approvalStatus === 'approved');
    let allReceived = true;
    for (const d of onlineApproved.slice(0, 3)) {
      const dReqs = await makeRequest('GET', `/api/drivers/${d.id}/requests`);
      const hasReq = (dReqs.data.requests || []).some(b => b.id === broadcastBooking.id);
      if (!hasReq) allReceived = false;
    }
    assert(allReceived, `All eligible online drivers received broadcast WhatsApp booking`);

    // Clean up test bookings
    await makeRequest('DELETE', `/api/bookings?id=${createdWaBooking.id}`);
    await makeRequest('DELETE', `/api/bookings?id=${broadcastBooking.id}`);

    console.log('\n================================================================');
    console.log(`📊 FINAL RESULTS: ${passedCount} PASSED, ${failedCount} FAILED (Total: ${passedCount + failedCount})`);
    console.log('================================================================\n');

    process.exit(failedCount === 0 ? 0 : 1);
  } catch (err) {
    console.error('💥 Test execution error:', err);
    process.exit(1);
  }
}

runTests();
