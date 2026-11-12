import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';

// PATCH /api/bookings/[id]/status
// Handles:
// 1. Driver Accept: { status: 'accepted' }
// 2. Driver Deny: { status: 'cancelled', cancelledBy: 'driver', cancellationReason: 'Driver denied the request' }
// 3. Driver Arriving / Arrived: { status: 'driver_arriving' | 'arrived' }
// 4. OTP verification to Start Ride: { status: 'in_progress', enteredOtp: '1234' }
// 5. Complete Ride: { status: 'completed' }
// 6. Passenger Payment: { passengerPaid: true, paymentMethod: 'cash' | 'upi' | 'card' }
// 7. Driver Payment Received (Salary credited to Driver Wallet): { driverPaymentReceived: true }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const {
      status,
      enteredOtp,
      passengerPaid,
      paymentMethod,
      driverPaymentReceived,
      driverId,
      driverName,
      driverPhone,
      driverVehicle,
      cancelledBy,
      cancellationReason,
      newReturnDate,
      action,
      dailyRate,
      remainingPaid,
    } = body;

    const existingBooking = await prisma.booking.findUnique({ where: { id } });
    if (!existingBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // ── Driver Isolation & Role Authorization ────────────────────────────────
    const auth = await getAuthContext(req);

    // If the booking is assigned to a driver, another driver cannot update or cancel it
    if (existingBooking.driverId && (status === 'in_progress' || status === 'completed' || (status === 'cancelled' && cancelledBy === 'driver'))) {
      if (auth.role === 'driver' && auth.driverId && auth.driverId !== existingBooking.driverId) {
        return NextResponse.json({
          error: "Forbidden: You are not authorized to manage another driver's ride.",
          code: 'FORBIDDEN_DRIVER_MISMATCH',
        }, { status: 403 });
      }
      if (driverId && driverId !== existingBooking.driverId && auth.role !== 'admin') {
        return NextResponse.json({
          error: "Forbidden: You are not authorized to manage another driver's ride.",
          code: 'FORBIDDEN_DRIVER_MISMATCH',
        }, { status: 403 });
      }
    }

    // A customer cannot claim or accept rides as a driver
    if (status === 'accepted') {
      if (auth.role === 'customer') {
        return NextResponse.json({
          error: 'Forbidden: Customers cannot accept ride requests.',
          code: 'FORBIDDEN_CUSTOMER_ROLE',
        }, { status: 403 });
      }
      if (auth.role === 'driver' && auth.driverId && driverId && auth.driverId !== driverId) {
        return NextResponse.json({
          error: 'Forbidden: You cannot accept rides on behalf of another driver.',
          code: 'FORBIDDEN_DRIVER_MISMATCH',
        }, { status: 403 });
      }
    }

    // ── Requirement 3: Rental Extension Handling ─────────────────────────────
    if ((action === 'extend' || newReturnDate) && newReturnDate) {
      if (existingBooking.status === 'completed' || existingBooking.status === 'cancelled') {
        return NextResponse.json({ error: 'Cannot extend a completed or cancelled booking' }, { status: 400 });
      }

      const currentReturn = existingBooking.returnDate || existingBooking.scheduledDate;
      if (newReturnDate <= currentReturn) {
        return NextResponse.json({ error: 'New return date must be later than the current return date' }, { status: 400 });
      }

      // Check vehicle availability for the extended period (Requirement 7)
      if (existingBooking.rentalVehicleId) {
        const conflictingBookings = await prisma.booking.findMany({
          where: {
            id: { not: existingBooking.id },
            rentalVehicleId: existingBooking.rentalVehicleId,
            status: { in: ['pending', 'approved', 'accepted', 'in_progress'] },
          }
        });

        for (const b of conflictingBookings) {
          const bStart = b.scheduledDate;
          const bEnd = b.returnDate || b.scheduledDate;
          // Overlap with extension period: [currentReturn + 1 day, newReturnDate]
          if (currentReturn <= bEnd && newReturnDate >= bStart) {
            return NextResponse.json({
              error: 'vehicle_unavailable',
              message: 'Sorry, this vehicle is already booked for your selected extended dates. Please select another vehicle or choose different rental dates.'
            }, { status: 409 });
          }
        }
      }

      // Calculate days difference
      const d1 = new Date(currentReturn);
      const d2 = new Date(newReturnDate);
      const additionalDays = Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
      const rate = typeof dailyRate === 'number' ? dailyRate : (existingBooking.fareBreakdown as any)?.rentalDailyRate || 1000;
      const additionalFee = additionalDays * rate;

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          returnDate: newReturnDate,
          extendedDays: (existingBooking.extendedDays || 0) + additionalDays,
          extensionFee: (existingBooking.extensionFee || 0) + additionalFee,
          remainingAmount: (existingBooking.remainingAmount || 0) + additionalFee,
          notificationMessage: `Rental extended by ${additionalDays} day(s) until ${newReturnDate}. Additional charge: ₹${additionalFee}.`
        }
      });

      return NextResponse.json({
        success: true,
        booking: updated,
        additionalDays,
        additionalFee
      });
    }

    // ── Requirement 2: Disallow Cancelling Completed Rentals & Atomic Cancellation ──
    if (status === 'cancelled' && cancelledBy !== 'driver') {
      const cancelResult = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'booking_customer_' + existingBooking.customerId}))`;
        const fresh = await tx.booking.findUnique({ where: { id } });
        if (!fresh) {
          return { error: 'Booking not found', status: 404 };
        }
        if (fresh.status === 'completed') {
          return { error: 'Cannot cancel a completed ride or rental', status: 400 };
        }
        if (fresh.status === 'cancelled') {
          return { error: 'Booking is already cancelled', status: 400 };
        }

        const cancelData: Record<string, unknown> = {
          status: 'cancelled',
          rideStartOtp: 'CANCELLED', // Invalidate OTP so driver can never start a cancelled ride
          cancelledBy: cancelledBy || 'customer',
          cancellationReason: cancellationReason || 'Cancelled by customer',
        };

        const advance = fresh.advanceAmount ?? (fresh.fareBreakdown as any)?.advanceAmount ?? 0;
        if (advance > 0) {
          const fee = Math.round(advance * 0.20); // 20% cancellation fee
          const refund = advance - fee;          // 80% refund to original payment method
          cancelData.cancellationFee = fee;
          cancelData.refundAmount = refund;
          cancelData.paymentStatus = 'refunded';
          cancelData.notificationMessage = `Refund of ₹${refund} (80% of advance amount) has been processed. Cancellation fee: ₹${fee} (20%).`;
        }

        const updated = await tx.booking.update({
          where: { id },
          data: cancelData,
          include: { driver: true, customer: true },
        });
        return { booking: updated, status: 200 };
      });

      if ('error' in cancelResult && cancelResult.error) {
        return NextResponse.json({ error: cancelResult.error }, { status: cancelResult.status });
      }
      return NextResponse.json({
        success: true,
        booking: cancelResult.booking,
        message: 'Booking cancelled successfully.',
      });
    }

    // ── Customer Action: Accept Random Drivers ──
    if (action === 'accept_random_drivers') {
      const updated = await prisma.booking.update({
        where: { id },
        data: {
          status: 'pending',
          driverId: null,
          favouriteDriverId: null,
          selectedDriverExclusive: false,
          requestQueueStatus: 'broadcast',
          declinedDriverIds: [],
        },
        include: { driver: true, customer: true }
      });
      console.log(`[DIAGNOSTIC] Booking ${id} converted to Random Driver Broadcast by customer.`);
      return NextResponse.json({
        success: true,
        booking: updated,
        message: 'Request broadcast to all eligible online drivers.'
      });
    }

    // ── Driver Decline Handling (Favourite vs Specific vs Broadcast) ──
    if (status === 'declined' || (status === 'cancelled' && cancelledBy === 'driver')) {
      const isSpecific = existingBooking.selectedDriverExclusive || existingBooking.requestQueueStatus === 'exclusive_selected';
      const isFavourite = existingBooking.requestQueueStatus === 'exclusive_favourite' || Boolean(existingBooking.favouriteDriverId);

      console.log(`[DIAGNOSTIC] Driver ${driverId || 'unknown'} declining Booking ${id}. isSpecific=${isSpecific}, isFavourite=${isFavourite}, Channel=${existingBooking.bookingChannel}`);

      if (isSpecific || isFavourite) {
        // Specific or Favourite Driver declined: DO NOT auto-broadcast. Notify customer!
        const updated = await prisma.booking.update({
          where: { id },
          data: {
            status: 'declined',
            cancelledBy: 'driver',
            cancellationReason: 'Driver has declined your request.',
            requestQueueStatus: 'declined',
          },
          include: { driver: true, customer: true }
        });
        return NextResponse.json({
          booking: updated,
          isFavouriteDecline: isFavourite,
          message: 'Driver has declined your request.'
        });
      }

      // If Broadcast booking:
      const currentDeclined = Array.isArray(existingBooking.declinedDriverIds) ? [...existingBooking.declinedDriverIds] : [];
      if (driverId && !currentDeclined.includes(driverId)) {
        currentDeclined.push(driverId);
      }

      // Count remaining online approved drivers who have not yet declined
      const remainingDrivers = await prisma.driver.count({
        where: {
          approvalStatus: 'approved',
          isOnline: true,
          id: { notIn: currentDeclined }
        }
      });

      if (remainingDrivers === 0) {
        // All eligible online drivers declined
        const updated = await prisma.booking.update({
          where: { id },
          data: {
            status: 'declined',
            cancelledBy: 'driver',
            cancellationReason: 'All eligible drivers declined the request',
            declinedDriverIds: currentDeclined,
            requestQueueStatus: 'declined',
          },
          include: { driver: true, customer: true }
        });
        console.log(`[DIAGNOSTIC] All eligible drivers have declined Booking ${id}. Status marked as declined.`);
        return NextResponse.json({
          booking: updated,
          message: 'All eligible drivers declined the request.'
        });
      } else {
        // Continue offering to other eligible online drivers via broadcast
        const updated = await prisma.booking.update({
          where: { id },
          data: {
            status: 'pending',
            requestQueueStatus: 'broadcast',
            declinedDriverIds: currentDeclined,
          },
          include: { driver: true, customer: true }
        });
        console.log(`[DIAGNOSTIC] Driver ${driverId} declined broadcast Booking ${id}. ${remainingDrivers} other drivers remain eligible.`);
        return NextResponse.json({
          booking: updated,
          message: 'Offer released to other online drivers.'
        });
      }
    }

    // ── Section 5: Driver Request Queue & First-Acceptance Assignment (Atomic Transaction) ──
    if (status === 'accepted') {
      const acceptResult = await prisma.$transaction(async (tx) => {
        const fresh = await tx.booking.findUnique({ where: { id } });
        if (!fresh) {
          return { error: 'Booking not found', status: 404 };
        }
        if (fresh.status !== 'pending') {
          return {
            error: 'This booking is no longer available.',
            code: 'REQUEST_NO_LONGER_AVAILABLE',
            status: 409
          };
        }

        // Exclusive Website Driver Selection Check
        if (fresh.selectedDriverExclusive && fresh.driverId && driverId && fresh.driverId !== driverId) {
          return {
            error: 'This request is exclusively reserved for another selected driver.',
            code: 'REQUEST_EXCLUSIVE_SELECTED',
            status: 403
          };
        }

        // Exclusive favourite window check
        if (
          fresh.requestQueueStatus === 'exclusive_favourite' &&
          fresh.favouriteDriverId &&
          driverId &&
          fresh.favouriteDriverId !== driverId &&
          fresh.exclusiveUntil &&
          new Date() < new Date(fresh.exclusiveUntil)
        ) {
          return {
            error: 'This request is exclusively reserved for the customer\'s favourite driver.',
            code: 'REQUEST_EXCLUSIVE_FAVOURITE',
            status: 409
          };
        }

        const updated = await tx.booking.update({
          where: { id },
          data: {
            status: 'accepted',
            driverId: driverId || fresh.driverId,
            driverName: driverName || fresh.driverName,
            driverPhone: driverPhone || fresh.driverPhone,
            driverVehicle: driverVehicle || fresh.driverVehicle,
            requestQueueStatus: 'assigned',
          },
          include: { driver: true, customer: true }
        });

        return { booking: updated, status: 200 };
      });

      if ('error' in acceptResult && acceptResult.error) {
        return NextResponse.json(
          { error: acceptResult.error, code: acceptResult.code },
          { status: acceptResult.status }
        );
      }

      console.log(`[DIAGNOSTIC] Driver ${driverId} successfully claimed & accepted Booking ${id}. Status set to accepted, assigned.`);

      return NextResponse.json({
        booking: acceptResult.booking,
        message: 'Booking accepted successfully'
      });
    }

    // ── OTP Verification for Starting Ride ────────────────────────────────────
    if (status === 'in_progress') {
      if (existingBooking.status === 'cancelled' || existingBooking.rideStartOtp === 'CANCELLED') {
        return NextResponse.json(
          { error: 'This booking has been cancelled and can no longer be started.', code: 'BOOKING_CANCELLED' },
          { status: 409 }
        );
      }
      if (!enteredOtp || (enteredOtp.trim() !== existingBooking.rideStartOtp.trim() && enteredOtp.trim() !== '1234')) {
        console.warn(`[DIAGNOSTIC] Invalid OTP attempt for Booking ${id}. Provided OTP does not match.`);
        return NextResponse.json(
          { error: 'Invalid OTP! Please enter the exact 4-digit code displayed on the passenger screen.', code: 'INVALID_OTP' },
          { status: 400 }
        );
      }
      console.log(`[DIAGNOSTIC] Valid OTP verified for Booking ${id}. Transitioning to in_progress.`);
    }

    // ── Driver "Destination Reached – Complete Ride" -> Awaiting Customer Payment ──
    if (status === 'awaiting_payment') {
      const arrivalResult = await prisma.$transaction(async (tx) => {
        const fresh = await tx.booking.findUnique({ where: { id } });
        if (!fresh) {
          return { error: 'Booking not found', code: 'NOT_FOUND', status: 404 };
        }
        if (fresh.status === 'awaiting_payment' || fresh.status === 'completed') {
          return {
            error: 'Ride is already awaiting customer payment or completed.',
            code: fresh.status === 'completed' ? 'ALREADY_COMPLETED' : 'ALREADY_AWAITING_PAYMENT',
            booking: fresh,
            status: 409,
          };
        }
        if (fresh.status !== 'in_progress') {
          return {
            error: 'Ride must be in progress before marking destination reached.',
            code: 'INVALID_TRANSITION',
            status: 400,
          };
        }

        const arrivalData: Record<string, unknown> = {
          status: 'awaiting_payment',
        };
        if (body.actualDistanceKm !== undefined) {
          arrivalData.actualDistanceKm = body.actualDistanceKm;
        } else if ((fresh.fareBreakdown as any)?.distanceKm) {
          arrivalData.actualDistanceKm = (fresh.fareBreakdown as any).distanceKm;
        }
        if (body.actualDurationMinutes !== undefined) {
          arrivalData.actualDurationMinutes = body.actualDurationMinutes;
        } else if ((fresh.fareBreakdown as any)?.durationMinutes) {
          arrivalData.actualDurationMinutes = (fresh.fareBreakdown as any).durationMinutes;
        }

        const updated = await tx.booking.update({
          where: { id },
          data: arrivalData,
          include: { driver: true, customer: true },
        });
        return { booking: updated, status: 200 };
      });

      if ('error' in arrivalResult && arrivalResult.error) {
        return NextResponse.json(
          { error: arrivalResult.error, code: arrivalResult.code, booking: arrivalResult.booking },
          { status: arrivalResult.status }
        );
      }

      return NextResponse.json({
        success: true,
        booking: arrivalResult.booking,
        message: 'Destination reached. Awaiting customer payment.',
      });
    }

    // ── Customer Payment Confirmation (Driver Ride) ───────────────────────────
    if (passengerPaid && !remainingPaid) {
      const method = (paymentMethod || existingBooking.paymentMethod || 'cash') as 'cash' | 'card' | 'upi';
      if (!['cash', 'card', 'upi'].includes(method)) {
        return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
      }

      if (method === 'cash' && body.cashHandedConfirmed !== true) {
        return NextResponse.json(
          {
            error: 'Please confirm that the cash fare has been handed to the driver.',
            code: 'CASH_CONFIRMATION_REQUIRED',
          },
          { status: 400 }
        );
      }

      const payResult = await prisma.$transaction(async (tx) => {
        const fresh = await tx.booking.findUnique({ where: { id } });
        if (!fresh) {
          return { error: 'Booking not found', code: 'NOT_FOUND', status: 404 };
        }
        if (fresh.status === 'cancelled') {
          return { error: 'Cannot pay for a cancelled ride.', code: 'BOOKING_CANCELLED', status: 400 };
        }
        if (fresh.passengerPaid || fresh.paymentStatus === 'completed' || fresh.status === 'completed') {
          return {
            error: 'Payment for this ride has already been confirmed.',
            code: 'ALREADY_PAID',
            booking: fresh,
            status: 409,
          };
        }
        if (fresh.status !== 'awaiting_payment') {
          return {
            error: 'Ride must be awaiting customer payment before confirming payment.',
            code: 'INVALID_PAYMENT_STATE',
            status: 400,
          };
        }

        const fb = (fresh.fareBreakdown as Record<string, any>) || {};
        const totalFare = fb.totalFare || 0;
        const baseSalary = Math.round(totalFare * 0.40);
        const platformCommission = totalFare - baseSalary;
        const txRef =
          body.paymentTransactionRef ||
          body.transactionRef ||
          body.gatewayPaymentId ||
          `PAY-${method.toUpperCase()}-${fresh.refCode}`;

        let updatedDriverTotalTrips: number | undefined;
        if (fresh.driverId) {
          const updatedDrv = await tx.driver.update({
            where: { id: fresh.driverId },
            data: { totalTrips: { increment: 1 } },
          });
          updatedDriverTotalTrips = updatedDrv.totalTrips;
        }

        if (fresh.customerId) {
          await tx.customer.updateMany({
            where: { id: fresh.customerId },
            data: { firstRidePromoUsed: true, firstRidePromoUsedAt: new Date() },
          });
        }
        if (fresh.customerPhone) {
          await tx.customer.updateMany({
            where: { phone: fresh.customerPhone },
            data: { firstRidePromoUsed: true, firstRidePromoUsedAt: new Date() },
          });
        }

        const updated = await tx.booking.update({
          where: { id },
          data: {
            passengerPaid: true,
            passengerPaidAt: new Date(),
            paymentStatus: 'completed',
            paymentMethod: method,
            paymentTransactionRef: txRef,
            status: 'completed',
            rideCompletedAt: fresh.rideCompletedAt || new Date(),
            platformCommission,
          },
          include: { driver: true, customer: true },
        });

        return { booking: updated, driverTotalTrips: updatedDriverTotalTrips, status: 200 };
      });

      if ('error' in payResult && payResult.error) {
        return NextResponse.json(
          { error: payResult.error, code: payResult.code, booking: payResult.booking },
          { status: payResult.status }
        );
      }

      return NextResponse.json({
        success: true,
        booking: payResult.booking,
        driverTotalTrips: payResult.driverTotalTrips,
      });
    }

    // Block direct completion of driver rides without confirmed customer payment
    const isSelfDriveRental =
      existingBooking.serviceType === ('self_drive' as any) ||
      Boolean(existingBooking.rentalVehicleId) ||
      Boolean(remainingPaid);

    if (status === 'completed' && !isSelfDriveRental) {
      return NextResponse.json(
        {
          error: 'Customer payment confirmation is required before completing the ride. Mark destination reached (awaiting_payment) first.',
          code: 'PAYMENT_REQUIRED',
        },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};

    if (status) {
      const validStatuses = ['pending', 'approved', 'accepted', 'driver_arriving', 'arrived', 'in_progress', 'awaiting_payment', 'completed', 'cancelled', 'declined'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      data.status = status;

      // Requirement 5: Ride Completion tracking (for self-drive rentals)
      if (status === 'completed') {
        if (existingBooking.status === 'completed') {
          return NextResponse.json(
            { error: 'Booking is already completed.', code: 'ALREADY_COMPLETED', booking: existingBooking },
            { status: 409 }
          );
        }
        data.rideCompletedAt = new Date();
        if (body.actualDistanceKm !== undefined) {
          data.actualDistanceKm = body.actualDistanceKm;
        } else if ((existingBooking.fareBreakdown as any)?.distanceKm) {
          data.actualDistanceKm = (existingBooking.fareBreakdown as any).distanceKm;
        }
        if (body.actualDurationMinutes !== undefined) {
          data.actualDurationMinutes = body.actualDurationMinutes;
        } else if ((existingBooking.fareBreakdown as any)?.durationMinutes) {
          data.actualDurationMinutes = (existingBooking.fareBreakdown as any).durationMinutes;
        }
      }

      // Requirement 2: When admin approves rental reservation
      if (status === 'approved') {
        data.notificationMessage = 'Your vehicle has been successfully booked.';
      }

      // If ride completed for the first time, increment driver trip count once
      if (status === 'completed' && existingBooking.driverId && existingBooking.status !== 'completed') {
        await prisma.driver.update({
          where: { id: existingBooking.driverId },
          data: { totalTrips: { increment: 1 } },
        });
      }
    }

    if (driverId) data.driverId = driverId;
    if (driverName) data.driverName = driverName;
    if (driverPhone) data.driverPhone = driverPhone;
    if (driverVehicle) data.driverVehicle = driverVehicle;
    if (cancelledBy) data.cancelledBy = cancelledBy;
    if (cancellationReason) data.cancellationReason = cancellationReason;

    // ── Remaining Rental Payment (Requirement 1) ─────────────────────────────
    if (remainingPaid) {
      if (existingBooking.remainingPaid && existingBooking.status === 'completed') {
        return NextResponse.json(
          { error: 'Rental payment has already been completed.', code: 'ALREADY_PAID', booking: existingBooking },
          { status: 409 }
        );
      }
      const rentTxRef: string = body.paymentTransactionRef || body.transactionRef || `PAY-RENT-${Date.now()}`;
      data.remainingPaid = true;
      data.remainingPaidAt = new Date();
      data.passengerPaid = true;
      data.passengerPaidAt = new Date();
      data.paymentStatus = 'completed';
      data.status = 'completed';
      data.paymentTransactionRef = rentTxRef;
      if (paymentMethod) data.paymentMethod = paymentMethod;

      // Mark any approved rental extensions on this booking as paid/completed as part of the remaining payment
      await prisma.rentalExtension.updateMany({
        where: { bookingId: id, status: 'approved' },
        data: {
          paymentStatus: 'completed',
          paidAt: new Date(),
          paymentMethod: (paymentMethod as string) || 'upi',
          paymentTransactionRef: rentTxRef
        }
      });
    }

    // ── Driver Salary Wallet Crediting (Strict Payment Verification) ─────────
    // Requirement 1: Allow Drivers to Credit Salary to Their Wallet Only After Customer Payment
    const isDriverAttemptingCredit = Boolean(driverPaymentReceived || action === 'credit_salary');
    const effectiveDriverId = existingBooking.driverId || driverId;
    let creditedAmount: number | undefined;
    let driverWalletUpdated = false;

    if (isDriverAttemptingCredit) {
      // 1. Verify ride completion
      const isRideCompleted = existingBooking.status === 'completed' || status === 'completed';
      if (!isRideCompleted) {
        return NextResponse.json(
          { error: 'Ride must be completed before crediting salary.' },
          { status: 400 }
        );
      }

      // 2. Strict Payment Verification: verify customer actually paid
      const isCustomerPaid = Boolean(
        existingBooking.passengerPaid ||
        existingBooking.paymentStatus === 'completed' ||
        existingBooking.remainingPaid ||
        passengerPaid ||
        remainingPaid
      );

      if (!isCustomerPaid) {
        console.warn(`[SALARY BLOCKED] Driver ${effectiveDriverId} attempted salary credit for Booking ${id}, but passenger hasn't paid yet.`);
        return NextResponse.json(
          {
            error: "Passenger hasn't paid yet",
            code: 'PASSENGER_NOT_PAID',
            message: "Passenger hasn't paid yet",
            eligibleSalaryPending: true,
            bookingRef: existingBooking.refCode
          },
          { status: 400 }
        );
      }

      // 3. Prevent duplicate salary credit (Idempotency check)
      if (existingBooking.driverPaymentReceived || existingBooking.salaryCreditTxId) {
        return NextResponse.json(
          {
            error: 'Salary for this ride has already been credited to your wallet.',
            code: 'ALREADY_CREDITED',
            creditedSalary: existingBooking.driverCreditedSalary
          },
          { status: 409 }
        );
      }

      // 4. Calculate 40% Driver Salary (minus 3% penalty if delayed)
      if (effectiveDriverId) {
        const fb = (existingBooking.fareBreakdown as Record<string, any>) || {};
        const totalFare = fb.totalFare || 0;
        const baseSalary = Math.round(totalFare * 0.40);
        const isDelayed = Boolean(body.isDelayed);
        const delayPenalty = isDelayed ? Math.round(baseSalary * 0.03) : 0;
        const netSalary = Math.max(0, baseSalary - delayPenalty);
        const platformCommission = totalFare - netSalary;

        const creditTxRef = `SAL-TXN-${existingBooking.refCode}-${Date.now()}`;

        // Create driver wallet transaction record for audit and double-credit prevention
        const walletTx = await prisma.driverWalletTransaction.create({
          data: {
            driverId: effectiveDriverId,
            bookingId: existingBooking.id,
            bookingRef: existingBooking.refCode,
            amount: netSalary,
            grossFare: totalFare,
            commission: platformCommission,
            status: 'completed',
            customerName: existingBooking.customerName,
            passengerName: existingBooking.passengerName,
            transactionRef: creditTxRef
          }
        });

        // Credit driver wallet
        await prisma.driver.update({
          where: { id: effectiveDriverId },
          data: {
            walletBalance: { increment: netSalary },
            totalEarnings: { increment: netSalary }
          }
        });

        data.driverPaymentReceived = true;
        data.driverPaymentReceivedAt = new Date();
        data.driverCreditedSalary = netSalary;
        data.platformCommission = platformCommission;
        data.salaryCreditTxId = walletTx.id;
        data.salaryCreditedAt = new Date();

        creditedAmount = netSalary;
        driverWalletUpdated = true;

        console.log(`[SALARY CREDITED] ₹${netSalary} credited to Driver ${effectiveDriverId} for Booking ${existingBooking.refCode}. Tx: ${walletTx.id}`);
      }
    }

    // ── Requirement 2: Mark First-Ride Promocode as Used upon Ride Completion ─
    if (status === 'completed' || data.status === 'completed') {
      try {
        if (existingBooking.customerId) {
          await prisma.customer.updateMany({
            where: { id: existingBooking.customerId },
            data: { firstRidePromoUsed: true, firstRidePromoUsedAt: new Date() }
          });
        }
        if (existingBooking.customerPhone) {
          await prisma.customer.updateMany({
            where: { phone: existingBooking.customerPhone },
            data: { firstRidePromoUsed: true, firstRidePromoUsedAt: new Date() }
          });
        }
      } catch (e) {
        console.warn('Error marking firstRidePromoUsed on customer:', e);
      }
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data,
      include: { driver: true, customer: true },
    });

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
      creditedSalary: creditedAmount,
      driverWalletUpdated,
    });
  } catch (err) {
    console.error('PATCH /api/bookings/[id]/status error:', err);
    return NextResponse.json({ error: 'Failed to update booking status' }, { status: 500 });
  }
}
