import { prisma } from '@/lib/prisma';
import { calculateRoadDistance } from '@/lib/routing';

// Clean extracted regex values
function cleanParam(val?: string) {
  if (!val) return '';
  return val.replace(/^\*+|\*+$/g, '').trim();
}

// Helper to extract booking parameters from customer WhatsApp text
export function parseWhatsAppBookingMessage(rawText: string) {
  const refMatch = rawText.match(/Booking Ref:\s*\*?([^\n\r*]+)\*?/i);
  const otpMatch = rawText.match(/Ride-Start OTP:\s*\*?([^\n\r*]+)\*?/i);
  const customerMatch = rawText.match(/Customer:\s*\*?([^\n\r*(]+)(?:\(([^)]+)\))?\*?/i);
  const serviceMatch = rawText.match(/Service:\s*\*?([^\n\r*]+)\*?/i);
  const preferredDriverMatch = rawText.match(/(?:Preferred Driver|Driver):\s*\*?([^\n\r*]+)\*?/i);
  const pickupMatch = rawText.match(/Pickup:\s*\*?([^\n\r*]+)\*?/i);
  const pinMatch = rawText.match(/Pickup\s*(?:pin|GPS|Map):\s*\*?([^\n\r*]+)\*?/i);
  const dropoffMatch = rawText.match(/(?:Drop-off|Dropoff|Destination):\s*\*?([^\n\r*]+)\*?/i);
  const dateMatch = rawText.match(/Date:\s*\*?([^\n\r*]+)\*?/i);
  const timeMatch = rawText.match(/Time:\s*\*?([^\n\r*]+)\*?/i);

  const refCode = cleanParam(refMatch?.[1]);
  const rideStartOtp = cleanParam(otpMatch?.[1]);
  const customerName = cleanParam(customerMatch?.[1]);
  const customerPhone = cleanParam(customerMatch?.[2]);
  const serviceType = cleanParam(serviceMatch?.[1]);
  const preferredDriver = cleanParam(preferredDriverMatch?.[1]);
  const pickupLocation = cleanParam(pickupMatch?.[1]);
  const pickupPin = cleanParam(pinMatch?.[1]);
  const dropoffLocation = cleanParam(dropoffMatch?.[1]);
  const scheduledDate = cleanParam(dateMatch?.[1]);
  const scheduledTime = cleanParam(timeMatch?.[1]);

  const isComplete = Boolean(
    serviceType &&
    pickupLocation &&
    (dropoffLocation || serviceType.toLowerCase().includes('hourly')) &&
    scheduledDate &&
    scheduledTime
  );

  return {
    refCode: refCode || null,
    rideStartOtp: rideStartOtp || null,
    customerName: customerName || null,
    customerPhone: customerPhone || null,
    serviceType: serviceType || null,
    preferredDriver: preferredDriver || null,
    pickupLocation: pickupLocation || null,
    pickupPin: pickupPin || null,
    dropoffLocation: dropoffLocation || null,
    scheduledDate: scheduledDate || null,
    scheduledTime: scheduledTime || null,
    isComplete,
  };
}

// Helper to match driver by preferred driver name/reference
export async function matchDriverForWhatsApp(preferredDriverName: string | null) {
  if (!preferredDriverName) {
    return {
      routingStatus: 'general_admin' as const,
      matchedDriverId: null,
      matchedDriverName: null,
    };
  }

  const clean = preferredDriverName.trim().toLowerCase();
  const ignored = ['none', 'any', 'any available', 'n/a', 'no preference', 'any driver'];
  if (ignored.includes(clean)) {
    return {
      routingStatus: 'general_admin' as const,
      matchedDriverId: null,
      matchedDriverName: null,
    };
  }

  const approvedDrivers = await prisma.driver.findMany({
    where: { approvalStatus: 'approved' },
  });

  const exactMatches = approvedDrivers.filter(
    (d) => d.name.trim().toLowerCase() === clean || d.phone.replace(/\D/g, '') === clean.replace(/\D/g, '')
  );

  if (exactMatches.length === 1) {
    return {
      routingStatus: 'routed_to_driver' as const,
      matchedDriverId: exactMatches[0].id,
      matchedDriverName: exactMatches[0].name,
    };
  }

  if (exactMatches.length > 1) {
    return {
      routingStatus: 'driver_identification_required' as const,
      matchedDriverId: null,
      matchedDriverName: null,
    };
  }

  const partialMatches = approvedDrivers.filter((d) => {
    const dName = d.name.toLowerCase();
    return dName.includes(clean) || (clean.length >= 4 && clean.includes(dName));
  });

  if (partialMatches.length === 1) {
    return {
      routingStatus: 'routed_to_driver' as const,
      matchedDriverId: partialMatches[0].id,
      matchedDriverName: partialMatches[0].name,
    };
  }

  if (partialMatches.length > 1) {
    return {
      routingStatus: 'driver_identification_required' as const,
      matchedDriverId: null,
      matchedDriverName: null,
    };
  }

  return {
    routingStatus: 'general_admin' as const,
    matchedDriverId: null,
    matchedDriverName: null,
  };
}

// Helper to determine pricing model, distance, duration, and estimated fare
export async function computeWhatsAppFare(
  serviceTypeStr: string | null,
  pickup: string | null,
  dropoff: string | null
) {
  const norm = (serviceTypeStr || 'one-way').toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
  const isKmModel = ['one-way', 'tour-package', 'airport-transfer', 'bar-pickup'].some((s) => norm.includes(s));
  const pricingModel = isKmModel ? 'kilometer' : 'minute';

  let calculatedKm = 25.0;
  let calculatedMinutes = 45;

  if (pickup && dropoff) {
    try {
      const route = await calculateRoadDistance(pickup, dropoff);
      calculatedKm = route.distanceKm;
      calculatedMinutes = route.durationMinutes;
    } catch {
      // Fallback
    }
  }

  const gstPercentage = 5;
  const platformFee = 25;
  let subtotal = 0;

  if (pricingModel === 'kilometer') {
    subtotal = Math.round(calculatedKm * 1.0);
  } else {
    if (norm.includes('hourly')) {
      calculatedMinutes = 120;
    } else if (norm.includes('hospital')) {
      calculatedMinutes = 180;
    } else if (norm.includes('round-trip')) {
      calculatedMinutes = Math.max(60, calculatedMinutes * 2);
    }
    subtotal = Math.round(calculatedMinutes * 1.2);
  }

  const gst = Math.round(subtotal * (gstPercentage / 100));
  const estimatedFare = subtotal + gst + platformFee;

  return {
    pricingModel,
    calculatedKm,
    calculatedMinutes,
    estimatedFare,
  };
}
