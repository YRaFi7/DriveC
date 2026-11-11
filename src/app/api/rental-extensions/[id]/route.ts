import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext, enforceAdminAccess } from '@/lib/auth';

// GET /api/rental-extensions/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthContext(req);
    const { id } = params;

    const extension = await prisma.rentalExtension.findUnique({
      where: { id }
    });

    if (!extension) {
      return NextResponse.json({ error: 'Rental extension not found.' }, { status: 404 });
    }

    if (auth.role === 'customer') {
      const customerId = auth.customerId || auth.userId;
      if (extension.customerId !== customerId) {
        return NextResponse.json({ error: 'Forbidden: You cannot access another customer\'s extension.' }, { status: 403 });
      }
    } else if (auth.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Unauthorized role.' }, { status: 403 });
    }

    return NextResponse.json(extension);
  } catch (err) {
    console.error('GET /api/rental-extensions/[id] error:', err);
    return NextResponse.json({ error: 'Failed to fetch rental extension' }, { status: 500 });
  }
}

// PATCH /api/rental-extensions/[id]
// action: 'approve' | 'decline' | 'pay'
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthContext(req);
    const { id } = params;
    const body = await req.json();
    const { action, adminNotes, paymentMethod, transactionRef } = body;

    const extension = await prisma.rentalExtension.findUnique({
      where: { id }
    });

    if (!extension) {
      return NextResponse.json({ error: 'Rental extension request not found.' }, { status: 404 });
    }

    // ── ACTION 1: ADMIN APPROVES EXTENSION ───────────────────────────────────
    if (action === 'approve') {
      const adminAuthErr = await enforceAdminAccess(req);
      if (adminAuthErr) return adminAuthErr;

      if (extension.status !== 'pending') {
        return NextResponse.json(
          { error: `Cannot approve extension with status "${extension.status}". Only pending requests can be approved.` },
          { status: 400 }
        );
      }

      // Check Fleet Availability & Schedule Conflicts
      // 1. Vehicle offline / maintenance check
      if (extension.rentalVehicleId) {
        const vehicle = await prisma.rentalVehicle.findUnique({
          where: { id: extension.rentalVehicleId }
        });

        if (vehicle && !vehicle.isAvailable && vehicle.offlineUntil) {
          // If maintenance overlaps with requested extension
          if (vehicle.offlineUntil >= extension.originalReturnDate) {
            return NextResponse.json({
              error: 'maintenance_conflict',
              message: `Scheduling Conflict: Vehicle is scheduled for maintenance (${vehicle.maintenanceReason || 'Fleet Inspection'}) until ${vehicle.offlineUntil}. Extension cannot be approved.`
            }, { status: 409 });
          }
        }

        // 2. Conflicting confirmed reservations check
        const conflictingBookings = await prisma.booking.findMany({
          where: {
            id: { not: extension.bookingId },
            rentalVehicleId: extension.rentalVehicleId,
            status: { in: ['approved', 'accepted', 'in_progress'] }
          }
        });

        for (const b of conflictingBookings) {
          const bStart = b.scheduledDate;
          const bEnd = b.returnDate || b.scheduledDate;
          // Overlap check with extended period: [originalReturnDate, requestedReturnDate]
          if (extension.originalReturnDate <= bEnd && extension.requestedReturnDate >= bStart) {
            return NextResponse.json({
              error: 'booking_conflict',
              message: `Scheduling Conflict: Vehicle is already reserved by ${b.customerName} (${b.refCode}) from ${b.scheduledDate} to ${bEnd}. Extension period overlaps.`
            }, { status: 409 });
          }
        }
      }

      // Update extension to approved
      const updatedExt = await prisma.rentalExtension.update({
        where: { id },
        data: {
          status: 'approved',
          adminDecision: 'approved',
          approvedReturnDate: extension.requestedReturnDate,
          adminId: auth.userId || 'admin-master',
          adminNotes: adminNotes || null,
          decisionAt: new Date()
        }
      });

      // Update original rental booking
      const originalBooking = await prisma.booking.findUnique({
        where: { id: extension.bookingId }
      });

      if (originalBooking) {
        const fare = (originalBooking.fareBreakdown as any) || {};
        const newTotalFare = (fare.totalFare || 0) + extension.extensionPrice;
        const newRemaining = (originalBooking.remainingAmount ?? (fare.remainingAmount ?? Math.max(0, (fare.totalFare || 0) - (originalBooking.advanceAmount || 1000)))) + extension.extensionPrice;

        await prisma.booking.update({
          where: { id: originalBooking.id },
          data: {
            returnDate: extension.requestedReturnDate,
            extendedDays: (originalBooking.extendedDays || 0) + extension.additionalDays,
            extensionFee: (originalBooking.extensionFee || 0) + extension.extensionPrice,
            remainingAmount: newRemaining,
            fareBreakdown: {
              ...fare,
              totalFare: newTotalFare,
              remainingAmount: newRemaining,
              extendedDays: (originalBooking.extendedDays || 0) + extension.additionalDays,
              extensionFee: (originalBooking.extensionFee || 0) + extension.extensionPrice
            },
            notificationMessage: `Rental extension approved! Return date updated to ${extension.requestedReturnDate}. Extension amount of ₹${extension.extensionPrice} has been added along with your remaining payment on return.`
          }
        });
      }

      // Notify customer in Customer Portal
      await prisma.disputeNotification.create({
        data: {
          noticeId: extension.id,
          driverId: extension.customerId,
          targetRole: 'customer',
          eventType: 'rental_extension_approved',
          title: 'Rental Extension Approved',
          message: `Your extension for ${extension.vehicleModel} until ${extension.requestedReturnDate} has been approved by Admin. Extension amount of ₹${extension.extensionPrice} has been added along with your remaining payment on return.`
        }
      });

      return NextResponse.json({
        success: true,
        action: 'approved',
        extension: updatedExt
      });
    }

    // ── ACTION 2: ADMIN DECLINES EXTENSION ───────────────────────────────────
    if (action === 'decline') {
      const adminAuthErr = await enforceAdminAccess(req);
      if (adminAuthErr) return adminAuthErr;

      if (extension.status !== 'pending') {
        return NextResponse.json(
          { error: `Cannot decline extension with status "${extension.status}".` },
          { status: 400 }
        );
      }

      const updatedExt = await prisma.rentalExtension.update({
        where: { id },
        data: {
          status: 'declined',
          adminDecision: 'declined',
          adminId: auth.userId || 'admin-master',
          adminNotes: adminNotes || 'Declined due to operational scheduling.',
          decisionAt: new Date()
        }
      });

      // Original return date and amounts remain strictly unchanged!

      // Notify customer in Customer Portal
      await prisma.disputeNotification.create({
        data: {
          noticeId: extension.id,
          driverId: extension.customerId,
          targetRole: 'customer',
          eventType: 'rental_extension_declined',
          title: 'Rental Extension Declined',
          message: `Your extension request for ${extension.vehicleModel} was declined. Original return date remains ${extension.originalReturnDate}.`
        }
      });

      return NextResponse.json({
        success: true,
        action: 'declined',
        extension: updatedExt
      });
    }

    // ── ACTION 3: CUSTOMER PAYS EXTENSION AMOUNT ─────────────────────────────
    if (action === 'pay') {
      if (extension.status !== 'approved') {
        return NextResponse.json(
          { error: 'Cannot pay for an extension that has not been approved by Admin.' },
          { status: 400 }
        );
      }

      if (extension.paymentStatus === 'completed') {
        return NextResponse.json(
          { error: 'Payment for this extension has already been completed.' },
          { status: 400 }
        );
      }

      // Customer authorization
      if (auth.role === 'customer') {
        const callerId = auth.customerId || auth.userId;
        if (extension.customerId !== callerId) {
          return NextResponse.json(
            { error: 'Forbidden: You cannot pay for another customer\'s rental extension.' },
            { status: 403 }
          );
        }
      }

      const txRef = transactionRef || `EXT-PAY-${Date.now()}`;
      const payMethod = paymentMethod || 'upi';

      const updatedExt = await prisma.rentalExtension.update({
        where: { id },
        data: {
          paymentStatus: 'completed',
          paymentMethod: payMethod,
          paymentTransactionRef: txRef,
          paidAt: new Date()
        }
      });

      // Update original booking payment details
      const booking = await prisma.booking.findUnique({
        where: { id: extension.bookingId }
      });

      if (booking) {
        const currentRemaining = Math.max(0, (booking.remainingAmount || 0) - extension.extensionPrice);
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            remainingAmount: currentRemaining,
            remainingPaid: currentRemaining === 0 ? true : booking.remainingPaid,
            remainingPaidAt: currentRemaining === 0 ? new Date() : booking.remainingPaidAt
          }
        });
      }

      // Notify Admin
      await prisma.disputeNotification.create({
        data: {
          noticeId: extension.id,
          driverId: 'admin-master',
          targetRole: 'admin',
          eventType: 'rental_extension_paid',
          title: 'Rental Extension Payment Received',
          message: `${extension.customerName} completed payment of ₹${extension.extensionPrice} for rental extension (${extension.bookingRef}). Ref: ${txRef}.`
        }
      });

      // Notify Customer
      await prisma.disputeNotification.create({
        data: {
          noticeId: extension.id,
          driverId: extension.customerId,
          targetRole: 'customer',
          eventType: 'rental_extension_paid',
          title: 'Extension Payment Successful',
          message: `Payment of ₹${extension.extensionPrice} for ${extension.vehicleModel} was successful. Transaction: ${txRef}.`
        }
      });

      return NextResponse.json({
        success: true,
        action: 'paid',
        extension: updatedExt
      });
    }

    return NextResponse.json({ error: 'Invalid action. Use "approve", "decline", or "pay".' }, { status: 400 });
  } catch (err) {
    console.error('PATCH /api/rental-extensions/[id] error:', err);
    return NextResponse.json({ error: 'Failed to process rental extension' }, { status: 500 });
  }
}
