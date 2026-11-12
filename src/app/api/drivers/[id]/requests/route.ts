import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enforceDriverAccess } from '@/lib/auth';
import { isDriverVehicleCompatible } from '@/lib/validation';

// GET /api/drivers/[id]/requests
// Retrieves all pending and active ride requests directed to a specific authenticated driver
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: driverParam } = params;

    // Resolve driver by id, phone, or licenseNumber
    const driver = await prisma.driver.findFirst({
      where: {
        OR: [
          { id: driverParam },
          { phone: driverParam },
          { licenseNumber: driverParam },
        ],
      },
    });

    if (!driver) {
      console.warn(`[DIAGNOSTIC] Driver request retrieval failed: Driver not found for param "${driverParam}"`);
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    // Authorization: Only this specific driver or Admin may access requests
    const authError = await enforceDriverAccess(req, driver.id);
    if (authError) {
      return authError;
    }

    const cleanDriverPhone = (driver.phone || '').replace(/\D/g, '');

    // Diagnostic logging
    console.log(`[DIAGNOSTIC] Fetching driver requests for Driver: ${driver.name} (ID: ${driver.id}, Phone: ${driver.phone}, Status: ${driver.approvalStatus}, Online: ${driver.isOnline})`);

    // Fetch relevant bookings from PostgreSQL:
    // 1. Direct Exclusive bookings where this driver is the selected driver (pending, accepted, in_progress, completed)
    // 2. Exclusive Favourite bookings targeted to this driver
    // 3. Broadcast bookings (status: pending, requestQueueStatus: broadcast) where driver has not declined
    const allPendingOrActiveBookings = await prisma.booking.findMany({
      where: {
        OR: [
          // Directly assigned by driverId or driverPhone
          { driverId: driver.id },
          ...(cleanDriverPhone ? [{ driverPhone: { contains: cleanDriverPhone } }] : []),
          // Targeted favourite driver
          { favouriteDriverId: driver.id },
          // Broadcast pending requests available to online approved drivers
          {
            status: 'pending',
            requestQueueStatus: 'broadcast',
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: { customer: true },
    });

    // Check if driver is currently driving an active ride
    const isCurrentlyOnRide = allPendingOrActiveBookings.some(
      ride => (ride.driverId === driver.id || (ride.driverPhone && cleanDriverPhone && ride.driverPhone.replace(/\D/g, '') === cleanDriverPhone)) &&
        ['accepted', 'driver_arriving', 'arrived', 'in_progress', 'awaiting_payment'].includes(ride.status)
    );

    // Filter according to strict assignment rules
    const qualifiedRequests = allPendingOrActiveBookings.filter((b) => {
      // 1. Decline check: Exclude if driver has declined this booking or booking is declined
      if (b.status === 'declined' || (b.status === 'cancelled' && b.cancelledBy === 'driver')) {
        return false;
      }
      if (Array.isArray(b.declinedDriverIds) && b.declinedDriverIds.includes(driver.id)) {
        return false;
      }

      // 2. Completed / Cancelled: show only if assigned
      if (b.status === 'completed' || b.status === 'cancelled') {
        return b.driverId === driver.id || (b.driverPhone && cleanDriverPhone && b.driverPhone.replace(/\D/g, '') === cleanDriverPhone);
      }

      // 3. Website exclusive booking: ONLY the selected driver receives it
      if (b.selectedDriverExclusive || b.requestQueueStatus === 'exclusive_selected') {
        const isMatch = b.driverId === driver.id || (b.driverPhone && cleanDriverPhone && b.driverPhone.replace(/\D/g, '') === cleanDriverPhone);
        return isMatch;
      }

      // 4. WhatsApp exclusive favourite booking: ONLY the favourite driver receives it during exclusive window
      if (b.requestQueueStatus === 'exclusive_favourite') {
        const isExpired = b.exclusiveUntil && new Date(b.exclusiveUntil) < new Date();
        if (isExpired) {
          // If exclusive window expired, only compatible approved online drivers can see and accept it
          if (driver.approvalStatus !== 'approved' || !driver.isOnline) return false;
          if (isCurrentlyOnRide) return false;
          const bTrans = b.transmission || (b.customerVehicle as any)?.transmission;
          const bFuel = b.fuelType || (b.customerVehicle as any)?.fuel;
          if (!isDriverVehicleCompatible(driver, { transmission: bTrans, fuelType: bFuel })) return false;
          return true;
        }
        const isFav = b.favouriteDriverId === driver.id || b.driverId === driver.id || (b.driverPhone && cleanDriverPhone && b.driverPhone.replace(/\D/g, '') === cleanDriverPhone);
        return isFav;
      }

      // 5. Broadcast request: Eligible compatible approved and online drivers receive it
      if (b.status === 'pending' && b.requestQueueStatus === 'broadcast') {
        // Driver must be approved and online
        if (driver.approvalStatus !== 'approved') return false;
        if (!driver.isOnline) return false;
        // Exclude if driver is busy on another ride
        if (isCurrentlyOnRide) return false;
        // Exclude if driver is not compatible with customer's vehicle
        const bTrans = b.transmission || (b.customerVehicle as any)?.transmission;
        const bFuel = b.fuelType || (b.customerVehicle as any)?.fuel;
        if (!isDriverVehicleCompatible(driver, { transmission: bTrans, fuelType: bFuel })) return false;
        return true;
      }

      // 6. Active accepted / in_progress rides:
      const isAssigned = b.driverId === driver.id || (b.driverPhone && cleanDriverPhone && b.driverPhone.replace(/\D/g, '') === cleanDriverPhone);
      return isAssigned;
    });

    console.log(`[DIAGNOSTIC] Driver ${driver.name} (${driver.id}) retrieved ${qualifiedRequests.length} qualified requests.`);

    const { password: _pw, ...safeDriver } = driver;
    return NextResponse.json({
      success: true,
      driver: safeDriver,
      requests: qualifiedRequests,
      count: qualifiedRequests.length,
    });
  } catch (err: any) {
    console.error('[DIAGNOSTIC] Error in GET /api/drivers/[id]/requests:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve driver requests', details: err?.message },
      { status: 500 }
    );
  }
}
