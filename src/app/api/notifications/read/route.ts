import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST or PATCH /api/notifications/read
// Body: { notificationId?: string, noticeId?: string, targetRole?: 'admin' | 'driver' }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { notificationId, noticeId, targetRole } = body;

    if (notificationId) {
      const updated = await prisma.disputeNotification.update({
        where: { id: notificationId },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, notification: updated });
    }

    if (noticeId && targetRole) {
      // Mark all unread notifications for this specific case and targetRole as read
      const updated = await prisma.disputeNotification.updateMany({
        where: {
          noticeId,
          targetRole,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      // If no notification row exists at all for this notice & targetRole, ensure a read record is created
      const totalForNotice = await prisma.disputeNotification.count({
        where: { noticeId, targetRole },
      });

      if (totalForNotice === 0) {
        const notice = await prisma.driverNotice.findUnique({ where: { id: noticeId } });
        if (notice) {
          await prisma.disputeNotification.create({
            data: {
              noticeId,
              driverId: notice.driverId,
              driverName: notice.driverName,
              adminId: notice.adminId || 'admin-master',
              targetRole,
              eventType: targetRole === 'admin' ? 'case_reviewed' : 'notice_viewed',
              title: targetRole === 'admin' ? 'Case Reviewed by Admin' : 'Notice Viewed by Driver',
              message: 'Marked as read upon card expansion',
              isRead: true,
              readAt: new Date(),
            },
          });
        }
      }

      return NextResponse.json({ success: true, count: updated.count });
    }

    return NextResponse.json(
      { error: 'Either notificationId or both noticeId and targetRole are required.' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('Error marking notification as read:', err);
    return NextResponse.json({ error: 'Failed to mark notification as read' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  return POST(req);
}
