import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/bookings
// Query params:
//   ?customerId=<id>   — bookings for a specific customer
//   ?driverId=<id>     — bookings for a specific driver
//   ?status=<status>   — filter by status
//   ?includeBroadcast=true — also include broadcast pending bookings for online drivers
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const driverId = searchParams.get('driverId');
    const status = searchParams.get('status');
    const includeBroadcast = searchParams.get('includeBroadcast') === 'true';

    let where: Record<string, unknown> = {};
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;

    if (driverId) {
      if (includeBroadcast) {
        where = {
          ...where,
          OR: [
            { driverId },
            { favouriteDriverId: driverId },
            { status: 'pending', requestQueueStatus: 'broadcast' },
          ],
        };
      } else {
        where.driverId = driverId;
      }
    }

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { customer: true, driver: true },
    });

    console.log(`[DIAGNOSTIC] GET /api/bookings retrieved ${bookings.length} bookings. Filters: customerId=${customerId || 'none'}, driverId=${driverId || 'none'}, status=${status || 'none'}, includeBroadcast=${includeBroadcast}`);

    return NextResponse.json(bookings);
  } catch (err) {
    console.error('[DIAGNOSTIC] GET /api/bookings error:', err);
    return NextResponse.json({ error: 'Failed to fetch bookings', details: String(err) }, { status: 500 });
  }
}

// POST /api/bookings — create new booking
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      refCode, customerId, customerName, customerPhone,
      passengerName, passengerPhone,
      serviceType, vehicleCategory,
      pickupLocation, destinationLocation,
      stops, scheduledDate, scheduledTime,
      isRoundTrip, returnDate, returnTime,
      durationHours, flightTrainNumber,
      medicalNotes, hospitalNotes, tourItineraryNotes, tourNotes,
      fareBreakdown, rideStartOtp,
      paymentMethod, emergencyContact,
      driverId, driverName, driverPhone, driverVehicle, driverRating,
      rentalVehicleId, rentalVehicleModel,
      advanceAmount, remainingAmount,
      offlineUntil,
    } = body;

    const effectiveDest = destinationLocation || (serviceType === 'hourly-driver' || serviceType === 'hourly_driver' ? 'In-City / As Directed' : pickupLocation);
    const effectiveRefCode = refCode || `DC-DRV-${Math.floor(10000 + Math.random() * 90000)}`;
    const effectiveOtp = rideStartOtp || Math.floor(1000 + Math.random() * 9000).toString();

    if (!customerId || !customerName || !customerPhone || !serviceType || !vehicleCategory || !pickupLocation || !scheduledDate || !scheduledTime || !fareBreakdown) {
      return NextResponse.json({ error: 'Missing required booking fields' }, { status: 400 });
    }

    // ── Requirement 7: Prevent Double Booking of Rental Vehicles ─────────────
    const isRental = serviceType === 'self-drive' || serviceType === 'self_drive' || Boolean(rentalVehicleId);
    if (isRental && rentalVehicleId) {
      // Validate advance payment status
      if (body.advancePaid === false || body.paymentFailed === true) {
        return NextResponse.json({
          error: 'advance_payment_failed',
          message: 'Advance payment failed or was not completed. Reservation cannot be created without advance payment.'
        }, { status: 400 });
      }

      // Validate pickup and return dates
      if (!scheduledDate || (returnDate && returnDate < scheduledDate)) {
        return NextResponse.json({
          error: 'invalid_dates',
          message: 'Return date must be on or after the pickup date.'
        }, { status: 400 });
      }

      // ── Requirement 1, 3, 5: Backend Vehicle Maintenance & Availability Revalidation ──
      const dbVehicle = await prisma.rentalVehicle.findUnique({
        where: { id: rentalVehicleId }
      });

      const effectiveOfflineUntil = dbVehicle?.offlineUntil || offlineUntil;
      const effectiveIsAvailable = dbVehicle ? dbVehicle.isAvailable : !offlineUntil;

      // If vehicle is marked offline / under maintenance
      if (!effectiveIsAvailable) {
        if (effectiveOfflineUntil && scheduledDate < effectiveOfflineUntil) {
          return NextResponse.json({
            error: 'vehicle_maintenance',
            expectedDate: effectiveOfflineUntil,
            message: `This vehicle is currently under maintenance. We expect it to be available again on ${effectiveOfflineUntil}. Thank you for your patience. We appreciate your understanding and look forward to serving you.`
          }, { status: 409 });
        } else if (!effectiveOfflineUntil) {
          return NextResponse.json({
            error: 'vehicle_maintenance',
            message: `This vehicle is currently under maintenance. Thank you for your patience. We appreciate your understanding and look forward to serving you.`
          }, { status: 409 });
        }
        // If scheduledDate >= effectiveOfflineUntil, future reservation is allowed!
      } else if (effectiveOfflineUntil && scheduledDate < effectiveOfflineUntil) {
        return NextResponse.json({
          error: 'vehicle_maintenance',
          expectedDate: effectiveOfflineUntil,
          message: `This vehicle is currently under maintenance. We expect it to be available again on ${effectiveOfflineUntil}. Thank you for your patience. We appreciate your understanding and look forward to serving you.`
        }, { status: 409 });
      }

      // Check overlapping bookings
      const reqStart = scheduledDate;
      const reqEnd = returnDate || scheduledDate;

      const activeBookings = await prisma.booking.findMany({
        where: {
          rentalVehicleId,
          status: { in: ['pending', 'approved', 'accepted', 'in_progress'] },
        }
      });

      for (const b of activeBookings) {
        const bStart = b.scheduledDate;
        const bEnd = b.returnDate || b.scheduledDate;
        if (reqStart <= bEnd && reqEnd >= bStart) {
          return NextResponse.json({
            error: 'vehicle_unavailable',
            message: 'Sorry, this vehicle is already booked for your selected dates. Please select another vehicle or choose different rental dates.'
          }, { status: 409 });
        }
      }
    }

    // Ensure customer exists in database so foreign key doesn't fail
    let validCustomerId = customerId;
    const existingCust = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!existingCust) {
      const custByPhone = await prisma.customer.findFirst({ where: { phone: customerPhone } });
      if (custByPhone) {
        validCustomerId = custByPhone.id;
      } else {
        const newCust = await prisma.customer.create({
          data: {
            name: customerName,
            phone: customerPhone,
            email: `${customerPhone.replace(/\D/g, '') || Date.now()}_${Date.now()}@customer.drivec.in`,
            city: 'Kochi',
            password: 'customer123',
          },
        });
        validCustomerId = newCust.id;
      }
    }

    // ── Requirement 2: Verify Promocode Eligibility on Backend ──────────────
    // The existing 50% off promocode offer must be available to every customer ONLY for their first completed ride.
    const completedRidesCount = await prisma.booking.count({
      where: {
        OR: [
          { customerId: validCustomerId },
          { customerPhone }
        ],
        status: 'completed'
      }
    });

    const customerDb = await prisma.customer.findFirst({
      where: { OR: [{ id: validCustomerId }, { phone: customerPhone }] }
    });

    const isPromoUsed = Boolean(customerDb?.firstRidePromoUsed || completedRidesCount > 0);
    const claimedPromo = (body.promoCode || '').trim().toUpperCase();
    const claimedDiscount = fareBreakdown?.discountAmount || 0;

    if (isPromoUsed) {
      // If customer has already completed their first ride, prevent 50% discount
      if (claimedPromo === 'DRIVECFIRST' || claimedPromo === 'FIRST50' || (claimedDiscount > 0 && claimedPromo !== 'KOCHI2026')) {
        return NextResponse.json({
          error: 'first_ride_promo_expired',
          message: 'Your first-ride 50% off offer has already been used.'
        }, { status: 400 });
      }
    }

    // Verify driver exists if driverId provided (try ID, phone, or name)
    let validDriverId: string | null = null;
    let targetDriverObj = null;

    if (driverId) {
      const existingDriver = await prisma.driver.findUnique({ where: { id: driverId } });
      if (existingDriver) {
        validDriverId = existingDriver.id;
        targetDriverObj = existingDriver;
      }
    }
    if (!validDriverId && driverPhone) {
      const cleanPhone = driverPhone.replace(/\D/g, '');
      const existingDriverByPhone = await prisma.driver.findFirst({
        where: {
          OR: [
            { phone: driverPhone },
            ...(cleanPhone ? [{ phone: { contains: cleanPhone } }] : [])
          ]
        }
      });
      if (existingDriverByPhone) {
        validDriverId = existingDriverByPhone.id;
        targetDriverObj = existingDriverByPhone;
      }
    }
    if (!validDriverId && driverName) {
      const existingDriverByName = await prisma.driver.findFirst({
        where: { name: { equals: driverName, mode: 'insensitive' } }
      });
      if (existingDriverByName) {
        validDriverId = existingDriverByName.id;
        targetDriverObj = existingDriverByName;
      }
    }

    // ── Driver Selection Mode Resolution (Favourite vs Specific vs Random Broadcast) ──
    const isRandomChoice = Boolean(body.acceptRandomDrivers || body.driverSelectionMode === 'random' || body.requestQueueStatus === 'broadcast');
    const isFavChoice = !isRandomChoice && Boolean(body.favouriteDriverId || body.driverSelectionMode === 'favourite');
    const isSpecificChoice = !isRandomChoice && !isFavChoice && Boolean(validDriverId);

    let driverSelectionMode: 'favourite' | 'specific' | 'random' = 'random';
    if (!isRental) {
      if (isSpecificChoice) {
        driverSelectionMode = 'specific';
      } else if (isFavChoice) {
        driverSelectionMode = 'favourite';
      } else {
        driverSelectionMode = 'random';
      }
    }

    console.log(`[DIAGNOSTIC] Processing booking creation. RefCode: ${effectiveRefCode}, Mode: ${driverSelectionMode}, DriverRequested: ${validDriverId || 'none'}, Channel: ${body.bookingChannel || 'website'}`);

    if (driverSelectionMode === 'random') {
      validDriverId = null;
      targetDriverObj = null;
    } else if (driverSelectionMode === 'favourite') {
      const favId = body.favouriteDriverId || validDriverId;
      const favDriverObj = await prisma.driver.findUnique({ where: { id: favId } });
      if (!favDriverObj || favDriverObj.approvalStatus !== 'approved' || !favDriverObj.isOnline) {
        console.log(`[DIAGNOSTIC] Favourite driver (${favId}) is offline/unapproved. Rejecting with 409.`);
        return NextResponse.json({
          error: 'driver_offline',
          message: 'Driver is offline.',
          driverSelectionMode: 'favourite',
        }, { status: 409 });
      }

      const activeRide = await prisma.booking.findFirst({
        where: {
          driverId: favId,
          status: { in: ['accepted', 'driver_arriving', 'arrived', 'in_progress'] },
        },
      });

      if (activeRide) {
        console.log(`[DIAGNOSTIC] Favourite driver (${favId}) is busy on ride ${activeRide.id}. Rejecting with 409.`);
        return NextResponse.json({
          error: 'driver_busy',
          message: 'Driver is on another ride.',
          driverSelectionMode: 'favourite',
        }, { status: 409 });
      }

      validDriverId = favDriverObj.id;
      targetDriverObj = favDriverObj;
    } else if (driverSelectionMode === 'specific' && validDriverId) {
      if (!targetDriverObj) {
        targetDriverObj = await prisma.driver.findUnique({ where: { id: validDriverId } });
      }

      if (!targetDriverObj || targetDriverObj.approvalStatus !== 'approved' || !targetDriverObj.isOnline) {
        console.log(`[DIAGNOSTIC] Selected driver (${validDriverId}) is offline. Rejecting with 409.`);
        return NextResponse.json({
          error: 'driver_unavailable',
          message: 'This driver is currently offline.',
          driverSelectionMode: 'specific',
        }, { status: 409 });
      }

      // Check if driver is already on an active ride
      const activeRide = await prisma.booking.findFirst({
        where: {
          driverId: validDriverId,
          status: { in: ['accepted', 'driver_arriving', 'arrived', 'in_progress'] },
        },
      });

      if (activeRide) {
        console.log(`[DIAGNOSTIC] Selected driver (${validDriverId}) is busy on ride ${activeRide.id}. Rejecting with 409.`);
        return NextResponse.json({
          error: 'driver_busy',
          message: 'This driver is currently on another ride.',
          driverSelectionMode: 'specific',
        }, { status: 409 });
      }
    }

    // Normalize serviceType (Prisma enum uses underscores, UI uses hyphens)
    const normalizedServiceType = (serviceType || 'one_way').replace(/-/g, '_') as any;

    const isKmPricing = ['one_way', 'tour_package', 'airport_transfer', 'bar_pickup'].includes(normalizedServiceType);
    const pricingModel = body.pricingModel || (isKmPricing ? 'kilometer' : (isRental ? 'rental' : 'minute'));
    const isWebsiteDriverExclusive = !isRental && driverSelectionMode === 'specific';
    const effectiveQueueStatus = isRental
      ? 'pending_admin'
      : (driverSelectionMode === 'favourite'
          ? 'exclusive_favourite'
          : (driverSelectionMode === 'specific'
              ? 'exclusive_selected'
              : 'broadcast'));

    const booking = await prisma.booking.create({
      data: {
        refCode: effectiveRefCode,
        bookingChannel: body.bookingChannel || (isRental ? 'rental' : 'website'),
        selectedDriverExclusive: isWebsiteDriverExclusive,
        customerId: validCustomerId,
        customerName,
        customerPhone,
        passengerName: passengerName || customerName,
        passengerPhone: passengerPhone || customerPhone,
        bookingFor: body.bookingFor || 'myself',
        passengerRelationship: body.passengerRelationship || undefined,
        passengerSpecialInstructions: body.passengerSpecialInstructions || undefined,
        serviceType: normalizedServiceType,
        vehicleCategory: vehicleCategory === 'auto' ? 'auto' : (vehicleCategory === 'ev' ? 'ev' : vehicleCategory),
        transmission: body.transmission || body.customerVehicle?.transmission || undefined,
        fuelType: body.fuelType || body.customerVehicle?.fuel || undefined,
        customerVehicle: body.customerVehicle || undefined,
        pickupLocation,
        destinationLocation: effectiveDest,
        stops: stops ?? [],
        scheduledDate,
        scheduledTime,
        isRoundTrip: Boolean(isRoundTrip),
        returnDate,
        returnTime,
        durationHours,
        flightTrainNumber,
        medicalNotes,
        hospitalNotes,
        tourItineraryNotes,
        tourNotes,
        fareBreakdown,
        rideStartOtp: effectiveOtp,
        driverId: validDriverId,
        driverName: (targetDriverObj?.name || driverName) || undefined,
        driverPhone: (targetDriverObj?.phone || driverPhone) || undefined,
        driverVehicle: (targetDriverObj?.vehicleModel || driverVehicle) || undefined,
        driverRating: typeof (targetDriverObj?.ratingAverage || driverRating) === 'number' ? (targetDriverObj?.ratingAverage || driverRating) : undefined,
        favouriteDriverId: driverSelectionMode === 'favourite' ? (body.favouriteDriverId || validDriverId) : null,
        requestedDriverName: body.requestedDriverName || targetDriverObj?.name || driverName || undefined,
        requestQueueStatus: effectiveQueueStatus,
        exclusiveUntil: driverSelectionMode === 'favourite' ? new Date(Date.now() + 60 * 1000) : null,
        pricingModel,
        declinedDriverIds: [],
        paymentMethod: paymentMethod ?? 'cash',
        emergencyContact,
        status: 'pending',
        paymentStatus: 'pending',
        rentalVehicleId: rentalVehicleId || undefined,
        rentalVehicleModel: rentalVehicleModel || undefined,
        advanceAmount: typeof advanceAmount === 'number' ? advanceAmount : (fareBreakdown?.advanceAmount ?? undefined),
        remainingAmount: typeof remainingAmount === 'number' ? remainingAmount : (fareBreakdown?.remainingAmount ?? undefined),
        advancePaid: isRental ? true : false,
        advancePaidAt: isRental ? new Date() : undefined,
        notificationMessage: isRental 
          ? 'New self-drive rental reservation submitted. Pending Admin Approval.'
          : undefined,
      },
    });

    console.log(`[DIAGNOSTIC] Booking created in PostgreSQL: ID=${booking.id}, RefCode=${booking.refCode}, DriverId=${booking.driverId || 'None (Broadcast)'}, QueueStatus=${booking.requestQueueStatus}, Channel=${booking.bookingChannel}`);

    const responseData = {
      ...booking,
      driverId: booking.driverId || driverId || null,
      driverName: booking.driverName || driverName || null,
      driverPhone: booking.driverPhone || driverPhone || null,
      driverVehicle: booking.driverVehicle || driverVehicle || null,
    };

    return NextResponse.json(responseData, { status: 201 });
  } catch (err) {
    console.error('POST /api/bookings error:', err);
    return NextResponse.json({ error: 'Failed to create booking', details: String(err) }, { status: 500 });
  }
}

// DELETE /api/bookings?id=<id> or ?refCode=<refCode>
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const refCode = searchParams.get('refCode');
    if (!id && !refCode) {
      return NextResponse.json({ error: 'Missing id or refCode' }, { status: 400 });
    }
    if (id) {
      await prisma.booking.delete({ where: { id } });
    } else if (refCode) {
      await prisma.booking.delete({ where: { refCode } });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete booking' }, { status: 500 });
  }
}
