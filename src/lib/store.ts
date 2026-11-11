import { 
  User, 
  Driver, 
  Booking, 
  BookingStatus,
  Review, 
  Complaint, 
  VehicleCategory, 
  RideServiceType, 
  FareBreakdown, 
  RentalVehicle,
  RentalExtension,
  DriverNotice,
  DisputeNotification,
  WhatsAppBookingEnquiry,
  HourlyPricingConfig,
  DriverServicesPricingConfig,
  ServicePricingRule
} from '../types';

export const defaultHourlyPricingConfig: HourlyPricingConfig = {
  packages: [
    { hours: 2, rate: 399, label: '2 Hours (Short Trip)', kmIncluded: 25 },
    { hours: 4, rate: 699, label: '4 Hours (Half Day)', kmIncluded: 45 },
    { hours: 6, rate: 999, label: '6 Hours (Extended City)', kmIncluded: 65 },
    { hours: 8, rate: 1299, label: '8 Hours (Full Day City)', kmIncluded: 85 },
    { hours: 12, rate: 1899, label: '12 Hours (All-Day Chauffeur)', kmIncluded: 125 }
  ],
  extraHourRate: 150
};

export const defaultDriverServicesPricingConfig: DriverServicesPricingConfig = {
  hourly: defaultHourlyPricingConfig,
  services: {
    'one-way': {
      baseFare: 150,
      baseKm: 4,
      perKmRate: 22,
      timeRatePerMin: 1.2,
      description: 'Point-to-point chauffeur. Base covers first 4 km. Time calculated at ₹1.2/min.',
      isEstimate: true
    },
    'round-trip': {
      baseFare: 200,
      baseKm: 4,
      perKmRate: 18,
      timeRatePerMin: 1.2,
      waitingChargePerHour: 60,
      description: 'Return journey on your vehicle. 10% discount on return km.',
      isEstimate: true
    },
    'hourly-driver': {
      baseFare: 399,
      baseKm: 25,
      perKmRate: 0,
      description: 'Dedicated in-city hourly chauffeur blocks.',
      isEstimate: false
    },
    'tour-package': {
      baseFare: 450,
      baseKm: 50,
      perKmRate: 18,
      driverAllowancePerDay: 350,
      description: 'Intercity Kerala sightseeing. ₹18/km + ₹350/day driver bata.',
      isEstimate: true
    },
    'airport-transfer': {
      baseFare: 650,
      baseKm: 30,
      perKmRate: 20,
      flatPackageRate: 650,
      flatPackageSlabKm: 30,
      description: 'Cochin Airport (COK) transfer. Flat ₹650 up to 30 km, then ₹20/km.',
      isEstimate: false
    },
    'bar-pickup': {
      baseFare: 350,
      baseKm: 5,
      perKmRate: 22,
      timeRatePerMin: 1.2,
      nightSurcharge: 100,
      description: 'Safe night & party chauffeur. Includes ₹100 night transit care.',
      isEstimate: true
    },
    'hospital-assistance': {
      baseFare: 250,
      baseKm: 5,
      perKmRate: 20,
      timeRatePerMin: 1.2,
      waitingChargePerHour: 50,
      description: 'Medical care escort. Includes patient waiting & assistance.',
      isEstimate: true
    },
    'advance-event': {
      baseFare: 300,
      baseKm: 5,
      perKmRate: 22,
      timeRatePerMin: 1.2,
      description: 'VIP Event chauffeur reservation.',
      isEstimate: true
    }
  },
  categoryRates: {
    hatchback: { baseFare: 120, baseKm: 4, perKmRate: 18, timeRatePerMin: 1.2 },
    sedan:     { baseFare: 150, baseKm: 4, perKmRate: 22, timeRatePerMin: 1.2 },
    suv:       { baseFare: 210, baseKm: 4, perKmRate: 28, timeRatePerMin: 1.2 },
    premium:   { baseFare: 380, baseKm: 5, perKmRate: 45, timeRatePerMin: 1.2 },
    auto:      { baseFare: 60,  baseKm: 1.5, perKmRate: 18, timeRatePerMin: 1.2 },
    bike:      { baseFare: 40,  baseKm: 2, perKmRate: 12, timeRatePerMin: 1.2 },
    ev:        { baseFare: 140, baseKm: 4, perKmRate: 20, timeRatePerMin: 1.2 },
    automatic: { baseFare: 150, baseKm: 4, perKmRate: 22, timeRatePerMin: 1.2 },
  },
  gstPercentage: 5,
  platformFee: 25
};

export interface AppState {
  currentUser: {
    id: string;
    role: 'guest' | 'customer' | 'driver' | 'owner' | 'admin';
    name: string;
    phone: string;
    email: string;
  };
  language: 'en' | 'ml';
  customers: User[];
  drivers: Driver[];
  rentalVehicles: RentalVehicle[];
  rentalExtensions?: RentalExtension[];
  bookings: Booking[];
  reviews: Review[];
  complaints: Complaint[];
  notices: DriverNotice[];
  whatsAppEnquiries?: WhatsAppBookingEnquiry[];
  notifications?: DisputeNotification[];
  favouriteDriverIds: string[];
  activeModal: 'none' | 'guestWarning' | 'customerRegister' | 'driverRegister' | 'ownerRegister' | 'adminRegister' | 'login' | 'bookingConfirmation' | 'reviewModal' | 'complaintModal';
  activeBookingToReview?: Booking;
}

const STORAGE_KEY = 'drivec_platform_state_clean_v3';
const OLD_STORAGE_KEY = 'kerago_platform_state_v1';

// Base rates for Professional Driver Bookings (customer's own car)
export const initialPricingRules: Record<string, { baseFare: number; baseKm: number; perKmRate: number; timeRatePerMin: number }> = {
  hatchback: { baseFare: 120, baseKm: 4, perKmRate: 18, timeRatePerMin: 1.2 },
  sedan:     { baseFare: 150, baseKm: 4, perKmRate: 22, timeRatePerMin: 1.2 },
  suv:       { baseFare: 210, baseKm: 4, perKmRate: 28, timeRatePerMin: 1.2 },
  premium:   { baseFare: 380, baseKm: 5, perKmRate: 45, timeRatePerMin: 1.2 },
  // Legacy mappings for backwards compatibility
  bike:      { baseFare: 40,  baseKm: 2, perKmRate: 12, timeRatePerMin: 1.2 },
  auto:      { baseFare: 60,  baseKm: 1.5, perKmRate: 18, timeRatePerMin: 1.2 },
  ev:        { baseFare: 140, baseKm: 4, perKmRate: 20, timeRatePerMin: 1.2 },
  automatic: { baseFare: 150, baseKm: 4, perKmRate: 22, timeRatePerMin: 1.2 },
};

export const serviceMultipliers: Record<RideServiceType, number> = {
  'one-way': 1.0,
  'round-trip': 1.8, // 10% discount on return
  'hospital-assistance': 1.15, // Patient care escort
  'bar-pickup': 1.25, // Night transit care
  'tour-package': 1.4, // Guided Kerala sightseeing standby
  'airport-transfer': 1.1, // Cochin Airport (COK) express flight sync
  'advance-event': 1.3, // Guaranteed advance reserved driver
  'hourly-driver': 1.2, // Dedicated multi-stop hours
  'self-drive': 1.0,
};

export const KM_BASED_SERVICES: RideServiceType[] = [
  'one-way',
  'tour-package',
  'airport-transfer',
  'bar-pickup',
];

export const MINUTE_BASED_SERVICES: RideServiceType[] = [
  'round-trip',
  'hourly-driver',
  'hospital-assistance',
];

export function calculateFare(
  serviceType: RideServiceType,
  category: VehicleCategory,
  distanceKm: number,
  stopsCount: number = 0,
  durationHours: number = 0,
  isRoundTrip: boolean = false,
  promoCode?: string,
  isFirstRide: boolean = false,
  pricingConfig?: DriverServicesPricingConfig | HourlyPricingConfig,
  routeDurationMins?: number
): FareBreakdown {
  const code = (promoCode || '').trim().toUpperCase();

  // Normalize pricing configuration from DB or default
  const fullConfig: DriverServicesPricingConfig = (pricingConfig && 'services' in pricingConfig)
    ? (pricingConfig as DriverServicesPricingConfig)
    : {
        ...defaultDriverServicesPricingConfig,
        hourly: (pricingConfig && 'packages' in pricingConfig)
          ? (pricingConfig as HourlyPricingConfig)
          : defaultHourlyPricingConfig
      };

  const gstPct = fullConfig.gstPercentage ?? 5;
  const platformFee = fullConfig.platformFee ?? 25;

  let baseFare = 0;
  let distanceCharge = 0;
  let timeCharge = 0;
  let durationMinutes = 0;
  let pricingModel: 'kilometer' | 'minute' = 'kilometer';
  let ratePerUnit = 1.00;
  let chargeableUnits = 0;
  let unitLabel = 'km';
  let pricingLabel = '';

  // ─────────────────────────────────────────────────────────────────────────────
  // MODEL A: Kilometer-Based Pricing (One Way, Outstation, Airport Transportation, Night Drive)
  // Distance charge = Actual road distance in KM * ₹1 per km.
  // Formula: Total Fare = (Distance in KM * ₹1) + GST + Platform Fee
  // No time charges, hourly charges, or waiting charges added to these four services.
  // ─────────────────────────────────────────────────────────────────────────────
  const isKmService = serviceType === 'one-way' || serviceType === 'tour-package' || serviceType === 'airport-transfer' || serviceType === 'bar-pickup';

  if (isKmService) {
    pricingModel = 'kilometer';
    ratePerUnit = 1.00;
    unitLabel = 'km';
    const effectiveKm = Math.max(1, Math.round(distanceKm * 10) / 10);
    chargeableUnits = effectiveKm;
    distanceCharge = Math.round(effectiveKm * 1.00);
    baseFare = distanceCharge;
    timeCharge = 0;
    durationMinutes = routeDurationMins || Math.max(10, Math.round((distanceKm / 35) * 60));

    if (serviceType === 'one-way') {
      pricingLabel = `Kilometer-Based Pricing (₹1/km) • ${effectiveKm} km`;
    } else if (serviceType === 'tour-package') {
      pricingLabel = `Outstation Kilometer-Based Pricing (₹1/km) • ${effectiveKm} km`;
    } else if (serviceType === 'airport-transfer') {
      pricingLabel = `Airport Kilometer-Based Pricing (₹1/km) • ${effectiveKm} km`;
    } else {
      pricingLabel = `Night Drive Kilometer-Based Pricing (₹1/km) • ${effectiveKm} km`;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────
  // MODEL B: Minute-Based Pricing (Round Trip, Hourly Chauffeur, Hospital Escort)
  // Duration charge = Actual booking duration in minutes * ₹1.20 per minute.
  // Formula: Total Fare = (Duration in Minutes * ₹1.20) + GST + Platform Fee
  // No per-kilometre charges, even if route distance is displayed.
  // ─────────────────────────────────────────────────────────────────────────────
  else {
    pricingModel = 'minute';
    ratePerUnit = 1.20;
    unitLabel = 'minutes';

    if (serviceType === 'hourly-driver') {
      const hours = Math.max(1, durationHours || 2);
      durationMinutes = hours * 60;
      pricingLabel = `Hourly Chauffeur (${hours}h = ${durationMinutes} mins @ ₹1.20/min)`;
    } else if (serviceType === 'hospital-assistance') {
      const hours = Math.max(1, durationHours || 3);
      durationMinutes = hours * 60;
      pricingLabel = `Hospital Escort (${hours}h = ${durationMinutes} mins @ ₹1.20/min)`;
    } else if (serviceType === 'round-trip') {
      // Round trip: return journey duration or selected hours * 60
      const roundMins = durationHours > 0 
        ? durationHours * 60 
        : Math.max(60, Math.round(((routeDurationMins || (distanceKm / 30 * 60)) * 2)));
      durationMinutes = roundMins;
      pricingLabel = `Round Trip (${durationMinutes} mins @ ₹1.20/min)`;
    } else {
      durationMinutes = Math.max(30, Math.round((distanceKm / 30) * 60));
      pricingLabel = `Minute-Based Pricing (${durationMinutes} mins @ ₹1.20/min)`;
    }

    chargeableUnits = durationMinutes;
    distanceCharge = 0; // Strictly ₹0 distance charge for minute-based services!
    timeCharge = Math.round(durationMinutes * 1.20);
    baseFare = timeCharge;
  }

  const subtotal = Math.round(distanceCharge + timeCharge);
  const serviceTaxGST = Math.round(subtotal * (gstPct / 100));
  
  let discountAmount = 0;
  if (isFirstRide) {
    discountAmount = Math.round((subtotal + serviceTaxGST) * 0.50); // 50% First Ride Discount
  } else if (code === 'KOCHI2026') {
    discountAmount = Math.min(150, Math.round((subtotal + serviceTaxGST) * 0.2));
  }

  const totalFare = Math.max(10, subtotal + serviceTaxGST + platformFee - discountAmount);

  return {
    baseFare,
    distanceKm: isKmService ? distanceKm : 0,
    distanceCharge,
    timeCharge,
    durationMinutes,
    stopCharges: 0,
    nightSurcharge: 0,
    waitingCharge: 0,
    driverAllowance: 0,
    serviceTaxGST,
    platformFee,
    discountAmount: discountAmount > 0 ? discountAmount : undefined,
    durationHours: durationHours > 0 ? durationHours : undefined,
    isEstimate: true,
    pricingLabel,
    pricingModel,
    ratePerUnit,
    chargeableUnits,
    unitLabel,
    totalFare
  };
}

export function calculateRentalQuote(
  rentalVehicle: RentalVehicle,
  days: number = 1,
  hours: number = 0,
  promoCode?: string,
  isFirstRental: boolean = false
): FareBreakdown {
  const dailyTotal = rentalVehicle.dailyRate * Math.max(1, days);
  const hourlyTotal = hours > 0 ? rentalVehicle.hourlyRate * hours : 0;
  const rentalBase = dailyTotal + hourlyTotal;
  const serviceTaxGST = Math.round(rentalBase * 0.05); // 5% GST
  const platformFee = 150; // DriveC Rental Protection & Handover Inspection fee

  let discountAmount = 0;
  const code = (promoCode || '').trim().toUpperCase();
  if (isFirstRental) {
    discountAmount = Math.round(rentalBase * 0.50); // 50% First Rental Discount
  } else if (code === 'KOCHI2026') {
    discountAmount = 250;
  }

  // Total rental price without security deposit
  const totalFare = Math.max(100, rentalBase + serviceTaxGST + platformFee - discountAmount);

  // Advance amount (Requirement 1: calculated advance amount deducted from total rental price)
  const configuredAdvance = rentalVehicle.advanceAmount ?? (rentalVehicle.securityDeposit ? Math.min(rentalVehicle.securityDeposit, 1500) : 1000);
  const advanceAmount = Math.min(totalFare, configuredAdvance > 0 ? configuredAdvance : 1000);
  const remainingAmount = Math.max(0, totalFare - advanceAmount);

  return {
    baseFare: rentalBase,
    distanceKm: 0,
    distanceCharge: 0,
    timeCharge: 0,
    stopCharges: 0,
    nightSurcharge: 0,
    serviceTaxGST,
    platformFee,
    rentalDailyRate: rentalVehicle.dailyRate,
    rentalDays: days,
    advanceAmount,
    remainingAmount,
    discountAmount: discountAmount > 0 ? discountAmount : undefined,
    totalFare,
  };
}

// 60% Organization Commission / 40% Driver Earnings Formula (Requirement 4)
// Credit salary only if ride is completed; if ride is cancelled, zero payment
// If driver timing is delayed, cut 3% of his salary
export function calculateDriverSalary(
  totalFare: number,
  isDelayed: boolean = false,
  status?: BookingStatus
): { driverSalary: number; platformCommission: number; delayPenalty: number } {
  // If cancelled, zero payment
  if (status === 'cancelled') {
    return { driverSalary: 0, platformCommission: 0, delayPenalty: 0 };
  }
  const platformCommission = Math.round(totalFare * 0.60); // 60% Organization Commission
  const baseSalary = totalFare - platformCommission;       // 40% Standard Driver Share
  const delayPenalty = isDelayed ? Math.round(baseSalary * 0.03) : 0; // 3% deduction if timing delayed
  const driverSalary = Math.max(0, baseSalary - delayPenalty);
  return { driverSalary, platformCommission, delayPenalty };
}

export function getInitialState(): AppState {
  return {
    currentUser: {
      id: 'guest-session',
      role: 'guest',
      name: 'Guest Explorer',
      phone: '',
      email: '',
    },
    language: 'en',
    customers: [],
    drivers: [],
    rentalVehicles: [],
    rentalExtensions: [],
    bookings: [],
    reviews: [],
    complaints: [],
    notices: [],
    whatsAppEnquiries: [],
    notifications: [],
    favouriteDriverIds: [],
    activeModal: 'none',
  };
}

export function loadSavedState(): AppState {
  if (typeof window === 'undefined') return getInitialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialState();
    const parsed = JSON.parse(raw);
    return {
      ...getInitialState(),
      ...parsed,
      rentalVehicles: Array.isArray(parsed.rentalVehicles) ? parsed.rentalVehicles : [],
      notices: parsed.notices || [],
      favouriteDriverIds: parsed.favouriteDriverIds || [],
    };
  } catch (err) {
    console.error('Error loading state from localStorage:', err);
    return getInitialState();
  }
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Error saving state to localStorage:', err);
  }
}
