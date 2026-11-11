import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/organization-wallet
// Calculates and returns Organization Wallet data according to Requirement 4:
// Category 1: Rental Revenue – earnings from self-drive vehicle rentals
// Category 2: Organization Commission – the organization's 60% share from completed driver rides
// Display the total organization wallet balance, individual transaction amounts, and transaction history.
export async function GET(req: NextRequest) {
  try {
    // Fetch completed bookings that have successful payment
    const completedBookings = await prisma.booking.findMany({
      where: {
        status: 'completed',
        OR: [
          { paymentStatus: 'completed' },
          { passengerPaid: true },
          { driverPaymentReceived: true },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: { driver: true, customer: true },
    });

    let rentalRevenue = 0;
    let organizationCommission = 0;
    const transactions: Array<{
      id: string;
      bookingRef: string;
      category: 'Rental Revenue' | 'Organization Commission';
      amount: number;
      details: string;
      customerName: string;
      driverName?: string;
      createdAt: string;
      status: 'completed';
    }> = [];

    // Map each completed booking to exactly one transaction (preventing duplicates)
    for (const b of completedBookings) {
      const isRental = b.serviceType === ('self_drive' as any) || Boolean(b.rentalVehicleId);
      const totalFare = (b.fareBreakdown as { totalFare?: number })?.totalFare || 0;

      if (isRental) {
        // Self-Drive Vehicle Rental Revenue
        const rentalAmount = totalFare;
        rentalRevenue += rentalAmount;
        transactions.push({
          id: `tx-rent-${b.id}`,
          bookingRef: b.refCode,
          category: 'Rental Revenue',
          amount: rentalAmount,
          details: `${b.rentalVehicleModel || 'Self-Drive Vehicle'} Rental (${b.scheduledDate} - ${b.returnDate || b.scheduledDate})`,
          customerName: b.customerName,
          createdAt: b.passengerPaidAt ? b.passengerPaidAt.toISOString() : b.createdAt.toISOString(),
          status: 'completed',
        });
      } else {
        // Driver Ride: 60% Organization Commission
        // Ensure 60% commission calculation
        const comm = b.platformCommission && b.platformCommission > 0
          ? b.platformCommission
          : Math.round(totalFare * 0.60);
        organizationCommission += comm;
        transactions.push({
          id: `tx-comm-${b.id}`,
          bookingRef: b.refCode,
          category: 'Organization Commission',
          amount: comm,
          details: `Commission from Driver Ride: ${b.pickupLocation} -> ${b.destinationLocation}`,
          customerName: b.customerName,
          driverName: b.driverName || b.driver?.name || 'Assigned Driver',
          createdAt: b.driverPaymentReceivedAt
            ? b.driverPaymentReceivedAt.toISOString()
            : (b.passengerPaidAt ? b.passengerPaidAt.toISOString() : b.createdAt.toISOString()),
          status: 'completed',
        });
      }
    }

    const totalBalance = rentalRevenue + organizationCommission;

    return NextResponse.json({
      totalBalance,
      rentalRevenue,
      organizationCommission,
      transactions,
    });
  } catch (err) {
    console.error('GET /api/organization-wallet error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch organization wallet', details: String(err) },
      { status: 500 }
    );
  }
}
