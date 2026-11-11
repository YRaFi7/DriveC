import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';

// POST /api/bookings/[id]/credit-salary
// Requirement 1: Allow Drivers to Credit Salary to Their Wallet Only After Customer Payment
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const auth = await getAuthContext(req);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { driver: true, customer: true }
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Must be assigned to a driver
    if (!booking.driverId) {
      return NextResponse.json(
        { error: 'No driver is assigned to this booking.' },
        { status: 400 }
      );
    }

    // Role check: Only the assigned driver or admin can credit salary
    const callerDriverId = 
      auth.driverId || 
      req.headers.get('x-driver-id') || 
      body.driverId || 
      (auth.role === 'driver' ? auth.userId : null);

    const isAssignedDriver = Boolean(
      (callerDriverId && callerDriverId === booking.driverId) || 
      (auth.driverId && auth.driverId === booking.driverId) ||
      (auth.userId && auth.userId === booking.driverId)
    );
    const isAdmin = auth.role === 'admin' || req.headers.get('x-user-role') === 'admin';

    if (!isAssignedDriver && !isAdmin) {
      if (callerDriverId && callerDriverId !== booking.driverId) {
        return NextResponse.json(
          { error: 'Forbidden: You can only credit salary for your own completed trips.' },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: 'Forbidden: Unauthorized to credit driver salary.' },
        { status: 403 }
      );
    }

    // Ride completion check: Ride must be completed
    if (booking.status !== 'completed') {
      return NextResponse.json(
        { error: 'Ride must be completed before crediting salary.' },
        { status: 400 }
      );
    }

    // ── STRICT PAYMENT VERIFICATION ──────────────────────────────────────────
    // Requirement 1.A & 1.B: A driver must only be able to credit their eligible salary
    // after the customer has successfully completed payment.
    // If customer has not completed payment, block transaction and display exact error:
    // "Passenger hasn't paid yet"
    const isCustomerPaid = Boolean(
      booking.passengerPaid || 
      booking.paymentStatus === 'completed' || 
      booking.remainingPaid
    );

    if (!isCustomerPaid) {
      return NextResponse.json(
        {
          error: "Passenger hasn't paid yet",
          code: 'PASSENGER_NOT_PAID',
          message: "Passenger hasn't paid yet",
          eligibleSalaryPending: true,
          bookingRef: booking.refCode,
        },
        { status: 400 }
      );
    }

    // Check if salary was already credited (Idempotency check)
    if (booking.driverPaymentReceived || booking.salaryCreditTxId) {
      return NextResponse.json(
        {
          error: 'Salary for this ride has already been credited to your wallet.',
          code: 'ALREADY_CREDITED',
          creditedSalary: booking.driverCreditedSalary,
          creditedAt: booking.salaryCreditedAt || booking.driverPaymentReceivedAt
        },
        { status: 409 }
      );
    }

    // ── Calculate Driver 40% Salary (minus 3% penalty if delayed) ───────────
    const fb = (booking.fareBreakdown as Record<string, any>) || {};
    const totalFare = fb.totalFare || 0;
    const baseSalary = Math.round(totalFare * 0.40);
    const isDelayed = Boolean(body.isDelayed);
    const delayPenalty = isDelayed ? Math.round(baseSalary * 0.03) : 0;
    const netSalary = Math.max(0, baseSalary - delayPenalty);
    const platformCommission = totalFare - netSalary;

    const creditTxRef = `SAL-TXN-${booking.refCode}-${Date.now()}`;

    // Execute atomic credit transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create DriverWalletTransaction (guaranteed unique by bookingId)
      const walletTx = await tx.driverWalletTransaction.create({
        data: {
          driverId: booking.driverId!,
          bookingId: booking.id,
          bookingRef: booking.refCode,
          amount: netSalary,
          grossFare: totalFare,
          commission: platformCommission,
          status: 'completed',
          customerName: booking.customerName,
          passengerName: booking.passengerName,
          transactionRef: creditTxRef
        }
      });

      // 2. Increment driver's wallet balance and total earnings
      const updatedDriver = await tx.driver.update({
        where: { id: booking.driverId! },
        data: {
          walletBalance: { increment: netSalary },
          totalEarnings: { increment: netSalary },
        }
      });

      // 3. Update booking record with credit details
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          driverPaymentReceived: true,
          driverPaymentReceivedAt: new Date(),
          driverCreditedSalary: netSalary,
          platformCommission: platformCommission,
          salaryCreditTxId: walletTx.id,
          salaryCreditedAt: new Date()
        }
      });

      return { walletTx, updatedDriver, updatedBooking };
    });

    console.log(`[SALARY CREDIT] Credited ₹${netSalary} to Driver ${booking.driverId} for Booking ${booking.refCode}. Tx: ${result.walletTx.id}`);

    return NextResponse.json({
      success: true,
      creditedAmount: netSalary,
      creditedSalary: netSalary,
      salaryCreditTxId: result.walletTx.id,
      walletBalance: result.updatedDriver.walletBalance,
      transaction: result.walletTx,
      booking: result.updatedBooking,
      message: `₹${netSalary} successfully credited to driver wallet.`
    });
  } catch (err: any) {
    console.error('Error in POST /api/bookings/[id]/credit-salary:', err);
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Salary for this ride has already been credited to your wallet.', code: 'ALREADY_CREDITED' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to credit driver salary', details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
