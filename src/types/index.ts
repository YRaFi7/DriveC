export type UserRole = 'guest' | 'customer' | 'driver' | 'owner' | 'admin';

export type Language = 'en' | 'ml';

export type BookingType = 'driver_booking' | 'self_drive_rental';

export type RideServiceType =
  | 'one-way'
  | 'round-trip'
  | 'hospital-assistance'
  | 'bar-pickup'
  | 'tour-package'
  | 'airport-transfer'
  | 'advance-event'
  | 'hourly-driver'
  | 'self-drive';

export type VehicleCategory =
  | 'hatchback'
  | 'sedan'
  | 'suv'
  | 'premium'
  // Legacy compatibility
  | 'bike'
  | 'auto'
  | 'ev'
  | 'automatic';

export type TransmissionType = 'manual' | 'automatic';
export type FuelType = 'petrol' | 'diesel' | 'ev' | 'cng';

export type BookingStatus =
  | 'pending'
  | 'approved'
  | 'accepted'
  | 'driver_arriving'
  | 'arrived'
  | 'in_progress'
  | 'awaiting_payment'
  | 'completed'
  | 'cancelled'
  | 'declined';

export interface BookingStop {
  id: string;
  address: string;
  order: number;
}

export interface FareBreakdown {
  baseFare: number;
  distanceKm: number;
  distanceCharge: number;
  timeCharge: number;
  durationMinutes?: number;
  stopCharges: number;
  nightSurcharge: number;
  waitingCharge?: number;
  driverAllowance?: number;
  serviceTaxGST: number;
  platformFee: number;
  discountAmount?: number;
  rentalDailyRate?: number;
  rentalDays?: number;
  advanceAmount?: number;
  remainingAmount?: number;
  securityDeposit?: number; // Kept for backward compatibility
  hourlyPackageRate?: number;
  extraHoursCharge?: number;
  durationHours?: number;
  isEstimate?: boolean;
  pricingLabel?: string;
  pricingModel?: 'kilometer' | 'minute' | 'rental';
  ratePerUnit?: number;
  chargeableUnits?: number;
  unitLabel?: string;
  durationCharge?: number;
  gstAmount?: number;
  totalFare: number;
}

export interface ServicePricingRule {
  baseFare: number;
  baseKm: number;
  perKmRate: number;
  timeRatePerMin?: number;
  waitingChargePerHour?: number;
  driverAllowancePerDay?: number;
  nightSurcharge?: number;
  flatPackageRate?: number;
  flatPackageSlabKm?: number;
  description?: string;
  isEstimate?: boolean;
}

export interface DriverServicesPricingConfig {
  hourly: HourlyPricingConfig;
  services: {
    'one-way': ServicePricingRule;
    'round-trip': ServicePricingRule;
    'hourly-driver': ServicePricingRule;
    'tour-package': ServicePricingRule;
    'airport-transfer': ServicePricingRule;
    'bar-pickup': ServicePricingRule;
    'hospital-assistance': ServicePricingRule;
    'advance-event'?: ServicePricingRule;
    [key: string]: ServicePricingRule | undefined;
  };
  categoryRates: Record<string, { baseFare: number; baseKm: number; perKmRate: number; timeRatePerMin: number }>;
  gstPercentage: number;
  platformFee: number;
}

export interface HourlyPackage {
  hours: number;
  rate: number;
  label?: string;
  kmIncluded?: number;
  includedKm?: number;
}

export interface HourlyPricingConfig {
  packages: HourlyPackage[];
  extraHourRate: number;
}

export interface CustomerVehicleDetails {
  id?: string;
  model: string;
  category: VehicleCategory;
  transmission: TransmissionType;
  fuel: FuelType;
  licensePlate?: string;
  notes?: string;
}

export interface HandoverChecklist {
  odometerKm: number;
  fuelPercentage: number;
  exteriorCondition: 'excellent' | 'good' | 'minor_scratches' | 'dents';
  cleanliness: 'clean' | 'moderate' | 'needs_cleaning';
  toolsPresent: boolean;
  spareTyrePresent: boolean;
  documentsVerified: boolean;
  notes?: string;
  completedAt?: string;
  signedByCustomer?: boolean;
}

export interface Booking {
  id: string;
  refCode: string;
  bookingType?: BookingType;
  customerId: string;
  customerName: string;
  customerPhone: string;
  passengerName?: string;
  passengerPhone?: string;
  serviceType: RideServiceType;
  vehicleCategory: VehicleCategory;
  transmission?: TransmissionType;
  fuelType?: FuelType;
  customerVehicle?: CustomerVehicleDetails;
  pickupLocation: string;
  destinationLocation: string;
  stops: BookingStop[];
  scheduledDate: string;
  scheduledTime: string;
  isRoundTrip: boolean;
  returnDate?: string;
  returnTime?: string;
  durationHours?: number;
  rentalDays?: number;
  rentalVehicleId?: string;
  rentalVehicleModel?: string;
  rentalVehicleOwnerId?: string;
  advanceAmount?: number;
  remainingAmount?: number;
  advancePaid?: boolean;
  advancePaidAt?: string;
  remainingPaid?: boolean;
  remainingPaidAt?: string;
  cancellationFee?: number;
  refundAmount?: number;
  notificationMessage?: string;
  extendedDays?: number;
  extensionFee?: number;
  securityDeposit?: number; // legacy
  depositStatus?: 'pending' | 'held' | 'refunded' | 'deducted';
  handoverChecklist?: HandoverChecklist;
  returnChecklist?: HandoverChecklist;
  flightTrainNumber?: string;
  medicalNotes?: string;
  hospitalNotes?: string;
  tourItineraryNotes?: string;
  tourNotes?: string;
  promoCode?: string;
  fareBreakdown: FareBreakdown;
  rideStartOtp: string;
  status: BookingStatus;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverVehicle?: string;
  driverRating?: number;
  paymentMethod: 'cash' | 'upi' | 'card';
  paymentStatus: 'pending' | 'completed' | 'refunded';
  createdAt: string;
  emergencyContact?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  driverAccepted?: boolean;
  passengerPaid?: boolean;
  passengerPaidAt?: string;
  favouriteDriverId?: string;
  requestedDriverName?: string;
  requestQueueStatus?: 'exclusive_favourite' | 'exclusive_selected' | 'broadcast' | 'assigned' | 'expired' | 'declined' | 'pending_admin';
  bookingChannel?: string;
  selectedDriverExclusive?: boolean;
  driverSelectionMode?: 'favourite' | 'specific' | 'random';
  acceptRandomDrivers?: boolean;
  declinedDriverIds?: string[];
  rideCompletedAt?: string;
  actualDistanceKm?: number;
  actualDurationMinutes?: number;
  exclusiveUntil?: string;
  pricingModel?: 'kilometer' | 'minute' | 'rental';
  driverPaymentReceived?: boolean;
  driverPaymentReceivedAt?: string;
  driverCreditedSalary?: number;
  platformCommission?: number;
  isDelayed?: boolean;
  delayMinutes?: number;
  delayPenalty?: number;

  // Feature 1: Salary Crediting & Payment Reference
  salaryCreditTxId?: string;
  salaryCreditedAt?: string;
  paymentTransactionRef?: string;

  // Feature 2: Free Real-Time Trip Sharing & Driver GPS
  shareToken?: string;
  shareTokenCreatedAt?: string;
  shareTokenExpiresAt?: string;
  isSharingActive?: boolean;
  driverLiveLat?: number;
  driverLiveLng?: number;
  driverLiveHeading?: number;
  driverLiveSpeed?: number;
  driverLiveUpdatedAt?: string;

  // Feature 3: Bookings For Others (Travelling Passenger vs Booking Customer)
  bookingFor?: 'myself' | 'someone_else';
  passengerRelationship?: 'family' | 'friend' | 'colleague' | 'other' | string;
  passengerSpecialInstructions?: string;
}

export interface CustomerVehicle {
  id: string;
  customerId: string;
  makeModel: string; // e.g. "Honda City" or "Hyundai Creta"
  vehicleType: VehicleCategory | string; // 'sedan' | 'suv' | 'hatchback' | 'premium'
  transmission: TransmissionType; // 'automatic' | 'manual'
  fuelType: FuelType | string; // 'petrol' | 'diesel' | 'ev'
  notes?: string;
  isDefault?: boolean;
  createdAt?: string;
}

export interface User {
  id: string;
  role: 'customer' | 'driver' | 'owner' | 'admin';
  name: string;
  phone: string;
  email: string;
  city: string;
  emergencyContact?: string;
  vehicles?: CustomerVehicle[];
  favouriteDriverIds?: string[];
  firstRidePromoUsed?: boolean;
  firstRidePromoUsedAt?: string;
  hasCompletedRide?: boolean;
  createdAt: string;
}

export interface DriverDocument {
  id: string;
  type: 'driving_license' | 'vehicle_rc' | 'insurance' | 'police_clearance';
  filename: string;
  uploadedAt: string;
  status: 'pending' | 'verified' | 'rejected';
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  licenseNumber: string;
  vehicleRc?: string; // legacy optional
  vehicleModel?: string; // legacy optional
  vehicleCategory?: VehicleCategory; // legacy optional
  transmissionCapabilities?: TransmissionType[];
  fuelCapabilities?: FuelType[];
  serviceZones?: string[];
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
  approvalNotes?: string;
  isOnline: boolean;
  documents: DriverDocument[];
  totalTrips: number;
  totalEarnings: number;
  pendingPayout: number;
  walletBalance?: number;
  ratingAverage: number;
  ratingCount: number;
  createdAt: string;
  salaryCredits?: Array<{
    id: string;
    bookingRef: string;
    customerName: string;
    tripAmount: number;
    salaryAmount: number;
    commission: number;
    creditedAt: string;
  }>;
}

export interface RentalVehicle {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  model: string;
  brand: string;
  category: VehicleCategory;
  transmission: TransmissionType;
  fuel: FuelType;
  seats: number;
  luggageCapacity: string;
  licensePlate: string;
  year: number;
  dailyRate: number;
  hourlyRate: number;
  advanceAmount: number;
  securityDeposit?: number; // legacy
  location: string;
  isAvailable: boolean;
  offlineUntil?: string;
  maintenanceReason?: string;
  notifySubscribers?: string[];
  approvalStatus: 'pending' | 'approved' | 'rejected';
  features: string[];
  totalRentals: number;
  ratingAverage: number;
  ratingCount: number;
  createdAt: string;
}

export interface RentalExtension {
  id: string;
  bookingId: string;
  bookingRef: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  rentalVehicleId: string;
  vehicleModel: string;
  licensePlate: string;
  originalPickupDate: string;
  originalReturnDate: string;
  requestedReturnDate: string;
  approvedReturnDate?: string | null;
  additionalDays: number;
  dailyRate: number;
  extensionPrice: number;
  existingTotalAmount: number;
  updatedTotalAmount: number;
  status: 'pending' | 'approved' | 'declined';
  adminDecision?: 'approved' | 'declined' | null;
  adminId?: string | null;
  adminNotes?: string | null;
  decisionAt?: string | null;
  paymentStatus: 'pending' | 'completed';
  paymentMethod?: string | null;
  paymentTransactionRef?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  bookingId: string;
  bookingRef: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: 'customer' | 'driver' | 'owner';
  targetId: string;
  targetName: string;
  targetRole: 'driver' | 'customer' | 'owner' | 'vehicle';
  targetVehicleModel?: string;
  punctualityRating: number; // 1-5
  cleanlinessRating: number; // 1-5
  comfortRating: number;     // 1-5
  overallRating: number;     // 1-5
  comment: string;
  adminReply?: string;
  adminRepliedAt?: string;
  createdAt: string;
  verifiedTrip: boolean;
}

export interface NoticeReply {
  id: string;
  senderRole: 'admin' | 'driver';
  senderName: string;
  message: string;
  createdAt: string;
}

export interface DriverNotice {
  id: string;
  driverId: string;
  driverName: string;
  driverPhone?: string;
  adminId?: string;
  adminName?: string;
  reviewId?: string;
  bookingId?: string;
  bookingRef?: string;
  type: 'warning' | 'suspension';
  reason: string;
  status: 'active' | 'dismissed';
  isAcknowledged: boolean;
  acknowledgedAt?: string;
  replies: NoticeReply[];
  createdAt: string;
}

export interface DisputeNotification {
  id: string;
  noticeId: string;
  driverId: string;
  driverName?: string | null;
  adminId: string;
  targetRole: 'admin' | 'driver';
  eventType: 'warning_issued' | 'suspension_issued' | 'admin_reply' | 'driver_reply' | 'driver_acknowledged' | 'case_reviewed' | 'notice_viewed' | string;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface WhatsAppBookingEnquiry {
  id: string;
  waMessageId: string;
  senderPhone: string;
  senderName?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  serviceType?: string | null;
  pickupLocation?: string | null;
  pickupPin?: string | null;
  dropoffLocation?: string | null;
  destinationLocation?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  preferredDriver?: string | null;
  matchedDriverId?: string | null;
  matchedDriverName?: string | null;
  routingStatus?: 'routed_to_driver' | 'driver_identification_required' | 'general_admin' | 'reassigned' | string;
  calculatedKm?: number | null;
  calculatedMinutes?: number | null;
  estimatedFare?: number | null;
  pricingModel?: 'kilometer' | 'minute' | string | null;
  rawMessage: string;
  status: 'pending_verification' | 'converted' | 'rejected';
  isComplete: boolean;
  convertedBookingId?: string | null;
  convertedBookingRef?: string | null;
  adminNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Complaint {
  id: string;
  bookingId: string;
  bookingRef: string;
  complainantId: string;
  complainantName: string;
  complainantRole: 'customer' | 'driver' | 'owner';
  category: 'fare_dispute' | 'rash_driving' | 'cleanliness' | 'unprofessional' | 'route_deviation' | 'vehicle_defect' | 'other';
  description: string;
  status: 'submitted' | 'under_review' | 'resolved' | 'closed';
  resolutionNotes?: string;
  actionTaken?: 'warned' | 'suspended' | 'restricted' | 'dismissed' | 'refunded';
  actionDate?: string;
  adminResponsible?: string;
  createdAt: string;
}

export interface KeralaServiceArea {
  id: string;
  name: string;
  nameMl: string;
  zone: string;
  hub: string;
  popularDestinations: string[];
  activeFleetCount: number;
  baseAvailability: boolean;
  descriptionEn: string;
  descriptionMl: string;
}

export interface WalletTransaction {
  id: string;
  bookingRef: string;
  category: 'Rental Revenue' | 'Organization Commission';
  amount: number;
  details: string;
  customerName: string;
  driverName?: string;
  createdAt: string;
  status: 'completed';
}

export interface OrganizationWalletData {
  totalBalance: number;
  rentalRevenue: number;
  organizationCommission: number;
  transactions: WalletTransaction[];
}

export interface DriverWalletTransaction {
  id: string;
  driverId: string;
  bookingId: string;
  bookingRef: string;
  amount: number;
  grossFare: number;
  commission: number;
  status: 'completed';
  customerName: string;
  passengerName?: string;
  transactionRef?: string;
  createdAt: string;
}

