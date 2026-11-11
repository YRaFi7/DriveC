const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(body); } catch (e) { parsed = body; }
        resolve({ statusCode: res.statusCode, headers: res.headers, data: parsed });
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
  console.log('DRIVEC PORTAL ACCESS RESTRICTIONS & ISOLATION TESTS');
  console.log('====================================================\n');

  // 1. Fetch available drivers
  const driversRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/drivers',
    method: 'GET'
  });

  if (!Array.isArray(driversRes.data) || driversRes.data.length < 2) {
    console.error('Need at least 2 drivers to test cross-driver isolation. Found:', driversRes.data);
    process.exit(1);
  }

  const driverA = driversRes.data[0];
  const driverB = driversRes.data[1];
  console.log(`Driver A: ${driverA.name} (${driverA.id})`);
  console.log(`Driver B: ${driverB.name} (${driverB.id})\n`);

  let passedCount = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`✓ PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`✗ FAIL: ${message}`);
    }
  }

  // --- TEST GROUP 1: Customer Access to Driver APIs ---
  console.log('--- TEST GROUP 1: Customer Blocked from Driver APIs (403 Forbidden) ---');

  // Customer -> Driver A Requests
  const custToReq = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/drivers/${driverA.id}/requests`,
    method: 'GET',
    headers: {
      'x-user-id': 'cust-101',
      'x-user-role': 'customer'
    }
  });
  assert(custToReq.statusCode === 403, `Customer accessing driver requests returns 403 Forbidden (got ${custToReq.statusCode})`);

  // Customer -> Driver A Online Toggle
  const custToOnline = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/drivers/${driverA.id}/online`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'cust-101',
      'x-user-role': 'customer'
    },
  }, { isOnline: true });
  assert(custToOnline.statusCode === 403, `Customer toggling driver online returns 403 Forbidden (got ${custToOnline.statusCode})`);

  // Customer -> Driver A Capabilities
  const custToCap = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/drivers/${driverA.id}/capabilities`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'cust-101',
      'x-user-role': 'customer'
    },
  }, { transmissionCapabilities: ['Manual'] });
  assert(custToCap.statusCode === 403, `Customer editing driver capabilities returns 403 Forbidden (got ${custToCap.statusCode})`);

  // Customer -> Driver Notices
  const custToNotices = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/notices?driverId=${driverA.id}`,
    method: 'GET',
    headers: {
      'x-user-id': 'cust-101',
      'x-user-role': 'customer'
    }
  });
  assert(custToNotices.statusCode === 403, `Customer viewing driver notices returns 403 Forbidden (got ${custToNotices.statusCode})`);

  // Customer -> Approve Driver (Admin only)
  const custToApprove = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/drivers/${driverA.id}/approve`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'cust-101',
      'x-user-role': 'customer'
    }
  }, { action: 'approve' });
  assert(custToApprove.statusCode === 403, `Customer calling approve driver returns 403 Forbidden (got ${custToApprove.statusCode})`);


  // --- TEST GROUP 2: Cross-Driver Isolation ---
  console.log('\n--- TEST GROUP 2: Cross-Driver Isolation (Driver A cannot access Driver B) ---');

  // Driver A -> Driver B Requests
  const drvAtoBReq = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/drivers/${driverB.id}/requests`,
    method: 'GET',
    headers: {
      'x-user-id': driverA.id,
      'x-user-role': 'driver',
      'x-driver-id': driverA.id
    }
  });
  assert(drvAtoBReq.statusCode === 403, `Driver A requesting Driver B's requests returns 403 Forbidden (got ${drvAtoBReq.statusCode})`);

  // Driver A -> Driver B Online Toggle
  const drvAtoBOnline = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/drivers/${driverB.id}/online`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': driverA.id,
      'x-user-role': 'driver',
      'x-driver-id': driverA.id
    },
  }, { isOnline: true });
  assert(drvAtoBOnline.statusCode === 403, `Driver A toggling Driver B online returns 403 Forbidden (got ${drvAtoBOnline.statusCode})`);

  // Driver A -> Driver B Capabilities
  const drvAtoBCap = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/drivers/${driverB.id}/capabilities`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': driverA.id,
      'x-user-role': 'driver',
      'x-driver-id': driverA.id
    },
  }, { transmissionCapabilities: ['Automatic'] });
  assert(drvAtoBCap.statusCode === 403, `Driver A modifying Driver B's capabilities returns 403 Forbidden (got ${drvAtoBCap.statusCode})`);

  // Driver A -> Driver B Notices
  const drvAtoBNotices = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/notices?driverId=${driverB.id}`,
    method: 'GET',
    headers: {
      'x-user-id': driverA.id,
      'x-user-role': 'driver',
      'x-driver-id': driverA.id
    }
  });
  assert(drvAtoBNotices.statusCode === 403, `Driver A viewing Driver B's notices returns 403 Forbidden (got ${drvAtoBNotices.statusCode})`);

  // Driver A -> Approve Driver
  const drvAtoApprove = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/drivers/${driverB.id}/approve`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': driverA.id,
      'x-user-role': 'driver',
      'x-driver-id': driverA.id
    }
  }, { action: 'approve' });
  assert(drvAtoApprove.statusCode === 403, `Driver calling approve driver returns 403 Forbidden (got ${drvAtoApprove.statusCode})`);


  // --- TEST GROUP 3: Legitimate Authenticated Access ---
  console.log('\n--- TEST GROUP 3: Legitimate Driver & Admin Access ---');

  // Driver A -> Driver A Requests
  const drvAtoAReq = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/drivers/${driverA.id}/requests`,
    method: 'GET',
    headers: {
      'x-user-id': driverA.id,
      'x-user-role': 'driver',
      'x-driver-id': driverA.id
    }
  });
  assert(drvAtoAReq.statusCode === 200, `Driver A accessing Driver A's own requests returns 200 OK (got ${drvAtoAReq.statusCode})`);

  // Driver A -> Driver A Online Toggle
  const drvAtoAOnline = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/drivers/${driverA.id}/online`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': driverA.id,
      'x-user-role': 'driver',
      'x-driver-id': driverA.id
    },
  }, { isOnline: true });
  assert(drvAtoAOnline.statusCode === 200, `Driver A toggling Driver A's own online status returns 200 OK (got ${drvAtoAOnline.statusCode})`);

  // Admin -> Any Driver Requests
  const adminToReq = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/drivers/${driverA.id}/requests`,
    method: 'GET',
    headers: {
      'x-user-id': 'admin-master',
      'x-user-role': 'admin'
    }
  });
  assert(adminToReq.statusCode === 200, `Admin accessing driver requests returns 200 OK (got ${adminToReq.statusCode})`);

  // Admin -> Notices
  const adminToNotices = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/notices',
    method: 'GET',
    headers: {
      'x-user-id': 'admin-master',
      'x-user-role': 'admin'
    }
  });
  assert(adminToNotices.statusCode === 200, `Admin accessing notices returns 200 OK (got ${adminToNotices.statusCode})`);

  // --- TEST GROUP 4: Ride Status Security (Booking Access Controls) ---
  console.log('\n--- TEST GROUP 4: Ride Status & Lifecycle Security ---');

  const bkgRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'GET'
  });

  const existingBooking = Array.isArray(bkgRes.data) && bkgRes.data.length > 0 ? bkgRes.data[0] : null;

  if (existingBooking) {
    // Customer attempting to claim a ride as a driver
    const custClaimRide = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/bookings/${existingBooking.id}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'cust-101',
        'x-user-role': 'customer'
      }
    }, { status: 'accepted', driverId: 'cust-101' });
    assert(custClaimRide.statusCode === 403, `Customer claiming a ride returns 403 Forbidden (got ${custClaimRide.statusCode})`);

    // Driver A attempting to accept ride on behalf of Driver B
    const drvAClaimForB = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/bookings/${existingBooking.id}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': driverA.id,
        'x-user-role': 'driver',
        'x-driver-id': driverA.id
      }
    }, { status: 'accepted', driverId: driverB.id });
    assert(drvAClaimForB.statusCode === 403, `Driver A claiming ride for Driver B returns 403 Forbidden (got ${drvAClaimForB.statusCode})`);
  } else {
    console.log('Skipping booking status tests (no existing bookings in database).');
  }


  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passedCount} / ${totalTests} passed`);
  console.log('====================================================');

  if (passedCount !== totalTests) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
