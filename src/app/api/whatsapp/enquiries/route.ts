import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  parseWhatsAppBookingMessage,
  matchDriverForWhatsApp,
  computeWhatsAppFare,
} from '@/lib/whatsapp';

// GET /api/whatsapp/enquiries
// Returns all received WhatsApp enquiries (filterable by status and matchedDriverId)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const matchedDriverId = searchParams.get('matchedDriverId');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (matchedDriverId) where.matchedDriverId = matchedDriverId;

    const enquiries = await prisma.whatsAppBooking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { driver: true },
    });

    return NextResponse.json(enquiries);
  } catch (err: any) {
    console.error('GET /api/whatsapp/enquiries error:', err);
    return NextResponse.json({ error: 'Failed to fetch WhatsApp enquiries' }, { status: 500 });
  }
}

// POST /api/whatsapp/enquiries
// For testing or manual enquiry submission via Meta simulator / admin tool
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      senderPhone = '+918547325636',
      senderName = 'WhatsApp Customer',
      rawMessage,
      serviceType,
      preferredDriver,
      pickupLocation,
      pickupPin,
      dropoffLocation,
      scheduledDate,
      scheduledTime,
      waMessageId = 'test_wamid_' + Date.now(),
    } = body;

    const messageText =
      rawMessage ||
      [
        "Hi DriveC, I'd like to book a driver.",
        "",
        `Service: ${serviceType || 'One Way'}`,
        `Preferred Driver: ${preferredDriver || 'None'}`,
        `Pickup: ${pickupLocation || 'Kochi'}`,
        `Pickup pin: ${pickupPin || 'https://www.openstreetmap.org'}`,
        `Drop-off: ${dropoffLocation || 'Cochin Airport'}`,
        `Date: ${scheduledDate || new Date().toISOString().split('T')[0]}`,
        `Time: ${scheduledTime || '10:00'}`,
      ].join('\n');

    // Parse the message text
    const parsed = parseWhatsAppBookingMessage(messageText);

    // Override with explicit payload fields if provided
    const effectiveService = serviceType || parsed.serviceType;
    const effectivePrefDriver = preferredDriver !== undefined ? preferredDriver : parsed.preferredDriver;
    const effectivePickup = pickupLocation || parsed.pickupLocation;
    const effectivePin = pickupPin || parsed.pickupPin;
    const effectiveDropoff = dropoffLocation || parsed.dropoffLocation;
    const effectiveDate = scheduledDate || parsed.scheduledDate;
    const effectiveTime = scheduledTime || parsed.scheduledTime;

    // Match driver
    const matchResult = await matchDriverForWhatsApp(effectivePrefDriver);

    // Compute route distance, duration and fare
    const fareInfo = await computeWhatsAppFare(
      effectiveService,
      effectivePickup,
      effectiveDropoff
    );

    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: { phone: senderPhone },
    });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: senderName || 'WhatsApp Customer',
          phone: senderPhone,
          email: `${senderPhone.replace(/\D/g, '') || Date.now()}@customer.drivec.in`,
          city: 'Kochi',
          password: 'customer_wa_123',
        },
      });
    }

    let linkedBookingId = body.convertedBookingId || null;
    let mainBookingRecord = null;

    if (!linkedBookingId) {
      // Create operational Booking for fleet drivers
      const rideStartOtp = (parsed.rideStartOtp && /^\d{4}$/.test(parsed.rideStartOtp))
        ? parsed.rideStartOtp
        : Math.floor(1000 + Math.random() * 9000).toString();

      let refCode = parsed.refCode;
      if (!refCode) {
        refCode = `DC-WA-${Math.floor(10000 + Math.random() * 90000)}`;
      } else {
        const existingRef = await prisma.booking.findUnique({ where: { refCode } });
        if (existingRef) {
          refCode = `DC-WA-${Math.floor(10000 + Math.random() * 90000)}`;
        }
      }

      const rawService = (effectiveService || 'one_way').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
      const validServices = ['one_way', 'round_trip', 'hourly_driver', 'tour_package', 'airport_transfer', 'bar_pickup', 'hospital_assistance', 'advance_event'];
      const normalizedService = (validServices.includes(rawService) ? rawService : 'one_way') as any;

      const gst = Math.round(fareInfo.estimatedFare * 0.05 / 1.05);
      const platformFee = 25;
      const baseFare = Math.max(0, fareInfo.estimatedFare - gst - platformFee);

      const candidateFavId = matchResult.matchedDriverId || (customer.favouriteDriverIds && customer.favouriteDriverIds.length > 0 ? customer.favouriteDriverIds[0] : null);
      let favDriver = null;
      let isFavAvailable = false;
      if (candidateFavId) {
        favDriver = await prisma.driver.findUnique({ where: { id: candidateFavId } });
        if (favDriver && favDriver.approvalStatus === 'approved' && favDriver.isOnline) {
          const activeRide = await prisma.booking.findFirst({
            where: {
              driverId: favDriver.id,
              status: { in: ['accepted', 'driver_arriving', 'arrived', 'in_progress'] },
            },
          });
          if (!activeRide) isFavAvailable = true;
        }
      }

      const requestQueueStatus = favDriver && isFavAvailable ? 'exclusive_favourite' : 'broadcast';

      mainBookingRecord = await prisma.booking.create({
        data: {
          refCode,
          bookingChannel: 'whatsapp',
          selectedDriverExclusive: false,
          customerId: customer.id,
          customerName: customer.name || senderName || 'WhatsApp Customer',
          customerPhone: senderPhone,
          passengerName: customer.name || senderName || 'WhatsApp Customer',
          passengerPhone: senderPhone,
          serviceType: normalizedService,
          vehicleCategory: 'sedan',
          pickupLocation: effectivePickup || 'Kochi City',
          destinationLocation: effectiveDropoff || (normalizedService === 'hourly_driver' ? 'In-City / As Directed' : 'Kochi City'),
          scheduledDate: effectiveDate || new Date().toISOString().split('T')[0],
          scheduledTime: effectiveTime || 'Immediate',
          rideStartOtp,
          status: 'pending',
          driverId: favDriver && isFavAvailable ? favDriver.id : null,
          driverName: favDriver && isFavAvailable ? favDriver.name : undefined,
          driverPhone: favDriver && isFavAvailable ? favDriver.phone : undefined,
          driverVehicle: favDriver && isFavAvailable ? favDriver.vehicleModel || undefined : undefined,
          driverRating: favDriver && isFavAvailable ? favDriver.ratingAverage || 5.0 : undefined,
          favouriteDriverId: favDriver && isFavAvailable ? favDriver.id : null,
          requestQueueStatus,
          exclusiveUntil: favDriver && isFavAvailable ? new Date(Date.now() + 60 * 1000) : null,
          declinedDriverIds: [],
          pricingModel: fareInfo.pricingModel,
          fareBreakdown: {
            baseFare,
            gstAmount: gst,
            platformFee,
            totalFare: fareInfo.estimatedFare,
            distanceKm: fareInfo.calculatedKm,
            durationMinutes: fareInfo.calculatedMinutes,
            pricingModel: fareInfo.pricingModel,
          },
          paymentMethod: 'cash',
          paymentStatus: 'pending',
          passengerPaid: false,
          driverPaymentReceived: false,
        },
      });

      linkedBookingId = mainBookingRecord.id;
    }

    const enquiry = await prisma.whatsAppBooking.create({
      data: {
        waMessageId,
        senderPhone,
        senderName,
        serviceType: effectiveService || null,
        preferredDriver: effectivePrefDriver || null,
        pickupLocation: effectivePickup || null,
        pickupPin: effectivePin || null,
        dropoffLocation: effectiveDropoff || null,
        scheduledDate: effectiveDate || null,
        scheduledTime: effectiveTime || null,
        matchedDriverId: matchResult.matchedDriverId,
        matchedDriverName: matchResult.matchedDriverName,
        routingStatus: matchResult.routingStatus,
        calculatedKm: fareInfo.calculatedKm,
        calculatedMinutes: fareInfo.calculatedMinutes,
        estimatedFare: fareInfo.estimatedFare,
        pricingModel: fareInfo.pricingModel,
        rawMessage: messageText,
        status: linkedBookingId ? 'converted' : 'pending_verification',
        convertedBookingId: linkedBookingId,
        isComplete: Boolean(effectiveService && effectivePickup && effectiveDate && effectiveTime),
      },
      include: { driver: true },
    });

    return NextResponse.json({ ...enquiry, booking: mainBookingRecord }, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/whatsapp/enquiries error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to create enquiry' }, { status: 500 });
  }
}
