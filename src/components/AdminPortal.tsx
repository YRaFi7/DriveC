"use client";

import React, { useState } from 'react';
import { 
  Language, 
  Driver, 
  User, 
  Booking, 
  Review, 
  Complaint, 
  UserRole, 
  RentalVehicle, 
  VehicleCategory, 
  TransmissionType, 
  FuelType, 
  DriverNotice,
  DisputeNotification,
  WhatsAppBookingEnquiry,
  HourlyPricingConfig,
  HourlyPackage,
  RideServiceType,
  DriverServicesPricingConfig,
  ServicePricingRule,
  RentalExtension
} from '../types';
import { translations } from '../lib/translations';
import { defaultHourlyPricingConfig, defaultDriverServicesPricingConfig } from '../lib/store';

interface AdminPortalProps {
  language: Language;
  currentUserRole: UserRole;
  initialTab?: 'drivers' | 'bookings' | 'history' | 'rentals' | 'users' | 'reviews' | 'complaints' | 'finance' | 'pricing' | 'whatsapp';
  drivers: Driver[];
  customers: User[];
  bookings: Booking[];
  reviews: Review[];
  complaints: Complaint[];
  rentalVehicles?: RentalVehicle[];
  rentalExtensions?: RentalExtension[];
  notices?: DriverNotice[];
  notifications?: DisputeNotification[];
  whatsAppEnquiries?: WhatsAppBookingEnquiry[];
  onApproveDriver: (driverId: string) => void;
  onRejectDriver: (driverId: string) => void;
  onSuspendDriver?: (driverId: string, reason: string) => void;
  onDeleteReview: (reviewId: string) => void;
  onReplyReview?: (reviewId: string, replyText: string) => void;
  onIssueNotice?: (data: {
    driverId: string;
    driverName: string;
    driverPhone?: string;
    type: 'warning' | 'suspension';
    reason: string;
    reviewId?: string;
    bookingId?: string;
    bookingRef?: string;
  }) => Promise<any>;
  onReplyNotice?: (noticeId: string, message: string, senderRole: 'admin' | 'driver', senderName: string) => Promise<any>;
  onMarkNotificationRead?: (noticeId: string, targetRole: 'admin' | 'driver') => Promise<void>;
  onUpdateWhatsAppEnquiry?: (enquiryId: string, updates: any) => Promise<any>;
  onCreateBooking?: (bookingData: any) => Promise<any>;
  onResolveComplaint: (complaintId: string, notes: string, action?: 'warned' | 'suspended' | 'restricted' | 'dismissed') => void;
  onOpenGuestWarning: () => void;
  // Admin Rental Fleet Handlers
  onAddRentalVehicle?: (vehicle: RentalVehicle) => void;
  onToggleRentalVehicleAvailability?: (vehicleId: string, isAvailable: boolean, offlineUntil?: string) => void;
  onUpdateRentalVehicle?: (vehicle: RentalVehicle) => void;
  onDeleteRentalVehicle?: (vehicleId: string) => void;
  onUpdateBookingStatus?: (bookingId: string, status: Booking['status'], extra?: Record<string, unknown>) => void;
  onApproveRentalExtension?: (extensionId: string, adminNotes?: string) => Promise<any>;
  onDeclineRentalExtension?: (extensionId: string, adminNotes?: string) => Promise<any>;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  language,
  currentUserRole,
  initialTab,
  drivers,
  customers,
  bookings,
  reviews,
  complaints,
  rentalVehicles = [],
  rentalExtensions = [],
  notices = [],
  notifications = [],
  whatsAppEnquiries = [],
  onApproveDriver,
  onRejectDriver,
  onSuspendDriver,
  onDeleteReview,
  onReplyReview,
  onIssueNotice,
  onReplyNotice,
  onMarkNotificationRead,
  onUpdateWhatsAppEnquiry,
  onCreateBooking,
  onResolveComplaint,
  onOpenGuestWarning,
  onAddRentalVehicle,
  onToggleRentalVehicleAvailability,
  onUpdateRentalVehicle,
  onDeleteRentalVehicle,
  onUpdateBookingStatus,
  onApproveRentalExtension,
  onDeclineRentalExtension
}) => {
  const t = translations[language];

  // Admin tabs: drivers, bookings, history, rentals, users, reviews, complaints, finance, pricing, whatsapp
  const [activeTab, setActiveTab] = useState<'drivers' | 'bookings' | 'history' | 'rentals' | 'users' | 'reviews' | 'complaints' | 'finance' | 'pricing' | 'whatsapp'>(initialTab || 'drivers');

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Requirement 3: Configurable Driver Services Pricing & Tariff Settings
  const [servicesPricing, setServicesPricing] = useState<DriverServicesPricingConfig>(defaultDriverServicesPricingConfig);
  const hourlyPricing = servicesPricing.hourly || defaultHourlyPricingConfig;
  const setHourlyPricing = (updater: HourlyPricingConfig | ((prev: HourlyPricingConfig) => HourlyPricingConfig)) => {
    setServicesPricing(prev => {
      const currentHourly = prev.hourly || defaultHourlyPricingConfig;
      const updatedHourly = typeof updater === 'function' ? updater(currentHourly) : updater;
      return { ...prev, hourly: updatedHourly };
    });
  };
  const [selectedPricingService, setSelectedPricingService] = useState<RideServiceType>('one-way');
  const [pricingSubTab, setPricingSubTab] = useState<'services' | 'hourly_packages' | 'categories'>('services');
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [pricingMsg, setPricingMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  React.useEffect(() => {
    fetch('/api/pricing')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          if (data.services) {
            setServicesPricing(data);
          } else if (Array.isArray(data.packages)) {
            setServicesPricing(prev => ({
              ...prev,
              hourly: {
                packages: data.packages,
                extraHourRate: Number(data.extraHourRate) || 150
              }
            }));
          }
        }
      })
      .catch(err => console.warn('Could not fetch pricing in AdminPortal:', err));
  }, []);

  const handleSaveServicesPricing = async () => {
    setIsSavingPricing(true);
    setPricingMsg(null);
    try {
      const res = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(servicesPricing)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setServicesPricing(data.config);
        }
        setPricingMsg({ type: 'success', text: 'All chauffeur service pricing rules successfully updated and active in database!' });
      } else {
        const err = await res.json();
        setPricingMsg({ type: 'error', text: err.error || 'Failed to save pricing configuration.' });
      }
    } catch {
      setPricingMsg({ type: 'error', text: 'Network error saving pricing configuration.' });
    } finally {
      setIsSavingPricing(false);
    }
  };

  const handlePackageChange = (index: number, field: keyof HourlyPackage, val: number | string) => {
    const updated = [...hourlyPricing.packages];
    updated[index] = { ...updated[index], [field]: val };
    setHourlyPricing({ ...hourlyPricing, packages: updated });
  };

  const handleAddPackage = () => {
    const nextHours = (hourlyPricing.packages[hourlyPricing.packages.length - 1]?.hours || 12) + 2;
    const newPkg: HourlyPackage = {
      hours: nextHours,
      rate: (hourlyPricing.packages[hourlyPricing.packages.length - 1]?.rate || 1800) + 300,
      kmIncluded: nextHours * 10,
      includedKm: nextHours * 10,
      label: `${nextHours} Hours Chauffeur`
    };
    setHourlyPricing({
      ...hourlyPricing,
      packages: [...hourlyPricing.packages, newPkg].sort((a, b) => a.hours - b.hours)
    });
  };

  const handleDeletePackage = (index: number) => {
    if (hourlyPricing.packages.length <= 1) {
      alert('You must have at least one duration package configured.');
      return;
    }
    const updated = hourlyPricing.packages.filter((_, i) => i !== index);
    setHourlyPricing({ ...hourlyPricing, packages: updated });
  };
  
  // Driver KYC filter
  const [driverFilter, setDriverFilter] = useState<'all' | 'pending' | 'approved' | 'suspended'>('all');

  // Requirement 3: Admin Booking & Ride History Filter
  const [bookingStatusFilter, setBookingStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [expandedAdminBookingId, setExpandedAdminBookingId] = useState<string | null>(null);
  const [expandedAdminHistoryId, setExpandedAdminHistoryId] = useState<string | null>(null);
  const [expandedWaEnquiryId, setExpandedWaEnquiryId] = useState<string | null>(null);

  // Collapse expanded cards whenever sub-navbar tab or filter changes
  React.useEffect(() => {
    setExpandedAdminBookingId(null);
    setExpandedAdminHistoryId(null);
    setExpandedWaEnquiryId(null);
  }, [activeTab, bookingStatusFilter]);

  // Collapse expanded cards when top navbar options or external collapse events fire
  React.useEffect(() => {
    const handleCollapse = () => {
      setExpandedAdminBookingId(null);
      setExpandedAdminHistoryId(null);
      setExpandedWaEnquiryId(null);
    };
    window.addEventListener('drivec_collapse_cards', handleCollapse);
    return () => window.removeEventListener('drivec_collapse_cards', handleCollapse);
  }, []);

  const toggleAdminBookingExpand = (bookingId: string) => {
    setExpandedAdminBookingId(prev => {
      const isOpening = prev !== bookingId;
      if (isOpening) {
        setTimeout(() => {
          const el = document.getElementById(`admin-booking-card-${bookingId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el.focus({ preventScroll: true });
          }
        }, 60);
      }
      return isOpening ? bookingId : null;
    });
  };

  const toggleAdminHistoryExpand = (bookingId: string) => {
    setExpandedAdminHistoryId(prev => {
      const isOpening = prev !== bookingId;
      if (isOpening) {
        setTimeout(() => {
          const el = document.getElementById(`admin-history-card-${bookingId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el.focus({ preventScroll: true });
          }
        }, 60);
      }
      return isOpening ? bookingId : null;
    });
  };

  const toggleWaEnquiryExpand = (enquiryId: string) => {
    setExpandedWaEnquiryId(prev => {
      const isOpening = prev !== enquiryId;
      if (isOpening) {
        setTimeout(() => {
          const el = document.getElementById(`admin-wa-card-${enquiryId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el.focus({ preventScroll: true });
          }
        }, 60);
      }
      return isOpening ? enquiryId : null;
    });
  };
  
  // Requirement 6: Passenger Search Query in Admin
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Requirement 10: Specific Driver Selector for Reviews
  const [selectedDriverForReview, setSelectedDriverForReview] = useState<string>('all');

  // Requirement 10: Official Admin Reply Inputs per Review
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});

  // Requirement 2: Disciplinary Warning & Suspension states per review
  const [warningLetters, setWarningLetters] = useState<Record<string, string>>({});
  const [warningSentStatus, setWarningSentStatus] = useState<Record<string, string>>({});
  const [confirmSuspendReviewId, setConfirmSuspendReviewId] = useState<string | null>(null);
  const [suspendSuccessStatus, setSuspendSuccessStatus] = useState<Record<string, string>>({});
  const [expandedReviewAction, setExpandedReviewAction] = useState<Record<string, 'warning' | 'suspension' | null>>({});
  const [actionErrorStatus, setActionErrorStatus] = useState<Record<string, string>>({});
  const [actionLoadingStatus, setActionLoadingStatus] = useState<Record<string, boolean>>({});

  // Disputes and Action history state (Requirement 5 & Compact Cards)
  const [disputesSubView, setDisputesSubView] = useState<'notices' | 'tickets'>('notices');
  const [expandedDisputeNoticeId, setExpandedDisputeNoticeId] = useState<string | null>(null);
  const [viewedAckNoticeIds, setViewedAckNoticeIds] = useState<Record<string, boolean>>({});
  const [adminNoticeReplies, setAdminNoticeReplies] = useState<Record<string, string>>({});
  const [noticeReplyError, setNoticeReplyError] = useState<Record<string, string>>({});
  const [noticeReplyLoading, setNoticeReplyLoading] = useState<Record<string, boolean>>({});

  // Persistent Notification tracking for Admin (Requirement 3)
  const getUnreadAdminNotificationsForNotice = (noticeId: string) => {
    return (notifications || []).filter(notif =>
      notif.noticeId === noticeId &&
      notif.targetRole === 'admin' &&
      !notif.isRead
    );
  };

  const hasAdminUnreadForNotice = (n: DriverNotice) => {
    // If the card is currently expanded by admin, it is being viewed right now -> stop blinking
    if (expandedDisputeNoticeId === n.id) return false;

    // Check database notifications for this notice with targetRole === 'admin'
    const adminNotifs = (notifications || []).filter(
      notif => notif.noticeId === n.id && notif.targetRole === 'admin'
    );
    if (adminNotifs.length > 0) {
      return adminNotifs.some(notif => !notif.isRead);
    }

    // Fallback check if recent reply/ack not yet acknowledged
    if (viewedAckNoticeIds[n.id]) return false;
    const last = Array.isArray(n.replies) && n.replies.length > 0 ? n.replies[n.replies.length - 1] : null;
    if (last?.senderRole === 'driver') return true;
    return Boolean(n.isAcknowledged && (!n.replies || n.replies.length === 0));
  };

  const hasDriverPendingReply = (notice: DriverNotice) => {
    if (!Array.isArray(notice.replies) || notice.replies.length === 0) return false;
    const last = notice.replies[notice.replies.length - 1];
    return last.senderRole === 'driver';
  };

  const hasDriverAckNotification = (notice: DriverNotice) => {
    return Boolean(notice.isAcknowledged && (!notice.replies || notice.replies.length === 0));
  };

  const disputeNotificationCount = notices.filter(hasAdminUnreadForNotice).length;
  const hasDisputeNotification = disputeNotificationCount > 0;

  // WhatsApp Enquiries State & Conversion (Requirement 2)
  const [waStatusFilter, setWaStatusFilter] = useState<'all' | 'pending_verification' | 'converted' | 'rejected'>('all');
  const [activeWaToConvert, setActiveWaToConvert] = useState<WhatsAppBookingEnquiry | null>(null);
  const [selectedDriverForWa, setSelectedDriverForWa] = useState<string>('');
  const [waConversionLoading, setWaConversionLoading] = useState<boolean>(false);
  const [waConversionKm, setWaConversionKm] = useState<number>(15);
  const [waConversionFare, setWaConversionFare] = useState<number>(500);
  const [waConversionError, setWaConversionError] = useState<string>('');
  const [waSearchQuery, setWaSearchQuery] = useState<string>('');
  React.useEffect(() => {
    setExpandedWaEnquiryId(null);
  }, [waStatusFilter, waSearchQuery]);
  const [showSimulateWaModal, setShowSimulateWaModal] = useState<boolean>(false);
  const [simulateWaText, setSimulateWaText] = useState<string>(
    `*DriveC Booking Request*\n• Service: One-Way Driver\n• Pickup: Aluva Railway Station\n• Pickup Pin: https://maps.google.com/?q=10.1076,76.3516\n• Drop-off: Infopark Kochi\n• Date: ${new Date().toISOString().split('T')[0]}\n• Time: 10:30 AM`
  );
  const [simulateWaPhone, setSimulateWaPhone] = useState<string>('+919847123456');
  const [simulateWaName, setSimulateWaName] = useState<string>('Rahul Nair');
  const [waSimulateLoading, setWaSimulateLoading] = useState<boolean>(false);

  const pendingWhatsAppCount = (whatsAppEnquiries || []).filter(w => w.status === 'pending_verification').length;

  const openWaConversionModal = async (wa: WhatsAppBookingEnquiry) => {
    setActiveWaToConvert(wa);
    setWaConversionError('');
    const onlineDrivers = drivers.filter(d => d.approvalStatus === 'approved');
    setSelectedDriverForWa(onlineDrivers[0]?.id || drivers[0]?.id || '');
    
    // Calculate road distance via /api/distance
    let km = 15;
    const dest = wa.destinationLocation || wa.dropoffLocation;
    if (wa.pickupLocation && dest) {
      try {
        const res = await fetch(`/api/distance?pickup=${encodeURIComponent(wa.pickupLocation)}&drop=${encodeURIComponent(dest)}`);
        if (res.ok) {
          const d = await res.json();
          if (d.distanceKm) {
            km = d.distanceKm;
          }
        }
      } catch {
        // fallback
      }
    }
    setWaConversionKm(km);

    // Compute fare according to service pricing
    const svcType = (wa.serviceType || 'one-way') as RideServiceType;
    const rule = servicesPricing.services[svcType] || servicesPricing.services['one-way'];
    const extraKm = Math.max(0, km - (rule?.baseKm || 10));
    const base = rule?.baseFare || 450;
    const kmFare = extraKm * (rule?.perKmRate || 18);
    const gst = Math.round((base + kmFare) * 0.05);
    const plat = 25;
    setWaConversionFare(base + kmFare + gst + plat);
  };

  const handleConfirmWaConversion = async () => {
    if (!activeWaToConvert) return;
    setWaConversionLoading(true);
    setWaConversionError('');
    try {
      const matchedDriver = drivers.find(d => d.id === selectedDriverForWa);
      const bookingRef = `DC-WA-${Math.floor(1000 + Math.random() * 9000)}`;
      const svcType = (activeWaToConvert.serviceType || 'one-way') as RideServiceType;
      const custPhone = activeWaToConvert.customerPhone || activeWaToConvert.senderPhone || '';
      const custName = activeWaToConvert.customerName || activeWaToConvert.senderName || 'WhatsApp Customer';
      const dest = activeWaToConvert.destinationLocation || activeWaToConvert.dropoffLocation || 'Ernakulam';
      const newBooking: Booking = {
        id: `bkg_wa_${Date.now()}`,
        refCode: bookingRef,
        customerId: `cust_wa_${Date.now()}`,
        customerName: custName,
        customerPhone: custPhone,
        driverId: matchedDriver?.id,
        driverName: matchedDriver?.name,
        driverPhone: matchedDriver?.phone,
        driverRating: matchedDriver?.ratingAverage,
        serviceType: svcType,
        vehicleCategory: 'sedan',
        pickupLocation: activeWaToConvert.pickupLocation || 'Kochi',
        destinationLocation: dest,
        stops: [],
        scheduledDate: activeWaToConvert.scheduledDate || new Date().toISOString().split('T')[0],
        scheduledTime: activeWaToConvert.scheduledTime || '10:00 AM',
        isRoundTrip: svcType === 'round-trip',
        rideStartOtp: String(Math.floor(1000 + Math.random() * 9000)),
        paymentMethod: 'cash',
        paymentStatus: 'pending',
        status: 'pending',
        fareBreakdown: {
          baseFare: Math.round(waConversionFare * 0.8),
          distanceKm: waConversionKm,
          distanceCharge: Math.round(waConversionFare * 0.1),
          timeCharge: 0,
          stopCharges: 0,
          nightSurcharge: 0,
          serviceTaxGST: Math.round(waConversionFare * 0.05),
          platformFee: 25,
          totalFare: waConversionFare,
        },
        createdAt: new Date().toISOString(),
      };

      if (onCreateBooking) {
        await onCreateBooking(newBooking);
      }

      if (onUpdateWhatsAppEnquiry) {
        await onUpdateWhatsAppEnquiry(activeWaToConvert.id, {
          status: 'converted',
          convertedBookingId: newBooking.id,
          convertedBookingRef: newBooking.refCode
        });
      }

      setActiveWaToConvert(null);
    } catch (err: any) {
      setWaConversionError(err?.message || 'Failed to convert enquiry to booking');
    } finally {
      setWaConversionLoading(false);
    }
  };

  const handleRejectWaEnquiry = async (enquiryId: string) => {
    if (!confirm('Are you sure you want to decline this WhatsApp booking enquiry?')) return;
    try {
      if (onUpdateWhatsAppEnquiry) {
        await onUpdateWhatsAppEnquiry(enquiryId, { status: 'rejected' });
      }
    } catch (err) {
      console.error('Failed to reject WhatsApp enquiry:', err);
    }
  };

  const handleSendSimulatedWa = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaSimulateLoading(true);
    try {
      const res = await fetch('/api/whatsapp/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerPhone: simulateWaPhone,
          customerName: simulateWaName,
          rawMessage: simulateWaText,
        }),
      });
      if (res.ok) {
        setShowSimulateWaModal(false);
        setActiveTab('whatsapp');
      }
    } catch (err) {
      console.error('Failed to simulate WhatsApp enquiry:', err);
    } finally {
      setWaSimulateLoading(false);
    }
  };

  const toggleReviewAction = (reviewId: string, action: 'warning' | 'suspension') => {
    setActionErrorStatus(prev => ({ ...prev, [reviewId]: '' }));
    setExpandedReviewAction(prev => ({
      ...prev,
      [reviewId]: prev[reviewId] === action ? null : action
    }));
  };

  // Requirement 10: Specific Driver Selector for Wallet & Ledger
  const [selectedDriverForWallet, setSelectedDriverForWallet] = useState<string>(drivers[0]?.id || 'all');

  // Complaint Action Modal state (Requirement 8)
  const [activeComplaintForAction, setActiveComplaintForAction] = useState<Complaint | null>(null);
  const [actionType, setActionType] = useState<'warned' | 'suspended' | 'restricted' | 'resolved'>('warned');
  const [actionNotes, setActionNotes] = useState('');

  // Admin Rental Fleet State (Rent vehicles handled by admin)
  const [rentalTabFilter, setRentalTabFilter] = useState<'fleet' | 'bookings' | 'extensions'>('fleet');
  const [extensionFilterStatus, setExtensionFilterStatus] = useState<'all' | 'pending' | 'approved' | 'declined'>('all');
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [newVehicleModel, setNewVehicleModel] = useState('');
  const [newVehicleBrand, setNewVehicleBrand] = useState('Toyota');
  const [newVehicleCategory, setNewVehicleCategory] = useState<VehicleCategory>('suv');
  const [newVehicleTransmission, setNewVehicleTransmission] = useState<TransmissionType>('automatic');
  const [newVehicleFuel, setNewVehicleFuel] = useState<FuelType>('diesel');
  const [newVehicleSeats, setNewVehicleSeats] = useState(7);
  const [newVehicleDailyRate, setNewVehicleDailyRate] = useState(2500);
  // Requirement 5: Driving History State for Admin
  const [selectedDriverForHistory, setSelectedDriverForHistory] = useState<string>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Requirement 6: Offline Vehicle Maintenance Modal
  const [offlineModalVehicle, setOfflineModalVehicle] = useState<RentalVehicle | null>(null);
  const [offlineExpectedDate, setOfflineExpectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [offlineReason, setOfflineReason] = useState('Periodic mechanical servicing & safety inspection');

  // Requirement 1: Replace Security Deposit with Advance Amount
  const [newVehicleAdvanceAmount, setNewVehicleAdvanceAmount] = useState(1000);
  const [newVehicleSecurityDeposit, setNewVehicleSecurityDeposit] = useState(1000);
  const [newVehicleLicensePlate, setNewVehicleLicensePlate] = useState('KL-07-CD-');
  const [newVehicleLocation, setNewVehicleLocation] = useState('Cochin International Airport (COK)');

  // Handover modal inside Admin
  const [activeHandoverBooking, setActiveHandoverBooking] = useState<Booking | null>(null);
  const [handoverOdometer, setHandoverOdometer] = useState(24500);
  const [handoverFuelLevel, setHandoverFuelLevel] = useState(100);
  const [handoverCondition, setHandoverCondition] = useState<'excellent' | 'good' | 'minor_scratches'>('excellent');
  const [handoverCleanliness, setHandoverCleanliness] = useState<'clean' | 'moderate'>('clean');

  // Return modal inside Admin
  const [activeReturnBooking, setActiveReturnBooking] = useState<Booking | null>(null);
  const [returnOdometer, setReturnOdometer] = useState(24750);
  const [returnFuelLevel, setReturnFuelLevel] = useState(90);
  const [returnDepositAction, setReturnDepositAction] = useState<'full_refund' | 'deduct_fuel' | 'deduct_damage'>('full_refund');

  // Inspection modal for rental reservations (Requirement 1)
  const [inspectingRentalBooking, setInspectingRentalBooking] = useState<Booking | null>(null);

  // Fleet Extension Requests State
  const [adminExtensionProcessingId, setAdminExtensionProcessingId] = useState<string | null>(null);
  const [adminExtensionError, setAdminExtensionError] = useState<string | null>(null);
  const [adminExtensionSuccess, setAdminExtensionSuccess] = useState<string | null>(null);
  const [declineModalExt, setDeclineModalExt] = useState<RentalExtension | null>(null);
  const [declineReason, setDeclineReason] = useState('Fleet schedule conflict with upcoming reservations');

  if (currentUserRole === 'guest') {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-[#14171f] border border-amber-500/50 rounded-3xl p-8 space-y-4 text-slate-100">
          <h3 className="text-xl font-bold text-amber-200">Administrative Access Protected</h3>
          <p className="text-xs text-amber-200 max-w-md mx-auto">
            Guest exploration mode cannot view or modify administrative operations. Please log in with administrator privileges.
          </p>
          <button
            onClick={onOpenGuestWarning}
            className="px-6 py-2.5 rounded-xl bg-[#002C6C] text-white font-bold text-xs"
          >
            Authorize Admin First
          </button>
        </div>
      </div>
    );
  }

  const pendingDrivers = drivers.filter(d => d.approvalStatus === 'pending');
  const totalRevenue = bookings.reduce((acc, b) => acc + (b.fareBreakdown?.totalFare || 0), 0);
  const completedBookings = bookings.filter(b => b.status === 'completed');

  // Match driver to booking helper
  const matchDriverBooking = (b: Booking, d: Driver) => {
    const matchId = Boolean(b.driverId && d.id && (b.driverId === d.id || b.driverId.toLowerCase() === d.id.toLowerCase()));
    const cleanBPhone = (b.driverPhone || '').replace(/\D/g, '');
    const cleanDPhone = (d.phone || '').replace(/\D/g, '');
    const matchPhone = Boolean(cleanBPhone && cleanDPhone && (cleanBPhone === cleanDPhone || cleanBPhone.includes(cleanDPhone) || cleanDPhone.includes(cleanBPhone)));
    const matchName = Boolean(b.driverName && d.name && (b.driverName.trim().toLowerCase() === d.name.trim().toLowerCase()));
    return matchId || matchPhone || matchName;
  };

  // Requirement 4: 40% Driver Salary / 60% Organization Commission
  const driverSalaryStats = drivers.map(d => {
    const dCompleted = bookings.filter(b => matchDriverBooking(b, d) && b.status === 'completed');
    const tripsCount = dCompleted.length > 0 ? dCompleted.length : (d.totalTrips || 0);
    const grossFare = dCompleted.reduce((sum, b) => sum + (b.fareBreakdown?.totalFare || 0), 0) || d.totalEarnings || 0;
    const orgCommission60 = dCompleted.reduce((sum, b) => sum + (b.platformCommission || Math.round((b.fareBreakdown?.totalFare || 0) * 0.60)), 0) || Math.round(grossFare * 0.60);
    const netSalary40 = dCompleted.reduce((sum, b) => sum + (b.driverCreditedSalary || Math.round((b.fareBreakdown?.totalFare || 0) * 0.40)), 0) || Math.round(grossFare * 0.40);
    const walletBalance = typeof d.walletBalance === 'number' && d.walletBalance > 0 ? d.walletBalance : netSalary40;

    return {
      driver: d,
      tripsCount,
      grossFare,
      orgCommission60,
      netSalary40,
      walletBalance,
      completedBookings: dCompleted,
    };
  });

  // Rental bookings filter
  const rentalBookings = bookings.filter(b => 
    b.serviceType === 'self-drive' || 
    (b.serviceType as string) === 'self_drive' || 
    b.bookingType === 'self_drive_rental' || 
    Boolean(b.rentalVehicleId)
  );

  // Requirement 4: Organization Wallet Categories
  // 1. Rental Revenue (earnings from completed self-drive vehicle rentals)
  const completedRentals = rentalBookings.filter(b => b.status === 'completed' || b.remainingPaid || b.passengerPaid);
  const orgRentalRevenue = completedRentals.reduce((sum, b) => sum + (b.fareBreakdown?.totalFare || 0), 0);

  // 2. Organization Commission (60% share from completed driver rides)
  const completedDriverRides = bookings.filter(b => 
    b.serviceType !== 'self-drive' && 
    (b.serviceType as string) !== 'self_drive' && 
    b.bookingType !== 'self_drive_rental' && 
    !b.rentalVehicleId && 
    b.status === 'completed'
  );
  const orgDriverCommission = completedDriverRides.reduce((sum, b) => sum + (b.platformCommission || Math.round((b.fareBreakdown?.totalFare || 0) * 0.60)), 0);

  // Gross Revenue components:
  // Component 1: Remaining 60% from driver rides
  const driver60Commission = orgDriverCommission;

  // Component 2: Advance received for self rental
  const rentalAdvanceReceived = rentalBookings.reduce((sum, b) => {
    if (b.status === 'cancelled') {
      // Retained 20% cancellation fee from advance
      return sum + (b.cancellationFee || 0);
    }
    if (b.advancePaid || b.advancePaidAt || ['pending', 'approved', 'in_progress', 'completed'].includes(b.status)) {
      return sum + (b.advanceAmount ?? (b.fareBreakdown as any)?.advanceAmount ?? 0);
    }
    return sum;
  }, 0);

  // Component 3: Remaining fees after self rental completed
  const rentalRemainingFeesCompleted = rentalBookings.reduce((sum, b) => {
    if (b.status === 'completed' || b.remainingPaid) {
      const rem = b.remainingAmount ?? Math.max(0, (b.fareBreakdown?.totalFare || 0) - (b.advanceAmount ?? (b.fareBreakdown as any)?.advanceAmount ?? 0));
      return sum + rem;
    }
    return sum;
  }, 0);

  // Gross Revenue = sum of remaining 60% from driver + advance received for self rental + remaining fees after self rental completed
  const grossRevenue = driver60Commission + rentalAdvanceReceived + rentalRemainingFeesCompleted;

  // Total Organization Wallet Balance
  const totalOrganizationWalletBalance = orgRentalRevenue + orgDriverCommission;

  // Total Driver Salaries (40% driver share)
  const totalDriverSalariesAllocated = completedDriverRides.reduce((sum, b) => sum + (b.driverCreditedSalary || Math.round((b.fareBreakdown?.totalFare || 0) * 0.40)), 0);

  // Unified Organization Wallet Transactions History
  const organizationWalletTransactions = [
    ...completedRentals.map(b => ({
      id: `tx-rent-${b.id}`,
      refCode: b.refCode,
      category: 'Rental Revenue' as const,
      amount: b.fareBreakdown?.totalFare || 0,
      details: `${b.rentalVehicleModel || 'Self-Drive Vehicle'} (${b.scheduledDate} → ${b.returnDate || b.scheduledDate})`,
      customerName: b.customerName,
      driverName: undefined,
      date: b.passengerPaidAt || b.createdAt,
      status: 'completed' as const
    })),
    ...completedDriverRides.map(b => ({
      id: `tx-comm-${b.id}`,
      refCode: b.refCode,
      category: 'Organization Commission' as const,
      amount: b.platformCommission || Math.round((b.fareBreakdown?.totalFare || 0) * 0.60),
      details: `Commission • ${b.pickupLocation} → ${b.destinationLocation}`,
      customerName: b.customerName,
      driverName: b.driverName || 'Verified Driver',
      date: b.driverPaymentReceivedAt || b.passengerPaidAt || b.createdAt,
      status: 'completed' as const
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Requirement 5: Filter driving history
  const filteredHistoryRides = completedDriverRides.filter(b => {
    if (selectedDriverForHistory !== 'all') {
      const match = matchDriverBooking(b, drivers.find(d => d.id === selectedDriverForHistory)!);
      if (!match) return false;
    }
    if (historySearchQuery.trim()) {
      const q = historySearchQuery.toLowerCase();
      const matchSearch = 
        b.refCode.toLowerCase().includes(q) ||
        (b.driverName || '').toLowerCase().includes(q) ||
        (b.customerName || '').toLowerCase().includes(q) ||
        b.pickupLocation.toLowerCase().includes(q) ||
        b.destinationLocation.toLowerCase().includes(q);
      if (!matchSearch) return false;
    }
    return true;
  });

  const totalGrossFromTrips = driverSalaryStats.reduce((sum, s) => sum + s.grossFare, 0) || totalRevenue;
  const totalFleetNetSalary = driverSalaryStats.reduce((sum, s) => sum + s.netSalary40, 0) || Math.round(totalGrossFromTrips * 0.40);
  const totalFleetCommission = driverSalaryStats.reduce((sum, s) => sum + s.orgCommission60, 0) || Math.round(totalGrossFromTrips * 0.60);
  const totalFleetWalletBalance = driverSalaryStats.reduce((sum, s) => sum + s.walletBalance, 0);

  // Requirement 6: Search Customers across all records
  const filteredCustomers = customers.filter(c => {
    if (!customerSearchQuery.trim()) return true;
    const q = customerSearchQuery.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q)
    );
  });

  // Requirement 10: Reviews filtered by selected driver
  const filteredReviews = reviews.filter(r => {
    if (selectedDriverForReview === 'all') return true;
    return r.targetId === selectedDriverForReview || r.targetName === drivers.find(d => d.id === selectedDriverForReview)?.name;
  });

  // Requirement 10: Driver selected for Wallet inspection
  const driverForWalletInspection = drivers.find(d => d.id === selectedDriverForWallet) || drivers[0];
  const driverCompletedBookings = driverForWalletInspection 
    ? bookings.filter(b => matchDriverBooking(b, driverForWalletInspection) && b.status === 'completed')
    : [];
  const selectedDriverStat = driverSalaryStats.find(s => s.driver.id === driverForWalletInspection?.id);

  const handleTakeComplaintAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeComplaintForAction) return;

    // Call resolve complaint with action taken
    onResolveComplaint(
      activeComplaintForAction.id,
      actionNotes || `Administrative action: ${actionType.toUpperCase()}`,
      actionType === 'resolved' ? undefined : actionType
    );

    // If suspension selected, also trigger driver suspension (Requirement 8)
    if (actionType === 'suspended' && onSuspendDriver) {
      const targetBooking = bookings.find(b => b.id === activeComplaintForAction.bookingId || b.refCode === activeComplaintForAction.bookingRef);
      if (targetBooking?.driverId) {
        onSuspendDriver(targetBooking.driverId, actionNotes || 'Suspended due to substantiated customer complaint');
      }
    }

    setActiveComplaintForAction(null);
    setActionNotes('');
  };

  // Admin Rental Fleet Handlers
  const fleetVehicles = rentalVehicles || [];
  const pendingRentalReservations = rentalBookings.filter(b => b.status === 'pending');
  const activeRentalsCount = rentalBookings.filter(b => b.status === 'in_progress' || b.status === 'accepted').length;
  const availableFleetCount = fleetVehicles.filter(v => v.isAvailable).length;
  const totalRentalRevenue = rentalBookings
    .filter(b => b.status === 'completed')
    .reduce((acc, b) => acc + (b.fareBreakdown?.totalFare || 0), 0);

  // Requirement 1: Chime & Notification when new rental reservation arrives
  const prevPendingRentalCountRef = React.useRef(pendingRentalReservations.length);
  React.useEffect(() => {
    if (pendingRentalReservations.length > prevPendingRentalCountRef.current) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      } catch (e) {
        // audio context blocked before interaction
      }
    }
    prevPendingRentalCountRef.current = pendingRentalReservations.length;
  }, [pendingRentalReservations.length]);

  const handleCreateVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicleModel.trim() || !onAddRentalVehicle) return;
    const newCar: RentalVehicle = {
      id: `car-rent-${Date.now()}`,
      ownerId: 'admin',
      ownerName: 'DriveC Admin Fleet',
      ownerPhone: '+91 98470 12345',
      model: newVehicleModel.trim(),
      brand: newVehicleBrand,
      category: newVehicleCategory,
      transmission: newVehicleTransmission,
      fuel: newVehicleFuel,
      seats: Number(newVehicleSeats),
      luggageCapacity: '3 Large Bags',
      licensePlate: newVehicleLicensePlate.trim(),
      year: 2024,
      dailyRate: Number(newVehicleDailyRate),
      hourlyRate: Math.round(Number(newVehicleDailyRate) / 10),
      advanceAmount: Number(newVehicleAdvanceAmount || 1000),
      securityDeposit: Number(newVehicleAdvanceAmount || 1000),
      location: newVehicleLocation.trim(),
      isAvailable: true,
      approvalStatus: 'approved',
      features: ['Air Conditioning', 'Airbags', 'GPS Navigation', 'Fastag Active', 'Clean Interior'],
      totalRentals: 0,
      ratingAverage: 5.0,
      ratingCount: 0,
      createdAt: new Date().toISOString()
    };
    onAddRentalVehicle(newCar);
    setShowAddVehicleModal(false);
    setNewVehicleModel('');
  };

  const handlePerformHandover = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHandoverBooking || !onUpdateBookingStatus) return;
    onUpdateBookingStatus(activeHandoverBooking.id, 'in_progress', {
      handoverChecklist: {
        odometerKm: handoverOdometer,
        fuelPercentage: handoverFuelLevel,
        exteriorCondition: handoverCondition,
        cleanliness: handoverCleanliness,
        toolsPresent: true,
        spareTyrePresent: true,
        documentsVerified: true,
        completedAt: new Date().toISOString(),
        signedByCustomer: true,
      }
    });
    setActiveHandoverBooking(null);
  };

  const handlePerformReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReturnBooking || !onUpdateBookingStatus) return;
    onUpdateBookingStatus(activeReturnBooking.id, 'completed', {
      depositStatus: returnDepositAction === 'full_refund' ? 'refunded' : 'deducted',
      returnChecklist: {
        odometerKm: returnOdometer,
        fuelPercentage: returnFuelLevel,
        exteriorCondition: returnDepositAction === 'deduct_damage' ? 'minor_scratches' : 'good',
        cleanliness: 'clean',
        toolsPresent: true,
        spareTyrePresent: true,
        documentsVerified: true,
        completedAt: new Date().toISOString(),
        signedByCustomer: true,
      }
    });
    setActiveReturnBooking(null);
  };

  const handleApproveExt = async (ext: RentalExtension) => {
    setAdminExtensionProcessingId(ext.id);
    setAdminExtensionError(null);
    setAdminExtensionSuccess(null);
    try {
      if (onApproveRentalExtension) {
        await onApproveRentalExtension(ext.id);
        setAdminExtensionSuccess(`Rental extension for booking ${ext.bookingRef || ext.bookingId} approved successfully! Return date extended to ${ext.requestedReturnDate}. Extension fee of ₹${ext.extensionPrice} added to customer's remaining payment.`);
      }
    } catch (err: any) {
      setAdminExtensionError(err?.message || 'Failed to approve extension.');
    } finally {
      setAdminExtensionProcessingId(null);
    }
  };

  const handleDeclineExt = async () => {
    if (!declineModalExt) return;
    setAdminExtensionProcessingId(declineModalExt.id);
    setAdminExtensionError(null);
    setAdminExtensionSuccess(null);
    try {
      if (onDeclineRentalExtension) {
        await onDeclineRentalExtension(declineModalExt.id, declineReason);
        setAdminExtensionSuccess(`Extension request for booking ${declineModalExt.bookingRef || declineModalExt.bookingId} declined. Original return date remains ${declineModalExt.originalReturnDate}.`);
        setDeclineModalExt(null);
      }
    } catch (err: any) {
      setAdminExtensionError(err?.message || 'Failed to decline extension.');
    } finally {
      setAdminExtensionProcessingId(null);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-4 sm:space-y-5 animate-in fade-in">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-[#002C6C] text-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl border border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-400/30">
              DriveC Operations & Governance
            </span>
            <span className="text-xs text-slate-300 font-medium">
              Kochi, Kerala Transport Compliance
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black">Admin Command Center</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Manual KYC document audits, driver licensing, passenger dispute resolution, wallet ledger inspection, and commission governance.
          </p>
        </div>

        {/* Global KPI Metrics */}
        <div className="flex flex-wrap gap-3">
          <div className="bg-white/10 px-4 py-2.5 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] text-slate-300 block">Pending KYC</span>
            <span className="text-xl font-black text-cyan-300">{pendingDrivers.length}</span>
          </div>
          <div className="bg-white/10 px-4 py-2.5 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] text-slate-300 block">Pending Rentals</span>
            <span className={`text-xl font-black ${pendingRentalReservations.length > 0 ? 'text-cyan-300 animate-pulse' : 'text-slate-300'}`}>
              {pendingRentalReservations.length}
            </span>
          </div>
          <div className="bg-white/10 px-4 py-2.5 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] text-slate-300 block">Total Bookings</span>
            <span className="text-xl font-black text-cyan-300">{bookings.length}</span>
          </div>
          <div className="bg-white/10 px-4 py-2.5 rounded-2xl border border-white/10 text-center" title={`Driver Rides Commission (₹${driver60Commission}) + Rental Advance (₹${rentalAdvanceReceived}) + Rental Remaining (₹${rentalRemainingFeesCompleted})`}>
            <span className="text-[10px] text-slate-300 block">Gross Revenue</span>
            <span className="text-xl font-black text-emerald-300">₹{grossRevenue.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Requirement 1 & 2: Persistent Admin Notification Banner for New Rental Reservations */}
      {pendingRentalReservations.length > 0 && (
        <div className="bg-[#14171f] border border-[#262b36] text-slate-100 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#002C6C] text-white font-black flex items-center justify-center shrink-0 shadow-sm animate-bounce">
              </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#002C6C] text-white font-black text-[10px] uppercase px-2 py-0.5 rounded-full tracking-wider">
                  New Reservation Alert
                </span>
                <h4 className="font-black text-sm text-slate-100">
                  {pendingRentalReservations.length} Self-Drive Rental Reservation{pendingRentalReservations.length > 1 ? 's' : ''} Awaiting Admin Approval
                </h4>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Latest from <strong>{pendingRentalReservations[0].customerName || pendingRentalReservations[0].passengerName}</strong> ({pendingRentalReservations[0].rentalVehicleModel || 'Self-Drive Vehicle'}) • Advance Amount Paid: <strong className="text-emerald-400">₹{pendingRentalReservations[0].advanceAmount || 1000}</strong> • Ref: <span className="font-mono font-bold">{pendingRentalReservations[0].refCode}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setInspectingRentalBooking(pendingRentalReservations[0])}
              className="px-3.5 py-2 bg-[#002C6C] hover:bg-[#001f4d] text-white rounded-xl text-xs font-bold border border-[#002C6C] shadow-xs transition-all whitespace-nowrap"
            >
              Inspect Details
            </button>
            <button
              onClick={() => {
                if (onUpdateBookingStatus) {
                  onUpdateBookingStatus(pendingRentalReservations[0].id, 'approved', { notificationMessage: 'Your vehicle has been successfully booked.' });
                }
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-all whitespace-nowrap"
            >
              Approve Reservation ✓
            </button>
            <button
              onClick={() => {
                const adv = pendingRentalReservations[0].advanceAmount || (pendingRentalReservations[0].fareBreakdown as any)?.advanceAmount || 1000;
                if (onUpdateBookingStatus) {
                  onUpdateBookingStatus(pendingRentalReservations[0].id, 'cancelled', {
                    cancelledBy: 'admin',
                    cancellationReason: 'Reservation declined by Admin',
                    refundAmount: adv,
                    cancellationFee: 0,
                    paymentStatus: 'refunded'
                  });
                }
              }}
              className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 rounded-xl text-xs font-bold whitespace-nowrap transition-colors"
            >
              Decline ✕
            </button>
            <button
              onClick={() => {
                setActiveTab('rentals');
                setRentalTabFilter('bookings');
              }}
              className="px-3 py-2 bg-[#002C6C] hover:bg-[#004B93] text-white rounded-xl text-xs font-bold shadow-xs transition-all whitespace-nowrap"
            >
              View All in Matrix →
            </button>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[#262b36] gap-2 overflow-x-auto text-xs font-bold text-slate-400">
        <button
          onClick={() => { setActiveTab('drivers'); setExpandedAdminBookingId(null); setExpandedAdminHistoryId(null); setExpandedWaEnquiryId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'drivers' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>Drivers & KYC</span>
          {pendingDrivers.length > 0 && (
            <span className="w-2.5 h-2.5 rounded-full bg-[#002C6C] animate-pulse" />
          )}
        </button>

        <button
          onClick={() => { setActiveTab('bookings'); setExpandedAdminBookingId(null); setExpandedAdminHistoryId(null); setExpandedWaEnquiryId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'bookings' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>Live Bookings</span>
        </button>

        {/* Requirement 5: Dedicated Driving History Tab */}
        <button
          onClick={() => { setActiveTab('history'); setExpandedAdminBookingId(null); setExpandedAdminHistoryId(null); setExpandedWaEnquiryId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'history' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>Driving History</span>
        </button>

        {/* Self-Drive Fleet & Rentals Management handled by Admin */}
        <button
          onClick={() => { setActiveTab('rentals'); setExpandedAdminBookingId(null); setExpandedAdminHistoryId(null); setExpandedWaEnquiryId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'rentals' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>Fleet & Rentals</span>
          {pendingRentalReservations.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#002C6C] text-white font-black text-[10px] animate-pulse">
              ⚡ NEW
            </span>
          )}
        </button>

        <button
          onClick={() => { setActiveTab('users'); setExpandedAdminBookingId(null); setExpandedAdminHistoryId(null); setExpandedWaEnquiryId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'users' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>Passengers & Search</span>
        </button>

        <button
          onClick={() => { setActiveTab('reviews'); setExpandedAdminBookingId(null); setExpandedAdminHistoryId(null); setExpandedWaEnquiryId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'reviews' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>Passengers Review</span>
        </button>

        <button
          onClick={() => { setActiveTab('complaints'); setExpandedAdminBookingId(null); setExpandedAdminHistoryId(null); setExpandedWaEnquiryId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 relative ${
            activeTab === 'complaints'
              ? 'border-[#002C6C] text-cyan-400'
              : hasDisputeNotification
                ? 'border-red-500 text-red-400 animate-pulse bg-red-950/30'
                : 'border-transparent hover:text-white'
          }`}
        >
          <span className={hasDisputeNotification ? 'font-black text-red-400' : ''}>
            Disputes & Action
          </span>
          {hasDisputeNotification && (
            <span className="flex items-center gap-1.5 ml-1">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 animate-pulse"></span>
              </span>
            </span>
          )}
        </button>

        {/* Requirement 4: Organization Wallet & Earnings Tab */}
        <button
          onClick={() => { setActiveTab('finance'); setExpandedAdminBookingId(null); setExpandedAdminHistoryId(null); setExpandedWaEnquiryId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'finance' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>Organization Wallet & Earnings</span>
        </button>

        {/* Requirement 1: Hourly Pricing & Tariff Settings Tab */}
        <button
          onClick={() => { setActiveTab('pricing'); setExpandedAdminBookingId(null); setExpandedAdminHistoryId(null); setExpandedWaEnquiryId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'pricing' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>Hourly Pricing & Tariff</span>
        </button>

        {/* WhatsApp Bookings Tab (Requirement 2) */}
        <button
          onClick={() => { setActiveTab('whatsapp'); setExpandedAdminBookingId(null); setExpandedAdminHistoryId(null); setExpandedWaEnquiryId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'whatsapp' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>WhatsApp Enquiries</span>
          {pendingWhatsAppCount > 0 && (
            <span className="bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse shadow-xs">
              NEW
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: DRIVERS & KYC AUDIT */}
      {activeTab === 'drivers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <span className="font-bold text-slate-100 text-sm block">Driver Applications & Capability Records</span>
              <p className="text-xs text-slate-400">Only Approved drivers can sign in and be matched with passenger vehicles.</p>
            </div>
            
            <div className="flex items-center gap-1.5 bg-[#0d1017] p-1 rounded-xl border border-[#262b36] text-xs font-semibold">
              <button
                onClick={() => setDriverFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  driverFilter === 'all' ? 'bg-[#002C6C] text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({drivers.length})
              </button>
              <button
                onClick={() => setDriverFilter('pending')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  driverFilter === 'pending' ? 'bg-[#002C6C] text-white font-black' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Pending</span>
                <span className="bg-amber-950/80 text-amber-300 border border-amber-800/60 text-[10px] px-1.5 rounded-full">{pendingDrivers.length}</span>
              </button>
              <button
                onClick={() => setDriverFilter('approved')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  driverFilter === 'approved' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Approved ({drivers.filter(d => d.approvalStatus === 'approved').length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {drivers
              .filter(d => driverFilter === 'all' ? true : d.approvalStatus === driverFilter)
              .map((d) => (
                <div key={d.id} className="bg-[#14171f] rounded-3xl p-6 border border-[#262b36] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-slate-100">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-100 text-base">{d.name}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        d.approvalStatus === 'approved' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80' :
                        d.approvalStatus === 'pending' ? 'bg-amber-950/60 text-amber-300 border border-amber-800/80 animate-pulse' :
                        d.approvalStatus === 'suspended' ? 'bg-rose-950/60 text-rose-300 border border-rose-800/80 font-bold' :
                        'bg-slate-800/60 text-slate-300 border border-slate-700/80'
                      }`}>
                        {d.approvalStatus.toUpperCase()}
                      </span>
                      {d.isOnline && (
                        <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-full">
                          🟢 Online
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-slate-300">
                      <div>Phone: <strong className="text-slate-100">{d.phone}</strong></div>
                      <div>District: <strong className="text-slate-100">{d.city}</strong></div>
                      <div>Commercial DL: <strong className="font-mono text-slate-100">{d.licenseNumber}</strong></div>
                      <div>Service: <strong className="text-cyan-400 font-bold">Driver-as-a-Service</strong></div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 pt-1">
                      <span>Transmissions: <strong className="text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80 font-bold">{(d.transmissionCapabilities || ['manual', 'automatic']).join(', ').toUpperCase()}</strong></span>
                      <span>Fuels: <strong className="text-cyan-200 bg-[#002C6C]/40 px-2 py-0.5 rounded border border-[#002C6C]/60 font-bold">{(d.fuelCapabilities || ['petrol', 'diesel', 'ev']).join(', ').toUpperCase()}</strong></span>
                      <span>Trips: <strong>{d.totalTrips || 0}</strong></span>
                      {(() => {
                        const stat = driverSalaryStats.find(s => s.driver.id === d.id);
                        return (
                          <>
                            <span>Gross: <strong className="text-slate-200">₹{stat?.grossFare || 0}</strong></span>
                            <span className="bg-emerald-950/60 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-800/80 font-bold">
                              Net Salary: ₹{stat?.netSalary40 || 0}
                            </span>
                            <span>Wallet: <strong className="text-cyan-300">₹{stat?.walletBalance || d.walletBalance || 0}</strong></span>
                          </>
                        );
                      })()}
                      <span>Rating: <strong className="text-cyan-400">★ {d.ratingAverage || 5.0}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {d.approvalStatus === 'pending' ? (
                      <>
                        <button
                          onClick={() => onApproveDriver(d.id)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                        >
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => onRejectDriver(d.id)}
                          className="px-4 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 font-bold text-xs transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    ) : d.approvalStatus === 'approved' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSuspendDriver && onSuspendDriver(d.id, 'Administrative suspension')}
                          className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 font-bold text-xs transition-colors"
                        >
                          Suspend Account
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onApproveDriver(d.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#0d1017] hover:bg-[#1a1f2c] text-slate-300 border border-[#262b36] font-semibold text-xs transition-colors"
                      >
                        Re-Approve
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 2: LIVE BOOKINGS & RIDE HISTORY (REQUIREMENT 3) */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Real-Time Dispatch Matrix & Riding History</h3>
              <p className="text-xs text-slate-400">Live operational monitor, delayed arrival tracking (-3%), and completed ride history.</p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 bg-[#0d1017] p-1 rounded-xl border border-[#262b36] text-xs font-semibold">
              <button
                onClick={() => setBookingStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  bookingStatusFilter === 'all' ? 'bg-[#002C6C] text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({bookings.length})
              </button>
              <button
                onClick={() => setBookingStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  bookingStatusFilter === 'active' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Active ({bookings.filter(b => b.status !== 'completed' && b.status !== 'cancelled').length})
              </button>
              <button
                onClick={() => setBookingStatusFilter('completed')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  bookingStatusFilter === 'completed' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ✓ Ride History ({bookings.filter(b => b.status === 'completed').length})
              </button>
              <button
                onClick={() => setBookingStatusFilter('cancelled')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  bookingStatusFilter === 'cancelled' ? 'bg-rose-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Cancelled ({bookings.filter(b => b.status === 'cancelled').length})
              </button>
            </div>
          </div>

          {/* Bookings & Ride History Cards (Horizontal small cards that click to extend) */}
          {(() => {
            const displayedBookings = bookings.filter((b) => {
              if (bookingStatusFilter === 'active') return b.status !== 'completed' && b.status !== 'cancelled';
              if (bookingStatusFilter === 'completed') return b.status === 'completed';
              if (bookingStatusFilter === 'cancelled') return b.status === 'cancelled';
              return true;
            });

            if (displayedBookings.length === 0) {
              return (
                <div className="bg-[#14171f] rounded-3xl border border-[#262b36] p-12 text-center text-slate-400 space-y-2 shadow-xs">
                  <p className="font-bold text-slate-300">No bookings found for the selected filter</p>
                  <p className="text-xs">Incoming and completed fleet requests will be listed here.</p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {displayedBookings.map((b) => {
                  const isExpanded = expandedAdminBookingId === b.id;
                  const gross = b.fareBreakdown?.totalFare || 0;
                  const isCancelled = b.status === 'cancelled';
                  const baseSalary = Math.round(gross * 0.40);
                  const delayPenalty = b.isDelayed ? (b.delayPenalty || Math.round(baseSalary * 0.03)) : 0;
                  const comm = isCancelled ? 0 : (b.platformCommission || Math.round(gross * 0.60));
                  const netSal = isCancelled ? 0 : (b.driverCreditedSalary !== undefined ? b.driverCreditedSalary : (baseSalary - delayPenalty));
                  const isCustPaid = Boolean(b.passengerPaid || b.paymentStatus === 'completed' || b.remainingPaid);

                  return (
                    <div
                      id={`admin-booking-card-${b.id}`}
                      key={b.id}
                      tabIndex={-1}
                      className={`bg-[#14171f] rounded-2xl border transition-all overflow-hidden scroll-mt-24 outline-none text-slate-100 ${
                        isExpanded
                          ? 'border-cyan-500 shadow-md ring-2 ring-cyan-500/20'
                          : 'border-[#262b36] shadow-2xs hover:border-slate-700 hover:shadow-xs'
                      }`}
                    >
                      {/* Small Card (Lined Vertically with minimal initial information) */}
                      <div
                        onClick={() => toggleAdminBookingExpand(b.id)}
                        className="p-3.5 sm:p-4 cursor-pointer flex flex-col gap-2.5 select-none hover:bg-[#1a1f2c] transition-colors"
                      >
                        {/* Top line: Ref & Service on Left, Pay & Trip Status on Right */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-300 bg-[#0d1017] px-2 py-0.5 rounded text-[10px] border border-[#262b36]">
                              Ref: {b.refCode}
                            </span>
                            <span className="text-xs font-bold text-slate-100 capitalize truncate max-w-[140px] sm:max-w-[200px]">
                              {b.serviceType}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isCustPaid ? (
                              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/80">
                                Paid ✓
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/80">
                                Pending
                              </span>
                            )}
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              b.status === 'completed' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80' :
                              b.status === 'cancelled' ? 'bg-rose-950/60 text-rose-300 border border-rose-800/80' :
                              b.status === 'in_progress' ? 'bg-[#002C6C]/40 text-cyan-200 border border-[#002C6C]/60 animate-pulse' :
                              'bg-slate-800/60 text-slate-300 border border-slate-700/80'
                            }`}>
                              {b.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        {/* Middle line: Route & Driver/Booker (Lined vertically) */}
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-300 truncate">
                            <span className="truncate font-medium">{b.pickupLocation}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-300 truncate">
                            <span className="truncate font-medium">{b.destinationLocation}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 pt-0.5 flex items-center gap-1 truncate">
                            <span>👤 Driver:</span>
                            <strong className="text-slate-200 font-semibold">{b.driverName || 'Matching...'}</strong>
                            <span className="text-slate-400">• Booker: {b.passengerName || b.customerName}</span>
                          </div>
                        </div>

                        {/* Bottom line: Date & Fare on Left, Click to Extend indicator on Right */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#262b36] text-xs">
                          <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                            <span>📅 {b.scheduledDate || 'Today'} {b.scheduledTime || ''}</span>
                            <span className="font-black text-xs text-slate-100 font-mono">
                              {isCancelled ? <span className="line-through text-slate-400">₹{gross}</span> : `₹${gross}`}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] font-bold text-cyan-400">
                            <span>{isExpanded ? 'Hide Details' : 'View Full Details'}</span>
                            {isExpanded ? (
                              <span className="font-bold text-xs leading-none">−</span>
                            ) : (
                              <span className="font-bold text-xs leading-none">+</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Extended Full Details on Click */}
                      {isExpanded && (
                        <div className="border-t border-[#262b36] p-4 sm:p-5 bg-[#0d1017] space-y-3.5 animate-in fade-in duration-150 text-xs text-slate-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Driver Profile */}
                            <div className="bg-[#14171f] p-3 rounded-2xl border border-[#262b36] space-y-1.5 text-slate-200">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Driver Assignment</span>
                              <div className="flex justify-between items-start">
                                <div>
                                  <strong className="text-slate-100 text-sm block">{b.driverName || 'Driver Matching in Progress...'}</strong>
                                  <span className="text-slate-400 font-mono text-xs">{b.driverPhone || 'No contact yet'}</span>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#0d1017] text-slate-300 border border-[#262b36] font-mono">
                                  {b.driverVehicle || 'Assigned Car'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-300 flex items-center justify-between pt-1 border-t border-[#262b36]">
                                <span>Driver Salary Status:</span>
                                <strong className={b.driverPaymentReceived ? "text-emerald-300 font-bold" : (isCustPaid ? "text-cyan-300 font-bold" : "text-amber-300 font-bold")}>
                                  {b.driverPaymentReceived ? 'Credited to Wallet ✓' : (isCustPaid ? 'Eligible for Wallet Credit' : 'Pending Passenger Payment')}
                                </strong>
                              </div>
                              {b.salaryCreditTxId && (
                                <div className="text-[10px] text-slate-400 font-mono truncate">
                                  Salary Tx ID: <strong>{b.salaryCreditTxId}</strong>
                                </div>
                              )}
                            </div>

                            {/* Customer & Passenger Profile */}
                            <div className="bg-[#14171f] p-3 rounded-2xl border border-[#262b36] space-y-1.5 text-slate-200">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Customer & Passenger</span>
                              {b.bookingFor === 'someone_else' || (b.passengerName && b.customerName && b.passengerName.trim().toLowerCase() !== b.customerName.trim().toLowerCase()) ? (
                                <div className="space-y-1">
                                  <span className="text-[9px] font-bold text-cyan-200 bg-[#002C6C]/40 px-1.5 py-0.5 rounded border border-[#002C6C]/60 uppercase inline-block">
                                    Booked for Someone Else {b.passengerRelationship ? `(${b.passengerRelationship})` : ''}
                                  </span>
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400">Passenger:</span>
                                    <strong className="text-slate-100">{b.passengerName} ({b.passengerPhone})</strong>
                                  </div>
                                  <div className="flex justify-between items-center text-xs text-slate-400">
                                    <span>Billing Booker:</span>
                                    <span className="font-medium text-slate-300">{b.customerName} ({b.customerPhone})</span>
                                  </div>
                                  {b.passengerSpecialInstructions && (
                                    <div className="bg-amber-950/60 text-amber-200 border border-amber-800/80 rounded-lg p-1.5 text-[10.5px]">
                                      Note: "{b.passengerSpecialInstructions}"
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <strong className="text-slate-100 text-sm block">{b.passengerName || b.customerName}</strong>
                                  <span className="text-slate-400 font-mono text-xs">{b.passengerPhone || b.customerPhone}</span>
                                </div>
                              )}
                              <div className="text-[11px] text-slate-300 flex items-center justify-between pt-1 border-t border-[#262b36]">
                                <span>Customer Payment:</span>
                                <strong className={isCustPaid ? "text-emerald-300 font-bold" : "text-amber-300 font-bold"}>
                                  {isCustPaid ? 'Payment Received ✓' : 'Payment Pending'}
                                </strong>
                              </div>
                              {b.paymentTransactionRef && (
                                <div className="text-[10px] text-slate-400 font-mono truncate">
                                  Payment Ref: <strong>{b.paymentTransactionRef}</strong>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Route, Verification & OTP */}
                          <div className="bg-[#14171f] p-3 rounded-2xl border border-[#262b36] space-y-2 text-slate-200">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Pickup, Destination & Boarding OTP</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div className="flex items-start gap-1.5">
                                <div>
                                  <span className="text-[10px] text-slate-400 block uppercase">Pickup</span>
                                  <span className="font-semibold text-slate-100">{b.pickupLocation}</span>
                                </div>
                              </div>
                              <div className="flex items-start gap-1.5">
                                <div>
                                  <span className="text-[10px] text-slate-400 block uppercase">Destination Drop</span>
                                  <span className="font-semibold text-slate-100">{b.destinationLocation}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[#262b36] text-[11px] text-slate-300">
                              <span>Service: <strong className="text-slate-200 uppercase">{b.serviceType}</strong></span>
                              <span>Category: <strong className="text-slate-200 uppercase">{b.vehicleCategory || 'Standard'}</strong></span>
                              <span>Ride-Start OTP: <strong className="font-mono text-emerald-300 font-bold text-xs bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80">{b.rideStartOtp}</strong></span>
                              {b.isDelayed && (
                                <span className="text-amber-300 font-semibold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/80">
                                  ⚠️ Delayed arrival penalty applied (-3%)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Financial Split Grid */}
                          <div className="bg-[#14171f] p-3 rounded-2xl border border-[#262b36] space-y-2 text-slate-200">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Financial Breakdown</span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                              <div className="bg-[#0d1017] border border-[#262b36] p-2 rounded-xl">
                                <span className="text-[10px] text-slate-400 block uppercase">Gross Tariff</span>
                                <strong className="text-slate-100 font-bold font-mono">₹{gross}</strong>
                              </div>
                              <div className="bg-emerald-950/40 border border-emerald-800/80 p-2 rounded-xl">
                                <span className="text-[10px] text-emerald-300 font-bold block uppercase">Org Comm</span>
                                <strong className="text-emerald-300 font-black text-sm font-mono">₹{comm}</strong>
                              </div>
                              <div className="bg-[#002C6C]/30 border border-[#002C6C]/60 p-2 rounded-xl">
                                <span className="text-[10px] text-cyan-200 font-bold block uppercase">Driver Sal</span>
                                <strong className="text-cyan-200 font-black text-sm font-mono">₹{netSal}</strong>
                              </div>
                              <div className="bg-[#0d1017] border border-[#262b36] p-2 rounded-xl">
                                <span className="text-[10px] text-slate-400 block uppercase">Delay Cut</span>
                                <strong className={b.isDelayed ? "text-amber-300 font-bold" : "text-slate-400"}>
                                  {b.isDelayed ? `-₹${delayPenalty}` : '₹0'}
                                </strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB: SELF-DRIVE FLEET & RENTALS MANAGEMENT (HANDLED BY ADMIN) */}
      {activeTab === 'rentals' && (
        <div className="space-y-6">
          {/* Top KPI row for rental fleet */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#14171f] p-5 rounded-2xl border border-[#262b36] shadow-xs text-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Fleet</span>
              <span className="text-2xl font-black text-slate-100 mt-1 block">{fleetVehicles.length} Cars</span>
              <span className="text-[11px] text-slate-400">Available across Kochi</span>
            </div>
            <div className="bg-[#14171f] p-5 rounded-2xl border border-[#262b36] shadow-xs text-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Ready for Hire</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">{availableFleetCount}</span>
              <span className="text-[11px] text-emerald-600/80 font-medium">Inspected & Available</span>
            </div>
            <div className="bg-[#14171f] p-5 rounded-2xl border border-[#262b36] shadow-xs text-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active On Road</span>
              <span className="text-2xl font-black text-cyan-400 mt-1 block">{activeRentalsCount}</span>
              <span className="text-[11px] text-cyan-400/80 font-medium">Currently rented</span>
            </div>
            <div className="bg-[#14171f] p-5 rounded-2xl border border-[#262b36] shadow-xs text-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Rental Volume</span>
              <span className="text-2xl font-black text-slate-100 mt-1 block">₹{totalRentalRevenue.toLocaleString('en-IN')}</span>
              <span className="text-[11px] text-slate-400">Completed bookings</span>
            </div>
          </div>

          {/* Sub-navigation & actions */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-[#14171f] p-4 rounded-2xl border border-[#262b36] shadow-xs text-slate-100">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setRentalTabFilter('fleet')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  rentalTabFilter === 'fleet'
                    ? 'bg-[#002C6C] text-white shadow-sm'
                    : 'bg-[#0d1017] text-slate-300 border border-[#262b36] hover:bg-[#1a1f2c] transition-colors'
                }`}
              >
                Self-Drive Fleet ({fleetVehicles.length})
              </button>
              <button
                onClick={() => setRentalTabFilter('bookings')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  rentalTabFilter === 'bookings'
                    ? 'bg-[#002C6C] text-white shadow-sm'
                    : 'bg-[#0d1017] text-slate-300 border border-[#262b36] hover:bg-[#1a1f2c] transition-colors'
                }`}
              >
                <span>Reservations & Handover Matrix</span>
                {pendingRentalReservations.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#002C6C] text-white text-[10px] font-black animate-pulse">
                    ⚡ NEW
                  </span>
                )}
              </button>
              <button
                onClick={() => setRentalTabFilter('extensions')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  rentalTabFilter === 'extensions'
                    ? 'bg-[#002C6C] text-white shadow-sm'
                    : 'bg-[#0d1017] text-slate-300 border border-[#262b36] hover:bg-[#1a1f2c] transition-colors'
                }`}
              >
                <span>Fleet Extension Requests</span>
                {(rentalExtensions || []).filter(e => e.status === 'pending').length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black animate-pulse">
                    ⚡ NEW
                  </span>
                )}
              </button>
            </div>

            {rentalTabFilter === 'fleet' && onAddRentalVehicle && (
              <button
                onClick={() => setShowAddVehicleModal(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Add Fleet Vehicle
              </button>
            )}
          </div>

          {/* Sub-tab 1: FLEET INVENTORY */}
          {rentalTabFilter === 'fleet' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {fleetVehicles.length === 0 ? (
                <div className="col-span-full bg-[#14171f] p-12 text-center rounded-3xl border border-[#262b36] text-slate-400 space-y-2">
                  <p className="font-bold text-slate-300">No rental vehicles listed yet</p>
                  <p className="text-xs">Click &quot;Add Fleet Vehicle&quot; above to register self-drive cars for Kochi travelers.</p>
                </div>
              ) : (
                fleetVehicles.map(vehicle => (
                  <div
                    key={vehicle.id}
                    className="bg-[#14171f] rounded-3xl border border-[#262b36] p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4 text-slate-100"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-cyan-200 bg-[#002C6C]/40 border border-[#002C6C]/60 px-2 py-0.5 rounded">
                            {vehicle.brand || 'DriveC Fleet'}
                          </span>
                          <h4 className="font-black text-slate-100 text-base mt-1">{vehicle.model}</h4>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                            vehicle.isAvailable
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
                              : 'bg-rose-950/60 text-rose-300 border-rose-800/80'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${vehicle.isAvailable ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                          {vehicle.isAvailable ? 'Available for Rent' : 'Maintenance / Offline'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 mt-3 pt-3 border-t border-[#262b36]">
                        <div><strong className="text-slate-100">Category:</strong> {vehicle.category?.toUpperCase()}</div>
                        <div><strong className="text-slate-100">Transmission:</strong> {vehicle.transmission}</div>
                        <div><strong className="text-slate-100">Fuel:</strong> {vehicle.fuel}</div>
                        <div><strong className="text-slate-100">Seats:</strong> {vehicle.seats || 5} Seater</div>
                        <div><strong className="text-slate-100">Plate:</strong> {vehicle.licensePlate}</div>
                        <div><strong className="text-slate-100">Advance Amount:</strong> ₹{vehicle.advanceAmount || vehicle.securityDeposit || 1000}</div>
                      </div>

                      <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
                        <span className="truncate">{vehicle.location || 'Kochi, Kerala'}</span>
                      </div>

                      {/* Requirement 6: Offline maintenance expected availability date */}
                      {(!vehicle.isAvailable || vehicle.offlineUntil) && (
                        <div className="mt-2.5 p-2 bg-amber-950/60 rounded-xl border border-amber-800/80 text-[11px] text-amber-200">
                          <p className="font-bold flex items-center gap-1">
                            Under Maintenance
                          </p>
                          <p className="text-[10px] text-amber-300 mt-0.5">
                            Expected available again: <strong>{vehicle.offlineUntil || 'Soon'}</strong>
                          </p>
                          {vehicle.maintenanceReason && (
                            <p className="text-[10px] text-amber-600 italic mt-0.5">&quot;{vehicle.maintenanceReason}&quot;</p>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex items-baseline justify-between bg-[#0d1017] p-2.5 rounded-xl border border-[#262b36]">
                        <span className="text-xs text-slate-400 font-medium">Daily Rental Rate:</span>
                        <span className="text-base font-black text-slate-100">
                          ₹{vehicle.dailyRate}<span className="text-[11px] font-normal text-slate-400">/day</span>
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#262b36] flex items-center gap-2">
                      {onToggleRentalVehicleAvailability && (
                        <button
                          onClick={() => {
                            if (vehicle.isAvailable) {
                              setOfflineModalVehicle(vehicle);
                            } else {
                              onToggleRentalVehicleAvailability(vehicle.id, true, undefined);
                              if (onUpdateRentalVehicle) {
                                onUpdateRentalVehicle({ ...vehicle, isAvailable: true, offlineUntil: undefined, maintenanceReason: undefined });
                              }
                            }
                          }}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border ${
                            vehicle.isAvailable
                              ? 'bg-amber-950/60 text-amber-300 hover:bg-amber-900/80 border-amber-800/80'
                              : 'bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/80 border-emerald-800/80'
                          }`}
                        >
                          {vehicle.isAvailable ? 'Take Offline' : 'Bring Online'}
                        </button>
                      )}

                      {onDeleteRentalVehicle && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Remove ${vehicle.model} (${vehicle.licensePlate}) from the rental fleet?`)) {
                              onDeleteRentalVehicle(vehicle.id);
                            }
                          }}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-300 hover:bg-rose-950/60 transition-colors border border-transparent hover:border-rose-800/80"
                          title="Delete vehicle"
                        >
                          <span className="text-[11px] font-bold">Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}



          {/* Sub-tab 2: RESERVATIONS & HANDOVER MATRIX */}
          {rentalTabFilter === 'bookings' && (
            <div className="bg-[#14171f] rounded-3xl border border-[#262b36] overflow-hidden shadow-xs text-slate-100">
              {rentalBookings.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <p className="font-bold text-slate-300">No rental reservations recorded</p>
                  <p className="text-xs">Self-drive bookings created by customers will appear here for admin approval, digital key handover, and return inspection.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-[#0d1017] text-slate-300 font-bold border-b border-[#262b36] uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3.5">Ref / Date</th>
                        <th className="p-3.5">Vehicle Details</th>
                        <th className="p-3.5">Customer / Contact</th>
                        <th className="p-3.5">Duration / Dates</th>
                        <th className="p-3.5">Total & Advance</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Admin Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262b36]">
                      {rentalBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-[#1a1f2c] transition-colors">
                          <td className="p-3.5">
                            <span className="font-mono font-bold text-slate-100 block">{b.refCode || b.id.slice(0, 8)}</span>
                            <span className="text-[10px] text-slate-400">{b.createdAt?.split('T')[0] || 'Today'}</span>
                          </td>
                          <td className="p-3.5">
                            <span className="font-bold text-slate-100 block">{b.rentalVehicleModel || 'Self-Drive Fleet'}</span>
                            <span className="text-[10px] text-slate-400">{b.pickupLocation}</span>
                          </td>
                          <td className="p-3.5">
                            <span className="font-bold text-slate-100 block">{b.passengerName || b.customerName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{b.passengerPhone || b.customerPhone}</span>
                          </td>
                          <td className="p-3.5">
                            <span className="font-semibold text-slate-200 block">{b.rentalDays || 1} Day(s)</span>
                            <span className="text-[10px] text-slate-400">{b.scheduledDate} → {b.returnDate || b.scheduledDate}</span>
                          </td>
                          <td className="p-3.5">
                            <span className="font-black text-slate-100 block">Total: ₹{b.fareBreakdown?.totalFare || 0}</span>
                            <div className="text-[10px] space-y-0.5">
                              <span className="text-emerald-300 font-semibold block">
                                Advance: ₹{b.advanceAmount || b.fareBreakdown?.advanceAmount || 1000} (Paid ✓)
                              </span>
                              <span className="text-slate-400 block">
                                Remaining: ₹{b.remainingAmount ?? (b.fareBreakdown?.remainingAmount ?? Math.max(0, (b.fareBreakdown?.totalFare || 0) - (b.advanceAmount || 1000)))}
                              </span>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-block ${
                                b.status === 'completed'
                                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80'
                                  : b.status === 'approved'
                                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80'
                                  : b.status === 'in_progress'
                                  ? 'bg-[#002C6C]/40 text-cyan-200 border border-[#002C6C]/60 animate-pulse'
                                  : b.status === 'cancelled'
                                  ? 'bg-rose-950/60 text-rose-300 border border-rose-800/80'
                                  : 'bg-amber-950/60 text-amber-300 border border-amber-800/80'
                              }`}
                            >
                              {b.status === 'pending' ? 'Pending Approval' : b.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setInspectingRentalBooking(b)}
                                className="px-2 py-1.5 bg-[#0d1017] hover:bg-[#1a1f2c] text-slate-300 border border-[#262b36] rounded-lg font-semibold text-[11px] transition-colors"
                                title="View full reservation details"
                              >
                                Details
                              </button>

                              {/* Requirement 1 & 2: Admin Approval & Decline */}
                              {b.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => {
                                      if (onUpdateBookingStatus) {
                                        onUpdateBookingStatus(b.id, 'approved', { notificationMessage: 'Your vehicle has been successfully booked.' });
                                      }
                                    }}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-xs"
                                    title="Approve reservation and notify customer"
                                  >
                                    Approve ✓
                                  </button>
                                  <button
                                    onClick={() => {
                                      const adv = b.advanceAmount || (b.fareBreakdown as any)?.advanceAmount || 1000;
                                      if (onUpdateBookingStatus) {
                                        onUpdateBookingStatus(b.id, 'cancelled', {
                                          cancelledBy: 'admin',
                                          cancellationReason: 'Reservation declined by Admin',
                                          refundAmount: adv,
                                          cancellationFee: 0,
                                          paymentStatus: 'refunded'
                                        });
                                      }
                                    }}
                                    className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 rounded-lg font-bold text-[11px] transition-colors"
                                    title="Decline reservation and refund advance"
                                  >
                                    Decline ✕
                                  </button>
                                </>
                              )}

                              {b.status === 'approved' && (
                                <button
                                  onClick={() => setActiveHandoverBooking(b)}
                                  className="px-3 py-1.5 bg-[#002C6C] text-white rounded-lg font-bold text-[11px] hover:bg-[#001f4d] transition-colors"
                                >
                                  Handover Keys 🔑
                                </button>
                              )}

                              {b.status === 'in_progress' && (
                                <button
                                  onClick={() => setActiveReturnBooking(b)}
                                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-[11px] hover:bg-emerald-700 transition-colors"
                                >
                                  Process Return & Settle 🏁
                                </button>
                              )}
                              {b.status === 'completed' && (
                                <span className="text-emerald-600 font-bold text-[11px] flex items-center justify-end gap-1">
                                  Settled ✓
                                </span>
                              )}
                              {b.status === 'cancelled' && (
                                <span className="text-rose-400 font-bold text-[11px]">
                                  Cancelled
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 3: FLEET EXTENSION REQUESTS */}
          {rentalTabFilter === 'extensions' && (
            <div className="space-y-4">
              {/* Filter controls and summary */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-[#14171f] p-4 rounded-2xl border border-[#262b36] shadow-xs text-slate-100">
                <div>
                  <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                    Fleet Extension Governance & Approval
                  </h3>
                  <p className="text-xs text-slate-400">
                    Review and approve customer self-drive rental duration extension requests with automated fleet conflict detection.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-[#0d1017] p-1 rounded-xl border border-[#262b36]">
                  {(['all', 'pending', 'approved', 'declined'] as const).map(status => {
                    const count = status === 'all' 
                      ? rentalExtensions.length 
                      : rentalExtensions.filter(e => e.status === status).length;
                    return (
                      <button
                        key={status}
                        onClick={() => setExtensionFilterStatus(status)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all flex items-center gap-1.5 ${
                          extensionFilterStatus === status
                            ? 'bg-[#002C6C] text-white shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {status}
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                          extensionFilterStatus === status
                            ? 'bg-white/20 text-white'
                            : 'bg-[#262b36] text-slate-300'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Alert Banners */}
              {adminExtensionSuccess && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl flex items-center justify-between text-xs text-emerald-300">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{adminExtensionSuccess}</span>
                  </div>
                  <button onClick={() => setAdminExtensionSuccess(null)} className="text-emerald-500 hover:text-emerald-300">
                    <span className="font-bold text-sm leading-none">✕</span>
                  </button>
                </div>
              )}

              {adminExtensionError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl flex items-center justify-between text-xs text-rose-300">
                  <div className="flex items-center gap-2">
                    <div>
                      <span className="font-bold">Extension Action Blocked: </span>
                      <span className="font-medium">{adminExtensionError}</span>
                    </div>
                  </div>
                  <button onClick={() => setAdminExtensionError(null)} className="text-rose-500 hover:text-rose-300">
                    <span className="font-bold text-sm leading-none">✕</span>
                  </button>
                </div>
              )}

              {/* Extensions Table */}
              <div className="bg-[#14171f] rounded-3xl border border-[#262b36] overflow-hidden shadow-xs text-slate-100">
                {rentalExtensions.filter(e => extensionFilterStatus === 'all' || e.status === extensionFilterStatus).length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-2">
                    <p className="font-bold text-slate-300">No rental extension requests found</p>
                    <p className="text-xs text-slate-400">
                      {extensionFilterStatus === 'pending'
                        ? 'There are currently no pending customer rental extensions.'
                        : 'No extension records match the selected filter.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#0d1017] border-b border-[#262b36] text-[10px] font-black uppercase text-slate-300 tracking-wider">
                          <th className="py-3 px-4">Extension ID & Booking</th>
                          <th className="py-3 px-4">Customer & Contact</th>
                          <th className="py-3 px-4">Vehicle Details</th>
                          <th className="py-3 px-4">Rental Dates</th>
                          <th className="py-3 px-4">Extension Pricing</th>
                          <th className="py-3 px-4">Status & Payment</th>
                          <th className="py-3 px-4 text-right">Admin Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#262b36] text-xs">
                        {rentalExtensions
                          .filter(e => extensionFilterStatus === 'all' || e.status === extensionFilterStatus)
                          .map((ext) => {
                            const isProcessing = adminExtensionProcessingId === ext.id;
                            return (
                              <tr key={ext.id} className="hover:bg-[#1a1f2c] transition-colors">
                                {/* ID & Booking */}
                                <td className="py-3.5 px-4 font-mono">
                                  <div className="font-black text-indigo-300">#{ext.id.slice(0, 8).toUpperCase()}</div>
                                  <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                                    Ref: <span className="font-mono font-bold text-slate-300">{ext.bookingRef || ext.bookingId.slice(0, 8)}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                                    {new Date(ext.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </td>

                                {/* Customer & Contact */}
                                <td className="py-3.5 px-4">
                                  <div className="font-bold text-slate-100">{ext.customerName}</div>
                                  <div className="font-mono text-slate-400 text-[11px] mt-0.5">{ext.customerPhone}</div>
                                </td>

                                {/* Vehicle Details */}
                                <td className="py-3.5 px-4">
                                  <div className="font-bold text-slate-100 flex items-center gap-1.5">
                                    {ext.vehicleModel}
                                  </div>
                                  <div className="font-mono text-[10px] text-slate-300 bg-[#0d1017] border border-[#262b36] px-1.5 py-0.5 rounded w-fit mt-1">
                                    {ext.licensePlate || 'Fleet Plate Verified'}
                                  </div>
                                </td>

                                {/* Rental Dates */}
                                <td className="py-3.5 px-4 space-y-1">
                                  <div className="text-[11px] text-slate-400">
                                    Original: <span className="font-semibold text-slate-200">{ext.originalPickupDate} → {ext.originalReturnDate}</span>
                                  </div>
                                  <div className="text-[11px] text-indigo-300 font-bold flex items-center gap-1">
                                    New Return: <span className="underline decoration-indigo-300 font-black">{ext.requestedReturnDate}</span>
                                  </div>
                                  <div className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full inline-block border border-emerald-800/80">
                                    +{ext.additionalDays} Additional Day{ext.additionalDays > 1 ? 's' : ''}
                                  </div>
                                </td>

                                {/* Pricing */}
                                <td className="py-3.5 px-4 space-y-1">
                                  <div className="text-slate-400 text-[11px]">
                                    Rate: <span className="font-semibold text-slate-200">₹{ext.dailyRate}/day</span>
                                  </div>
                                  <div className="text-xs font-black text-slate-100">
                                    Ext Fee: <span className="text-indigo-300">₹{ext.extensionPrice}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    Updated Total: <span className="font-bold text-slate-200">₹{ext.updatedTotalAmount}</span>
                                  </div>
                                </td>

                                {/* Status & Payment */}
                                <td className="py-3.5 px-4 space-y-1.5">
                                  <div>
                                    {ext.status === 'pending' && (
                                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-950/60 text-amber-300 border border-amber-800/80 flex items-center gap-1 w-fit">
                                        Pending Review
                                      </span>
                                    )}
                                    {ext.status === 'approved' && (
                                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 flex items-center gap-1 w-fit">
                                        Approved
                                      </span>
                                    )}
                                    {ext.status === 'declined' && (
                                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-950/60 text-rose-300 border border-rose-800/80 flex items-center gap-1 w-fit">
                                        Declined
                                      </span>
                                    )}
                                  </div>
                                  {ext.status === 'approved' && (
                                    <div className="text-[10px] font-bold">
                                      {ext.paymentStatus === 'completed' ? (
                                        <span className="text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80">
                                          Paid ✓ ({ext.paymentMethod?.toUpperCase() || 'ONLINE'})
                                        </span>
                                      ) : (
                                        <span className="text-cyan-200 bg-[#002C6C]/40 px-2 py-0.5 rounded border border-[#002C6C]/60">
                                          Added to Remaining Return Payment
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {ext.adminNotes && (
                                    <div className="text-[10px] text-slate-400 italic max-w-xs">
                                      "{ext.adminNotes}"
                                    </div>
                                  )}
                                </td>

                                {/* Admin Actions */}
                                <td className="py-3.5 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {ext.status === 'pending' ? (
                                      <>
                                        <button
                                          type="button"
                                          disabled={isProcessing}
                                          onClick={() => handleApproveExt(ext)}
                                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1"
                                          title="Validate availability and approve extension"
                                        >
                                          {isProcessing ? 'Approving...' : 'Approve Extension'}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isProcessing}
                                          onClick={() => setDeclineModalExt(ext)}
                                          className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 disabled:opacity-50 text-rose-300 border border-rose-800/80 rounded-xl font-bold text-xs transition-all flex items-center gap-1"
                                          title="Decline extension and preserve original dates"
                                        >
                                          Decline
                                        </button>
                                      </>
                                    ) : ext.status === 'approved' ? (
                                      <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1 justify-end">
                                        Approved
                                      </span>
                                    ) : (
                                      <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1 justify-end">
                                        Declined
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}


        </div>
      )}

      {/* TAB 3: REGISTERED PASSENGERS & SEARCH (REQUIREMENT 6) */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Verified Passenger Database</h3>
              <p className="text-xs text-slate-400">Search customer records by passenger name, mobile, or email.</p>
            </div>

            {/* Requirement 6: Passenger Search Input */}
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Search Passenger by Name / Phone..."
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs text-slate-100 placeholder:text-slate-400 outline-none focus:border-[#002C6C]"
              />
              {customerSearchQuery && (
                <button onClick={() => setCustomerSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400">
                  <span className="font-bold text-sm leading-none">✕</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredCustomers.map((c) => (
              <div key={c.id} className="bg-[#14171f] rounded-3xl p-5 border border-[#262b36] shadow-xs space-y-2 text-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#002C6C] text-white flex items-center justify-center font-bold text-sm">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-100 text-sm">{c.name}</h4>
                    <span className="text-[10px] text-slate-400">{c.city}</span>
                  </div>
                </div>
                <div className="text-xs text-slate-300 space-y-0.5 pt-2 border-t border-[#262b36]">
                  <p>Mobile: <strong className="text-slate-100">{c.phone}</strong></p>
                  <p>Email: <strong className="text-slate-100">{c.email}</strong></p>
                  <p>Total Rides: <strong>{bookings.filter(b => b.customerId === c.id || b.customerPhone === c.phone).length}</strong></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: PASSENGERS REVIEW (REQUIREMENT 2: HORIZONTAL ROWS, WARNING & SUSPENSION) */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#262b36] pb-4">
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Passengers Review & Moderation Terminal</h3>
              <p className="text-xs text-slate-400">Inspect verified passenger feedback and enforce driver disciplinary actions.</p>
            </div>

            {/* Filter Driver Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-300">Filter Driver:</label>
              <select
                value={selectedDriverForReview}
                onChange={(e) => setSelectedDriverForReview(e.target.value)}
                className="px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-bold text-slate-100 outline-none"
              >
                <option value="all">All Fleet Drivers ({reviews.length} reviews)</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} (★ {d.ratingAverage || 5.0})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredReviews.length === 0 ? (
            <div className="bg-[#14171f] border border-[#262b36] rounded-3xl p-10 text-center text-xs text-slate-400">
              No passenger reviews recorded for this driver yet.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReviews.map((r) => {
                const targetDriver = drivers.find(d => d.id === r.targetId || d.name === r.targetName);

                return (
                  <div key={r.id} className="bg-[#14171f] rounded-2xl border border-[#262b36] overflow-hidden shadow-xs hover:border-slate-700 transition-all text-slate-100">
                    {/* Horizontal Review Row: Passenger, Driver, Booking, Rating, Review, Date, Actions */}
                    <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      
                      {/* Review Details Columns */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 flex-1 items-center text-xs">
                        {/* 1. Passenger */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Passenger</span>
                          <strong className="text-slate-100 font-bold block truncate" title={r.reviewerName}>{r.reviewerName}</strong>
                        </div>

                        {/* 2. Driver */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Driver</span>
                          <strong className="text-cyan-300 font-bold block truncate" title={r.targetName}>{r.targetName}</strong>
                        </div>

                        {/* 3. Booking */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Booking</span>
                          <span className="font-mono text-slate-300 font-bold text-[11px] block">#{r.bookingRef}</span>
                        </div>

                        {/* 4. Rating */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rating</span>
                          <span className="font-black text-amber-500 text-sm flex items-center gap-1">
                            ★ {r.overallRating}.0
                          </span>
                        </div>

                        {/* 5. Review */}
                        <div className="col-span-2 sm:col-span-1 lg:col-span-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Review</span>
                          <p className="text-slate-300 italic truncate" title={r.comment}>"{r.comment}"</p>
                        </div>

                        {/* 6. Date */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Date</span>
                          <span className="text-slate-400 text-[11px] block">{new Date(r.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Requirement 2: Only Two Action Buttons: Warning and Suspension */}
                      <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#262b36]">
                        <button
                          type="button"
                          onClick={() => toggleReviewAction(r.id, 'warning')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            expandedReviewAction[r.id] === 'warning'
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/80 transition-colors'
                          }`}
                        >
                          <span>Warning</span>
                          {expandedReviewAction[r.id] === 'warning' ? <span className="font-bold text-xs leading-none">−</span> : <span className="font-bold text-xs leading-none">+</span>}
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleReviewAction(r.id, 'suspension')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            expandedReviewAction[r.id] === 'suspension'
                              ? 'bg-red-600 text-white shadow-xs'
                              : 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 transition-colors'
                          }`}
                        >
                          <span>Suspension</span>
                          {expandedReviewAction[r.id] === 'suspension' ? <span className="font-bold text-xs leading-none">−</span> : <span className="font-bold text-xs leading-none">+</span>}
                        </button>
                      </div>
                    </div>

                    {/* EXPANDED YELLOW CARD: WARNING */}
                    {expandedReviewAction[r.id] === 'warning' && (
                      <div className="bg-[#14171f] border-t-2 border-amber-500/80 p-5 space-y-4 animate-in fade-in text-xs text-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-amber-200 flex items-center gap-1.5">
                            <span>Warning Action Notice</span>
                          </span>
                          <span className="text-[10px] font-bold bg-amber-900/60 text-amber-200 px-2 py-0.5 rounded">
                            Disciplinary Warning Letter
                          </span>
                        </div>

                        {/* Requirement 1: Customer Rating & Review on Warning Card */}
                        <div className="bg-[#0d1017] p-3.5 rounded-xl border border-amber-500/30 shadow-xs space-y-2 text-xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-amber-700/70 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-amber-200 uppercase tracking-wider">Customer Review:</span>
                              <strong className="text-slate-100">{r.reviewerName}</strong>
                              {r.verifiedTrip && (
                                <span className="text-[10px] bg-emerald-950/70 text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                                  Verified Passenger
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <span className="font-mono font-bold text-slate-300">Trip Ref #{r.bookingRef}</span>
                              <span>•</span>
                              <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-amber-500 font-black text-sm">
                              ★ {r.overallRating.toFixed(1)} / 5.0
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-300 font-semibold">
                              <span>Punctuality: ★{r.punctualityRating}</span>
                              <span>•</span>
                              <span>Cleanliness: ★{r.cleanlinessRating}</span>
                              <span>•</span>
                              <span>Comfort: ★{r.comfortRating}</span>
                            </div>
                          </div>

                          <p className="text-slate-200 italic bg-amber-950/50 p-2.5 rounded-lg border border-amber-700/70 font-medium leading-relaxed">
                            "{r.comment}"
                          </p>
                        </div>

                        {/* Relevant Driver Details inside Yellow Card */}
                        <div className="bg-[#0d1017] p-3 rounded-xl border border-amber-500/30 text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Driver Name</span>
                            <strong className="text-slate-100 text-xs block">{targetDriver ? targetDriver.name : r.targetName}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Phone</span>
                            <span className="font-mono text-slate-200 text-xs block">{targetDriver?.phone || 'Registered Driver'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Commercial DL</span>
                            <span className="font-mono text-slate-200 text-xs block">{targetDriver?.licenseNumber || 'Verified License'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Current Rating</span>
                            <span className="font-bold text-amber-600 text-xs block">★ {targetDriver?.ratingAverage || r.overallRating || 5.0}</span>
                          </div>
                        </div>

                        {/* Textarea for Admin to write Warning Letter / Reason */}
                        <div>
                          <label className="block text-[11px] font-bold text-amber-200 mb-1">
                            Warning Letter / Reason *
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Write the official disciplinary warning letter or reason for this driver..."
                            value={warningLetters[r.id] || ''}
                            onChange={(e) => setWarningLetters(prev => ({ ...prev, [r.id]: e.target.value }))}
                            className="w-full p-3 bg-[#0d1017] border border-amber-500/50 rounded-xl text-xs outline-none focus:border-amber-700/70 font-medium text-slate-100 placeholder:text-slate-400"
                          />
                        </div>

                        {/* Error Banner on Failure (Requirement 2) */}
                        {actionErrorStatus[r.id] && (
                          <div className="p-3 bg-rose-950/70 text-rose-200 rounded-xl border border-rose-800/80 font-bold text-xs flex items-center gap-2 animate-in fade-in">
                            <span>{actionErrorStatus[r.id]}</span>
                          </div>
                        )}

                        {/* Action to Send the Warning */}
                        <div className="flex items-center justify-between pt-1">
                          <div>
                            {warningSentStatus[r.id] && (
                              <span className="text-xs font-bold text-emerald-300 bg-emerald-950/70 px-3 py-1.5 rounded-lg border border-emerald-700/80 animate-in fade-in">
                                ✓ {warningSentStatus[r.id]}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => toggleReviewAction(r.id, 'warning')}
                              className="px-4 py-2 rounded-xl border border-[#262b36] text-slate-300 font-semibold text-xs hover:bg-[#1a1f2c] cursor-pointer transition-colors"
                            >
                              Close
                            </button>
                            <button
                              type="button"
                              disabled={actionLoadingStatus[r.id]}
                              onClick={async () => {
                                const letter = (warningLetters[r.id] || '').trim();
                                if (!letter) {
                                  setActionErrorStatus(prev => ({ ...prev, [r.id]: 'Please write the warning letter or reason before sending.' }));
                                  return;
                                }
                                const driverId = targetDriver?.id || r.targetId;
                                const driverName = targetDriver?.name || r.targetName;
                                try {
                                  setActionLoadingStatus(prev => ({ ...prev, [r.id]: true }));
                                  setActionErrorStatus(prev => ({ ...prev, [r.id]: '' }));

                                  if (onIssueNotice) {
                                    await onIssueNotice({
                                      driverId,
                                      driverName,
                                      driverPhone: targetDriver?.phone,
                                      type: 'warning',
                                      reason: letter,
                                      reviewId: r.id,
                                      bookingId: r.bookingId,
                                      bookingRef: r.bookingRef,
                                    });
                                  }

                                  // Action succeeded: automatically collapse card (Requirement 2)
                                  setExpandedReviewAction(prev => ({ ...prev, [r.id]: null }));
                                  setWarningSentStatus(prev => ({ ...prev, [r.id]: `Warning issued to ${driverName}` }));
                                  setWarningLetters(prev => ({ ...prev, [r.id]: '' }));
                                } catch (err: any) {
                                  // Action failed: keep expanded and show error (Requirement 2)
                                  setActionErrorStatus(prev => ({ ...prev, [r.id]: err?.message || 'Failed to send warning letter. Please try again.' }));
                                } finally {
                                  setActionLoadingStatus(prev => ({ ...prev, [r.id]: false }));
                                }
                              }}
                              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <span>{actionLoadingStatus[r.id] ? 'Sending...' : 'Send Warning to Driver'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* EXPANDED RED CARD: SUSPENSION */}
                    {expandedReviewAction[r.id] === 'suspension' && (
                      <div className="bg-[#14171f] border-t-2 border-rose-500/80 p-5 space-y-4 animate-in fade-in text-xs text-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-rose-200 flex items-center gap-1.5">
                            <span>Driver Suspension Action</span>
                          </span>
                          <span className="text-[10px] font-bold bg-rose-900/60 text-rose-200 px-2 py-0.5 rounded">
                            Immediate Dispatch Suspension
                          </span>
                        </div>

                        {/* Requirement 1: Customer Rating & Review on Suspension Card */}
                        <div className="bg-[#0d1017] p-3.5 rounded-xl border border-rose-500/30 shadow-xs space-y-2 text-xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-rose-800/80 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-rose-200 uppercase tracking-wider">Customer Review:</span>
                              <strong className="text-slate-100">{r.reviewerName}</strong>
                              {r.verifiedTrip && (
                                <span className="text-[10px] bg-emerald-950/70 text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                                  Verified Passenger
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <span className="font-mono font-bold text-slate-300">Trip Ref #{r.bookingRef}</span>
                              <span>•</span>
                              <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-amber-500 font-black text-sm">
                              ★ {r.overallRating.toFixed(1)} / 5.0
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-300 font-semibold">
                              <span>Punctuality: ★{r.punctualityRating}</span>
                              <span>•</span>
                              <span>Cleanliness: ★{r.cleanlinessRating}</span>
                              <span>•</span>
                              <span>Comfort: ★{r.comfortRating}</span>
                            </div>
                          </div>

                          <p className="text-slate-200 italic bg-rose-950/50 p-2.5 rounded-lg border border-rose-800/80 font-medium leading-relaxed">
                            "{r.comment}"
                          </p>
                        </div>

                        {/* Relevant Driver Details inside Red Card */}
                        <div className="bg-[#0d1017] p-3 rounded-xl border border-rose-500/30 text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Driver Name</span>
                            <strong className="text-slate-100 text-xs block">{targetDriver ? targetDriver.name : r.targetName}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Phone</span>
                            <span className="font-mono text-slate-200 text-xs block">{targetDriver?.phone || 'Registered Driver'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Commercial DL</span>
                            <span className="font-mono text-slate-200 text-xs block">{targetDriver?.licenseNumber || 'Verified License'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Account Status</span>
                            <span className={`font-bold uppercase text-xs block ${targetDriver?.approvalStatus === 'suspended' ? 'text-rose-400' : 'text-emerald-300'}`}>
                              {targetDriver?.approvalStatus || 'APPROVED'}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-rose-200 leading-relaxed">
                          Suspending this driver will immediately revoke booking dispatch and prevent them from receiving new rides until reinstated.
                        </p>

                        {/* Error Banner on Failure (Requirement 2) */}
                        {actionErrorStatus[r.id] && (
                          <div className="p-3 bg-rose-950/70 text-rose-200 rounded-xl border border-rose-800/80 font-bold text-xs flex items-center gap-2 animate-in fade-in">
                            <span>{actionErrorStatus[r.id]}</span>
                          </div>
                        )}

                        {/* The Action: Suspend Driver with Confirmation Step */}
                        <div className="pt-1">
                          {targetDriver?.approvalStatus === 'suspended' ? (
                            <div className="p-3 bg-rose-950/70 rounded-xl text-center text-xs font-bold text-rose-200 border border-rose-800/80">
                              🚫 Driver is Currently Suspended
                            </div>
                          ) : confirmSuspendReviewId === r.id ? (
                            <div className="p-4 bg-[#0d1017] rounded-xl border-2 border-rose-600/80 space-y-3">
                              <p className="text-xs font-bold text-rose-200 text-center">
                                Are you sure you want to suspend driver {targetDriver?.name || r.targetName}?
                              </p>
                              <div className="flex justify-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setConfirmSuspendReviewId(null)}
                                  className="px-4 py-2 rounded-xl border border-[#262b36] text-slate-300 font-semibold text-xs hover:bg-[#1a1f2c] cursor-pointer transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={actionLoadingStatus[r.id]}
                                  onClick={async () => {
                                    const driverId = targetDriver?.id || r.targetId;
                                    const driverName = targetDriver?.name || r.targetName;
                                    try {
                                      setActionLoadingStatus(prev => ({ ...prev, [r.id]: true }));
                                      setActionErrorStatus(prev => ({ ...prev, [r.id]: '' }));

                                      if (onIssueNotice) {
                                        await onIssueNotice({
                                          driverId,
                                          driverName,
                                          driverPhone: targetDriver?.phone,
                                          type: 'suspension',
                                          reason: `Administrative account suspension following passenger review on booking #${r.bookingRef}.`,
                                          reviewId: r.id,
                                          bookingId: r.bookingId,
                                          bookingRef: r.bookingRef,
                                        });
                                      }
                                      if (onSuspendDriver) {
                                        onSuspendDriver(driverId, `Suspended due to review moderation on trip #${r.bookingRef}`);
                                      }

                                      // Action succeeded: automatically collapse card (Requirement 2)
                                      setConfirmSuspendReviewId(null);
                                      setExpandedReviewAction(prev => ({ ...prev, [r.id]: null }));
                                      setSuspendSuccessStatus(prev => ({ ...prev, [r.id]: `Driver ${driverName} suspended successfully` }));
                                    } catch (err: any) {
                                      // Action failed: keep expanded and show error (Requirement 2)
                                      setActionErrorStatus(prev => ({ ...prev, [r.id]: err?.message || 'Failed to suspend driver. Please try again.' }));
                                    } finally {
                                      setActionLoadingStatus(prev => ({ ...prev, [r.id]: false }));
                                    }
                                  }}
                                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                                >
                                  {actionLoadingStatus[r.id] ? 'Suspending...' : 'Confirm Suspend'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div>
                                {suspendSuccessStatus[r.id] && (
                                  <span className="text-xs font-bold text-rose-200 bg-rose-950/70 px-3 py-1.5 rounded-lg border border-rose-800/80 animate-in fade-in">
                                    ✓ {suspendSuccessStatus[r.id]}
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleReviewAction(r.id, 'suspension')}
                                  className="px-4 py-2 rounded-xl border border-[#262b36] text-slate-300 font-semibold text-xs hover:bg-[#1a1f2c] cursor-pointer transition-colors"
                                >
                                  Close
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmSuspendReviewId(r.id)}
                                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span>Suspend Driver</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}


        </div>
      )}

      {/* TAB 5: DISPUTES & ACTION HISTORY (REQUIREMENT 5) */}
      {activeTab === 'complaints' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#14171f] p-5 rounded-2xl border border-[#262b36] shadow-xs text-slate-100">
            <div>
              <h3 className="font-black text-slate-100 text-base">Disputes and Action History</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Investigate disciplinary cases, customer reviews, warning & suspension records, and two-way conversations with drivers.
              </p>
            </div>

            {/* Sub-view Switcher */}
            <div className="flex items-center gap-2 bg-[#0d1017] p-1 rounded-xl border border-[#262b36]">
              <button
                type="button"
                onClick={() => setDisputesSubView('notices')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  disputesSubView === 'notices'
                    ? 'bg-[#002C6C] text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Disciplinary Cases ({notices.length})</span>
                {hasDisputeNotification && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600 animate-pulse"></span>
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setDisputesSubView('tickets')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  disputesSubView === 'tickets'
                    ? 'bg-[#002C6C] text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Complaint Tickets ({complaints.length})
              </button>
            </div>
          </div>

          {/* VIEW A: DISCIPLINARY NOTICES & ACTION HISTORY (REQUIREMENT 5) */}
          {disputesSubView === 'notices' && (
            notices.length === 0 ? (
              <div className="bg-[#14171f] border border-[#262b36] rounded-3xl p-12 text-center text-xs text-slate-400 space-y-2">
                <p className="font-bold text-slate-300 text-sm">No disciplinary warning or suspension cases on record.</p>
                <p className="max-w-md mx-auto text-slate-400">
                  When disciplinary warnings or suspensions are issued from Passengers Review, the complete case file and driver replies will be maintained here permanently.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notices.map((n) => {
                  const targetDriver = drivers.find(d => d.id === n.driverId);
                  const linkedReview = reviews.find(r => 
                    (n.reviewId && r.id === n.reviewId) || 
                    (n.bookingId && r.bookingId === n.bookingId) || 
                    (n.bookingRef && r.bookingRef === n.bookingRef)
                  );
                  const linkedBooking = bookings.find(b => 
                    (n.bookingId && b.id === n.bookingId) || 
                    (n.bookingRef && b.refCode === n.bookingRef)
                  );

                  const isSuspension = n.type === 'suspension';
                  const isExpanded = expandedDisputeNoticeId === n.id;
                  const cardHasNotification = hasAdminUnreadForNotice(n);
                  const unreadNotifs = getUnreadAdminNotificationsForNotice(n.id);
                  const driverHasReplied = cardHasNotification && (unreadNotifs.some(x => x.eventType === 'driver_reply') || (!viewedAckNoticeIds[n.id] && hasDriverPendingReply(n)));
                  const driverHasAcked = cardHasNotification && (unreadNotifs.some(x => x.eventType === 'driver_acknowledged') || (!viewedAckNoticeIds[n.id] && hasDriverAckNotification(n)));

                  return (
                    <div
                      key={n.id}
                      className={`rounded-2xl border-2 transition-all shadow-xs bg-[#14171f] overflow-hidden text-slate-100 ${
                        isSuspension ? 'border-rose-800/80' : 'border-amber-700/70'
                      } ${cardHasNotification ? 'ring-2 ring-red-500 animate-pulse' : ''}`}
                    >
                      {/* Compact Card Header (Every card is compact by default; Click to elaborate) */}
                      <div
                        onClick={async () => {
                          const willExpand = expandedDisputeNoticeId !== n.id;
                          setExpandedDisputeNoticeId(prev => prev === n.id ? null : n.id);
                          if (willExpand) {
                            try {
                              setViewedAckNoticeIds(prev => ({ ...prev, [n.id]: true }));
                              await onMarkNotificationRead?.(n.id, 'admin');
                            } catch (err) {
                              console.error('Failed to mark admin notification as read in database:', err);
                              setViewedAckNoticeIds(prev => {
                                const copy = { ...prev };
                                delete copy[n.id];
                                return copy;
                              });
                            }
                          }
                        }}
                        className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-[#1a1f2c] transition-colors select-none"
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                isSuspension ? 'bg-rose-950/70 text-rose-200 border border-rose-800/80' : 'bg-amber-950/70 text-amber-200 border border-amber-700/70'
                              }`}>
                                {isSuspension ? '🚫 Driver Suspension' : '⚠️ Disciplinary Warning'}
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-300">
                                Case #{n.id}
                              </span>
                              {n.bookingRef && (
                                <span className="text-[10px] font-mono bg-[#0d1017] text-slate-300 px-2 py-0.5 rounded border border-[#262b36] font-bold">
                                  Trip #{n.bookingRef}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400">
                                {new Date(n.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                              <span className="font-bold text-slate-100">
                                Driver: {n.driverName || targetDriver?.name || 'Assigned Driver'}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-300 font-mono">
                                {n.driverPhone || targetDriver?.phone || 'Registered Driver'}
                              </span>
                              {!isExpanded && (
                                <>
                                  <span className="text-slate-400 hidden sm:inline">•</span>
                                  <span className="text-slate-400 italic line-clamp-1 max-w-xs sm:max-w-md hidden sm:inline">
                                    "{n.reason}"
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right side: Status Badges, Notification indicators & Elaborate toggle button */}
                        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                          {driverHasReplied && (
                            <span className="text-[10px] font-black bg-rose-950/70 text-rose-200 border border-rose-800/80 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping"></span>
                              <span>Driver Replied</span>
                            </span>
                          )}

                          {driverHasAcked && (
                            <span className="text-[10px] font-black bg-emerald-950/70 text-emerald-200 border border-emerald-700/80 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
                              <span>Driver Acknowledged</span>
                            </span>
                          )}

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            targetDriver?.approvalStatus === 'suspended'
                              ? 'bg-rose-950/60 text-rose-300 border border-rose-800/80'
                              : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80'
                          }`}>
                            {targetDriver?.approvalStatus?.toUpperCase() || (isSuspension ? 'SUSPENDED' : 'APPROVED')}
                          </span>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            n.isAcknowledged
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80'
                              : 'bg-amber-950/60 text-amber-300 border border-amber-800/80'
                          }`}>
                            {n.isAcknowledged ? '✓ Acknowledged' : '● Awaiting Driver'}
                          </span>

                          {Array.isArray(n.replies) && n.replies.length > 0 && (
                            <span className="text-[10px] font-bold bg-[#0d1017] text-slate-300 px-2 py-0.5 rounded border border-[#262b36] flex items-center gap-1">
                              <span>{n.replies.length}</span>
                            </span>
                          )}

                          <button
                            type="button"
                            className="p-1.5 rounded-lg hover:bg-[#1a1f2c] text-slate-300 flex items-center gap-1 text-xs font-bold transition-colors"
                            title={isExpanded ? 'Collapse card' : 'Elaborate case card'}
                          >
                            <span className="hidden sm:inline text-[11px] text-slate-400">
                              {isExpanded ? 'Collapse' : 'Elaborate'}
                            </span>
                            {isExpanded ? <span className="font-bold text-xs leading-none">−</span> : <span className="font-bold text-xs leading-none">+</span>}
                          </button>
                        </div>
                      </div>

                      {/* Elaborated / Expanded Details View (Visible ONLY when admin clicks this specific card) */}
                      {isExpanded && (
                        <div className="p-5 border-t border-[#262b36] space-y-4 bg-[#0d1017] animate-in fade-in text-slate-100">
                          {/* Driver Information Bar */}
                          <div className="bg-[#14171f] p-3.5 rounded-xl border border-[#262b36] text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 shadow-xs text-slate-100">
                            <div>
                              <span className="text-[10px] text-slate-400 block">Driver Name</span>
                              <strong className="text-slate-100 font-bold text-xs">{n.driverName || targetDriver?.name}</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Phone</span>
                              <span className="font-mono text-slate-200 font-semibold">{n.driverPhone || targetDriver?.phone || 'Registered Driver'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Commercial DL</span>
                              <span className="font-mono text-slate-200 font-semibold">{targetDriver?.licenseNumber || 'Verified License'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Current Rating</span>
                              <span className="font-bold text-amber-600">★ {targetDriver?.ratingAverage || 5.0}</span>
                            </div>
                          </div>

                          {/* Associated Customer Rating and Review */}
                          {linkedReview ? (
                            <div className="bg-amber-950/40 p-3.5 rounded-xl border border-amber-800/60 space-y-2 text-xs text-amber-200">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-amber-700/70 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-amber-200 uppercase tracking-wider">Customer Rating & Review:</span>
                                  <strong className="text-slate-100">{linkedReview.reviewerName}</strong>
                                  {linkedReview.verifiedTrip && (
                                    <span className="text-[10px] bg-emerald-950/70 text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                                      Verified Passenger
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                  <span className="font-mono font-bold text-slate-300">Trip Ref #{linkedReview.bookingRef}</span>
                                  <span>•</span>
                                  <span>{new Date(linkedReview.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-amber-500 font-black text-sm">
                                  ★ {linkedReview.overallRating.toFixed(1)} / 5.0
                                </span>
                                <div className="flex items-center gap-2 text-[10px] text-slate-300 font-semibold">
                                  <span>Punctuality: ★{linkedReview.punctualityRating}</span>
                                  <span>•</span>
                                  <span>Cleanliness: ★{linkedReview.cleanlinessRating}</span>
                                  <span>•</span>
                                  <span>Comfort: ★{linkedReview.comfortRating}</span>
                                </div>
                              </div>

                              <p className="text-slate-200 italic bg-[#0d1017] p-2.5 rounded-lg border border-amber-800/60 font-medium">
                                "{linkedReview.comment}"
                              </p>
                            </div>
                          ) : linkedBooking ? (
                            <div className="bg-[#14171f] p-3 rounded-xl border border-[#262b36] text-xs text-slate-200">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Linked Booking:</span>
                              <span className="text-slate-200 font-medium">
                                Trip #{linkedBooking.refCode} • {linkedBooking.pickupLocation} ➔ {linkedBooking.destinationLocation}
                              </span>
                            </div>
                          ) : null}

                          {/* Official Disciplinary Letter / Reason */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                              Official Disciplinary Letter / Reason Issued:
                            </label>
                            <div className="bg-[#14171f] p-3.5 rounded-xl border border-[#262b36] text-xs text-slate-200 font-medium whitespace-pre-wrap leading-relaxed shadow-xs">
                              {n.reason}
                            </div>
                            {isSuspension && (
                              <div className="text-[11px] font-semibold text-rose-300 bg-rose-950/60 p-2 rounded-lg border border-rose-800/80 flex items-center gap-1.5">
                                <span>Suspension Enforcement: Driver dispatch blocked. Driver cannot accept or receive ride assignments.</span>
                              </div>
                            )}
                          </div>

                          {/* Conversation History: Driver Replies and Admin Responses */}
                          <div className="space-y-2.5 pt-2 border-t border-[#262b36]">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                                Dispute Conversation & Response History ({Array.isArray(n.replies) ? n.replies.length : 0})
                              </label>
                              {n.acknowledgedAt && (
                                <span className="text-[10px] text-emerald-300 font-bold">
                                  Driver acknowledged on {new Date(n.acknowledgedAt).toLocaleString()}
                                </span>
                              )}
                            </div>

                            {Array.isArray(n.replies) && n.replies.length > 0 ? (
                              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {n.replies.map((rep) => (
                                  <div
                                    key={rep.id}
                                    className={`p-3 rounded-xl text-xs space-y-1 ${
                                      rep.senderRole === 'driver'
                                        ? 'bg-amber-950/50 border border-amber-700/70 ml-4'
                                        : 'bg-[#002C6C]/30 border border-[#002C6C]/60 text-slate-200 mr-4'
                                    }`}
                                  >
                                    <div className="flex justify-between items-center text-[10px] font-bold">
                                      <span className={rep.senderRole === 'driver' ? 'text-amber-200 font-black' : 'text-cyan-300 font-black'}>
                                        {rep.senderRole === 'driver' ? `👤 Driver Reply: ${rep.senderName}` : `🛡️ Admin Response: ${rep.senderName}`}
                                      </span>
                                      <span className="text-slate-400">{new Date(rep.createdAt).toLocaleString()}</span>
                                    </div>
                                    <p className="text-slate-200 font-medium whitespace-pre-wrap">{rep.message}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 italic bg-[#0d1017] p-2.5 rounded-lg border border-[#262b36]">
                                No replies recorded yet from driver or administration.
                              </p>
                            )}

                            {/* Admin Response to Driver */}
                            <div className="pt-1 space-y-1.5">
                              {noticeReplyError[n.id] && (
                                <span className="text-xs text-rose-400 font-bold block">
                                  ✕ {noticeReplyError[n.id]}
                                </span>
                              )}
                              <div className="flex gap-2 items-center">
                                <input
                                  type="text"
                                  placeholder={`Write administrative response to ${n.driverName}...`}
                                  value={adminNoticeReplies[n.id] || ''}
                                  onChange={(e) => setAdminNoticeReplies(prev => ({ ...prev, [n.id]: e.target.value }))}
                                  className="flex-1 px-3.5 py-2.5 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs text-slate-100 placeholder:text-slate-400 outline-none focus:border-[#002C6C]"
                                />
                                <button
                                  type="button"
                                  disabled={noticeReplyLoading[n.id]}
                                  onClick={async () => {
                                    const msg = (adminNoticeReplies[n.id] || '').trim();
                                    if (!msg) return;
                                    try {
                                      setNoticeReplyLoading(prev => ({ ...prev, [n.id]: true }));
                                      setNoticeReplyError(prev => ({ ...prev, [n.id]: '' }));
                                      if (onReplyNotice) {
                                        await onReplyNotice(n.id, msg, 'admin', 'DriveC Administrator');
                                      }
                                      setAdminNoticeReplies(prev => ({ ...prev, [n.id]: '' }));
                                      setViewedAckNoticeIds(prev => ({ ...prev, [n.id]: true }));
                                      // Collapse back to normal compact size on Send Response!
                                      setExpandedDisputeNoticeId(null);
                                    } catch (err: any) {
                                      setNoticeReplyError(prev => ({ ...prev, [n.id]: err?.message || 'Failed to send reply' }));
                                    } finally {
                                      setNoticeReplyLoading(prev => ({ ...prev, [n.id]: false }));
                                    }
                                  }}
                                  className="px-4 py-2.5 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-bold text-xs shadow-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  <span>{noticeReplyLoading[n.id] ? 'Sending...' : 'Send Response'}</span>
                                </button>
                              </div>
                            </div>

                            {/* Subsequent Disciplinary Action Controls */}
                            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#262b36]">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Subsequent Action:
                              </span>
                              <div className="flex gap-2">
                                {targetDriver?.approvalStatus === 'suspended' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onApproveDriver(n.driverId);
                                      setViewedAckNoticeIds(prev => ({ ...prev, [n.id]: true }));
                                      // Collapse back to normal compact size
                                      setExpandedDisputeNoticeId(null);
                                    }}
                                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                  >
                                    <span>Reinstate Driver (Lift Suspension)</span>
                                  </button>
                                ) : (
                                  onSuspendDriver && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (confirm(`Are you sure you want to suspend driver ${n.driverName}?`)) {
                                          if (onIssueNotice) {
                                            await onIssueNotice({
                                              driverId: n.driverId,
                                              driverName: n.driverName,
                                              driverPhone: n.driverPhone,
                                              type: 'suspension',
                                              reason: `Administrative account suspension following disciplinary review of Case #${n.id}.`,
                                              reviewId: n.reviewId,
                                              bookingId: n.bookingId,
                                              bookingRef: n.bookingRef,
                                            });
                                          }
                                          onSuspendDriver(n.driverId, `Suspended following disciplinary review of Case #${n.id}`);
                                          setViewedAckNoticeIds(prev => ({ ...prev, [n.id]: true }));
                                          // Collapse back to normal compact size on Escalate to suspension!
                                          setExpandedDisputeNoticeId(null);
                                        }
                                      }}
                                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                    >
                                      <span>Escalate to Suspension</span>
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* VIEW B: COMPLAINT TICKETS */}
          {disputesSubView === 'tickets' && (
            complaints.length === 0 ? (
              <div className="bg-[#14171f] border border-[#262b36] rounded-3xl p-10 text-center text-xs text-slate-400">
                No unresolved complaints recorded.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {complaints.map((c) => (
                  <div key={c.id} className="bg-[#14171f] rounded-3xl p-6 border border-[#262b36] shadow-xs space-y-3 text-slate-100">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100 uppercase font-mono">{c.category.replace('_', ' ')}</span>
                          <span className="text-slate-400 text-xs">Ref #{c.bookingRef}</span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">Complainant: <strong>{c.complainantName}</strong></p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                        c.status === 'resolved' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80' : 'bg-amber-950/60 text-amber-300 border border-amber-800/80'
                      }`}>
                        {c.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 italic bg-[#0d1017] p-3 rounded-2xl border border-[#262b36]">
                      "{c.description}"
                    </p>

                    {c.actionTaken ? (
                      <div className="p-3 bg-emerald-950/60 rounded-2xl text-xs text-emerald-300 flex justify-between items-center border border-emerald-800/80">
                        <span>Documented Action: <strong className="uppercase">{c.actionTaken}</strong></span>
                        <span className="text-[11px] text-slate-400">{c.resolutionNotes}</span>
                      </div>
                    ) : (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => {
                            setActiveComplaintForAction(c);
                            setActionType('warned');
                          }}
                          className="px-3.5 py-2 bg-amber-950/60 text-amber-300 border border-amber-800/80 rounded-xl text-xs font-bold hover:bg-amber-900/80 cursor-pointer transition-colors"
                        >
                          Issue Warning to Driver
                        </button>
                        <button
                          onClick={() => {
                            setActiveComplaintForAction(c);
                            setActionType('suspended');
                          }}
                          className="px-3.5 py-2 bg-rose-950/60 text-rose-300 border border-rose-800/80 rounded-xl text-xs font-bold hover:bg-rose-900/80 cursor-pointer transition-colors"
                        >
                          Suspend Driver
                        </button>
                        <button
                          onClick={() => {
                            setActiveComplaintForAction(c);
                            setActionType('resolved');
                          }}
                          className="px-3.5 py-2 bg-[#0d1017] text-slate-300 border border-[#262b36] rounded-xl text-xs font-bold hover:bg-[#1a1f2c] cursor-pointer transition-colors"
                        >
                          Resolve with Notes
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* TAB: DRIVING HISTORY FOR ADMIN (REQUIREMENT 5) */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#14171f] p-6 rounded-3xl border border-[#262b36] shadow-xs text-slate-100">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300 bg-[#002C6C]/40 px-2.5 py-1 rounded-full border border-[#002C6C]/60">
                REQUIREMENT 5: COMPREHENSIVE FLEET DRIVING HISTORY
              </span>
              <h3 className="text-xl font-black text-slate-100 mt-1">Driving History of All Drivers</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect completed driver journeys, pickup and drop-off locations, dates, driver salary, organization commission, and ride statuses.
              </p>
            </div>

            {/* Filter by Driver Dropdown */}
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-bold text-slate-300">Filter Driver:</label>
              <select
                value={selectedDriverForHistory}
                onChange={(e) => setSelectedDriverForHistory(e.target.value)}
                className="px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-bold text-slate-100 outline-none"
              >
                <option value="all">All Drivers ({completedDriverRides.length} Journeys)</option>
                {drivers.map(d => {
                  const dTrips = completedDriverRides.filter(b => matchDriverBooking(b, d));
                  return (
                    <option key={d.id} value={d.id}>
                      {d.name} ({dTrips.length} completed)
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div className="bg-[#14171f] p-4 rounded-2xl border border-[#262b36] text-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Completed Journeys</span>
              <span className="text-2xl font-black text-slate-100">{filteredHistoryRides.length}</span>
            </div>
            <div className="bg-[#14171f] p-4 rounded-2xl border border-[#262b36] text-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Gross Fare</span>
              <span className="text-2xl font-black text-slate-100">
                ₹{filteredHistoryRides.reduce((acc, b) => acc + (b.fareBreakdown?.totalFare || 0), 0)}
              </span>
            </div>
            <div className="bg-[#14171f] p-4 rounded-2xl border border-[#262b36] text-slate-100">
              <span className="text-cyan-300 block text-[10px] uppercase font-bold">Driver Salaries</span>
              <span className="text-2xl font-black text-cyan-300">
                ₹{filteredHistoryRides.reduce((acc, b) => acc + (b.driverCreditedSalary || Math.round((b.fareBreakdown?.totalFare || 0) * 0.40)), 0)}
              </span>
            </div>
            <div className="bg-[#14171f] p-4 rounded-2xl border border-[#262b36] text-slate-100">
              <span className="text-emerald-300 block text-[10px] uppercase font-bold">Org Commission</span>
              <span className="text-2xl font-black text-emerald-200">
                ₹{filteredHistoryRides.reduce((acc, b) => acc + (b.platformCommission || Math.round((b.fareBreakdown?.totalFare || 0) * 0.60)), 0)}
              </span>
            </div>
          </div>

          {/* Search bar */}
          <div className="bg-[#14171f] p-3 rounded-2xl border border-[#262b36] text-slate-100">
            <input
              type="text"
              placeholder="Search driving history by ref code, driver name, passenger name, or location..."
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs text-slate-100 placeholder:text-slate-400 outline-none focus:border-[#002C6C]"
            />
          </div>

          {/* Driving History Cards (Horizontal small cards that click to extend) */}
          {filteredHistoryRides.length === 0 ? (
            <div className="bg-[#14171f] rounded-3xl border border-[#262b36] p-12 text-center text-slate-400 space-y-2 shadow-xs text-slate-100">
              <p className="font-bold text-slate-300">No driving history found</p>
              <p className="text-xs">Completed rides by verified drivers will be archived and displayed here.</p>
            </div>
          ) : (
            <div 
              className="grid gap-4 items-start"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
            >
              {filteredHistoryRides.map(b => {
                const isExpanded = expandedAdminHistoryId === b.id;
                const gross = b.fareBreakdown?.totalFare || 0;
                const driverSal = b.driverCreditedSalary || Math.round(gross * 0.40);
                const orgComm = b.platformCommission || Math.round(gross * 0.60);
                const isCustPaid = Boolean(b.passengerPaid || b.paymentStatus === 'completed');

                return (
                  <div
                    id={`admin-history-card-${b.id}`}
                    key={b.id}
                    tabIndex={-1}
                    className={`bg-[#14171f] rounded-2xl border transition-all overflow-hidden scroll-mt-24 outline-none text-slate-100 ${
                      isExpanded
                        ? 'col-span-full border-[#002C6C] shadow-md ring-2 ring-blue-100'
                        : 'border-[#262b36] shadow-2xs hover:border-slate-700 hover:shadow-xs'
                    }`}
                    style={isExpanded ? { gridColumn: '1 / -1' } : undefined}
                  >
                    {/* Small Card (Lined Vertically with minimal initial information) */}
                    <div
                      onClick={() => toggleAdminHistoryExpand(b.id)}
                      className="p-3.5 sm:p-4 cursor-pointer flex flex-col gap-2.5 select-none hover:bg-[#1a1f2c] transition-colors"
                    >
                      {/* Top line: Ref & WA on Left, Pay Status & Completed on Right */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-300 bg-[#0d1017] px-2 py-0.5 rounded text-[10px] border border-[#262b36]">
                            Ref: {b.refCode}
                          </span>
                          {b.bookingChannel === 'whatsapp' && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-[#25D366] text-white">
                              WA
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isCustPaid ? (
                            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/80">
                              Paid ✓
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/80">
                              Pending
                            </span>
                          )}
                          <span className="text-[10px] font-bold uppercase bg-emerald-950/70 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700/80">
                            Completed
                          </span>
                        </div>
                      </div>

                      {/* Middle line: Route & Driver/Passenger (Lined vertically) */}
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300 truncate">
                          <span className="truncate font-medium">{b.pickupLocation}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300 truncate">
                          <span className="truncate font-medium">{b.destinationLocation}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 pt-0.5 flex items-center gap-1 truncate">
                          <span>👤 Driver:</span>
                          <strong className="text-slate-200 font-semibold">{b.driverName || 'Driver'}</strong>
                          <span className="text-slate-400">• Passenger: {b.passengerName || b.customerName}</span>
                        </div>
                      </div>

                      {/* Bottom line: Date & Revenue Split on Left, Click to Extend indicator on Right */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#262b36] text-xs">
                        <div className="flex items-center gap-2.5 text-slate-400 text-[11px] flex-wrap">
                          <span>📅 {b.scheduledDate} {b.scheduledTime || ''}</span>
                          <span className="font-bold text-slate-200 font-mono" title="Gross Fare">
                            Gross: ₹{gross}
                          </span>
                          <span className="text-[10px] font-bold text-cyan-300 font-mono hidden sm:inline">
                            (D: ₹{driverSal})
                          </span>
                          <span className="text-[10px] font-bold text-emerald-300 font-mono hidden sm:inline">
                            (Org: ₹{orgComm})
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] font-bold text-cyan-400">
                          <span>{isExpanded ? 'Hide Details' : 'View Full Details'}</span>
                          {isExpanded ? (
                            <span className="font-bold text-xs leading-none">−</span>
                          ) : (
                            <span className="font-bold text-xs leading-none">+</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Extended Section: Full Driving History Details on Click */}
                    {isExpanded && (
                      <div className="border-t border-[#262b36] p-4 sm:p-5 bg-[#0d1017] space-y-3.5 animate-in fade-in duration-150 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Driver Details Box */}
                          <div className="bg-[#0d1017] p-3.5 rounded-2xl border border-[#262b36] space-y-2 text-slate-200">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Driver Profile</span>
                            <div className="flex justify-between items-start">
                              <div>
                                <strong className="text-slate-100 text-sm block">{b.driverName || 'Verified Kerala Driver'}</strong>
                                <span className="text-slate-400 font-mono text-xs">{b.driverPhone || 'No Phone Recorded'}</span>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#0d1017] text-slate-300 border border-[#262b36] font-mono">
                                {b.driverVehicle || 'Vehicle'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-300 flex items-center justify-between pt-1 border-t border-[#262b36]">
                              <span>Driver Salary Status:</span>
                              <strong className={b.driverPaymentReceived ? "text-emerald-300 font-bold" : (isCustPaid ? "text-cyan-300 font-bold" : "text-amber-300 font-bold")}>
                                {b.driverPaymentReceived ? 'Credited to Wallet ✓' : (isCustPaid ? 'Eligible for Wallet Credit' : 'Pending Passenger Payment')}
                              </strong>
                            </div>
                            {b.salaryCreditTxId && (
                              <div className="text-[10px] text-slate-400 font-mono truncate">
                                Wallet Credit Tx ID: <strong>{b.salaryCreditTxId}</strong>
                              </div>
                            )}
                          </div>

                          {/* Customer & Passenger Details Box */}
                          <div className="bg-[#0d1017] p-3.5 rounded-2xl border border-[#262b36] space-y-2 text-slate-200">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Customer & Passenger</span>
                            {b.bookingFor === 'someone_else' || (b.passengerName && b.customerName && b.passengerName.trim().toLowerCase() !== b.customerName.trim().toLowerCase()) ? (
                              <div className="space-y-1.5">
                                <span className="text-[9px] font-bold text-cyan-200 bg-[#002C6C]/40 px-1.5 py-0.5 rounded border border-[#002C6C]/60 uppercase inline-block">
                                  Booked for Someone Else {b.passengerRelationship ? `(${b.passengerRelationship})` : ''}
                                </span>
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-slate-400">Passenger:</span>
                                  <strong className="text-slate-100">{b.passengerName} ({b.passengerPhone})</strong>
                                </div>
                                <div className="flex justify-between items-center text-xs text-slate-400">
                                  <span>Billing Customer:</span>
                                  <span className="font-medium text-slate-300">{b.customerName} ({b.customerPhone})</span>
                                </div>
                                {b.passengerSpecialInstructions && (
                                  <div className="bg-amber-950/60 text-amber-200 border border-amber-800/80 rounded-lg p-1.5 text-[10.5px]">
                                    Note: "{b.passengerSpecialInstructions}"
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <strong className="text-slate-100 text-sm block">{b.passengerName || b.customerName}</strong>
                                <span className="text-slate-400 font-mono text-xs">{b.passengerPhone || b.customerPhone}</span>
                              </div>
                            )}
                            <div className="text-[11px] text-slate-300 flex items-center justify-between pt-1 border-t border-[#262b36]">
                              <span>Customer Payment:</span>
                              <strong className={isCustPaid ? "text-emerald-300 font-bold" : "text-amber-300 font-bold"}>
                                {isCustPaid ? 'Payment Received ✓' : 'Payment Pending'}
                              </strong>
                            </div>
                            {b.paymentTransactionRef && (
                              <div className="text-[10px] text-slate-400 font-mono truncate">
                                Payment Ref: <strong>{b.paymentTransactionRef}</strong>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Route & Ride-Start OTP */}
                        <div className="bg-[#0d1017] p-3.5 rounded-2xl border border-[#262b36] space-y-2 text-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Pickup, Destination & Verification</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="flex items-start gap-1.5">
                              <div>
                                <span className="text-[10px] text-slate-400 block uppercase">Pickup Location</span>
                                <span className="font-semibold text-slate-100">{b.pickupLocation}</span>
                              </div>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <div>
                                <span className="text-[10px] text-slate-400 block uppercase">Destination Drop</span>
                                <span className="font-semibold text-slate-100">{b.destinationLocation}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[#262b36] text-[11px] text-slate-300">
                            <span>Service: <strong className="text-slate-200 uppercase">{b.serviceType}</strong></span>
                            <span>Vehicle Category: <strong className="text-slate-200 uppercase">{b.vehicleCategory || 'Standard'}</strong></span>
                            <span>Ride-Start Boarding OTP: <strong className="font-mono text-emerald-300 font-bold">{b.rideStartOtp}</strong></span>
                            {b.isDelayed && (
                              <span className="text-amber-300 font-semibold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/80">
                                ⚠️ Delayed arrival penalty applied (-3%)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Financial Split Grid */}
                        <div className="bg-[#0d1017] p-3.5 rounded-2xl border border-[#262b36] space-y-2 text-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Financial Breakdown & Revenue Split</span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                            <div className="bg-[#0d1017] border border-[#262b36] p-2 rounded-xl">
                              <span className="text-[10px] text-slate-400 block uppercase">Gross Tariff</span>
                              <strong className="text-slate-100 font-bold font-mono">₹{gross}</strong>
                            </div>
                            <div className="bg-emerald-950/40 border border-emerald-800/80 p-2 rounded-xl">
                              <span className="text-[10px] text-emerald-300 font-bold block uppercase">Org Comm</span>
                              <strong className="text-emerald-300 font-black text-sm font-mono">₹{orgComm}</strong>
                            </div>
                            <div className="bg-[#002C6C]/30 border border-[#002C6C]/60 p-2 rounded-xl">
                              <span className="text-[10px] text-cyan-200 font-bold block uppercase">Driver Salary</span>
                              <strong className="text-cyan-200 font-black text-sm font-mono">₹{driverSal}</strong>
                            </div>
                            <div className="bg-[#0d1017] border border-[#262b36] p-2 rounded-xl">
                              <span className="text-[10px] text-slate-400 block uppercase">Delay Penalty</span>
                              <strong className={b.isDelayed ? "text-amber-300 font-bold" : "text-slate-400"}>
                                {b.isDelayed ? `-₹${b.delayPenalty || Math.round(driverSal * 0.03)}` : '₹0'}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: ORGANIZATION WALLET & 60% COMMISSION (REQUIREMENT 4) */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-950 via-[#001D47] to-[#002C6C] text-white rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300 bg-white/10 px-2.5 py-1 rounded-full border border-white/15">
              REQUIREMENT 4: FINANCIAL DISTRIBUTION LEDGER
            </span>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-2xl sm:text-3xl font-black">Organization Wallet</h3>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  Automated distribution: driver salary allocated to drivers, Organization Commission allocated to platform wallet.
                </p>
              </div>
              <div className="text-right sm:text-right bg-white/10 px-5 py-3 rounded-2xl border border-white/15">
                <span className="text-[10px] text-slate-300 uppercase font-bold block">Total Organization Wallet Balance</span>
                <span className="text-3xl font-black text-emerald-400 font-mono">₹{totalOrganizationWalletBalance.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Separate Earnings Categories (Requirement 4) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category 1: Rental Revenue */}
            <div className="bg-[#14171f] rounded-3xl p-6 border border-[#262b36] shadow-xs space-y-2 relative overflow-hidden text-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800/80">
                  Category 1
                </span>
                </div>
              <h4 className="text-sm font-bold text-slate-300">Rental Revenue</h4>
              <p className="text-2xl font-black text-slate-100 font-mono">₹{orgRentalRevenue.toLocaleString('en-IN')}</p>
              <p className="text-[11px] text-slate-400">
                Direct earnings from completed self-drive vehicle rentals in Kochi. ({completedRentals.length} completed rentals)
              </p>
            </div>

            {/* Category 2: Organization Commission (60%) */}
            <div className="bg-[#14171f] rounded-3xl p-6 border border-[#262b36] shadow-xs space-y-2 relative overflow-hidden text-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-200 bg-[#002C6C]/40 px-2.5 py-0.5 rounded-full border border-[#002C6C]/60">
                  Category 2
                </span>
                </div>
              <h4 className="text-sm font-bold text-slate-300">Organization Commission</h4>
              <p className="text-2xl font-black text-cyan-300 font-mono">₹{orgDriverCommission.toLocaleString('en-IN')}</p>
              <p className="text-[11px] text-slate-400">
                Organization's share from completed driver rides. ({completedDriverRides.length} completed rides)
              </p>
            </div>

            {/* Category 3: Driver Salary (40% Driver Share) */}
            <div className="bg-[#14171f] rounded-3xl p-6 border border-[#262b36] shadow-xs space-y-2 relative overflow-hidden text-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 bg-[#0d1017] px-2.5 py-0.5 rounded-full border border-[#262b36]">
                  Driver Share
                </span>
                </div>
              <h4 className="text-sm font-bold text-slate-300">Driver Salaries Allocated</h4>
              <p className="text-2xl font-black text-slate-100 font-mono">₹{totalDriverSalariesAllocated.toLocaleString('en-IN')}</p>
              <p className="text-[11px] text-slate-400">
                Driver payments credited directly to individual drivers&apos; wallets upon ride completion.
              </p>
            </div>
          </div>

          {/* Organization Wallet Transaction History (Requirement 4) */}
          <div className="bg-[#14171f] rounded-3xl p-6 sm:p-8 border border-[#262b36] shadow-xs space-y-4 text-slate-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#262b36] pb-4">
              <div>
                <h4 className="font-black text-slate-100 text-base">Organization Wallet Transaction History</h4>
                <p className="text-xs text-slate-400">
                  Detailed individual transaction amounts and credits updated only after relevant payment/ride has completed.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-300 bg-[#0d1017] border border-[#262b36] px-3 py-1 rounded-xl">
                {organizationWalletTransactions.length} Settled Transactions
              </span>
            </div>

            {organizationWalletTransactions.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No completed wallet transactions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#0d1017] text-slate-300 font-bold border-b border-[#262b36] uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3.5">Ref / Timestamp</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Transaction Details</th>
                      <th className="p-3.5">Customer / Driver</th>
                      <th className="p-3.5">Credit Amount</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262b36]">
                    {organizationWalletTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-[#1a1f2c] transition-colors">
                        <td className="p-3.5">
                          <span className="font-mono font-bold text-slate-100 block">{tx.refCode}</span>
                          <span className="text-[10px] text-slate-400">{tx.date?.split('T')[0] || 'Today'}</span>
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block ${
                            tx.category === 'Rental Revenue'
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80'
                              : 'bg-[#002C6C]/40 text-cyan-200 border border-[#002C6C]/60'
                          }`}>
                            {tx.category}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-200 font-medium">
                          {tx.details}
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-slate-100 block">{tx.customerName}</span>
                          {tx.driverName && <span className="text-[10px] text-slate-400">{tx.driverName}</span>}
                        </td>
                        <td className="p-3.5 font-mono font-black text-emerald-300 text-sm">
                          +₹{tx.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3.5">
                          <span className="text-emerald-300 font-bold flex items-center gap-1 text-[11px]">
                            Settled ✓
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* INDIVIDUAL DRIVERS SALARY MASTER TABLE (40% Share) */}
          <div className="bg-[#14171f] rounded-3xl p-6 sm:p-8 border border-[#262b36] shadow-xs space-y-4 text-slate-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#262b36] pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-200 bg-[#002C6C]/40 px-2.5 py-1 rounded-full border border-[#002C6C]/60">
                  INDIVIDUAL DRIVER SALARIES
                </span>
                <h3 className="text-lg font-black text-slate-100 mt-1">Individual Drivers Salary & Payout Overview</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Complete breakdown of gross trip earnings, Organization Commission, and individual net driver salaries.
                </p>
              </div>

              <span className="text-xs font-bold text-slate-300 bg-[#0d1017] border border-[#262b36] px-3 py-1.5 rounded-xl">
                {drivers.length} Registered Drivers
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0d1017] border-b border-[#262b36] text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Driver Name & Status</th>
                    <th className="p-3.5">Vehicle & Category</th>
                    <th className="p-3.5 text-center">Completed Trips</th>
                    <th className="p-3.5">Gross Generated</th>
                    <th className="p-3.5">Org Commission</th>
                    <th className="p-3.5">Driver Salary</th>
                    <th className="p-3.5">Driver Wallet Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262b36]">
                  {driverSalaryStats.map((stat) => {
                    const d = stat.driver;
                    return (
                      <tr key={d.id} className="hover:bg-[#1a1f2c] transition-colors">
                        <td className="p-3.5">
                          <strong className="text-slate-100 block font-bold text-sm">{d.name}</strong>
                          <span className="text-[10px] text-slate-400 font-mono">{d.phone} • {d.city}</span>
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-slate-200 text-xs">{(d.transmissionCapabilities || ['manual', 'automatic']).join(', ').toUpperCase()}</div>
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-[#002C6C]/40 rounded text-cyan-200 border border-[#002C6C]/60">
                            {(d.fuelCapabilities || ['petrol', 'diesel', 'ev']).join(', ')}
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-bold text-slate-200">
                          {stat.tripsCount}
                        </td>
                        <td className="p-3.5 font-bold text-slate-100">
                          ₹{stat.grossFare}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-emerald-300">
                          ₹{stat.orgCommission60}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-cyan-300">
                          ₹{stat.netSalary40}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-slate-100">
                          ₹{stat.walletBalance}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: HOURLY PRICING & TARIFF SETTINGS (REQUIREMENT 1) */}
      {activeTab === 'pricing' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-slate-950 via-[#001D47] to-[#002C6C] text-white rounded-2xl p-5 sm:p-6 border border-white/10 shadow-lg space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15">
                  REAL-TIME PRICING ENGINE (DAFY-INSPIRED)
                </span>
                <h3 className="text-xl sm:text-2xl font-black mt-1">Chauffeur Services & Dynamic Tariff Control</h3>
                <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
                  Configure live pricing rules for every driver service: One-Way, Round-Trip, Hourly, Outstation, Airport Transfer, Night Chauffeur, and Hospital Escort.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Reset all service tariffs to Kerala approved standard defaults?')) {
                      setServicesPricing(defaultDriverServicesPricingConfig);
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 border border-white/15 transition-all"
                >
                  <span>Reset Defaults</span>
                </button>
                <button
                  type="button"
                  disabled={isSavingPricing}
                  onClick={handleSaveServicesPricing}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  {isSavingPricing ? (
                    <>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span>Save All Tariffs</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex gap-2 pt-2 border-t border-white/10 overflow-x-auto">
              <button
                type="button"
                onClick={() => setPricingSubTab('services')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                  pricingSubTab === 'services'
                    ? 'bg-cyan-400 text-slate-950 shadow-sm'
                    : 'bg-white/10 text-white hover:bg-white/15'
                }`}
              >
                All Driver Services ({Object.keys(servicesPricing.services).length})
              </button>
              <button
                type="button"
                onClick={() => setPricingSubTab('hourly_packages')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                  pricingSubTab === 'hourly_packages'
                    ? 'bg-cyan-400 text-slate-950 shadow-sm'
                    : 'bg-white/10 text-white hover:bg-white/15'
                }`}
              >
                Hourly Duration Packages ({hourlyPricing.packages.length})
              </button>
              <button
                type="button"
                onClick={() => setPricingSubTab('categories')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                  pricingSubTab === 'categories'
                    ? 'bg-cyan-400 text-slate-950 shadow-sm'
                    : 'bg-white/10 text-white hover:bg-white/15'
                }`}
              >
                Vehicle Surcharges & Taxes
              </button>
            </div>
          </div>

          {/* Feedback Message */}
          {pricingMsg && (
            <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
              pricingMsg.type === 'success' 
                ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300' 
                : 'bg-rose-950/60 border border-rose-800/80 text-rose-300'
            }`}>
              <span>{pricingMsg.text}</span>
              <button onClick={() => setPricingMsg(null)} className="font-black text-sm ml-2">✕</button>
            </div>
          )}



          {/* SUB-TAB 1: ALL DRIVER SERVICES PRICING */}
          {pricingSubTab === 'services' && (
            <div className="space-y-4">
              {/* Service Selector Chips */}
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'one-way' as RideServiceType, label: 'One Way (Point-to-Point)' },
                  { id: 'round-trip' as RideServiceType, label: 'Round Trip (Return)' },
                  { id: 'hourly-driver' as RideServiceType, label: 'Hourly Chauffeur' },
                  { id: 'tour-package' as RideServiceType, label: 'Outstation / Tour' },
                  { id: 'airport-transfer' as RideServiceType, label: 'Airport Transfer' },
                  { id: 'bar-pickup' as RideServiceType, label: 'Night Chauffeur' },
                  { id: 'hospital-assistance' as RideServiceType, label: 'Hospital Escort' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedPricingService(s.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                      selectedPricingService === s.id
                        ? 'bg-[#002C6C] text-white border-[#002C6C] shadow-sm'
                        : 'bg-[#0d1017] text-slate-300 border border-[#262b36] hover:bg-[#1a1f2c] transition-colors'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Service Rule Form */}
              {(() => {
                const rule: ServicePricingRule = servicesPricing.services[selectedPricingService] || {
                  baseFare: 150,
                  baseKm: 4,
                  perKmRate: 20,
                  timeRatePerMin: 2,
                  waitingChargePerHour: 50,
                  nightSurcharge: 0,
                  driverAllowancePerDay: 0,
                  isEstimate: true,
                  description: ''
                };

                const updateRule = (patch: Partial<ServicePricingRule>) => {
                  setServicesPricing(prev => ({
                    ...prev,
                    services: {
                      ...prev.services,
                      [selectedPricingService]: {
                        ...rule,
                        ...patch
                      } as ServicePricingRule
                    }
                  }));
                };

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Left 2 cols: Rate Inputs */}
                    <div className="lg:col-span-2 bg-[#14171f] rounded-2xl p-5 border border-[#262b36] shadow-xs space-y-4 text-slate-100">
                      <div className="flex items-center justify-between border-b border-[#262b36] pb-3">
                        <div>
                          <h4 className="font-black text-sm text-slate-100">
                            {selectedPricingService.replace('-', ' ').toUpperCase()} Tariff Settings
                          </h4>
                          <p className="text-[11px] text-slate-400">Modify dynamic parameters fetched and computed during customer booking.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-300">Display Model:</span>
                          <button
                            type="button"
                            onClick={() => updateRule({ isEstimate: !rule.isEstimate })}
                            className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                              rule.isEstimate
                                ? 'bg-amber-950/70 text-amber-200 border-amber-700/70'
                                : 'bg-emerald-950/70 text-emerald-200 border-emerald-700/80'
                            }`}
                          >
                            {rule.isEstimate ? '⚡ Metered Estimate' : '✓ Confirmed Fixed Tariff'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">Base Fare (₹) *</label>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={rule.baseFare}
                            onChange={(e) => updateRule({ baseFare: Number(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-black text-slate-100 focus:border-[#002C6C] outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">Included Base Km</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={rule.baseKm}
                            onChange={(e) => updateRule({ baseKm: Number(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-black text-slate-100 focus:border-[#002C6C] outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">Per-Km Rate (₹/km) *</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={rule.perKmRate}
                            onChange={(e) => updateRule({ perKmRate: Number(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-black text-emerald-300 focus:border-[#002C6C] outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">Travel Time Rate (₹/min)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={rule.timeRatePerMin || 0}
                            onChange={(e) => updateRule({ timeRatePerMin: Number(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-black text-slate-100 focus:border-[#002C6C] outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">Waiting Care Rate (₹/hour)</label>
                          <input
                            type="number"
                            min="0"
                            step="20"
                            value={rule.waitingChargePerHour || 0}
                            onChange={(e) => updateRule({ waitingChargePerHour: Number(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-black text-rose-300 focus:border-[#002C6C] outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">Night Safety Surcharge (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="25"
                            value={rule.nightSurcharge || 0}
                            onChange={(e) => updateRule({ nightSurcharge: Number(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-black text-purple-300 focus:border-[#002C6C] outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">Driver Daily Bata (Allowance ₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="50"
                            value={rule.driverAllowancePerDay || 0}
                            onChange={(e) => updateRule({ driverAllowancePerDay: Number(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-black text-teal-300 focus:border-[#002C6C] outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right 1 col: Live Summary & Calculation preview */}
                    <div className="bg-[#14171f] rounded-2xl p-5 border border-[#262b36] shadow-xs space-y-3 text-xs text-slate-100">
                      <div className="flex items-center gap-2 border-b border-[#262b36] pb-2.5">
                        <h4 className="font-black text-slate-100">Tariff Logic & Transparency</h4>
                      </div>

                      <div className="space-y-2 text-slate-300">
                        <div className="flex justify-between">
                          <span>Base Fare:</span>
                          <span className="font-bold text-slate-100">₹{rule.baseFare} (incl. {rule.baseKm} km)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Additional Distance:</span>
                          <span className="font-bold text-slate-100">₹{rule.perKmRate} / km</span>
                        </div>
                        {Boolean(rule.timeRatePerMin) && (
                          <div className="flex justify-between">
                            <span>Travel Time:</span>
                            <span className="font-bold text-slate-100">₹{rule.timeRatePerMin} / min</span>
                          </div>
                        )}
                        {Boolean(rule.waitingChargePerHour) && (
                          <div className="flex justify-between">
                            <span>Waiting Care:</span>
                            <span className="font-bold text-rose-300">₹{rule.waitingChargePerHour} / hr</span>
                          </div>
                        )}
                        {Boolean(rule.nightSurcharge) && (
                          <div className="flex justify-between">
                            <span>Night Surcharge:</span>
                            <span className="font-bold text-purple-300">₹{rule.nightSurcharge}</span>
                          </div>
                        )}
                        {Boolean(rule.driverAllowancePerDay) && (
                          <div className="flex justify-between">
                            <span>Daily Bata:</span>
                            <span className="font-bold text-teal-700">₹{rule.driverAllowancePerDay}</span>
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-[#0d1424] border border-blue-800/70 rounded-xl text-[11px] text-cyan-300 font-medium space-y-1">
                        <span className="font-black block">💡 Dafy Pricing Guarantee:</span>
                        <p>
                          {rule.isEstimate 
                            ? 'Fares are metered live using accurate GPS travel distance and time elapsed.' 
                            : 'Fares are confirmed fixed tariffs with no hidden surges or extra charges.'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}



          {/* SUB-TAB 2: HOURLY DURATION PACKAGES */}
          {pricingSubTab === 'hourly_packages' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left 1 col: Surcharge settings */}
              <div className="bg-[#14171f] rounded-2xl p-5 border border-[#262b36] shadow-xs space-y-4 text-slate-100">
                <div className="flex items-center gap-2 border-b border-[#262b36] pb-3">
                  <h4 className="font-black text-sm text-slate-100">Overtime / Additional Hour Rate</h4>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Extra Hour Charge (₹ / Hour) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-black text-slate-400">₹</span>
                    <input
                      type="number"
                      min="50"
                      step="10"
                      value={hourlyPricing.extraHourRate}
                      onChange={(e) => setHourlyPricing({ ...hourlyPricing, extraHourRate: Number(e.target.value) || 0 })}
                      className="w-full pl-7 pr-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-bold text-slate-100 outline-none focus:border-[#002C6C]"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    Charged automatically when customer selects hours exceeding the base duration package or when extra time is requested.
                  </p>
                </div>

                <div className="bg-[#0d1424] border border-blue-800/70 rounded-xl p-3 text-xs text-cyan-300 space-y-1">
                  <span className="font-black block">💡 Pricing Rule:</span>
                  <p className="text-[11px] text-cyan-300">
                    Total fare = Package Rate + (Extra Hours × ₹{hourlyPricing.extraHourRate}) + 5% GST + ₹25 Platform Fee.
                  </p>
                </div>
              </div>

              {/* Right 2 cols: Hourly Duration Packages Table */}
              <div className="lg:col-span-2 bg-[#14171f] rounded-2xl p-5 border border-[#262b36] shadow-xs space-y-4 text-slate-100">
                <div className="flex items-center justify-between border-b border-[#262b36] pb-3">
                  <div>
                    <h4 className="font-black text-sm text-slate-100">Duration Packages & Base Fares</h4>
                    <p className="text-[11px] text-slate-400">Manage package prices offered in the passenger portal.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddPackage}
                    className="px-3 py-1.5 rounded-xl bg-[#0d1017] hover:bg-[#1a1f2c] text-cyan-300 font-bold text-xs flex items-center gap-1 border border-[#262b36] transition-all"
                  >
                    <span>Add Duration Package</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0d1017] border-b border-[#262b36] text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3">Duration (Hours)</th>
                        <th className="p-3">Package Rate (₹)</th>
                        <th className="p-3">Included Km</th>
                        <th className="p-3">Display Label</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262b36] font-medium">
                      {hourlyPricing.packages.map((pkg, idx) => (
                        <tr key={idx} className="hover:bg-[#1c202a]">
                          <td className="p-3">
                            <input
                              type="number"
                              min="1"
                              max="24"
                              value={pkg.hours}
                              onChange={(e) => handlePackageChange(idx, 'hours', Number(e.target.value) || 1)}
                              className="w-20 px-2 py-1.5 border border-[#262b36] rounded-lg text-xs font-black text-slate-100"
                            />
                          </td>
                          <td className="p-3">
                            <div className="relative w-28">
                              <span className="absolute left-2 top-1.5 text-xs text-slate-400 font-bold">₹</span>
                              <input
                                type="number"
                                min="100"
                                step="50"
                                value={pkg.rate}
                                onChange={(e) => handlePackageChange(idx, 'rate', Number(e.target.value) || 0)}
                                className="w-full pl-6 pr-2 py-1.5 border border-[#262b36] rounded-lg text-xs font-black text-emerald-300"
                              />
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                step="5"
                                value={pkg.includedKm ?? pkg.kmIncluded ?? (pkg.hours * 10)}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  handlePackageChange(idx, 'includedKm', val);
                                  handlePackageChange(idx, 'kmIncluded', val);
                                }}
                                className="w-20 px-2 py-1.5 border border-[#262b36] rounded-lg text-xs font-medium"
                              />
                              <span className="text-[11px] text-slate-400 font-bold">km</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={pkg.label || `${pkg.hours} Hours Chauffeur`}
                              onChange={(e) => handlePackageChange(idx, 'label', e.target.value)}
                              className="w-full px-2 py-1.5 border border-[#262b36] rounded-lg text-xs font-medium"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeletePackage(idx)}
                              className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg transition-colors"
                              title="Delete this duration package"
                            >
                              <span className="text-[11px] font-bold">Delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}



          {/* SUB-TAB 3: VEHICLE CATEGORY SURCHARGES & PLATFORM TAXES */}
          {pricingSubTab === 'categories' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-[#14171f] rounded-2xl p-5 border border-[#262b36] shadow-xs space-y-4 text-slate-100">
                <div className="border-b border-[#262b36] pb-3">
                  <h4 className="font-black text-sm text-slate-100">Vehicle Category Rates</h4>
                  <p className="text-[11px] text-slate-400">Base surcharge and per-km multipliers for different car classes.</p>
                </div>

                <div className="space-y-3">
                  {(['hatchback', 'sedan', 'suv', 'premium'] as VehicleCategory[]).map((cat) => {
                    const cRate = servicesPricing.categoryRates?.[cat] || { baseFare: 150, baseKm: 4, perKmRate: 22, timeRatePerMin: 2.2 };
                    return (
                      <div key={cat} className="p-3 bg-[#0d1017] rounded-xl border border-[#262b36] flex items-center justify-between gap-3 text-xs text-slate-100">
                        <div className="font-black text-slate-100 uppercase w-24">{cat}</div>
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] text-slate-400 font-bold">Base (₹):</label>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={cRate.baseFare}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setServicesPricing(prev => ({
                                ...prev,
                                categoryRates: {
                                  ...prev.categoryRates,
                                  [cat]: { ...cRate, baseFare: val }
                                }
                              }));
                            }}
                            className="w-18 px-2 py-1 bg-[#0d1017] border border-[#262b36] rounded-lg font-bold text-slate-100 focus:border-[#002C6C]"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] text-slate-400 font-bold">₹/km:</label>
                          <input
                            type="number"
                            min="10"
                            max="50"
                            step="1"
                            value={cRate.perKmRate}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 20;
                              setServicesPricing(prev => ({
                                ...prev,
                                categoryRates: {
                                  ...prev.categoryRates,
                                  [cat]: { ...cRate, perKmRate: val }
                                }
                              }));
                            }}
                            className="w-16 px-2 py-1 bg-[#0d1017] border border-[#262b36] rounded-lg font-bold text-emerald-300 focus:border-[#002C6C]"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] text-slate-400 font-bold">₹/min:</label>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.5"
                            value={cRate.timeRatePerMin}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 2.0;
                              setServicesPricing(prev => ({
                                ...prev,
                                categoryRates: {
                                  ...prev.categoryRates,
                                  [cat]: { ...cRate, timeRatePerMin: val }
                                }
                              }));
                            }}
                            className="w-16 px-2 py-1 bg-[#0d1017] border border-[#262b36] rounded-lg font-bold text-slate-100 focus:border-[#002C6C]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#14171f] rounded-2xl p-5 border border-[#262b36] shadow-xs space-y-4 text-slate-100">
                <div className="border-b border-[#262b36] pb-3">
                  <h4 className="font-black text-sm text-slate-100">Platform Fees & Taxes</h4>
                  <p className="text-[11px] text-slate-400">Government taxes and safety platform charge added to fare.</p>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">State GST (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="28"
                      value={servicesPricing.gstPercentage || 5}
                      onChange={(e) => setServicesPricing({ ...servicesPricing, gstPercentage: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl font-bold text-slate-100 focus:border-[#002C6C] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Platform & Safety Fee (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={servicesPricing.platformFee || 25}
                      onChange={(e) => setServicesPricing({ ...servicesPricing, platformFee: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl font-bold text-slate-100 focus:border-[#002C6C] outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}


        </div>
      )}

      {/* TAB: WHATSAPP ENQUIRIES & CONVERSION (REQUIREMENT 2) */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-[#002C6C] text-white rounded-2xl p-5 sm:p-6 border border-white/10 shadow-lg space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>LIVE META WEBHOOK STREAM</span>
                  </span>
                  <span className="text-xs font-mono bg-white/15 px-2 py-0.5 rounded text-white font-bold">
                    +918547325636
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black mt-1 flex items-center gap-2">
                  <span>WhatsApp Booking Enquiries</span>
                </h3>
                <p className="text-xs text-emerald-100/80 max-w-2xl mt-0.5">
                  Real-time incoming booking messages received from DriveC WhatsApp (+918547325636). Verify customer details, auto-calculate road distance and tariff, and convert into confirmed bookings.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSimulateWaModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Simulate Incoming WhatsApp</span>
                </button>
              </div>
            </div>

            {/* Filter Tabs & Search */}
            <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div className="flex flex-wrap items-center gap-1.5 bg-black/20 p-1 rounded-xl">
                {[
                  { id: 'all' as const, label: 'All' },
                  { id: 'pending_verification' as const, label: 'Pending Verification' },
                  { id: 'converted' as const, label: 'Completed' },
                  { id: 'rejected' as const, label: 'Rejected' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setWaStatusFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                      waStatusFilter === f.id
                        ? 'bg-[#002C6C] text-white shadow-xs'
                        : 'text-emerald-100 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[220px]">
                <input
                  type="text"
                  placeholder="Search phone, name, location..."
                  value={waSearchQuery}
                  onChange={(e) => setWaSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white/10 border border-white/20 rounded-xl text-xs text-white placeholder-white/50 outline-none focus:bg-white/20 focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            </div>
          </div>

          {/* Enquiries List */}
          {(() => {
            const filtered = (whatsAppEnquiries || []).filter((w) => {
              if (waStatusFilter !== 'all' && w.status !== waStatusFilter) return false;
              if (waSearchQuery) {
                const q = waSearchQuery.toLowerCase();
                const phone = w.customerPhone || w.senderPhone || '';
                const name = w.customerName || w.senderName || '';
                const pickup = w.pickupLocation || '';
                const dest = w.destinationLocation || w.dropoffLocation || '';
                const matchPhone = phone.toLowerCase().includes(q);
                const matchName = name.toLowerCase().includes(q);
                const matchPickup = pickup.toLowerCase().includes(q);
                const matchDest = dest.toLowerCase().includes(q);
                const matchMsg = (w.rawMessage || '').toLowerCase().includes(q);
                if (!matchPhone && !matchName && !matchPickup && !matchDest && !matchMsg) return false;
              }
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div className="bg-[#14171f] rounded-2xl border border-[#262b36] p-12 text-center text-xs text-slate-400 space-y-3">
                  <p className="font-bold text-slate-100 text-sm">No WhatsApp booking enquiries found</p>
                  <p className="max-w-md mx-auto text-slate-400">
                    {waStatusFilter !== 'all'
                      ? `No enquiries match status filter "${waStatusFilter}".`
                      : 'Incoming WhatsApp messages sent to +918547325636 will be received in real time and displayed here.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowSimulateWaModal(true)}
                    className="px-4 py-2 bg-[#002C6C] hover:bg-[#001f4d] text-white font-bold rounded-xl text-xs shadow-xs"
                  >
                    Simulate WhatsApp Message
                  </button>
                </div>
              );
            }

            return (
              <div
                className="grid gap-4 items-start"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
              >
                {filtered.map((wa) => {
                  const isExpanded = expandedWaEnquiryId === wa.id;
                  const isPending = wa.status === 'pending_verification';
                  const isConverted = wa.status === 'converted';
                  const isRejected = wa.status === 'rejected';
                  const displayPhone = wa.customerPhone || wa.senderPhone;
                  const displayName = wa.customerName || wa.senderName || 'WhatsApp Customer';
                  const displayDest = wa.destinationLocation || wa.dropoffLocation;
                  const estFare = wa.estimatedFare || (wa.pricingModel === 'kilometer' ? Math.round((wa.calculatedKm || 25) * 1.05 + 25) : 150);

                  return (
                    <div
                      id={`admin-wa-card-${wa.id}`}
                      key={wa.id}
                      tabIndex={-1}
                      className={`bg-[#14171f] rounded-2xl border transition-all overflow-hidden scroll-mt-24 outline-none text-slate-100 ${
                        isExpanded
                          ? 'col-span-full border-cyan-500 shadow-lg ring-2 ring-cyan-500/25'
                          : isPending
                          ? 'border-emerald-500/70 hover:border-emerald-700/80 shadow-2xs hover:shadow-xs'
                          : 'border-[#262b36] hover:border-slate-600 shadow-2xs hover:shadow-xs'
                      } ${isRejected && !isExpanded ? 'opacity-80' : ''}`}
                      style={isExpanded ? { gridColumn: '1 / -1' } : undefined}
                    >
                      {/* Small Card (Minimum details; click to expand focused card & collapse others) */}
                      <div
                        onClick={() => toggleWaEnquiryExpand(wa.id)}
                        className="p-3.5 sm:p-4 cursor-pointer flex flex-col gap-2.5 select-none hover:bg-[#1a1f2c] transition-colors"
                      >
                        {/* Top line: Contact Name / Phone + Status Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-black text-slate-100 text-xs sm:text-sm block truncate">
                              {displayName}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-emerald-400 block truncate mt-0.5">
                              {displayPhone}
                            </span>
                          </div>

                          <div className="shrink-0">
                            {isPending && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-950/70 text-amber-300 border border-amber-700/80 inline-flex items-center gap-1 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                                <span>Pending</span>
                              </span>
                            )}
                            {isConverted && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/70 text-emerald-300 border border-emerald-700/80">
                                Completed
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#0d1017] text-slate-400 border border-[#262b36]">
                                Rejected
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle line: Minimal Route */}
                        <div className="space-y-1 text-xs">
                          <div className="text-slate-300 truncate">
                            <span className="text-slate-400 text-[10px] uppercase font-bold mr-1">From:</span>
                            <span className="font-medium text-slate-200">{wa.pickupLocation || 'Not specified'}</span>
                          </div>
                          <div className="text-slate-300 truncate">
                            <span className="text-slate-400 text-[10px] uppercase font-bold mr-1">To:</span>
                            <span className="font-medium text-slate-200">{displayDest || 'Not specified'}</span>
                          </div>
                        </div>

                        {/* Bottom line: Date & Fare + View Details Toggle */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#262b36] text-[11px]">
                          <div className="flex items-center gap-2 text-slate-400 truncate">
                            <span className="truncate">{wa.scheduledDate || 'Immediate'}</span>
                            <span className="font-black text-cyan-400 font-mono">
                              ₹{estFare}
                            </span>
                          </div>

                          <span className="font-bold text-cyan-400 shrink-0 ml-2">
                            {isExpanded ? 'Hide Details −' : 'View Details +'}
                          </span>
                        </div>
                      </div>

                      {/* Expanded Full Details View */}
                      {isExpanded && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="border-t border-[#262b36] p-4 sm:p-5 bg-[#0d1017]/50 space-y-4 animate-in fade-in duration-200"
                        >
                          {/* Meta Bar: Received timestamp & Full Status */}
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[11px] text-slate-400">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>Received: <strong className="text-slate-200">{new Date(wa.createdAt).toLocaleString()}</strong></span>
                              {wa.serviceType && (
                                <>
                                  <span>•</span>
                                  <span className="font-bold text-cyan-400 uppercase text-[10px]">
                                    {wa.serviceType.replace('-', ' ')}
                                  </span>
                                </>
                              )}
                            </div>
                            {isConverted && (wa.convertedBookingRef || wa.convertedBookingId) && (
                              <span className="font-mono font-bold text-emerald-300 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800/80 text-[10px]">
                                Completed Ref: #{wa.convertedBookingRef || wa.convertedBookingId}
                              </span>
                            )}
                          </div>

                          {/* Route & Travel Details */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#0d1017] p-3.5 rounded-xl border border-[#262b36] text-xs text-slate-200">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pickup Point:</span>
                              <span className="font-bold text-slate-100 block break-words">
                                {wa.pickupLocation || 'Not specified'}
                              </span>
                              {wa.pickupPin && (
                                <a
                                  href={wa.pickupPin.startsWith('http') ? wa.pickupPin : `https://maps.google.com/?q=${encodeURIComponent(wa.pickupPin)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold inline-flex items-center gap-1 mt-1 underline"
                                >
                                  <span>View Pickup GPS Pin</span>
                                </a>
                              )}
                            </div>

                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Drop-off Destination:</span>
                              <span className="font-bold text-slate-100 block break-words">
                                {displayDest || 'Not specified'}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Requested Schedule:</span>
                              <span className="font-bold text-slate-100 block">
                                {wa.scheduledDate || 'Immediate'} {wa.scheduledTime ? `at ${wa.scheduledTime}` : ''}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Service Category:</span>
                              <span className="font-bold text-emerald-400 uppercase block">
                                {wa.serviceType ? wa.serviceType.replace('-', ' ') : 'Driver Service'}
                              </span>
                            </div>
                          </div>

                          {/* Driver Routing & Match Banner */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#0d1017] p-3.5 rounded-xl border border-[#262b36] text-xs text-slate-200">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Routing Status:</span>
                              <span className={`inline-block font-black text-[10px] uppercase px-2 py-0.5 rounded-full mt-1 ${
                                wa.routingStatus === 'routed_to_driver'
                                  ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/80'
                                  : wa.routingStatus === 'driver_identification_required'
                                  ? 'bg-amber-950/70 text-amber-300 border border-amber-700/80 animate-pulse'
                                  : wa.routingStatus === 'reassigned'
                                  ? 'bg-purple-950/70 text-purple-300 border border-purple-700/80'
                                  : 'bg-[#002C6C]/50 text-cyan-300 border border-cyan-700/50'
                              }`}>
                                {wa.routingStatus ? wa.routingStatus.replace(/_/g, ' ') : 'General Admin Pool'}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Preferred Driver (Requested):</span>
                              <span className="font-bold text-rose-400 block mt-1">
                                {wa.preferredDriver || 'None specified (Any available)'}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Matched Driver ID / Name:</span>
                              <span className="font-bold text-slate-100 block mt-1 truncate">
                                {wa.matchedDriverName ? `${wa.matchedDriverName} (${wa.matchedDriverId})` : 'Unassigned (General Pool)'}
                              </span>
                            </div>
                          </div>

                          {/* Kilometer / Minute Dynamic Pricing Route Calculation */}
                          <div className="p-3.5 bg-[#0d1017] rounded-xl border border-[#262b36] flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                            <div>
                              <span className="font-black text-slate-100 block">
                                {wa.pricingModel === 'kilometer' ? 'Kilometer-Based Pricing (₹1.00/km)' : 'Minute-Based Pricing (₹1.20/min)'}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {wa.pricingModel === 'kilometer'
                                  ? `Calculated Road Distance: ${wa.calculatedKm || 25} km via OSRM • Zero time charges`
                                  : `Calculated Duration: ${wa.calculatedMinutes || 60} mins • Zero distance charges`}
                              </span>
                            </div>
                            <div className="text-left sm:text-right">
                              <span className="text-[10px] text-slate-400 uppercase block font-bold">Estimated Tariff</span>
                              <span className="text-lg font-black text-cyan-400 font-mono">₹{estFare}</span>
                            </div>
                          </div>

                          {/* Raw WhatsApp Message Bubble */}
                          <div className="bg-[#0a1a14] border border-emerald-900/60 rounded-xl p-3.5 text-xs space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-bold text-emerald-300">
                              <span>Raw WhatsApp Message Received:</span>
                              <span className="font-mono text-slate-400">ID: {wa.id}</span>
                            </div>
                            <p className="text-slate-200 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                              {wa.rawMessage}
                            </p>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#262b36]">
                            <div className="text-[11px] text-slate-400">
                              {isPending && 'Review route & distance, assign driver, and confirm booking.'}
                              {isConverted && '✓ Verified and marked Completed in DriveC confirmed bookings.'}
                              {isRejected && 'Declined by Administrator.'}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {isPending && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectWaEnquiry(wa.id)}
                                    className="px-3.5 py-2 rounded-xl bg-[#14171f] hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-[#262b36] hover:border-rose-800/80 font-bold text-xs transition-colors cursor-pointer"
                                  >
                                    Reject Enquiry
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openWaConversionModal(wa)}
                                    className="px-4 py-2 rounded-xl bg-[#002C6C] hover:bg-[#001f4d] text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <span>Verify & Convert to Confirmed Booking</span>
                                  </button>
                                </>
                              )}
                              {isConverted && (wa.convertedBookingRef || wa.convertedBookingId) && (
                                <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-800/80">
                                  Booking Ref: #{wa.convertedBookingRef || wa.convertedBookingId}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* WHATSAPP CONVERSION MODAL */}
      {activeWaToConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-[#14171f] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#262b36] space-y-4 text-xs text-slate-100">
            <div className="flex justify-between items-start border-b border-[#262b36] pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800/80">
                  WhatsApp Conversion Workflow
                </span>
                <h3 className="text-base font-black text-slate-100 mt-1">Convert WhatsApp Enquiry to DriveC Booking</h3>
              </div>
              <button onClick={() => setActiveWaToConvert(null)} className="text-slate-400 hover:text-slate-300 cursor-pointer">
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            {waConversionError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300 font-bold">
                {waConversionError}
              </div>
            )}

            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={activeWaToConvert.customerName || activeWaToConvert.senderName || 'WhatsApp Customer'}
                    onChange={(e) => setActiveWaToConvert({ ...activeWaToConvert, customerName: e.target.value, senderName: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl font-bold text-slate-100 focus:border-[#002C6C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Customer WhatsApp Phone</label>
                  <input
                    type="text"
                    value={activeWaToConvert.customerPhone || activeWaToConvert.senderPhone || ''}
                    onChange={(e) => setActiveWaToConvert({ ...activeWaToConvert, customerPhone: e.target.value, senderPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl font-mono font-bold text-emerald-300 focus:border-[#002C6C] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Pickup Location</label>
                <input
                  type="text"
                  value={activeWaToConvert.pickupLocation || ''}
                  onChange={(e) => setActiveWaToConvert({ ...activeWaToConvert, pickupLocation: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-slate-100 focus:border-[#002C6C] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Drop-off Destination</label>
                <input
                  type="text"
                  value={activeWaToConvert.destinationLocation || activeWaToConvert.dropoffLocation || ''}
                  onChange={(e) => setActiveWaToConvert({ ...activeWaToConvert, destinationLocation: e.target.value, dropoffLocation: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-slate-100 focus:border-[#002C6C] outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">Road Km</label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={waConversionKm}
                    onChange={(e) => {
                      const km = Number(e.target.value) || 1;
                      setWaConversionKm(km);
                      const rule = servicesPricing.services[activeWaToConvert.serviceType || 'one-way'] || servicesPricing.services['one-way'];
                      const extraKm = Math.max(0, km - (rule?.baseKm || 10));
                      const base = rule?.baseFare || 450;
                      const kmFare = extraKm * (rule?.perKmRate || 18);
                      const gst = Math.round((base + kmFare) * 0.05);
                      setWaConversionFare(base + kmFare + gst + 25);
                    }}
                    className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl font-black text-cyan-300 focus:border-[#002C6C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">Date</label>
                  <input
                    type="date"
                    value={activeWaToConvert.scheduledDate || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setActiveWaToConvert({ ...activeWaToConvert, scheduledDate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl font-bold text-slate-100 focus:border-[#002C6C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">Time</label>
                  <input
                    type="text"
                    value={activeWaToConvert.scheduledTime || '10:00 AM'}
                    onChange={(e) => setActiveWaToConvert({ ...activeWaToConvert, scheduledTime: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl font-bold text-slate-100 focus:border-[#002C6C] outline-none"
                  />
                </div>
              </div>

              {/* Assign Driver */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Assign Professional Driver</label>
                <select
                  value={selectedDriverForWa}
                  onChange={(e) => setSelectedDriverForWa(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-bold text-slate-100 focus:border-[#002C6C] outline-none"
                >
                  <option value="">-- Auto-assign next available driver --</option>
                  {drivers
                    .filter(d => d.approvalStatus === 'approved')
                    .map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.phone}) • {d.isOnline ? '🟢 Online' : '⚪ Offline'} • ★{d.ratingAverage}
                      </option>
                    ))}
                </select>
              </div>

              {/* Fare Summary Box */}
              <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">Total Confirmed Tariff (incl. GST & Platform):</span>
                  <span className="text-xl font-black text-emerald-200">₹{waConversionFare}</span>
                </div>
                <span className="text-xs font-bold text-emerald-300 bg-[#0d1017] px-2.5 py-1 rounded-lg border border-emerald-800/80">
                  {waConversionKm} km Road Route
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-[#262b36]">
              <button
                type="button"
                onClick={() => setActiveWaToConvert(null)}
                className="px-4 py-2.5 rounded-xl bg-[#0d1017] hover:bg-[#1a1f2c] text-slate-300 border border-[#262b36] font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={waConversionLoading}
                onClick={handleConfirmWaConversion}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{waConversionLoading ? 'Confirming...' : `Confirm Booking & Dispatch Driver (₹${waConversionFare})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATE INCOMING WHATSAPP MODAL */}
      {showSimulateWaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#14171f] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#262b36] space-y-4 text-xs text-slate-100">
            <div className="flex justify-between items-start border-b border-[#262b36] pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/80">
                  Dev & Testing Tool
                </span>
                <h3 className="text-base font-black text-slate-100 mt-1">Simulate Incoming WhatsApp Message</h3>
              </div>
              <button onClick={() => setShowSimulateWaModal(false)} className="text-slate-400 hover:text-slate-300 cursor-pointer">
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-300">Quick Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    label: '✈️ Airport Drop',
                    text: `*DriveC Booking Request*\n• Service: Airport Transfer\n• Pickup: Panampilly Nagar, Kochi\n• Pickup Pin: https://maps.google.com/?q=9.9634,76.2974\n• Drop-off: Cochin International Airport (COK)\n• Date: ${new Date().toISOString().split('T')[0]}\n• Time: 06:00 PM`
                  },
                  {
                    label: '🚗 One-Way Local',
                    text: `*DriveC Booking Request*\n• Service: One-Way Driver\n• Pickup: Aluva Railway Station\n• Pickup Pin: https://maps.google.com/?q=10.1076,76.3516\n• Drop-off: Kakkanad InfoPark\n• Date: ${new Date().toISOString().split('T')[0]}\n• Time: 11:30 AM`
                  },
                  {
                    label: '⏱️ Hourly Chauffeur',
                    text: `*DriveC Booking Request*\n• Service: Hourly Chauffeur (4 Hours)\n• Pickup: Marine Drive, Ernakulam\n• Pickup Pin: https://maps.google.com/?q=9.9816,76.2750\n• Drop-off: Kochi City Tour\n• Date: ${new Date().toISOString().split('T')[0]}\n• Time: 02:00 PM`
                  },
                  {
                    label: '🌙 Night Chauffeur',
                    text: `*DriveC Booking Request*\n• Service: Night Chauffeur / Bar Pickup\n• Pickup: Olive Downtown, Kadavanthra\n• Pickup Pin: https://maps.google.com/?q=9.9664,76.2982\n• Drop-off: Fort Kochi\n• Date: ${new Date().toISOString().split('T')[0]}\n• Time: 11:30 PM`
                  }
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSimulateWaText(preset.text)}
                    className="px-2.5 py-1 bg-[#0d1017] hover:bg-emerald-950/60 hover:text-emerald-300 text-slate-300 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border border-[#262b36]"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSendSimulatedWa} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Customer Phone</label>
                  <input
                    type="text"
                    value={simulateWaPhone}
                    onChange={(e) => setSimulateWaPhone(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl font-mono font-bold text-slate-100 focus:border-[#002C6C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={simulateWaName}
                    onChange={(e) => setSimulateWaName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl font-bold text-slate-100 focus:border-[#002C6C] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Raw WhatsApp Message Payload</label>
                <textarea
                  rows={6}
                  value={simulateWaText}
                  onChange={(e) => setSimulateWaText(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl font-mono text-[11px] leading-relaxed text-slate-100 focus:border-[#002C6C] outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-[#262b36]">
                <button
                  type="button"
                  onClick={() => setShowSimulateWaModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#0d1017] hover:bg-[#1a1f2c] text-slate-300 border border-[#262b36] font-bold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={waSimulateLoading}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>{waSimulateLoading ? 'Delivering...' : 'Send to DriveC Webhook'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISCIPLINARY ACTION MODAL (REQUIREMENT 8) */}
      {activeComplaintForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#14171f] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#262b36] space-y-4 text-xs text-slate-100">
            <div className="flex justify-between items-start border-b border-[#262b36] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Disciplinary Authority</span>
                <h3 className="text-base font-bold text-slate-100">Take Action: Ticket #{activeComplaintForAction.bookingRef}</h3>
              </div>
              <button onClick={() => setActiveComplaintForAction(null)} className="text-slate-400 hover:text-slate-300">
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            <form onSubmit={handleTakeComplaintAction} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-200 mb-1">Select Action to Enforce *</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none font-bold bg-[#0d1017] text-slate-100 focus:border-[#002C6C]"
                >
                  <option value="warned">Issue Written Warning to Driver</option>
                  <option value="suspended">Suspend Driver Account (Blocks Dispatch & Login)</option>
                  <option value="restricted">Restrict Driver to Non-Peak Hours</option>
                  <option value="resolved">Close & Resolve Dispute</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1">Administrative Notes & Audit Reason *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Document reason for action, investigator notes, and communication with passenger..."
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none"
                ></textarea>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveComplaintForAction(null)}
                  className="w-1/3 py-2.5 rounded-xl border border-[#262b36] text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  Enforce Action & Save to Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD FLEET VEHICLE */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-[#14171f] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#262b36] space-y-5 text-xs max-h-[90vh] overflow-y-auto text-slate-100">
            <div className="flex justify-between items-start border-b border-[#262b36] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-200 bg-[#002C6C]/40 px-2 py-0.5 rounded border border-[#002C6C]/60">
                  Fleet Registry
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-1">Register New Self-Drive Vehicle</h3>
                <p className="text-slate-400 text-[11px]">Add vehicle to the platform rental catalog for customer bookings.</p>
              </div>
              <button onClick={() => setShowAddVehicleModal(false)} className="text-slate-400 hover:text-slate-300">
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Make / Brand *</label>
                  <input
                    type="text"
                    required
                    value={newVehicleBrand}
                    onChange={(e) => setNewVehicleBrand(e.target.value)}
                    placeholder="e.g. Toyota, Hyundai, Mahindra"
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none focus:ring-2 focus:ring-[#002C6C]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Model Name *</label>
                  <input
                    type="text"
                    required
                    value={newVehicleModel}
                    onChange={(e) => setNewVehicleModel(e.target.value)}
                    placeholder="e.g. Innova Hycross, Creta"
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none focus:ring-2 focus:ring-[#002C6C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Category *</label>
                  <select
                    value={newVehicleCategory}
                    onChange={(e) => setNewVehicleCategory(e.target.value as any)}
                    className="w-full px-2.5 py-2 border border-[#262b36] rounded-xl outline-none bg-[#0d1017] text-slate-100 font-medium focus:border-[#002C6C]"
                  >
                    <option value="hatchback">Hatchback</option>
                    <option value="sedan">Sedan</option>
                    <option value="suv">SUV / MUV</option>
                    <option value="luxury">Luxury / Premium</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Transmission *</label>
                  <select
                    value={newVehicleTransmission}
                    onChange={(e) => setNewVehicleTransmission(e.target.value as any)}
                    className="w-full px-2.5 py-2 border border-[#262b36] rounded-xl outline-none bg-[#0d1017] text-slate-100 font-medium focus:border-[#002C6C]"
                  >
                    <option value="automatic">Automatic</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Fuel Type *</label>
                  <select
                    value={newVehicleFuel}
                    onChange={(e) => setNewVehicleFuel(e.target.value as any)}
                    className="w-full px-2.5 py-2 border border-[#262b36] rounded-xl outline-none bg-[#0d1017] text-slate-100 font-medium focus:border-[#002C6C]"
                  >
                    <option value="petrol">Petrol</option>
                    <option value="diesel">Diesel</option>
                    <option value="electric">Electric EV</option>
                    <option value="cng">CNG</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Seats *</label>
                  <input
                    type="number"
                    min={2}
                    max={12}
                    value={newVehicleSeats}
                    onChange={(e) => setNewVehicleSeats(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Daily Rate (₹) *</label>
                  <input
                    type="number"
                    min={500}
                    step={100}
                    value={newVehicleDailyRate}
                    onChange={(e) => setNewVehicleDailyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Advance Amount (₹) *</label>
                  <input
                    type="number"
                    min={500}
                    step={500}
                    value={newVehicleAdvanceAmount}
                    onChange={(e) => setNewVehicleAdvanceAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Registration / Plate *</label>
                  <input
                    type="text"
                    required
                    value={newVehicleLicensePlate}
                    onChange={(e) => setNewVehicleLicensePlate(e.target.value)}
                    placeholder="KL-07-CD-1234"
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Hub Location *</label>
                  <input
                    type="text"
                    required
                    value={newVehicleLocation}
                    onChange={(e) => setNewVehicleLocation(e.target.value)}
                    placeholder="e.g. COK Airport, Kakkanad, Fort Kochi"
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-[#262b36]">
                <button
                  type="button"
                  onClick={() => setShowAddVehicleModal(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-[#262b36] text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors"
                >
                  Add Vehicle to Fleet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TAKE VEHICLE OFFLINE / MAINTENANCE PROTOCOL (REQUIREMENT 6) */}
      {offlineModalVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#14171f] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#262b36] space-y-4 text-xs text-slate-100">
            <div className="flex justify-between items-start border-b border-[#262b36] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/80">
                  Maintenance Dispatch Protocol
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-1">Take Vehicle Offline</h3>
                <p className="text-slate-400 text-[11px]">
                  {offlineModalVehicle.brand} {offlineModalVehicle.model} • {offlineModalVehicle.licensePlate}
                </p>
              </div>
              <button onClick={() => setOfflineModalVehicle(null)} className="text-slate-400 hover:text-slate-300">
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (onToggleRentalVehicleAvailability) {
                  onToggleRentalVehicleAvailability(offlineModalVehicle.id, false, offlineExpectedDate);
                }
                if (onUpdateRentalVehicle) {
                  onUpdateRentalVehicle({
                    ...offlineModalVehicle,
                    isAvailable: false,
                    offlineUntil: offlineExpectedDate,
                    maintenanceReason: offlineReason
                  });
                }
                setOfflineModalVehicle(null);
              }}
              className="space-y-4"
            >
              <div className="p-3 bg-amber-950/60 rounded-2xl border border-amber-800/80 text-amber-200 space-y-1">
                <p className="font-bold text-xs flex items-center gap-1.5">
                  Scheduled Maintenance Notice
                </p>
                <p className="text-[11px] text-amber-300">
                  Customers selecting this vehicle will see the maintenance notice with the expected return date. Customers may still reserve for future dates after this return date.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1">Expected Return / Availability Date *</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={offlineExpectedDate}
                  onChange={(e) => setOfflineExpectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none focus:ring-2 focus:ring-[#002C6C] font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1">Maintenance / Service Reason</label>
                <textarea
                  rows={2}
                  value={offlineReason}
                  onChange={(e) => setOfflineReason(e.target.value)}
                  placeholder="e.g. Scheduled brake servicing, paint detail, inspection..."
                  className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none text-xs"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-[#262b36]">
                <button
                  type="button"
                  onClick={() => setOfflineModalVehicle(null)}
                  className="w-1/3 py-2.5 rounded-xl border border-[#262b36] text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors shadow-xs"
                >
                  Confirm Take Offline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DIGITAL HANDOVER CHECKLIST */}
      {activeHandoverBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#14171f] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#262b36] space-y-4 text-xs text-slate-100">
            <div className="flex justify-between items-start border-b border-[#262b36] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-200 bg-[#002C6C]/40 px-2 py-0.5 rounded border border-[#002C6C]/60">
                  Key Handover Protocol
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-1">Vehicle Dispatch Handover</h3>
                <p className="text-slate-400 text-[11px]">Ref: {activeHandoverBooking.refCode} • {activeHandoverBooking.passengerName}</p>
              </div>
              <button onClick={() => setActiveHandoverBooking(null)} className="text-slate-400 hover:text-slate-300">
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            <form onSubmit={handlePerformHandover} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-200 mb-1">Starting Odometer (KM) *</label>
                <input
                  type="number"
                  required
                  value={handoverOdometer}
                  onChange={(e) => setHandoverOdometer(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1">Fuel / Charge Level ({handoverFuelLevel}%)</label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={handoverFuelLevel}
                  onChange={(e) => setHandoverFuelLevel(Number(e.target.value))}
                  className="w-full accent-cyan-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1">Exterior & Body Inspection *</label>
                <select
                  value={handoverCondition}
                  onChange={(e) => setHandoverCondition(e.target.value as any)}
                  className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none bg-[#0d1017] text-slate-100 font-medium"
                >
                  <option value="excellent">Flawless / Pristine Condition</option>
                  <option value="good">Good (Normal wear, no dents)</option>
                  <option value="minor_scratches">Pre-existing minor bumper scratches noted</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1">Interior Cleanliness *</label>
                <select
                  value={handoverCleanliness}
                  onChange={(e) => setHandoverCleanliness(e.target.value as any)}
                  className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none bg-[#0d1017] text-slate-100 font-medium"
                >
                  <option value="clean">Deep-cleaned & Sanitized</option>
                  <option value="moderate">Standard Clean</option>
                </select>
              </div>

              <div className="bg-[#0d1017] p-3 rounded-xl border border-[#262b36] space-y-1 text-[11px] text-slate-300">
                <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                  Spare tyre, jack & toolkit verified in boot
                </div>
                <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                  Original RC copy & Kerala commercial permit present
                </div>
                <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                  Customer valid driving license physically inspected
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-[#262b36]">
                <button
                  type="button"
                  onClick={() => setActiveHandoverBooking(null)}
                  className="w-1/3 py-2.5 rounded-xl border border-[#262b36] text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#002C6C] hover:bg-[#001f4d] text-white font-bold"
                >
                  Hand Over Keys & Start Rental
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RETURN INSPECTION & DEPOSIT SETTLEMENT */}
      {activeReturnBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#14171f] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#262b36] space-y-4 text-xs text-slate-100">
            <div className="flex justify-between items-start border-b border-[#262b36] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80">
                  Vehicle Return Inspection
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-1">Check-in & Deposit Release</h3>
                <p className="text-slate-400 text-[11px]">Ref: {activeReturnBooking.refCode} • {activeReturnBooking.passengerName}</p>
              </div>
              <button onClick={() => setActiveReturnBooking(null)} className="text-slate-400 hover:text-slate-300">
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            <form onSubmit={handlePerformReturn} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-200 mb-1">Return Odometer (KM) *</label>
                <input
                  type="number"
                  required
                  value={returnOdometer}
                  onChange={(e) => setReturnOdometer(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1">Return Fuel / Battery ({returnFuelLevel}%)</label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={returnFuelLevel}
                  onChange={(e) => setReturnFuelLevel(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1">Security Deposit Settlement *</label>
                <select
                  value={returnDepositAction}
                  onChange={(e) => setReturnDepositAction(e.target.value as any)}
                  className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none bg-[#0d1017] text-slate-100 font-bold focus:border-[#002C6C]"
                >
                  <option value="full_refund">Full Refund (100% deposit returned to customer)</option>
                  <option value="deduct_fuel">Deduct Fuel Refill Surcharge</option>
                  <option value="deduct_damage">Deduct Repair / Scratch Assessment</option>
                </select>
              </div>

              <div className="bg-[#0d1017] p-3 rounded-xl border border-[#262b36] text-[11px] text-slate-300">
                <span className="font-bold text-slate-200 block mb-1">Settlement Summary:</span>
                <div className="flex justify-between">
                  <span>Customer Deposit Held:</span>
                  <span className="font-mono font-bold text-slate-100">₹{activeReturnBooking.securityDeposit || 3000}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Action:</span>
                  <span className={`font-bold ${returnDepositAction === 'full_refund' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {returnDepositAction === 'full_refund' ? 'Refund ₹' + (activeReturnBooking.securityDeposit || 3000) : 'Deduct from Deposit'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-[#262b36]">
                <button
                  type="button"
                  onClick={() => setActiveReturnBooking(null)}
                  className="w-1/3 py-2.5 rounded-xl border border-[#262b36] text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Complete Return & Close Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT RENTAL RESERVATION MODAL (REQUIREMENT 1) */}
      {inspectingRentalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#14171f] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-[#262b36] space-y-5 text-slate-100">
            <div className="flex items-center justify-between border-b border-[#262b36] pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300 bg-[#002C6C]/40 px-2.5 py-0.5 rounded-full border border-[#002C6C]/60">
                  Rental Reservation Details
                </span>
                <h3 className="text-xl font-black text-slate-100 mt-1">
                  {inspectingRentalBooking.rentalVehicleModel || 'Self-Drive Vehicle'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingRentalBooking(null)}
                className="p-2 text-slate-400 hover:text-slate-200 rounded-full hover:bg-[#1a1f2c] transition-colors"
              >
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#0d1017] rounded-2xl border border-[#262b36] space-y-1.5 text-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Customer Information</span>
                <div className="flex justify-between">
                  <span className="text-slate-300">Customer Name:</span>
                  <span className="font-bold text-slate-100">{inspectingRentalBooking.customerName || inspectingRentalBooking.passengerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Contact Phone:</span>
                  <span className="font-mono font-bold text-slate-100">{inspectingRentalBooking.customerPhone || inspectingRentalBooking.passengerPhone}</span>
                </div>
                {inspectingRentalBooking.passengerName && inspectingRentalBooking.passengerName !== inspectingRentalBooking.customerName && (
                  <div className="flex justify-between">
                    <span className="text-slate-300">Designated Driver / Passenger:</span>
                    <span className="font-bold text-slate-100">{inspectingRentalBooking.passengerName} ({inspectingRentalBooking.passengerPhone})</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-[#0d1017] rounded-2xl border border-[#262b36] space-y-1.5 text-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Rental Schedule & Logistics</span>
                <div className="flex justify-between">
                  <span className="text-slate-300">Booking Ref:</span>
                  <span className="font-mono font-bold text-slate-100">{inspectingRentalBooking.refCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Rental Duration:</span>
                  <span className="font-bold text-slate-100">{inspectingRentalBooking.rentalDays || 1} Day(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Pickup Date & Time:</span>
                  <span className="font-semibold text-slate-100">{inspectingRentalBooking.scheduledDate} at {inspectingRentalBooking.scheduledTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Return Date:</span>
                  <span className="font-semibold text-slate-100">{inspectingRentalBooking.returnDate || inspectingRentalBooking.scheduledDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Depot / Pickup Location:</span>
                  <span className="font-medium text-slate-100">{inspectingRentalBooking.pickupLocation}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-950/50 rounded-2xl border border-emerald-700/80 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider block">Financial & Advance Payment</span>
                <div className="flex justify-between">
                  <span className="text-emerald-200">Total Rental Fare:</span>
                  <span className="font-black text-slate-100">₹{inspectingRentalBooking.fareBreakdown?.totalFare || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-200">Advance Amount Paid:</span>
                  <span className="font-black text-emerald-300">₹{inspectingRentalBooking.advanceAmount || 1000} (PAID ✓)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-200">Remaining Due on Vehicle Return:</span>
                  <span className="font-bold text-slate-200">
                    ₹{inspectingRentalBooking.remainingAmount ?? Math.max(0, (inspectingRentalBooking.fareBreakdown?.totalFare || 0) - (inspectingRentalBooking.advanceAmount || 1000))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-200">Advance Paid At:</span>
                  <span className="font-mono text-emerald-300 text-[11px]">{inspectingRentalBooking.advancePaidAt || inspectingRentalBooking.createdAt}</span>
                </div>
              </div>

              <div className="flex justify-between items-center px-1">
                <span className="text-slate-300">Current Status:</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    inspectingRentalBooking.status === 'completed'
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80'
                      : inspectingRentalBooking.status === 'approved'
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80'
                      : inspectingRentalBooking.status === 'in_progress'
                      ? 'bg-[#002C6C]/40 text-cyan-200 border border-[#002C6C]/60'
                      : inspectingRentalBooking.status === 'cancelled'
                      ? 'bg-rose-950/60 text-rose-300 border border-rose-800/80'
                      : 'bg-amber-950/60 text-amber-300 border border-amber-800/80'
                  }`}
                >
                  {inspectingRentalBooking.status === 'pending' ? 'Pending Approval' : inspectingRentalBooking.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#262b36] flex gap-2">
              {inspectingRentalBooking.status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (onUpdateBookingStatus) {
                        onUpdateBookingStatus(inspectingRentalBooking.id, 'approved', { notificationMessage: 'Your vehicle has been successfully booked.' });
                      }
                      setInspectingRentalBooking(null);
                    }}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all"
                  >
                    Approve Reservation ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const adv = inspectingRentalBooking.advanceAmount || (inspectingRentalBooking.fareBreakdown as any)?.advanceAmount || 1000;
                      if (onUpdateBookingStatus) {
                        onUpdateBookingStatus(inspectingRentalBooking.id, 'cancelled', {
                          cancelledBy: 'admin',
                          cancellationReason: 'Reservation declined by Admin',
                          refundAmount: adv,
                          cancellationFee: 0,
                          paymentStatus: 'refunded'
                        });
                      }
                      setInspectingRentalBooking(null);
                    }}
                    className="px-4 py-3 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 font-bold text-xs transition-all"
                  >
                    Decline ✕
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setInspectingRentalBooking(null)}
                className={`${inspectingRentalBooking.status === 'pending' ? 'px-4' : 'w-full'} py-3 rounded-xl bg-[#0d1017] hover:bg-[#1a1f2c] text-slate-300 border border-[#262b36] font-bold text-xs transition-colors`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fleet Extension Decline Modal */}
      {declineModalExt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#14171f] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#262b36] space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-[#262b36] pb-3">
              <div className="flex items-center gap-2 text-rose-300">
                <h3 className="text-base font-black">Decline Rental Extension</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeclineModalExt(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-full hover:bg-[#1a1f2c] transition-colors"
              >
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Decline extension request for booking <span className="font-bold text-slate-100">{declineModalExt.bookingRef || declineModalExt.bookingId}</span> ({declineModalExt.vehicleModel}). The scheduled return date will remain <span className="font-bold text-slate-100">{declineModalExt.originalReturnDate}</span> without fee adjustments.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Reason for Declining (Visible to Customer)
              </label>
              <textarea
                rows={3}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Explain why extension cannot be accommodated..."
                className="w-full p-3 text-xs border border-[#262b36] rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                disabled={Boolean(adminExtensionProcessingId)}
                onClick={handleDeclineExt}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                {adminExtensionProcessingId === declineModalExt.id ? 'Declining...' : 'Confirm Decline'}
              </button>
              <button
                type="button"
                onClick={() => setDeclineModalExt(null)}
                className="px-4 py-2.5 bg-[#0d1017] hover:bg-[#1a1f2c] text-slate-300 border border-[#262b36] rounded-xl font-bold text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
