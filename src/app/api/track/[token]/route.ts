import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { geocodeLocation, calculateRoadDistance, getRouteRoadGeometry } from '@/lib/routing';

// GET /api/track/[token] — Public, read-only endpoint for live trip sharing
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token || token.trim().length < 6) {
      return NextResponse.json({ error: 'Invalid or missing sharing token' }, { status: 400 });
    }

    const booking = await prisma.booking.findFirst({
      where: {
        OR: [
          { shareToken: token },
          { id: token }
        ]
      },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            phone: true,
            ratingAverage: true,
            ratingCount: true,
            totalTrips: true,
            approvalStatus: true
          }
        }
      }
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Trip tracking link not found or invalid.', active: false },
        { status: 404 }
      );
    }

    // Check if customer stopped sharing
    if (!booking.isSharingActive) {
      return NextResponse.json(
        {
          error: 'The customer has stopped sharing this trip.',
          active: false,
          refCode: booking.refCode
        },
        { status: 410 }
      );
    }

    // Check if trip is completed or cancelled (Automatic expiration)
    if (booking.status === 'completed' || booking.status === 'cancelled' || booking.status === 'declined') {
      return NextResponse.json(
        {
          error: `This trip has ended (${booking.status}). Live tracking has automatically expired for privacy and safety.`,
          active: false,
          status: booking.status,
          refCode: booking.refCode,
          rideCompletedAt: booking.rideCompletedAt
        },
        { status: 410 }
      );
    }

    // Geocode pickup and destination points for the Leaflet map (free OpenStreetMap)
    const pickupCoords = await geocodeLocation(booking.pickupLocation);
    const destCoords = await geocodeLocation(booking.destinationLocation);

    // Fetch verified OSRM road geometry and distance/time metrics
    let routeGeometry: [number, number][] = [];
    let routeDistanceKm = 0;
    let routeDurationMins = 0;

    if (pickupCoords && destCoords) {
      const [geometry, roadSummary] = await Promise.all([
        getRouteRoadGeometry(pickupCoords, destCoords),
        calculateRoadDistance(booking.pickupLocation, booking.destinationLocation, pickupCoords, destCoords)
      ]);
      routeGeometry = geometry;
      routeDistanceKm = roadSummary.distanceKm;
      routeDurationMins = roadSummary.durationMinutes;
    }

    // Live driver coordinates (or fallback to pickup coordinates if ride starting)
    const effectiveLat = booking.driverLiveLat ?? pickupCoords?.lat ?? 9.9312;
    const effectiveLng = booking.driverLiveLng ?? pickupCoords?.lon ?? 76.2673;

    // Mask phone for recipient privacy
    const maskedDriverPhone = booking.driverPhone 
      ? `${booking.driverPhone.slice(0, 5)}*****` 
      : null;

    return NextResponse.json({
      active: true,
      refCode: booking.refCode,
      status: booking.status,
      serviceType: booking.serviceType,
      vehicleCategory: booking.vehicleCategory,
      pickupLocation: booking.pickupLocation,
      destinationLocation: booking.destinationLocation,
      scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime,
      passengerName: booking.passengerName || booking.customerName,
      bookingFor: booking.bookingFor || 'myself',
      pickupCoords: pickupCoords ? { lat: pickupCoords.lat, lng: pickupCoords.lon } : null,
      destinationCoords: destCoords ? { lat: destCoords.lat, lng: destCoords.lon } : null,
      routeGeometry,
      routeDistanceKm,
      routeDurationMins,
      driver: {
        name: booking.driverName || booking.driver?.name || 'Verified Professional Chauffeur',
        phone: maskedDriverPhone,
        vehicle: booking.driverVehicle || 'Private Passenger Vehicle',
        rating: booking.driverRating || booking.driver?.ratingAverage || 5.0,
        trips: booking.driver?.totalTrips || 120
      },
      liveLocation: {
        lat: effectiveLat,
        lng: effectiveLng,
        heading: booking.driverLiveHeading || 0,
        speed: booking.driverLiveSpeed || 0,
        updatedAt: booking.driverLiveUpdatedAt ? booking.driverLiveUpdatedAt.toISOString() : null,
        isLiveGpsReceived: Boolean(booking.driverLiveLat && booking.driverLiveLng)
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Error in GET /api/track/[token]:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve trip tracking details', details: err?.message },
      { status: 500 }
    );
  }
}
