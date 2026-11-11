import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/notifications
// Query params: role ('admin' | 'driver'), driverId (optional)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetRole = searchParams.get('role');
    const driverId = searchParams.get('driverId');

    const where: any = {};
    if (targetRole) {
      where.targetRole = targetRole;
    }
    if (driverId && targetRole === 'driver') {
      where.driverId = driverId;
    }

    const notifications = await prisma.disputeNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(notifications);
  } catch (err: any) {
    console.error('GET /api/notifications error:', err);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// POST /api/notifications
// Create a new notification event
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      noticeId,
      driverId,
      driverName,
      adminId = 'admin-master',
      targetRole, // 'admin' | 'driver'
      eventType,
      title,
      message,
    } = body;

    if (!noticeId || !driverId || !targetRole || !eventType || !title || !message) {
      return NextResponse.json(
        { error: 'noticeId, driverId, targetRole, eventType, title, and message are required.' },
        { status: 400 }
      );
    }

    const notification = await prisma.disputeNotification.create({
      data: {
        noticeId,
        driverId,
        driverName: driverName || null,
        adminId,
        targetRole,
        eventType,
        title,
        message,
        isRead: false,
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/notifications error:', err);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}
