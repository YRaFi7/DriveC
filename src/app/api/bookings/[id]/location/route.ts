import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';

// POST /api/bookings/[id]/location — Driver transmits live GPS coordinates
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const auth = await getAuthContext(req);
    const body = await req.json();
    const { lat, lng, heading, speed } = body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'Invalid coordinates: lat and lng must be numbers' },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Only assigned driver or admin can update GPS
    if (auth.role === 'driver' && auth.driverId && booking.driverId && auth.driverId !== booking.driverId) {
      return NextResponse.json(
        { error: 'Forbidden: You cannot update GPS for another driver\'s trip' },
        { status: 403 }
      );
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        driverLiveLat: lat,
        driverLiveLng: lng,
        driverLiveHeading: typeof heading === 'number' ? heading : null,
        driverLiveSpeed: typeof speed === 'number' ? speed : null,
        driverLiveUpdatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      updatedAt: updated.driverLiveUpdatedAt,
      driverLiveLat: updated.driverLiveLat,
      driverLiveLng: updated.driverLiveLng
    });
  } catch (err: any) {
    console.error('Error in POST /api/bookings/[id]/location:', err);
    return NextResponse.json(
      { error: 'Failed to update driver live location', details: err?.message },
      { status: 500 }
    );
  }
}
