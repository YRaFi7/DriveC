import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext, enforceAdminAccess } from '@/lib/auth';

// GET /api/notices
// ?driverId=<id>
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    const { searchParams } = new URL(req.url);
    const driverIdParam = searchParams.get('driverId');

    // Customers cannot access driver notices
    if (auth.role === 'customer') {
      return NextResponse.json(
        { error: 'Forbidden: Customers cannot access driver notices.' },
        { status: 403 }
      );
    }

    // Driver authorization: can only access their own notices
    if (auth.role === 'driver') {
      const callerDriverId = auth.driverId || auth.userId;
      if (driverIdParam && callerDriverId && driverIdParam !== callerDriverId) {
        return NextResponse.json(
          { error: 'Forbidden: You cannot access another driver\'s notices.' },
          { status: 403 }
        );
      }

      // If driver didn't provide driverId, restrict query strictly to caller
      const effectiveDriverId = driverIdParam || callerDriverId;
      const notices = await prisma.driverNotice.findMany({
        where: effectiveDriverId ? { driverId: effectiveDriverId } : undefined,
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(notices);
    }

    // Admin can access all or filter by driverId
    const notices = await prisma.driverNotice.findMany({
      where: driverIdParam ? { driverId: driverIdParam } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(notices);
  } catch (err) {
    console.error('GET /api/notices error:', err);
    return NextResponse.json({ error: 'Failed to fetch notices' }, { status: 500 });
  }
}

// POST /api/notices — Admin issues warning or suspension notice to a driver
export async function POST(req: NextRequest) {
  try {
    // Only Admin may issue notices
    const authError = await enforceAdminAccess(req);
    if (authError) {
      return authError;
    }

    const body = await req.json();
    const {
      driverId,
      driverName,
      driverPhone,
      reviewId,
      bookingId,
      bookingRef,
      type, // 'warning' | 'suspension'
      reason,
      adminId = 'admin-master',
      adminName = 'DriveC Administrator',
    } = body;

    if (!driverId || !type || !reason) {
      return NextResponse.json(
        { error: 'driverId, type (warning or suspension), and reason are required.' },
        { status: 400 }
      );
    }

    if (type !== 'warning' && type !== 'suspension') {
      return NextResponse.json(
        { error: 'Notice type must be either "warning" or "suspension".' },
        { status: 400 }
      );
    }

    // Verify driver exists
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true, name: true, phone: true },
    });

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    // Create notice record
    const notice = await prisma.driverNotice.create({
      data: {
        driverId,
        driverName: driverName || driver.name,
        driverPhone: driverPhone || driver.phone,
        adminId,
        adminName,
        reviewId: reviewId || null,
        bookingId: bookingId || null,
        bookingRef: bookingRef || null,
        type,
        reason: reason.trim(),
        status: 'active',
        isAcknowledged: false,
        replies: [],
      },
    });

    // Create persistent unread notification for the driver
    await prisma.disputeNotification.create({
      data: {
        noticeId: notice.id,
        driverId,
        driverName: driverName || driver.name,
        adminId,
        targetRole: 'driver',
        eventType: type === 'suspension' ? 'suspension_issued' : 'warning_issued',
        title: type === 'suspension' ? 'Account Suspension Issued' : 'Official Warning Issued',
        message: reason.trim(),
        isRead: false,
      },
    }).catch(e => console.warn('Could not create driver dispute notification:', e));

    // If suspension notice, immediately apply suspension to driver
    if (type === 'suspension') {
      await prisma.driver.update({
        where: { id: driverId },
        data: {
          approvalStatus: 'suspended',
          approvalNotes: `Suspended by ${adminName}: ${reason.trim()}`,
          isOnline: false,
        },
      });
    }

    return NextResponse.json(notice, { status: 201 });
  } catch (err) {
    console.error('POST /api/notices error:', err);
    return NextResponse.json({ error: 'Failed to issue notice' }, { status: 500 });
  }
}
