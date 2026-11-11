import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';

// POST /api/bookings/[id]/share — Generate or retrieve active trip sharing link
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const auth = await getAuthContext(req);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { driver: true, customer: true }
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Customer, Driver, Admin, or session owner authorization
    if (auth.role === 'customer' && auth.customerId) {
      if (booking.customerId && booking.customerId !== auth.customerId && booking.customerPhone !== auth.phone) {
        return NextResponse.json(
          { error: 'Forbidden: You can only share your own active trips.' },
          { status: 403 }
        );
      }
    }

    // Check if trip is active
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot share a completed or cancelled ride.' },
        { status: 400 }
      );
    }

    // Generate or reuse token
    let token = booking.shareToken;
    if (!token || !booking.isSharingActive) {
      token = crypto.randomUUID().replace(/-/g, '') + crypto.randomBytes(4).toString('hex');
      await prisma.booking.update({
        where: { id },
        data: {
          shareToken: token,
          isSharingActive: true,
          shareTokenCreatedAt: new Date(),
          shareTokenExpiresAt: new Date(Date.now() + 24 * 3600 * 1000) // 24 hours expiry
        }
      });
    }

    const rawHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || (rawHost.includes('localhost') || rawHost.includes('127.0.0.1') ? 'http' : 'https');
    
    // In local development, resolve 'localhost' to a dotted IPv4 address (LAN IP or 127.0.0.1) so WhatsApp/SMS parsers recognize http:// as a clickable hyperlink
    let effectiveHost = rawHost;
    if (rawHost.startsWith('localhost:')) {
      const port = rawHost.split(':')[1] || '3000';
      try {
        const os = require('os');
        const nets = os.networkInterfaces();
        let lanIp = '';
        for (const name of Object.keys(nets)) {
          for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
              lanIp = net.address;
              break;
            }
          }
          if (lanIp) break;
        }
        effectiveHost = `${lanIp || '127.0.0.1'}:${port}`;
      } catch (e) {
        effectiveHost = `127.0.0.1:${port}`;
      }
    }

    const shareUrl = `${protocol}://${effectiveHost}/track/${token}`;

    return NextResponse.json({
      success: true,
      shareToken: token,
      shareUrl,
      isSharingActive: true,
      message: 'Trip sharing link generated successfully.'
    });
  } catch (err: any) {
    console.error('Error in POST /api/bookings/[id]/share:', err);
    return NextResponse.json(
      { error: 'Failed to generate trip share link', details: err?.message },
      { status: 500 }
    );
  }
}

// DELETE /api/bookings/[id]/share — Stop sharing trip
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const auth = await getAuthContext(req);

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (auth.role === 'customer') {
      const callerId = auth.customerId || auth.userId;
      if (booking.customerId !== callerId && booking.customerPhone !== auth.phone) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    await prisma.booking.update({
      where: { id },
      data: {
        isSharingActive: false,
        shareToken: null
      }
    });

    return NextResponse.json({
      success: true,
      isSharingActive: false,
      message: 'Trip sharing stopped. The previous link is now inactive.'
    });
  } catch (err: any) {
    console.error('Error in DELETE /api/bookings/[id]/share:', err);
    return NextResponse.json(
      { error: 'Failed to stop trip sharing', details: err?.message },
      { status: 500 }
    );
  }
}
