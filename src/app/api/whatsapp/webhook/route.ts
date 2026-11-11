import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import {
  parseWhatsAppBookingMessage,
  matchDriverForWhatsApp,
  computeWhatsAppFare,
} from '@/lib/whatsapp';

// Meta WhatsApp Webhook Verification
// Meta sends GET request with hub.mode, hub.verify_token, hub.challenge
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'drivec_whatsapp_webhook_secret_2026';

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('WhatsApp Webhook verified successfully by Meta Cloud API.');
      return new NextResponse(challenge || '', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    console.warn('WhatsApp Webhook verification failed. Tokens did not match.');
    return new NextResponse('Forbidden: Verification token mismatch', { status: 403 });
  } catch (err) {
    console.error('Error in WhatsApp webhook GET:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}

// Meta WhatsApp Incoming Message Webhook
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Verify Meta HMAC signature if WHATSAPP_APP_SECRET is configured
    const signature = req.headers.get('x-hub-signature-256');
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    if (appSecret && signature) {
      const expectedSignature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      if (signature !== expectedSignature) {
        console.warn('WhatsApp webhook signature verification failed.');
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const createdEnquiries = [];
    const messagesToProcess: Array<{
      waMessageId: string;
      senderPhone: string;
      senderName: string | null;
      rawMessage: string;
      explicitService?: string;
      explicitPrefDriver?: string;
      explicitPickup?: string;
      explicitDropoff?: string;
      explicitDate?: string;
      explicitTime?: string;
    }> = [];

    // 1. Meta Cloud API Webhook standard structure
    if (Array.isArray(payload.entry)) {
      for (const entry of payload.entry) {
        const changes = Array.isArray(entry.changes) ? entry.changes : [];
        for (const change of changes) {
          const value = change.value;
          if (!value) continue;

          // Extract contacts map for sender names
          const contactsMap: Record<string, string> = {};
          if (Array.isArray(value.contacts)) {
            for (const c of value.contacts) {
              if (c.wa_id && c.profile?.name) {
                contactsMap[c.wa_id] = c.profile.name;
              }
            }
          }

          const messages = Array.isArray(value.messages) ? value.messages : [];
          for (const msg of messages) {
            const waMessageId = msg.id || (`wa_msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
            const senderPhone = msg.from || value.metadata?.display_phone_number || 'Unknown';
            const senderName = contactsMap[msg.from] || null;
            const rawMessage = msg.text?.body || msg.caption || '[Non-text message or media]';
            messagesToProcess.push({ waMessageId, senderPhone, senderName, rawMessage });
          }
        }
      }
    } else if (payload.senderPhone || payload.message || payload.rawMessage || payload.serviceType) {
      // 2. Direct client / mobile APK / simulator payload
      const waMessageId = payload.waMessageId || payload.id || (`wa_direct_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
      const senderPhone = payload.senderPhone || payload.customerPhone || '+918547325636';
      const senderName = payload.senderName || payload.customerName || 'WhatsApp Customer';
      const rawMessage = payload.rawMessage || payload.message || [
        "Hi DriveC, I'd like to book a driver.",
        "",
        `Service: ${payload.serviceType || 'One Way'}`,
        `Preferred Driver: ${payload.preferredDriver || 'None'}`,
        `Pickup: ${payload.pickupLocation || 'Kochi'}`,
        `Drop-off: ${payload.dropoffLocation || 'Cochin Airport'}`,
        `Date: ${payload.scheduledDate || new Date().toISOString().split('T')[0]}`,
        `Time: ${payload.scheduledTime || 'Immediate'}`
      ].join('\n');

      messagesToProcess.push({
        waMessageId,
        senderPhone,
        senderName,
        rawMessage,
        explicitService: payload.serviceType,
        explicitPrefDriver: payload.preferredDriver,
        explicitPickup: payload.pickupLocation,
        explicitDropoff: payload.dropoffLocation,
        explicitDate: payload.scheduledDate,
        explicitTime: payload.scheduledTime,
      });
    }

    for (const item of messagesToProcess) {
      const { waMessageId, senderPhone, senderName, rawMessage } = item;
      if (!waMessageId) continue;

      // Check if already processed (Idempotency)
      const existing = await prisma.whatsAppBooking.findUnique({
        where: { waMessageId },
      });

      if (existing) {
        console.log(`Duplicate WhatsApp webhook delivery ignored: ${waMessageId}`);
        continue;
      }

      console.log(`[DIAGNOSTIC] WhatsApp webhook message received: ID=${waMessageId}, From=${senderPhone}, Name=${senderName || 'Unknown'}`);

      const parsed = parseWhatsAppBookingMessage(rawMessage);
      const effectiveService = item.explicitService || parsed.serviceType || 'one_way';
      const effectivePrefDriver = item.explicitPrefDriver !== undefined ? item.explicitPrefDriver : parsed.preferredDriver;
      const effectivePickup = item.explicitPickup || parsed.pickupLocation || 'Kochi City';
      const effectiveDropoff = item.explicitDropoff || parsed.dropoffLocation || 'Kochi City';
      const effectiveDate = item.explicitDate || parsed.scheduledDate || new Date().toISOString().split('T')[0];
      const effectiveTime = item.explicitTime || parsed.scheduledTime || 'Immediate';
      const effectiveSenderPhone = item.senderPhone && item.senderPhone !== '+918547325636' ? item.senderPhone : (parsed.customerPhone || item.senderPhone || '+918547325636');
      const effectiveSenderName = item.senderName && item.senderName !== 'WhatsApp Customer' ? item.senderName : (parsed.customerName || item.senderName || 'WhatsApp Customer');

      // Match driver from preferred driver text or customer favourites
      const matchResult = await matchDriverForWhatsApp(effectivePrefDriver);

      console.log(`[DIAGNOSTIC] WhatsApp parsed booking: Service=${effectiveService}, PreferredDriver=${effectivePrefDriver || 'None'}, MatchedDriverId=${matchResult.matchedDriverId || 'None'}`);

      // Calculate fare & road distance
      const fareInfo = await computeWhatsAppFare(
        effectiveService,
        effectivePickup,
        effectiveDropoff
      );

          // ── Find or Create Customer in DB ──
          let customer = await prisma.customer.findFirst({
            where: { phone: effectiveSenderPhone }
          });
          if (!customer) {
            customer = await prisma.customer.create({
              data: {
                name: effectiveSenderName || 'WhatsApp Customer',
                phone: effectiveSenderPhone,
                email: `${effectiveSenderPhone.replace(/\D/g, '') || Date.now()}@customer.drivec.in`,
                city: 'Kochi',
                password: 'customer_wa_123',
              }
            });
          }

          // ── Scenario A vs B vs C Favourite Driver Priority ──
          // If customer has a favourite driver or requested a specific driver:
          const candidateFavId = matchResult.matchedDriverId || (customer.favouriteDriverIds && customer.favouriteDriverIds.length > 0 ? customer.favouriteDriverIds[0] : null);
          let favDriver = null;
          let isFavAvailable = false;

          if (candidateFavId) {
            favDriver = await prisma.driver.findUnique({
              where: { id: candidateFavId }
            });
            if (favDriver && favDriver.approvalStatus === 'approved' && favDriver.isOnline) {
              const activeRide = await prisma.booking.findFirst({
                where: {
                  driverId: favDriver.id,
                  status: { in: ['accepted', 'driver_arriving', 'arrived', 'in_progress'] }
                }
              });
              if (!activeRide) {
                isFavAvailable = true;
              } else {
                console.log(`[DIAGNOSTIC] Favourite driver ${favDriver.name} is on another ride. Automatically routing to other online drivers via broadcast.`);
              }
            } else if (favDriver) {
              console.log(`[DIAGNOSTIC] Favourite driver ${favDriver.name} is offline or not approved. Automatically routing to other online drivers via broadcast.`);
            }
          }

          // Scenario A: Favourite driver exists and is available -> Exclusive to favourite driver
          // Scenario B: Favourite driver busy or offline -> Automatically route to other online drivers via broadcast
          // Scenario C: No favourite driver -> Route to other online drivers via broadcast
          let requestQueueStatus: 'exclusive_favourite' | 'broadcast' = 'broadcast';
          let assignedDriverId: string | null = null;
          let assignedDriverName: string | null = null;
          let assignedDriverPhone: string | null = null;
          let assignedDriverVehicle: string | null = null;
          let assignedDriverRating: number | null = null;
          let exclusiveFavId: string | null = null;
          let exclusiveUntil: Date | null = null;

          if (favDriver && isFavAvailable) {
            requestQueueStatus = 'exclusive_favourite';
            assignedDriverId = favDriver.id;
            assignedDriverName = favDriver.name;
            assignedDriverPhone = favDriver.phone;
            assignedDriverVehicle = favDriver.vehicleModel || null;
            assignedDriverRating = favDriver.ratingAverage || 5.0;
            exclusiveFavId = favDriver.id;
            exclusiveUntil = new Date(Date.now() + 60 * 1000);
          } else {
            // Favourite is offline or on another ride -> Goes to other online drivers
            requestQueueStatus = 'broadcast';
            assignedDriverId = null;
            assignedDriverName = null;
            assignedDriverPhone = null;
            assignedDriverVehicle = null;
            assignedDriverRating = null;
            exclusiveFavId = null;
            exclusiveUntil = null;
          }

          // Generate or reuse 4-digit Ride-Start OTP and RefCode
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

          // Normalize service type
          const rawService = (effectiveService || 'one_way').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
          const validServices = ['one_way', 'round_trip', 'hourly_driver', 'tour_package', 'airport_transfer', 'bar_pickup', 'hospital_assistance', 'advance_event'];
          const normalizedService = (validServices.includes(rawService) ? rawService : 'one_way') as any;

          const gst = Math.round(fareInfo.estimatedFare * 0.05 / 1.05);
          const platformFee = 25;
          const baseFare = Math.max(0, fareInfo.estimatedFare - gst - platformFee);

          // Create the main operational Booking record in PostgreSQL
          const mainBooking = await prisma.booking.create({
            data: {
              refCode,
              bookingChannel: 'whatsapp',
              selectedDriverExclusive: false,
              customerId: customer.id,
              customerName: customer.name || effectiveSenderName || 'WhatsApp Customer',
              customerPhone: effectiveSenderPhone,
              passengerName: customer.name || effectiveSenderName || 'WhatsApp Customer',
              passengerPhone: effectiveSenderPhone,
              serviceType: normalizedService,
              vehicleCategory: 'sedan',
              pickupLocation: effectivePickup || 'Kochi City',
              destinationLocation: effectiveDropoff || (normalizedService === 'hourly_driver' ? 'In-City / As Directed' : 'Kochi City'),
              scheduledDate: effectiveDate || new Date().toISOString().split('T')[0],
              scheduledTime: effectiveTime || 'Immediate',
              rideStartOtp,
              status: 'pending',
              driverId: assignedDriverId,
              driverName: assignedDriverName || undefined,
              driverPhone: assignedDriverPhone || undefined,
              driverVehicle: assignedDriverVehicle || undefined,
              driverRating: assignedDriverRating ?? undefined,
              favouriteDriverId: exclusiveFavId,
              requestQueueStatus,
              exclusiveUntil,
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
            }
          });

          console.log(`[DIAGNOSTIC] WhatsApp Booking created in PostgreSQL: ID=${mainBooking.id}, RefCode=${mainBooking.refCode}, DriverId=${mainBooking.driverId || 'None (Broadcast)'}, QueueStatus=${mainBooking.requestQueueStatus}`);

          const newBooking = await prisma.whatsAppBooking.create({
            data: {
              waMessageId,
              senderPhone,
              senderName,
              serviceType: effectiveService,
              pickupLocation: effectivePickup,
              pickupPin: parsed.pickupPin,
              dropoffLocation: effectiveDropoff,
              scheduledDate: effectiveDate,
              scheduledTime: effectiveTime,
              preferredDriver: effectivePrefDriver,
              matchedDriverId: assignedDriverId || matchResult.matchedDriverId,
              matchedDriverName: assignedDriverName || matchResult.matchedDriverName,
              routingStatus: matchResult.routingStatus,
              calculatedKm: fareInfo.calculatedKm,
              calculatedMinutes: fareInfo.calculatedMinutes,
              estimatedFare: fareInfo.estimatedFare,
              pricingModel: fareInfo.pricingModel,
              rawMessage,
              status: 'pending_verification',
              isComplete: parsed.isComplete,
              convertedBookingId: mainBooking.id,
            },
          });

          createdEnquiries.push({ ...newBooking, booking: mainBooking });
        }

    return NextResponse.json({
      success: true,
      processed: createdEnquiries.length,
      enquiries: createdEnquiries,
    });
  } catch (err: any) {
    console.error('Error handling WhatsApp webhook POST:', err);
    return NextResponse.json({ error: err?.message || 'Internal webhook error' }, { status: 500 });
  }
}
