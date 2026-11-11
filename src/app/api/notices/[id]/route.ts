import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';

// GET /api/notices/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const notice = await prisma.driverNotice.findUnique({
      where: { id },
    });

    if (!notice) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }

    const auth = await getAuthContext(req);
    if (auth.role === 'customer') {
      return NextResponse.json({ error: 'Forbidden: Customers cannot access driver notices.' }, { status: 403 });
    }
    if (auth.role === 'driver') {
      const callerDriverId = auth.driverId || auth.userId;
      if (callerDriverId && callerDriverId !== notice.driverId) {
        return NextResponse.json({ error: 'Forbidden: You cannot access another driver\'s notice.' }, { status: 403 });
      }
    }

    return NextResponse.json(notice);
  } catch (err) {
    console.error('GET /api/notices/[id] error:', err);
    return NextResponse.json({ error: 'Failed to fetch notice' }, { status: 500 });
  }
}

// PATCH /api/notices/[id]
// body: { action: 'acknowledge' | 'dismiss' | 'reply', message?: string, senderRole?: 'admin' | 'driver', senderName?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const action = body.action || (body.replyMessage ? 'reply' : undefined);
    const message = body.message || body.replyMessage;
    const { senderRole = 'driver', senderName = 'Driver' } = body;

    const existing = await prisma.driverNotice.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }

    const auth = await getAuthContext(req);
    if (auth.role === 'customer') {
      return NextResponse.json({ error: 'Forbidden: Customers cannot manage driver notices.' }, { status: 403 });
    }

    // A driver can only acknowledge or reply to their own notice
    if (senderRole === 'driver' || auth.role === 'driver') {
      const callerDriverId = auth.driverId || auth.userId;
      if (callerDriverId && callerDriverId !== existing.driverId && auth.role !== 'admin') {
        return NextResponse.json({
          error: 'Forbidden: You cannot acknowledge or reply to another driver\'s notice.',
          code: 'FORBIDDEN_DRIVER_MISMATCH',
        }, { status: 403 });
      }
    }

    // Dismissal or admin reply requires Admin privileges
    if (action === 'dismiss' || senderRole === 'admin') {
      if (auth.role !== 'admin') {
        return NextResponse.json({
          error: 'Forbidden: Only administrators can dismiss notices or reply as admin.',
          code: 'FORBIDDEN_ADMIN_REQUIRED',
        }, { status: 403 });
      }
    }

    if (action === 'acknowledge') {
      // Driver acknowledged notice: create unread notification for Admin
      const updated = await prisma.driverNotice.update({
        where: { id },
        data: {
          isAcknowledged: true,
          acknowledgedAt: new Date(),
        },
      });

      await prisma.disputeNotification.create({
        data: {
          noticeId: id,
          driverId: existing.driverId,
          driverName: existing.driverName,
          adminId: existing.adminId,
          targetRole: 'admin',
          eventType: 'driver_acknowledged',
          title: `Driver ${existing.driverName} Acknowledged Case #${id}`,
          message: `Driver ${existing.driverName} has officially acknowledged the disciplinary notice.`,
          isRead: false,
        },
      }).catch(e => console.warn('Could not create admin notification on ack:', e));

      return NextResponse.json(updated);
    }

    if (action === 'dismiss') {
      // Driver dismisses / closes notice from active view
      // NOTE: This does NOT delete notice, remove warning, reverse suspension, or erase history!
      const updated = await prisma.driverNotice.update({
        where: { id },
        data: {
          status: 'dismissed',
          isAcknowledged: true,
          acknowledgedAt: existing.acknowledgedAt || new Date(),
        },
      });
      return NextResponse.json(updated);
    }

    if (action === 'reply') {
      // Driver or Admin replies to notice conversation
      if (!message || !message.trim()) {
        return NextResponse.json({ error: 'Reply message cannot be empty' }, { status: 400 });
      }

      const currentReplies = Array.isArray(existing.replies) ? (existing.replies as any[]) : [];
      const newReply = {
        id: 'reply-' + Date.now(),
        senderRole, // 'admin' | 'driver'
        senderName: senderName.trim(),
        message: message.trim(),
        createdAt: new Date().toISOString(),
      };

      const updated = await prisma.driverNotice.update({
        where: { id },
        data: {
          replies: [...currentReplies, newReply],
        },
      });

      // Persistent unread notification for the recipient
      const recipientRole = senderRole === 'driver' ? 'admin' : 'driver';
      await prisma.disputeNotification.create({
        data: {
          noticeId: id,
          driverId: existing.driverId,
          driverName: existing.driverName,
          adminId: existing.adminId,
          targetRole: recipientRole,
          eventType: senderRole === 'driver' ? 'driver_reply' : 'admin_reply',
          title: senderRole === 'driver' 
            ? `New Reply from Driver ${existing.driverName}`
            : `Administrative Response from ${senderName}`,
          message: message.trim(),
          isRead: false,
        },
      }).catch(e => console.warn('Could not create reply dispute notification:', e));

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Invalid action. Supported: acknowledge, dismiss, reply' }, { status: 400 });
  } catch (err) {
    console.error('PATCH /api/notices/[id] error:', err);
    return NextResponse.json({ error: 'Failed to update notice' }, { status: 500 });
  }
}
