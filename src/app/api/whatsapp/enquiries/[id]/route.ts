import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/whatsapp/enquiries/[id]
// Update status (converted, rejected), admin reassignment, add adminNotes, link converted booking
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const {
      status,
      convertedBookingId,
      adminNotes,
      matchedDriverId,
      matchedDriverName,
      routingStatus,
    } = body;

    const existing = await prisma.whatsAppBooking.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'WhatsApp enquiry not found' }, { status: 404 });
    }

    // If reassigning driver
    let effectiveMatchedDriverName = matchedDriverName;
    if (matchedDriverId && !matchedDriverName) {
      const d = await prisma.driver.findUnique({ where: { id: matchedDriverId } });
      if (d) effectiveMatchedDriverName = d.name;
    }

    const updated = await prisma.whatsAppBooking.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(convertedBookingId ? { convertedBookingId } : {}),
        ...(adminNotes !== undefined ? { adminNotes } : {}),
        ...(matchedDriverId !== undefined ? { matchedDriverId } : {}),
        ...(effectiveMatchedDriverName !== undefined ? { matchedDriverName: effectiveMatchedDriverName } : {}),
        ...(routingStatus !== undefined
          ? { routingStatus }
          : matchedDriverId !== undefined
          ? { routingStatus: matchedDriverId ? 'reassigned' : 'general_admin' }
          : {}),
      },
      include: { driver: true },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('PATCH /api/whatsapp/enquiries/[id] error:', err);
    return NextResponse.json({ error: 'Failed to update enquiry' }, { status: 500 });
  }
}

// DELETE /api/whatsapp/enquiries/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await prisma.whatsAppBooking.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/whatsapp/enquiries/[id] error:', err);
    return NextResponse.json({ error: 'Failed to delete enquiry' }, { status: 500 });
  }
}
