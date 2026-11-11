import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext, enforceAdminAccess } from '@/lib/auth';

// GET /api/rental-extensions
// Admin sees all extensions. Customers see their extensions or all if unauthenticated/syncing.
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    const { searchParams } = new URL(req.url);
    const bookingId = searchParams.get('bookingId');
    const status = searchParams.get('status');
    const customerIdParam = searchParams.get('customerId');

    let whereClause: any = {};

    if (customerIdParam) {
      whereClause.customerId = customerIdParam;
    } else if (auth.role === 'customer' && auth.customerId && !auth.userId?.includes('admin')) {
      whereClause.customerId = auth.customerId;
    }

    if (bookingId) {
      whereClause.bookingId = bookingId;
    }
    if (status) {
      whereClause.status = status;
    }

    const extensions = await prisma.rentalExtension.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(extensions);
  } catch (err) {
    console.error('GET /api/rental-extensions error:', err);
    return NextResponse.json({ error: 'Failed to fetch rental extensions' }, { status: 500 });
  }
}

// POST /api/rental-extensions
// Customer submits an extension request for an approved self-drive rental
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    const body = await req.json();
    const { bookingId, requestedReturnDate, notes } = body;

    if (!bookingId || !requestedReturnDate) {
      return NextResponse.json(
        { error: 'Missing required fields: bookingId and requestedReturnDate are required.' },
        { status: 400 }
      );
    }

    // Look up the booking
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    // Verify it is a Self-Drive Rental
    const isRental =
      booking.serviceType === 'self_drive' ||
      (booking as any).bookingType === 'self_drive_rental' ||
      Boolean(booking.rentalVehicleId);

    if (!isRental) {
      return NextResponse.json(
        { error: 'Rental extensions can only be requested for Self-Drive Rental vehicles.' },
        { status: 400 }
      );
    }

    // Customer authorization: Customers can extend their own rental bookings
    if (auth.role === 'customer') {
      const callerId = auth.customerId || auth.userId;
      if (callerId && booking.customerId && booking.customerId !== callerId && booking.customerPhone !== auth.phone) {
        return NextResponse.json(
          { error: 'Forbidden: You can only request extensions for your own rental bookings.' },
          { status: 403 }
        );
      }
    } else if (auth.role !== 'admin' && auth.role !== 'guest') {
      const callerId = auth.customerId || auth.userId;
      if (callerId && booking.customerId && booking.customerId !== callerId && booking.customerPhone !== auth.phone) {
        return NextResponse.json({ error: 'Forbidden: Unauthorized role.' }, { status: 403 });
      }
    }

    // Validate booking status (Must be approved or in_progress; cannot be completed or cancelled)
    if (booking.status === 'completed' || booking.status === 'cancelled' || booking.status === 'declined') {
      return NextResponse.json(
        { error: `Cannot extend a rental with status "${booking.status}". Rental must be active or approved.` },
        { status: 400 }
      );
    }

    // Validate return date: must be strictly later than current return date
    const currentReturnDate = booking.returnDate || booking.scheduledDate;
    if (requestedReturnDate <= currentReturnDate) {
      return NextResponse.json(
        { error: `Requested new return date (${requestedReturnDate}) must be strictly later than current return date (${currentReturnDate}).` },
        { status: 400 }
      );
    }

    // Prevent multiple conflicting pending extension requests
    const existingPending = await prisma.rentalExtension.findFirst({
      where: {
        bookingId: booking.id,
        status: 'pending'
      }
    });

    if (existingPending) {
      return NextResponse.json(
        {
          error: 'pending_conflict',
          message: 'A pending extension request is already awaiting Admin review for this rental booking.'
        },
        { status: 409 }
      );
    }

    // Vehicle lookup & pricing calculation
    let vehicle = null;
    if (booking.rentalVehicleId) {
      vehicle = await prisma.rentalVehicle.findUnique({
        where: { id: booking.rentalVehicleId }
      });
    }

    const dailyRate =
      (booking.fareBreakdown as any)?.dailyRate ||
      vehicle?.dailyRate ||
      (booking.fareBreakdown as any)?.rentalDailyRate ||
      2000;

    // Calculate additional rental days
    const d1 = new Date(currentReturnDate);
    const d2 = new Date(requestedReturnDate);
    const additionalDays = Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
    const extensionPrice = additionalDays * dailyRate;

    const existingTotalAmount = (booking.fareBreakdown as any)?.totalFare || 0;
    const updatedTotalAmount = existingTotalAmount + extensionPrice;

    // Save extension request in PostgreSQL
    const extension = await prisma.rentalExtension.create({
      data: {
        bookingId: booking.id,
        bookingRef: booking.refCode,
        customerId: booking.customerId,
        customerName: booking.passengerName || booking.customerName,
        customerPhone: booking.passengerPhone || booking.customerPhone,
        rentalVehicleId: booking.rentalVehicleId || vehicle?.id || 'unknown',
        vehicleModel: vehicle?.model || booking.rentalVehicleModel || 'Self-Drive Vehicle',
        licensePlate: vehicle?.licensePlate || 'KL-07-SD-' + booking.refCode.slice(-4),
        originalPickupDate: booking.scheduledDate,
        originalReturnDate: currentReturnDate,
        requestedReturnDate,
        additionalDays,
        dailyRate,
        extensionPrice,
        existingTotalAmount,
        updatedTotalAmount,
        status: 'pending',
        adminNotes: notes || null,
        paymentStatus: 'pending'
      }
    });

    // Notify Admin Portal immediately with persistent disputeNotification
    await prisma.disputeNotification.create({
      data: {
        noticeId: extension.id,
        driverId: 'admin-master',
        targetRole: 'admin',
        eventType: 'rental_extension_requested',
        title: 'New Fleet Extension Request Received',
        message: `${booking.customerName} requested a ${additionalDays}-day extension for ${vehicle?.model || booking.rentalVehicleModel} (${extension.licensePlate}) until ${requestedReturnDate}. Additional: ₹${extensionPrice}.`
      }
    });

    return NextResponse.json(extension, { status: 201 });
  } catch (err) {
    console.error('POST /api/rental-extensions error:', err);
    return NextResponse.json({ error: 'Failed to submit rental extension request' }, { status: 500 });
  }
}
