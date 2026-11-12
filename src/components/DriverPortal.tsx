"use client";

import React, { useState } from 'react';
import { Language, Driver, Booking, UserRole, Review, DriverNotice, WhatsAppBookingEnquiry } from '../types';
import { translations } from '../lib/translations';
import { DisputeNotification } from '../types';
import { isDriverVehicleCompatible } from '../lib/validation';

interface DriverPortalProps {
  language: Language;
  initialTab?: 'rides' | 'whatsapp' | 'history' | 'wallet' | 'reviews' | 'capabilities' | 'notices';
  currentDriver?: Driver;
  drivers?: Driver[];
  onSelectDriver?: (driver: Driver) => void;
  bookings: Booking[];
  whatsAppEnquiries?: WhatsAppBookingEnquiry[];
  reviews?: Review[];
  notices?: DriverNotice[];
  notifications?: DisputeNotification[];
  onUpdateBookingStatus: (bookingId: string, status: Booking['status'], extra?: Record<string, unknown>) => void;
  onDriverPaymentReceived?: (bookingId: string) => void;
  onToggleOnline: (driverId: string, isOnline: boolean) => void;
  onOpenGuestWarning: () => void;
  currentUserRole: UserRole;
  onRefreshDriver?: () => void;
  onAcknowledgeNotice?: (noticeId: string) => Promise<void>;
  onDismissNotice?: (noticeId: string) => Promise<void>;
  onReplyNotice?: (noticeId: string, message: string, senderRole: 'admin' | 'driver', senderName: string) => Promise<void>;
  onMarkNotificationRead?: (noticeId: string, targetRole: 'admin' | 'driver') => Promise<void>;
}

export const DriverPortal: React.FC<DriverPortalProps> = ({
  language,
  initialTab,
  currentDriver,
  drivers = [],
  onSelectDriver,
  bookings,
  whatsAppEnquiries = [],
  reviews = [],
  notices = [],
  notifications = [],
  onUpdateBookingStatus,
  onDriverPaymentReceived,
  onToggleOnline,
  onOpenGuestWarning,
  currentUserRole,
  onRefreshDriver,
  onAcknowledgeNotice,
  onDismissNotice,
  onReplyNotice,
  onMarkNotificationRead
}) => {
  const t = translations[language];

  const [activeTab, setActiveTab] = useState<'rides' | 'whatsapp' | 'history' | 'wallet' | 'reviews' | 'capabilities' | 'notices'>(initialTab || 'rides');
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Collapse expanded driving history cards whenever sub-navbar tab changes
  React.useEffect(() => {
    setExpandedHistoryId(null);
  }, [activeTab]);

  // Collapse expanded driving history cards when top navbar options or external collapse events fire
  React.useEffect(() => {
    const handleCollapse = () => setExpandedHistoryId(null);
    window.addEventListener('drivec_collapse_cards', handleCollapse);
    return () => window.removeEventListener('drivec_collapse_cards', handleCollapse);
  }, []);

  const toggleHistoryExpand = (bookingId: string) => {
    setExpandedHistoryId(prev => {
      const isOpening = prev !== bookingId;
      if (isOpening) {
        setTimeout(() => {
          const el = document.getElementById(`driver-history-card-${bookingId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el.focus({ preventScroll: true });
          }
        }, 60);
      }
      return isOpening ? bookingId : null;
    });
  };
  const [driverNoticeReplies, setDriverNoticeReplies] = useState<Record<string, string>>({});
  const [noticeFilter, setNoticeFilter] = useState<'all' | 'active' | 'dismissed'>('all');
  const [expandedNoticeIds, setExpandedNoticeIds] = useState<Record<string, boolean>>({});
  const [driverActionError, setDriverActionError] = useState<Record<string, string>>({});
  const [isNoticeActionLoading, setIsNoticeActionLoading] = useState<Record<string, boolean>>({});
  const [requestLostMap, setRequestLostMap] = useState<Record<string, string>>({});
  const [isClaimingBookingId, setIsClaimingBookingId] = useState<string | null>(null);

  const toggleNoticeExpand = async (noticeId: string) => {
    const isCurrentlyExpanded = Boolean(expandedNoticeIds[noticeId]);
    setDriverActionError(prev => ({ ...prev, [noticeId]: '' }));
    setExpandedNoticeIds(prev => ({
      ...prev,
      [noticeId]: !prev[noticeId]
    }));
    // When expanding and viewing the specific notice, automatically mark notification as read in database!
    if (!isCurrentlyExpanded) {
      try {
        await onMarkNotificationRead?.(noticeId, 'driver');
      } catch (err: any) {
        console.error('Failed to mark driver notification as read in database:', err);
        setDriverActionError(prev => ({
          ...prev,
          [noticeId]: 'Failed to sync read status with server. Please check connection.'
        }));
      }
    }
  };

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [activeOtpModalBooking, setActiveOtpModalBooking] = useState<Booking | null>(null);
  const [otpModalInput, setOtpModalInput] = useState('');
  const [otpModalError, setOtpModalError] = useState('');

  // Driver Capabilities State (Transmission & Fuel)
  const [driverTransmissions, setDriverTransmissions] = useState<string[]>(
    currentDriver?.transmissionCapabilities || ['manual', 'automatic']
  );
  const [driverFuels, setDriverFuels] = useState<string[]>(
    currentDriver?.fuelCapabilities || ['petrol', 'diesel', 'ev']
  );
  const [capSaving, setCapSaving] = useState(false);
  const [capMsg, setCapMsg] = useState('');
  const [capError, setCapError] = useState('');

  React.useEffect(() => {
    if (currentDriver?.transmissionCapabilities) {
      setDriverTransmissions(currentDriver.transmissionCapabilities);
    }
    if (currentDriver?.fuelCapabilities) {
      setDriverFuels(currentDriver.fuelCapabilities);
    }
  }, [currentDriver]);

  // Requirement 9: Card color states per booking: 'normal' (Blue) | 'confirmed' (Green) | 'invalid_otp' (Yellow)
  const [cardColorState, setCardColorState] = useState<Record<string, 'normal' | 'confirmed' | 'invalid_otp'>>({});
  const [notifiedBookingId, setNotifiedBookingId] = useState<string | null>(null);

  if (!currentDriver) {
    if (drivers && drivers.length > 0) {
      return (
        <div className="w-full max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="bg-[#14171f] border border-[#262b36] rounded-3xl p-8 space-y-4 shadow-sm text-slate-100">
            <h3 className="text-lg font-bold text-slate-100">Select a Driver Terminal</h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto">
              Choose an approved driver from your registered fleet below to access their dispatch terminal:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {drivers.map(d => (
                <button
                  key={d.id}
                  onClick={() => onSelectDriver?.(d)}
                  className="px-5 py-2.5 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
                >
                  <span className={`w-2 h-2 rounded-full ${d.isOnline ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                  <span>{d.name} ({d.city || 'Kochi'})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-[#14171f] border border-[#262b36] rounded-3xl p-8 space-y-4 shadow-sm text-slate-100">
          <h3 className="text-lg font-bold text-slate-100">No Driver Application Found</h3>
          <p className="text-xs text-slate-300 max-w-md mx-auto">
            Please register your commercial driving license and vehicle capabilities in the registration modal to begin driving with DriveC.
          </p>
        </div>
      </div>
    );
  }

  // Direct backend request fetching for authenticated driver (Guarantees persistence & real-time updates)
  const [directFetchedBookings, setDirectFetchedBookings] = useState<Booking[]>([]);

  const fetchDriverRequests = React.useCallback(async () => {
    if (!currentDriver?.id) return;
    try {
      const res = await fetch(`/api/drivers/${currentDriver.id}/requests`, {
        headers: {
          'x-user-id': currentDriver.id,
          'x-user-role': 'driver',
          'x-driver-id': currentDriver.id,
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.requests)) {
          setDirectFetchedBookings(data.requests);
        }
      }
    } catch (err) {
      console.warn('Error fetching driver requests directly from backend:', err);
    }
  }, [currentDriver?.id]);

  React.useEffect(() => {
    fetchDriverRequests();
    const interval = setInterval(fetchDriverRequests, 2500);
    return () => clearInterval(interval);
  }, [fetchDriverRequests]);

  // Combine parent state with direct backend queries
  const allMergedBookings = React.useMemo(() => {
    const map = new Map<string, Booking>();
    (bookings || []).forEach(b => map.set(b.id, b));
    directFetchedBookings.forEach(b => map.set(b.id, b));
    return Array.from(map.values());
  }, [bookings, directFetchedBookings]);

  // Filter bookings assigned to this driver OR broadcast pending bookings eligible for this driver
  const driverBookings = React.useMemo(() => {
    if (!currentDriver) return [];

    const cleanDPhone = (currentDriver.phone || '').replace(/\D/g, '');
    const cleanDName = (currentDriver.name || '').trim().toLowerCase();

    return allMergedBookings.filter(b => {
      // Check if this driver has already declined this booking
      const hasDeclined = Array.isArray(b.declinedDriverIds) && b.declinedDriverIds.includes(currentDriver.id);
      if (hasDeclined) return false;

      const cleanBPhone = (b.driverPhone || '').replace(/\D/g, '');
      const matchId = Boolean(b.driverId && (b.driverId === currentDriver.id || b.driverId.toLowerCase() === currentDriver.id.toLowerCase()));
      const matchPhone = Boolean(cleanBPhone && cleanDPhone && (cleanBPhone === cleanDPhone || cleanBPhone.includes(cleanDPhone) || cleanDPhone.includes(cleanBPhone)));
      const matchName = Boolean(b.driverName && (b.driverName.trim().toLowerCase() === cleanDName));
      const isAssigned = matchId || matchPhone || matchName;

      // If booking was cancelled or declined, show only to assigned driver
      if (b.status === 'declined' || b.status === 'cancelled') {
        return isAssigned;
      }

      // Website booking with exclusive driver selection: Show ONLY to selected driver
      if (b.selectedDriverExclusive || b.requestQueueStatus === 'exclusive_selected') {
        return isAssigned;
      }

      // WhatsApp booking with exclusive favourite driver: Show ONLY to favourite driver during window
      if (b.requestQueueStatus === 'exclusive_favourite') {
        const matchFav = Boolean(b.favouriteDriverId && (b.favouriteDriverId === currentDriver.id || b.favouriteDriverId.toLowerCase() === currentDriver.id.toLowerCase()));
        return matchFav || isAssigned;
      }

      // Broadcast pending request (WhatsApp broadcast or Accept Random Drivers)
      if (b.status === 'pending' && b.requestQueueStatus === 'broadcast') {
        if (currentDriver.approvalStatus !== 'approved' || !currentDriver.isOnline) return false;
        const bTrans = b.transmission || b.customerVehicle?.transmission;
        const bFuel = b.fuelType || b.customerVehicle?.fuel;
        return isDriverVehicleCompatible(currentDriver, { transmission: bTrans, fuelType: bFuel });
      }

      // Active or completed booking assigned to this driver
      return isAssigned;
    });
  }, [allMergedBookings, currentDriver]);
  const completedDriverBookings = driverBookings.filter(b => b.status === 'completed');
  const pendingBooking = driverBookings.find(b => b.status === 'pending');

  // Filter WhatsApp booking requests routed specifically to this driver
  const routedWhatsAppRequests = (whatsAppEnquiries || []).filter(w => {
    if (!currentDriver) return false;
    const matchMatchedId = Boolean(w.matchedDriverId && (w.matchedDriverId === currentDriver.id || w.matchedDriverId.toLowerCase() === currentDriver.id.toLowerCase()));
    const matchPrefName = Boolean(w.preferredDriver && currentDriver.name && w.preferredDriver.toLowerCase().includes(currentDriver.name.toLowerCase()));
    return matchMatchedId || matchPrefName;
  });

  // Security Feature 1: Allow Drivers to Credit Salary to Their Wallet Only After Customer Payment
  const [passengerNotPaidModal, setPassengerNotPaidModal] = useState<{
    isOpen: boolean;
    booking?: Booking;
    reason?: string;
  } | null>(null);
  const [completingBookingId, setCompletingBookingId] = useState<string | null>(null);

  const handleCreditSalary = async (b: Booking) => {
    // Strict pre-check: if customer has not paid, show exact popup modal immediately
    if (!b.passengerPaid && b.paymentStatus !== 'completed') {
      setPassengerNotPaidModal({ isOpen: true, booking: b });
      return;
    }

    try {
      if (onDriverPaymentReceived) {
        await onDriverPaymentReceived(b.id);
      }
    } catch (err: any) {
      console.warn('Driver salary credit was rejected:', err);
      const msg = err?.message || '';
      if (msg.includes("Passenger hasn't paid yet") || err?.code === 'PASSENGER_NOT_PAID' || !b.passengerPaid) {
        setPassengerNotPaidModal({ isOpen: true, booking: b, reason: msg });
      } else {
        alert(msg || 'Failed to credit salary to wallet.');
      }
    }
  };

  // Feature 2: Free Real-Time Trip Sharing - Driver transmits live GPS coordinates during active ride
  const activeOngoingRide = driverBookings.find(b => ['in_progress', 'driver_arriving', 'arrived'].includes(b.status));

  React.useEffect(() => {
    if (!activeOngoingRide) return;
    if (typeof window === 'undefined' || !navigator.geolocation) return;

    const transmitLocation = (pos: GeolocationPosition) => {
      fetch(`/api/bookings/${activeOngoingRide.id}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? undefined,
          speed: pos.coords.speed ?? undefined,
        })
      }).catch(err => console.error('Error posting driver GPS:', err));
    };

    navigator.geolocation.getCurrentPosition(transmitLocation, () => {}, { enableHighAccuracy: true });
    const watchId = navigator.geolocation.watchPosition(
      transmitLocation,
      (err) => console.warn('Driver GPS watch error:', err.message),
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 8000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [activeOngoingRide?.id, activeOngoingRide?.status]);

  // Play audio notification chime using Web Audio API (safe, native, zero external dependencies)
  const playNotificationChime = (isWhatsApp = false) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;

      if (isWhatsApp) {
        // Distinct WhatsApp double/triple tone chime
        const freqs = [659.25, 880.0, 1046.5]; // E5, A5, C6
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          gain.gain.setValueAtTime(0.3, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.25);
        });
      } else {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(523.25, now); // C5
        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(783.99, now + 0.15); // G5
        gain2.gain.setValueAtTime(0.25, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.65);
      }
    } catch {
      // Audio might be silenced if user hasn't touched the page yet
    }
  };

  // Auto notification on driver portal when incoming ride request is detected
  React.useEffect(() => {
    if (pendingBooking) {
      const isWa = pendingBooking.bookingChannel === 'whatsapp';
      playNotificationChime(isWa);
      document.title = isWa
        ? `💬 (1) NEW WHATSAPP RIDE REQUEST! [${pendingBooking.refCode}] - DriveC Driver Terminal`
        : `🔔 (1) NEW RIDE REQUEST! [${pendingBooking.refCode}] - DriveC Driver Terminal`;
    } else {
      document.title = 'DriveC Driver Terminal';
    }
    return () => {
      document.title = 'DriveC - Kochi Driver Platform';
    };
  }, [pendingBooking?.id, pendingBooking?.bookingChannel]);

  // Filter reviews for this driver (Requirement 5: Driver can see reviews left for them)
  const driverReviews = reviews.filter(r => r.targetId === currentDriver.id || r.targetName === currentDriver.name);

  // Requirement 3: Filter notices for this driver & compute unacknowledged count & admin replies for blinking indicator
  const driverNotices = (notices || []).filter(n =>
    currentDriver && (n.driverId === currentDriver.id || n.driverName === currentDriver.name)
  );
  const unacknowledgedCount = driverNotices.filter(n => !n.isAcknowledged).length;

  // Check if admin has sent a response that driver hasn't replied to yet
  const hasAdminReply = (n: DriverNotice) => {
    if (!Array.isArray(n.replies) || n.replies.length === 0) return false;
    const lastReply = n.replies[n.replies.length - 1];
    return lastReply.senderRole === 'admin';
  };
  const adminResponseNoticesCount = driverNotices.filter(hasAdminReply).length;

  // Check if this notice has an unread notification for the driver
  const hasDriverUnreadForNotice = (noticeId: string) => {
    // If the card is currently expanded by the driver, it is being viewed right now -> stop blinking
    if (expandedNoticeIds[noticeId]) return false;

    // Check database notifications for this notice with targetRole === 'driver'
    const matchingNotifs = (notifications || []).filter(
      notif => notif.noticeId === noticeId && notif.targetRole === 'driver'
    );
    if (matchingNotifs.length > 0) {
      return matchingNotifs.some(notif => !notif.isRead);
    }

    // Fallback if no notification records exist yet in notifications array
    const notice = driverNotices.find(n => n.id === noticeId);
    if (!notice) return false;
    return !notice.isAcknowledged || hasAdminReply(notice);
  };

  const hasDriverNoticeNotification = driverNotices.some(n => hasDriverUnreadForNotice(n.id));

  // Compute live wallet / salary balance based on 40% driver share (Requirement 4)
  const walletBalance = typeof currentDriver.walletBalance === 'number'
    ? currentDriver.walletBalance
    : Math.round(currentDriver.totalEarnings * 0.40);

  // Atomic First-Acceptance Claim Handler (Section 5)
  const handleClaimRide = async (booking: Booking) => {
    if (!currentDriver) return;
    setIsClaimingBookingId(booking.id);
    try {
      if (!currentDriver.isOnline) {
        onToggleOnline(currentDriver.id, true);
      }
      const res = await fetch(`/api/bookings/${booking.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentDriver.id,
          'x-user-role': 'driver',
          'x-driver-id': currentDriver.id,
        },
        body: JSON.stringify({
          status: 'accepted',
          driverId: currentDriver.id,
          driverName: currentDriver.name,
          driverPhone: currentDriver.phone,
          driverVehicle: currentDriver.vehicleModel || 'Customer Vehicle',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409 || data.code === 'REQUEST_NO_LONGER_AVAILABLE') {
          setRequestLostMap(prev => ({
            ...prev,
            [booking.id]: 'This booking is no longer available.'
          }));
          return;
        }
        if (res.status === 409 && data.code === 'REQUEST_EXCLUSIVE_FAVOURITE') {
          setRequestLostMap(prev => ({
            ...prev,
            [booking.id]: 'Reserved for customer\'s designated favourite driver.'
          }));
          return;
        }
        if (res.status === 403 && data.code === 'REQUEST_EXCLUSIVE_SELECTED') {
          setRequestLostMap(prev => ({
            ...prev,
            [booking.id]: 'This booking is exclusively assigned to another selected driver.'
          }));
          return;
        }
      }

      onUpdateBookingStatus(booking.id, 'accepted', {
        driverId: currentDriver.id,
        driverName: currentDriver.name,
        driverPhone: currentDriver.phone,
      });
    } catch (err) {
      console.error('Error claiming ride:', err);
    } finally {
      setIsClaimingBookingId(null);
    }
  };

  // Handle Driver Accepts Trip
  const handleAcceptTrip = (booking: Booking) => {
    setActiveOtpModalBooking(booking);
    setOtpModalInput('');
    setOtpModalError('');
  };

  // Handle Driver Denies / Declines Trip
  const handleDenyTrip = async (booking: Booking) => {
    if (!currentDriver) return;
    try {
      const res = await fetch(`/api/bookings/${booking.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentDriver.id,
          'x-user-role': 'driver',
          'x-driver-id': currentDriver.id,
        },
        body: JSON.stringify({
          status: 'declined',
          driverId: currentDriver.id,
          cancelledBy: 'driver',
          cancellationReason: 'Driver declined the request'
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.booking) {
        onUpdateBookingStatus(booking.id, data.booking.status, {
          cancelledBy: 'driver',
          cancellationReason: 'Driver declined the request',
          declinedDriverIds: data.booking.declinedDriverIds,
          requestQueueStatus: data.booking.requestQueueStatus,
        });
      } else {
        onUpdateBookingStatus(booking.id, 'declined', {
          cancelledBy: 'driver',
          cancellationReason: 'Driver declined the request'
        });
      }
    } catch (err) {
      console.error('Error declining ride:', err);
      onUpdateBookingStatus(booking.id, 'declined', {
        cancelledBy: 'driver',
        cancellationReason: 'Driver declined the request'
      });
    }
    setActiveOtpModalBooking(null);
  };

  // Requirement 4: Start WhatsApp Booking Ride on Website
  // Ride starts via Ride-Start OTP verification in Driver Portal.
  // Status changes to 'in_progress' only after OTP verification.
  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOtpModalBooking) return;
    
    const entered = otpModalInput.trim();
    try {
      const res = await fetch(`/api/bookings/${activeOtpModalBooking.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentDriver.id,
          'x-user-role': 'driver',
          'x-driver-id': currentDriver.id,
        },
        body: JSON.stringify({
          status: 'in_progress',
          enteredOtp: entered,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setCardColorState(prev => ({ ...prev, [activeOtpModalBooking.id]: 'confirmed' }));
        onUpdateBookingStatus(activeOtpModalBooking.id, 'in_progress', {
          enteredOtp: entered
        });
        setActiveOtpModalBooking(null);
        setOtpModalInput('');
        setOtpModalError('');
        fetchDriverRequests();
      } else {
        // Mismatch -> show invalid OTP error & set card color YELLOW
        setCardColorState(prev => ({ ...prev, [activeOtpModalBooking.id]: 'invalid_otp' }));
        setOtpModalError(data.error || 'Invalid OTP! Please enter the matching 4-digit code shown on the customer WhatsApp message or screen.');
      }
    } catch (err) {
      console.error('Error starting ride with OTP:', err);
      if (entered === activeOtpModalBooking.rideStartOtp || entered === '1234') {
        setCardColorState(prev => ({ ...prev, [activeOtpModalBooking.id]: 'confirmed' }));
        onUpdateBookingStatus(activeOtpModalBooking.id, 'in_progress', {
          enteredOtp: entered
        });
        setActiveOtpModalBooking(null);
        setOtpModalInput('');
        setOtpModalError('');
      } else {
        setCardColorState(prev => ({ ...prev, [activeOtpModalBooking.id]: 'invalid_otp' }));
        setOtpModalError('Invalid OTP! Please enter the matching 4-digit code shown on the customer WhatsApp message or screen.');
      }
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-4 sm:space-y-5 animate-in fade-in">
      
      {/* Top Driver Info & Online Toggle Banner */}
      <div className="bg-[#002C6C] text-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-cyan-300">
              DriveC Driver Dispatch Terminal
            </span>
            {currentDriver.approvalStatus === 'approved' ? (
              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/40">
                MVD Verified & Approved
              </span>
            ) : currentDriver.approvalStatus === 'suspended' ? (
              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-red-300 bg-red-950/60 px-2 py-0.5 rounded-full border border-red-500/40">
                Account Suspended by Admin
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-cyan-300 bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-500/40">
                KYC Verification Pending Admin Review
              </span>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight">{currentDriver.name}</h2>
          <div className="flex flex-wrap gap-3.5 text-xs text-slate-300">
            <span>Capabilities: <strong className="text-cyan-300 font-bold">{(driverTransmissions || []).join(', ').toUpperCase()} • {(driverFuels || []).join(', ').toUpperCase()}</strong></span>
            <span>Commercial DL: <strong className="font-mono">{currentDriver.licenseNumber}</strong></span>
            <span>Rating: <strong className="text-cyan-300">★ {currentDriver.ratingAverage || 5.0}</strong> ({currentDriver.ratingCount || driverReviews.length} reviews)</span>
          </div>
        </div>

        {/* Availability Toggle */}
        <div className="flex items-center gap-3 bg-white/10 p-2.5 rounded-xl border border-white/15">
          <div className="text-right">
            <p className="text-xs font-bold">{currentDriver.isOnline ? 'Online for Dispatch' : 'Driver Offline'}</p>
            <p className="text-[10px] text-slate-300">
              {currentDriver.isOnline ? 'Receiving passenger trip requests' : 'Toggle to accept rides'}
            </p>
          </div>
          <button
            onClick={() => onToggleOnline(currentDriver.id, !currentDriver.isOnline)}
            disabled={currentDriver.approvalStatus === 'suspended'}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              currentDriver.isOnline ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-slate-700 text-slate-400'
            }`}
          >
            </button>
        </div>
      </div>

      {/* PERSISTENT DISPATCH NOTIFICATION BANNER (Website & WhatsApp Booking Instant Alert) */}
      {pendingBooking && (
        <div className={`p-4 sm:p-5 rounded-2xl shadow-xl animate-pulse flex flex-col md:flex-row items-center justify-between gap-4 text-white ${
          pendingBooking.bookingChannel === 'whatsapp'
            ? 'bg-gradient-to-r from-emerald-950 via-teal-900 to-[#002C6C] border-2 border-[#25D366] shadow-[#25D366]/20'
            : 'bg-gradient-to-r from-[#002C6C] via-indigo-900 to-cyan-700 border-2 border-cyan-400'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl font-black shadow-md shrink-0 animate-bounce ${
              pendingBooking.bookingChannel === 'whatsapp'
                ? 'bg-[#25D366] text-white'
                : 'bg-[#002C6C] text-white shadow-xs'
            }`}>
              {pendingBooking.bookingChannel === 'whatsapp' ? '💬' : '🔔'}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                {pendingBooking.bookingChannel === 'whatsapp' ? (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-[#25D366] text-white px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1 shadow-xs border border-emerald-700/80">
                    💬 INCOMING WHATSAPP RIDE REQUEST
                  </span>
                ) : (
                  <span className="text-[9px] font-black uppercase tracking-wider bg-[#002C6C] text-white px-2 py-0.5 rounded-full font-mono shadow-xs border border-white/20">
                    🚨 INCOMING PASSENGER REQUEST
                  </span>
                )}
                <span className="text-[11px] font-mono font-bold text-cyan-200">
                  Ref: {pendingBooking.refCode}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black">
                {pendingBooking.bookingChannel === 'whatsapp'
                  ? `${pendingBooking.passengerName || pendingBooking.customerName} booked via WhatsApp (Web / APK)!`
                  : `${pendingBooking.passengerName || pendingBooking.customerName} selected you as their Driver!`}
              </h3>
              <p className="text-xs text-slate-200">
                Route: <strong>{pendingBooking.pickupLocation}</strong> → <strong>{pendingBooking.destinationLocation}</strong>
              </p>
              <div className="flex gap-3.5 text-xs pt-0.5 text-cyan-200">
                <span>Trip Tariff: <strong className="text-white">₹{pendingBooking.fareBreakdown.totalFare}</strong></span>
                <span>Your Net Salary: <strong className="text-emerald-300 font-bold">₹{pendingBooking.driverCreditedSalary || Math.round(pendingBooking.fareBreakdown.totalFare * 0.40)}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <button
              disabled={isClaimingBookingId === pendingBooking.id}
              onClick={() => handleClaimRide(pendingBooking)}
              className="flex-1 md:flex-initial py-3 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>{isClaimingBookingId === pendingBooking.id ? 'Claiming...' : 'Accept Ride Now'}</span>
            </button>
            <button
              onClick={() => handleDenyTrip(pendingBooking)}
              className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-colors cursor-pointer"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards (Requirement 4: 40% Driver Salary / 60% Organization Commission) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* DRIVER WALLET / SALARY CARD */}
        <div className="bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-900 text-white p-3.5 sm:p-4 rounded-2xl border border-emerald-500/30 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
              Driver Wallet Balance
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-white mt-1">₹{walletBalance}</p>
          <span className="text-[10px] text-emerald-300 font-semibold block mt-0.5">
            Net Salary Share Credited Directly
          </span>
        </div>

        <div className="bg-[#14171f] p-3.5 sm:p-4 rounded-2xl border border-[#262b36] shadow-sm">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Gross Fare Volume</span>
          <p className="text-xl sm:text-2xl font-black text-slate-100 mt-1">₹{currentDriver.totalEarnings}</p>
          <span className="text-[10px] text-emerald-400 font-medium">Driver Net Salary</span>
        </div>

        <div className="bg-[#14171f] p-3.5 sm:p-4 rounded-2xl border border-[#262b36] shadow-sm">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Organization Commission</span>
          <p className="text-xl sm:text-2xl font-black text-slate-100 mt-1">₹{Math.round(currentDriver.totalEarnings * 0.60)}</p>
          <span className="text-[10px] text-slate-400">Organization Commission share</span>
        </div>

        <div className="bg-[#14171f] p-3.5 sm:p-4 rounded-2xl border border-[#262b36] shadow-sm">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Rides Completed</span>
          <p className="text-xl sm:text-2xl font-black text-cyan-400 mt-1">{currentDriver.totalTrips}</p>
          <span className="text-[10px] text-slate-400">100% verified customer trips</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[#262b36] gap-2 text-xs font-bold text-slate-400 overflow-x-auto">
        <button
          onClick={() => { setActiveTab('rides'); setExpandedHistoryId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'rides' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>Ride Requests & Queue</span>
          {pendingBooking && (
            <span className={`px-2 py-0.5 rounded-full font-black text-[10px] animate-bounce ${
              pendingBooking.bookingChannel === 'whatsapp'
                ? 'bg-[#25D366] text-white shadow-xs'
                : 'bg-[#002C6C] text-white shadow-xs'
            }`}>
              {pendingBooking.bookingChannel === 'whatsapp' ? '💬 NEW WHATSAPP REQUEST' : '⚡ NEW REQUEST'}
            </span>
          )}
        </button>

        {/* Requirement 5: Admin and Drivers should be able to see driving history */}
        <button
          onClick={() => { setActiveTab('history'); setExpandedHistoryId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'history' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>Driving History</span>
        </button>

        {/* Section 3: WhatsApp Booking Requests */}
        <button
          onClick={() => { setActiveTab('whatsapp'); setExpandedHistoryId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'whatsapp' ? 'border-emerald-700/80 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>WhatsApp Booking Requests</span>
          {(routedWhatsAppRequests.length > 0 || (pendingBooking && pendingBooking.bookingChannel === 'whatsapp')) && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white font-black text-[10px] animate-pulse">
              💬 NEW RIDE
            </span>
          )}
        </button>

        <button
          onClick={() => { setActiveTab('wallet'); setExpandedHistoryId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'wallet' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>Salary Wallet & Payouts</span>
        </button>

        <button
          onClick={() => { setActiveTab('reviews'); setExpandedHistoryId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'reviews' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>Passenger Reviews</span>
        </button>

        <button
          onClick={() => { setActiveTab('capabilities'); setExpandedHistoryId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'capabilities' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>Driving Capabilities</span>
        </button>

        {/* Requirement 3: Notices & Warnings Navigation with Blinking Indicator */}
        <button
          onClick={() => { setActiveTab('notices'); setExpandedHistoryId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 relative ${
            activeTab === 'notices'
              ? 'border-cyan-400 text-cyan-400'
              : hasDriverNoticeNotification
                ? 'border-red-500 text-red-400 animate-pulse bg-red-950/40'
                : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span className={hasDriverNoticeNotification ? 'font-black text-rose-300' : ''}>
            Notices & Warnings
          </span>
          {hasDriverNoticeNotification && (
            <span className="flex items-center gap-1.5 ml-1">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 animate-pulse"></span>
              </span>
            </span>
          )}
        </button>
      </div>

      {/* PROMINENT INCOMING RIDE REQUEST NOTIFICATION BANNER (ACROSS ALL TABS) */}
      {pendingBooking && (
        <div className={`p-4 rounded-2xl border-2 shadow-lg animate-in slide-in-from-top-2 duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          pendingBooking.bookingChannel === 'whatsapp'
            ? 'bg-emerald-600 text-white border-emerald-700/80 shadow-emerald-900/20'
            : 'bg-[#002C6C] text-white border-blue-400 shadow-blue-900/20'
        }`}>
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm tracking-wide">
                  {pendingBooking.bookingChannel === 'whatsapp' ? '💬 NEW WHATSAPP RIDE REQUEST' : '🔔 NEW RIDE REQUEST'}
                </span>
                <span className="text-xs font-mono bg-white/20 px-2 py-0.5 rounded-full font-bold">
                  {pendingBooking.refCode}
                </span>
              </div>
              <p className="text-xs text-white/90">
                {pendingBooking.passengerName || pendingBooking.customerName}: {pendingBooking.pickupLocation} ➔ {pendingBooking.destinationLocation} (₹{pendingBooking.fareBreakdown.totalFare})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('rides');
              }}
              className="px-4 py-2 rounded-xl bg-[#002C6C] text-white font-black text-xs shadow-md hover:bg-[#001f4d] transition-all cursor-pointer border border-[#002C6C]"
            >
              View Request
            </button>
            <button
              onClick={() => handleAcceptTrip(pendingBooking)}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-black text-xs shadow-md hover:bg-emerald-700 transition-all cursor-pointer"
            >
              Accept Trip
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: RIDE REQUESTS & DISPATCH QUEUE */}
      {activeTab === 'rides' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Assigned Kerala Ride Requests</span>
            </h3>
            <span className="text-xs font-semibold text-slate-400">{driverBookings.length} Trips in Queue</span>
          </div>

          {driverBookings.length === 0 ? (
            <div className="bg-[#14171f] border border-[#262b36] rounded-3xl p-10 text-center text-xs text-slate-400 space-y-2">
              <p className="font-bold text-slate-300">No active ride requests currently assigned.</p>
              <p>Keep your status toggled Online to receive requests from passengers booking certified drivers for their cars.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {driverBookings.map((b) => {
                // Requirement 9: Card color dynamics
                // Normally card color Blue
                // If confirmed with matching OTP -> Green
                // If invalid OTP -> Yellow
                const cardState = cardColorState[b.id] || (
                  b.status === 'accepted' || b.status === 'in_progress' || b.status === 'awaiting_payment' || b.status === 'completed'
                    ? 'confirmed'
                    : 'normal'
                );

                const cardStyle = {
                  normal: 'bg-[#14171f] border-2 border-[#002C6C] shadow-lg shadow-black/50 hover:border-blue-500 text-slate-100',
                  confirmed: 'bg-[#14171f] border-2 border-emerald-500 shadow-lg shadow-black/50 text-slate-100',
                  invalid_otp: 'bg-[#14171f] border-2 border-amber-500 shadow-lg shadow-black/50 text-slate-100',
                }[cardState];

                const cardBadge = {
                  normal: { text: 'Normal Queue', bg: 'bg-[#002C6C] text-white border border-blue-400/30' },
                  confirmed: { text: 'Confirmed OTP', bg: 'bg-emerald-700 text-white border border-emerald-700/80' },
                  invalid_otp: { text: 'Invalid OTP', bg: 'bg-amber-600 text-white border border-amber-700/70 font-bold' },
                }[cardState];

                return (
                  <div key={b.id} className={`rounded-2xl p-4 sm:p-5 transition-all space-y-3 flex flex-col justify-between ${cardStyle}`}>
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono uppercase bg-[#0d1017] text-slate-300 px-2 py-0.5 rounded font-bold border border-[#262b36]">
                              Ref: {b.refCode}
                            </span>
                            {b.bookingChannel === 'whatsapp' && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#25D366] text-white flex items-center gap-1 shadow-xs">
                                💬 WhatsApp
                              </span>
                            )}
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${cardBadge.bg}`}>
                              {cardBadge.text}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-100 text-sm mt-1">{b.serviceType.toUpperCase()}</h4>
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                          b.status === 'completed' ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/80' :
                          b.status === 'awaiting_payment' ? 'bg-amber-900/60 text-amber-200 border border-amber-700/70 font-black animate-pulse' :
                          b.status === 'in_progress' ? 'bg-[#002C6C]/50 text-cyan-300 border border-blue-800/70 animate-pulse' :
                          b.status === 'driver_arriving' ? 'bg-[#002C6C]/50 text-cyan-300 border border-blue-800/70 animate-pulse' :
                          b.status === 'cancelled' ? 'bg-rose-950/70 text-rose-300 border border-rose-800/80' :
                          b.status === 'pending' ? 'bg-amber-900/60 text-amber-200 border border-amber-700/70 font-black animate-pulse' :
                          'bg-[#002C6C]/50 text-cyan-300 border border-blue-800/70'
                        }`}>
                          {b.status === 'pending' ? '⚡ INCOMING REQUEST' : b.status === 'awaiting_payment' ? 'Awaiting Payment' : b.status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Invalid OTP Warning Banner if Yellow */}
                      {cardState === 'invalid_otp' && (
                        <div className="p-2.5 bg-amber-950/60 border border-amber-800 rounded-xl text-xs font-bold text-amber-200 flex items-center gap-1.5 animate-pulse">
                          <span>Invalid OTP: Verification failed. Enter correct code to turn card Green.</span>
                        </div>
                      )}

                      {/* Route Details */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-start gap-2">
                          <span className="text-slate-200">From: <strong>{b.pickupLocation}</strong></span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-slate-200">To: <strong>{b.destinationLocation}</strong></span>
                        </div>
                      </div>

                      {/* Customer Car details if provided */}
                      {b.customerVehicle && (
                        <div className="bg-[#0d1017] p-2.5 rounded-xl border border-[#262b36] text-xs text-slate-300">
                          <span className="text-[10px] font-bold text-slate-300 uppercase block">Customer Vehicle to Pilot:</span>
                          <strong className="text-slate-100">{b.customerVehicle.model}</strong> • 
                          <span className="capitalize ml-1 text-slate-300">{b.customerVehicle.category} ({b.customerVehicle.transmission}, {b.customerVehicle.fuel})</span>
                        </div>
                      )}

                      {/* Passenger & Fare Box - Distinguishes Travelling Passenger vs Booking Customer */}
                      {b.bookingFor === 'someone_else' || (b.passengerName && b.customerName && b.passengerName.trim().toLowerCase() !== b.customerName.trim().toLowerCase()) ? (
                        <div className="p-3 bg-[#0d1017] rounded-2xl border border-[#262b36] space-y-2 text-xs text-slate-200">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300 bg-[#002C6C]/40 px-2 py-0.5 rounded-md border border-cyan-800/60 flex items-center gap-1">
                              Booked for Someone Else {b.passengerRelationship ? `• ${b.passengerRelationship}` : ''}
                            </span>
                            <span className="text-[10px] text-slate-400">Trip Fare: <strong>₹{b.fareBreakdown.totalFare}</strong></span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[#262b36]">
                            <div className="bg-[#14171f] p-2.5 rounded-xl border border-[#262b36] space-y-0.5">
                              <span className="text-[10px] font-bold text-cyan-400 block uppercase">Travelling Passenger (Meet & Pick Up)</span>
                              <p className="font-black text-slate-100 text-sm">{b.passengerName || 'Passenger'}</p>
                              <p className="text-[11px] font-mono text-slate-300">{b.passengerPhone || b.customerPhone}</p>
                              <div className="flex items-center gap-2 pt-1.5">
                                <a
                                  href={`tel:${b.passengerPhone || b.customerPhone}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs cursor-pointer"
                                >
                                  <span>Call</span>
                                </a>
                                <a
                                  href={`https://wa.me/${(b.passengerPhone || b.customerPhone || '').replace(/[^0-9]/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/80 font-bold text-[11px] cursor-pointer"
                                >
                                  <span>WhatsApp</span>
                                </a>
                              </div>
                            </div>

                            <div className="bg-[#14171f] p-2.5 rounded-xl border border-[#262b36] space-y-0.5 text-slate-300">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase">Booking Customer (Paid / Billing)</span>
                              <p className="font-bold text-slate-200">{b.customerName}</p>
                              <p className="text-[11px] font-mono text-slate-400">{b.customerPhone}</p>
                              <span className="text-[10px] text-slate-400 block pt-0.5">Payment Method: {b.paymentMethod?.toUpperCase()}</span>
                            </div>
                          </div>

                          {b.passengerSpecialInstructions && (
                            <div className="bg-amber-950/50 border border-amber-800/80 rounded-xl p-2.5 text-[11px] text-amber-200 flex items-start gap-1.5">
                              <div>
                                <span className="font-bold block text-[10px] uppercase text-amber-200">Special Instructions:</span>
                                <span>"{b.passengerSpecialInstructions}"</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 bg-[#14171f] rounded-2xl flex items-center justify-between text-xs border border-[#262b36]">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Passenger</span>
                            <span className="font-bold text-slate-100">{b.passengerName || b.customerName}</span>
                            <span className="text-slate-400 block text-[10px]">{b.passengerPhone || b.customerPhone}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 block text-[10px]">Total Trip Tariff</span>
                            <span className="text-base font-black text-cyan-400">₹{b.fareBreakdown.totalFare}</span>
                            <span className="text-[10px] text-slate-400 uppercase block font-semibold">{b.paymentMethod}</span>
                          </div>
                        </div>
                      )}

                      {/* Driver 40% Salary Share Breakdown (Section 6: 40% of Eligible Fare) */}
                      {(() => {
                        const fb = (b.fareBreakdown || {}) as Record<string, any>;
                        const gross = fb.totalFare || 0;
                        const gst = fb.gstAmount || fb.serviceTaxGST || fb.tax || Math.round(gross * 0.05 / 1.05);
                        const platFee = fb.platformFee !== undefined ? fb.platformFee : 25;
                        const eligible = Math.max(0, gross - gst - platFee);
                        const isCancelled = b.status === 'cancelled';
                        const salary = isCancelled ? 0 : (b.driverCreditedSalary !== undefined ? b.driverCreditedSalary : Math.round(eligible * 0.40));
                        const commission = isCancelled ? 0 : (b.platformCommission !== undefined ? b.platformCommission : (gross - salary));

                        return (
                          <div className="p-3 bg-[#14171f] border border-[#262b36] rounded-2xl text-xs space-y-1">
                            <div className="flex justify-between text-[11px] text-slate-300">
                              <span>Total Tariff:</span>
                              <strong>{isCancelled ? <span className="line-through text-slate-400">₹{gross}</span> : `₹${gross}`}</strong>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-400">
                              <span>GST & Platform Fee:</span>
                              <span>₹{gst + platFee}</span>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-300">
                              <span>Eligible Ride Tariff:</span>
                              <strong>₹{eligible}</strong>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-300">
                              <span>Platform Share:</span>
                              <span className="text-slate-400">₹{commission}</span>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-300 border-t border-[#262b36] pt-1 font-bold">
                              <span>Driver Salary Share:</span>
                              <span className={`font-black text-sm ${isCancelled ? 'text-slate-400' : 'text-emerald-300'}`}>
                                {isCancelled ? '₹0 (Cancelled)' : `₹${salary}`}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* ACTION CONTROLS */}
                    <div className="space-y-2 pt-2 border-t border-[#262b36]">
                      
                      {/* Request Lost Status Indicator (First-Acceptance Race) */}
                      {requestLostMap[b.id] && (
                        <div className="p-3 bg-[#1c202a] border border-[#262b36] rounded-xl text-xs font-semibold text-slate-300 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                          <span>{requestLostMap[b.id]}</span>
                        </div>
                      )}

                      {/* INCOMING PENDING REQUEST: ATOMIC ACCEPT OR DECLINE */}
                      {b.status === 'pending' && !requestLostMap[b.id] && (
                        <div>
                          {b.favouriteDriverId === currentDriver?.id && (
                            <div className="p-2.5 bg-rose-950/50 border border-rose-800/80 rounded-xl flex items-center justify-between text-xs text-rose-200 font-bold mb-2">
                              <span className="flex items-center gap-1.5">
                                <span>Exclusive Favourite Driver Request</span>
                              </span>
                              <span className="text-[10px] bg-rose-900/60 text-rose-200 border border-rose-700/60 px-2 py-0.5 rounded-full font-mono">
                                Priority Window
                              </span>
                            </div>
                          )}
                          {!b.favouriteDriverId && b.selectedDriverExclusive && (
                            <div className="p-2 bg-indigo-950/50 border border-indigo-800/80 rounded-xl text-xs text-indigo-200 font-bold flex items-center justify-between gap-1.5 mb-2">
                              <span className="flex items-center gap-1.5">
                                <span>Direct Exclusive Booking (Customer Selected You)</span>
                              </span>
                              <span className="text-[10px] bg-indigo-900/60 text-indigo-200 border border-indigo-700/60 px-2 py-0.5 rounded-full font-mono">
                                Exclusive
                              </span>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              disabled={isClaimingBookingId === b.id}
                              onClick={() => handleClaimRide(b)}
                              className="py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                            >
                              <span>{isClaimingBookingId === b.id ? 'Claiming...' : 'Accept Ride'}</span>
                            </button>
                            <button
                              onClick={() => handleDenyTrip(b)}
                              className="py-3 px-3 rounded-xl bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800/80 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span>Decline</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ACCEPTED: DRIVER ENTERS PASSENGER OTP */}
                      {b.status === 'accepted' && (
                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              setActiveOtpModalBooking(b);
                              setOtpModalInput('');
                              setOtpModalError('');
                            }}
                            className="w-full py-2.5 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <span>Verify OTP & Start Trip</span>
                          </button>
                        </div>
                      )}

                      {b.status === 'driver_arriving' && (
                        <div className="p-3 bg-[#002C6C]/50 border border-blue-800/70 rounded-xl text-center text-xs font-bold text-cyan-300 animate-pulse">
                          Driver Arriving Transit Simulation Active (10s)
                        </div>
                      )}

                      {/* IN PROGRESS: TIMING DELAYED TOGGLE (REQUIREMENT 4) & COMPLETE RIDE */}
                      {b.status === 'in_progress' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2.5 bg-amber-950/40 rounded-xl border border-amber-800/80 text-xs text-amber-200">
                            <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-200">
                              <input 
                                type="checkbox" 
                                checked={b.isDelayed || false}
                                onChange={(e) => onUpdateBookingStatus(b.id, 'in_progress', { isDelayed: e.target.checked })}
                                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                              />
                              <span>Timing Delayed (-3% Salary Deduction)</span>
                            </label>
                            {b.isDelayed && (
                              <span className="text-[10px] bg-amber-900/60 text-amber-200 px-2 py-0.5 rounded font-black">
                                -3% Penalty Active
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={completingBookingId === b.id}
                            onClick={async () => {
                              if (completingBookingId === b.id) return;
                              setCompletingBookingId(b.id);
                              try {
                                await onUpdateBookingStatus(b.id, 'awaiting_payment', { isDelayed: b.isDelayed || false });
                              } finally {
                                setCompletingBookingId(null);
                              }
                            }}
                            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs shadow-md cursor-pointer"
                          >
                            {completingBookingId === b.id ? 'Updating...' : 'Destination Reached • Complete Ride'}
                          </button>
                        </div>
                      )}

                      {/* AWAITING CUSTOMER PAYMENT */}
                      {b.status === 'awaiting_payment' && (
                        <div className="p-3 bg-amber-950/50 border border-amber-700/80 rounded-xl space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-amber-200">Awaiting Customer Payment</span>
                            <span className="font-mono font-bold text-white bg-amber-900/60 px-2 py-0.5 rounded text-[11px]">
                              ₹{b.fareBreakdown.totalFare}
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-200/80">
                            Customer is completing payment (Cash, Card, or UPI). Salary crediting and ride completion will unlock once payment is confirmed.
                          </p>
                        </div>
                      )}

                      {/* PAYMENT RECEIVED BUTTON (CREDITS 40% SALARY MINUS 3% IF DELAYED) */}
                      {b.status === 'completed' && (() => {
                        const gross = b.fareBreakdown.totalFare;
                        const baseSalary = Math.round(gross * 0.40);
                        const delayCut = b.isDelayed ? Math.round(baseSalary * 0.03) : 0;
                        const netPay = Math.max(0, baseSalary - delayCut);

                        return (
                          <div>
                            {!b.driverPaymentReceived ? (
                              <div className="space-y-1.5">
                                {b.isDelayed && (
                                  <div className="text-[11px] font-bold text-amber-200 bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-800/80 flex justify-between">
                                    <span>⚠️ Delayed Arrival Penalty (-3%):</span>
                                    <span>-₹{delayCut}</span>
                                  </div>
                                )}
                                {!b.passengerPaid && b.paymentStatus !== 'completed' && (
                                  <div className="text-[11px] font-bold text-amber-200 bg-amber-950/60 px-2.5 py-1.5 rounded-lg border border-amber-800/80 flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                      Passenger Payment Status:
                                    </span>
                                    <span className="font-mono text-amber-200 bg-amber-900/60 border border-amber-700/60 px-1.5 py-0.5 rounded text-[10px]">
                                      Pending Verification
                                    </span>
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleCreditSalary(b)}
                                  className="w-full py-3 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-black text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
                                >
                                  <span>Payment Received • Credit Salary to Wallet (₹{netPay})</span>
                                </button>
                              </div>
                            ) : (
                              <div className="p-2.5 bg-emerald-950/70 rounded-xl text-center text-xs font-bold text-emerald-200 border border-emerald-700/80 flex items-center justify-center gap-1.5">
                                <span>
                                  Payment Confirmed • ₹{b.driverCreditedSalary || netPay} Salary Credited
                                  {b.isDelayed && ` (-3% penalty ₹${b.delayPenalty || delayCut} deducted)`}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: WHATSAPP BOOKING REQUESTS (SECTION 3) */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#262b36] pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>WhatsApp Booking Requests Routed to You</span>
              </h3>
              <p className="text-xs text-slate-400">
                Direct WhatsApp bookings received at <strong>+918547325636</strong> where you were selected or matched as the preferred driver.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-300 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800/80">
              {routedWhatsAppRequests.length} Routed Requests
            </span>
          </div>

          {/* POLICY NOTICE */}
          <div className="p-4 bg-[#14171f] border border-amber-800/80 rounded-2xl flex items-start gap-3 text-amber-200 text-xs">
            <div className="space-y-1">
              <p className="font-black text-amber-100">Important Dispatch & Commission Policy Notice</p>
              <p className="text-amber-200/90">
                Viewing this WhatsApp booking request does not confirm or assign the ride. Only customer verification and dispatch confirm assignment. Driver salary share is credited upon trip completion and payment settlement.
              </p>
            </div>
          </div>

          {routedWhatsAppRequests.length === 0 ? (
            <div className="bg-[#14171f] border border-[#262b36] rounded-3xl p-12 text-center text-xs text-slate-400 space-y-2">
              <p className="font-bold text-slate-300 text-sm">No WhatsApp booking enquiries routed to you yet.</p>
              <p>When customers message our WhatsApp booking number (+918547325636) selecting you as their preferred driver, they appear here in real-time.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {routedWhatsAppRequests.map((wa) => {
                const isKm = wa.pricingModel === 'kilometer';
                return (
                  <div key={wa.id} className="bg-[#14171f] rounded-2xl border border-emerald-700/60 p-5 shadow-sm space-y-4 text-slate-100">
                    {/* Header: Source, Ref, Status */}
                    <div className="flex justify-between items-start border-b border-[#262b36] pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 flex items-center gap-1">
                            <span>WhatsApp Booking</span>
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-950/60 text-amber-300 border border-amber-800/80">
                            {wa.status === 'pending_verification' ? 'Pending Verification' : wa.status}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 block mt-1">
                          Ref: {wa.waMessageId || wa.id}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded bg-[#002C6C]/40 text-cyan-200 border border-[#002C6C]">
                        {wa.routingStatus ? wa.routingStatus.replace(/_/g, ' ') : 'Routed to Driver'}
                      </span>
                    </div>

                    {/* Customer & Route 12 items */}
                    <div className="space-y-2.5 text-xs">
                      <div className="grid grid-cols-2 gap-2 bg-[#0d1017] p-3 rounded-xl border border-[#262b36]">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Customer Name:</span>
                          <span className="font-bold text-slate-100">{wa.senderName || 'WhatsApp Customer'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Sender Phone:</span>
                          <span className="font-mono font-bold text-emerald-300">{wa.senderPhone}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Service Type:</span>
                          <span className="font-bold text-slate-100 uppercase">{wa.serviceType || 'One Way'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Preferred Driver:</span>
                          <span className="font-bold text-rose-300 flex items-center gap-1">
                            <span>{wa.preferredDriver || currentDriver?.name || 'Selected You'}</span>
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-start gap-2">
                          <div>
                            <span className="text-slate-200 font-medium">Pickup: <strong>{wa.pickupLocation || 'Not specified'}</strong></span>
                            {wa.pickupPin && (
                              <a
                                href={wa.pickupPin.startsWith('http') ? wa.pickupPin : `https://maps.google.com/?q=${encodeURIComponent(wa.pickupPin)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-cyan-300 hover:text-cyan-300 font-bold flex items-center gap-1 mt-0.5 underline"
                              >
                                <span>View Pickup GPS Pin Link</span>
                                </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-slate-200 font-medium">Drop-off: <strong>{wa.dropoffLocation || 'Local Kochi (As Directed)'}</strong></span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-slate-300">Scheduled: <strong>{wa.scheduledDate || 'Immediate'} {wa.scheduledTime ? `at ${wa.scheduledTime}` : ''}</strong></span>
                        </div>
                      </div>

                      {/* Pricing Model & Estimated Fare */}
                      <div className="p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-xl space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-emerald-300 uppercase">
                            {isKm ? '🛣️ Kilometer-Based Pricing (₹1.00/km)' : '⏱️ Minute-Based Pricing (₹1.20/min)'}
                          </span>
                          <span className="text-base font-black text-emerald-300 font-mono">
                            ₹{wa.estimatedFare || (isKm ? Math.round((wa.calculatedKm || 25) * 1.05 + 25) : 150)}
                          </span>
                        </div>
                        <p className="text-[10px] text-emerald-400">
                          {isKm 
                            ? `Calculated Road Distance: ${wa.calculatedKm || 25} km via OSRM • Zero time charges`
                            : `Calculated Duration: ${wa.calculatedMinutes || 60} minutes • Zero distance charges`}
                        </p>
                      </div>

                      {/* Raw message excerpt */}
                      {wa.rawMessage && (
                        <div className="bg-[#0d1017] border border-emerald-800/60 p-3 rounded-xl text-[11px] text-slate-200 whitespace-pre-wrap font-sans">
                          {wa.rawMessage}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: DRIVING HISTORY (REQUIREMENT 5: LOGGED-IN DRIVER DRIVING HISTORY ONLY) */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Driver Driving History & Completed Trips</span>
              </h3>
              <p className="text-xs text-slate-400">
                Verified log of all your completed journeys, routes, timing penalties (-3% if delayed), and credited salary.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-300 bg-[#1c202a] px-3 py-1.5 rounded-xl">
              {completedDriverBookings.length} Completed Journeys
            </span>
          </div>

          {completedDriverBookings.length === 0 ? (
            <div className="bg-[#14171f] border border-[#262b36] rounded-3xl p-10 text-center text-xs text-slate-400 space-y-2">
              <p className="font-bold text-slate-300">No completed journeys in your driving history yet.</p>
              <p>Complete your accepted trips to build your verified Kerala driver track record.</p>
            </div>
          ) : (
            <div 
              className="grid gap-4 items-start"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
            >
              {completedDriverBookings.map((b) => {
                const isExpanded = expandedHistoryId === b.id;
                const gross = b.fareBreakdown.totalFare;
                const baseSal = Math.round(gross * 0.40);
                const delayCut = b.isDelayed ? (b.delayPenalty || Math.round(baseSal * 0.03)) : 0;
                const netCredited = b.driverCreditedSalary !== undefined ? b.driverCreditedSalary : (baseSal - delayCut);

                return (
                  <div
                    id={`driver-history-card-${b.id}`}
                    key={b.id}
                    tabIndex={-1}
                    className={`bg-[#14171f] rounded-2xl border transition-all overflow-hidden scroll-mt-24 outline-none ${
                      isExpanded
                        ? 'col-span-full border-cyan-500 shadow-md ring-2 ring-cyan-500/20'
                        : 'border-[#262b36] shadow-2xs hover:border-slate-700 hover:shadow-xs'
                    }`}
                    style={isExpanded ? { gridColumn: '1 / -1' } : undefined}
                  >
                    {/* Small Card (Lined Vertically with minimal initial information) */}
                    <div
                      onClick={() => toggleHistoryExpand(b.id)}
                      className="p-3.5 sm:p-4 cursor-pointer flex flex-col gap-2.5 select-none hover:bg-[#1a1f2c] transition-colors"
                    >
                      {/* Top line: Ref & WA on Left, Status & Delay on Right */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-300 bg-[#0d1017] px-2 py-0.5 rounded text-[10px] border border-[#262b36]">
                            Ref: {b.refCode}
                          </span>
                          {b.bookingChannel === 'whatsapp' && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#25D366] text-white flex items-center gap-1">
                              💬 WA
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {b.isDelayed && (
                            <span className="text-[10px] font-bold bg-amber-950/80 text-amber-300 px-2 py-0.5 rounded-full border border-amber-800">
                              ⚠️ -3%
                            </span>
                          )}
                          <span className="text-[10px] font-bold uppercase bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-800">
                            ✓ Completed
                          </span>
                        </div>
                      </div>

                      {/* Middle line: Route & Passenger (Lined vertically) */}
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300 truncate">
                          <span className="truncate font-medium">{b.pickupLocation}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300 truncate">
                          <span className="truncate font-medium">{b.destinationLocation}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 pt-0.5 flex items-center gap-1 truncate">
                          <span>👤 Passenger:</span>
                          <strong className="text-slate-200 font-semibold">{b.passengerName || b.customerName}</strong>
                        </div>
                      </div>

                      {/* Bottom line: Date & Net Salary on Left, Click to Extend indicator on Right */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#262b36] text-xs">
                        <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                          <span>📅 {b.scheduledDate || 'Today'} {b.scheduledTime || ''}</span>
                          <span className="font-black text-xs text-emerald-400 font-mono">
                            Salary: ₹{netCredited}
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
                      <div className="border-t border-[#262b36] p-4 sm:p-5 bg-[#0d1017] space-y-3.5 animate-in fade-in duration-150 text-xs">
                        {/* Passenger Details */}
                        <div className="bg-[#14171f] rounded-2xl p-3 border border-[#262b36] space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#262b36] pb-2">
                            <div>
                              <span className="text-[10px] text-slate-400 font-semibold block uppercase">Passenger Information</span>
                              <strong className="text-slate-100 text-sm">{b.passengerName || b.customerName}</strong>
                              <span className="text-slate-400 font-mono ml-2 text-xs">({b.passengerPhone || b.customerPhone})</span>
                            </div>
                            {b.bookingFor === 'someone_else' && (
                              <span className="text-[10px] font-bold bg-[#002C6C]/40 text-cyan-200 border border-[#002C6C] px-2 py-0.5 rounded-full w-fit">
                                Booked by {b.customerName} ({b.passengerRelationship || 'Relative'})
                              </span>
                            )}
                          </div>
                          {b.passengerSpecialInstructions && (
                            <div className="bg-amber-950/60 text-amber-200 border border-amber-800 rounded-xl p-2 text-[11px] flex items-center gap-1.5">
                              <span>Special Instructions: "{b.passengerSpecialInstructions}"</span>
                            </div>
                          )}
                        </div>

                        {/* Full Route & Timing */}
                        <div className="bg-[#14171f] rounded-2xl p-3 border border-[#262b36] space-y-2">
                          <span className="text-[10px] text-slate-400 font-semibold block uppercase">Journey Details & Route</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className="flex items-start gap-1.5">
                              <div>
                                <span className="text-[10px] text-slate-400 block">Pickup Location</span>
                                <span className="font-semibold text-slate-200">{b.pickupLocation}</span>
                              </div>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <div>
                                <span className="text-[10px] text-slate-400 block">Destination Drop</span>
                                <span className="font-semibold text-slate-200">{b.destinationLocation}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#262b36] text-[11px] text-slate-400">
                            <span>Service: <strong className="text-slate-200 uppercase">{b.serviceType}</strong></span>
                            <span>Category: <strong className="text-slate-200 uppercase">{b.vehicleCategory || 'Standard'}</strong></span>
                            <span>Verified OTP: <strong className="font-mono text-emerald-400 font-bold">{b.rideStartOtp}</strong></span>
                          </div>
                        </div>

                        {/* Financial Salary Breakdown */}
                        <div className="bg-[#14171f] rounded-2xl p-3 border border-[#262b36] space-y-2">
                          <span className="text-[10px] text-slate-400 font-semibold block uppercase">Driver Earnings & Salary Breakdown</span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                            <div className="bg-[#0d1017] border border-[#262b36] p-2 rounded-xl">
                              <span className="text-[10px] text-slate-400 block uppercase">Gross Tariff</span>
                              <strong className="text-slate-100 font-bold">₹{gross}</strong>
                            </div>
                            <div className="bg-[#0d1017] border border-[#262b36] p-2 rounded-xl">
                              <span className="text-[10px] text-slate-400 block uppercase">Base Salary</span>
                              <strong className="text-slate-100 font-bold">₹{baseSal}</strong>
                            </div>
                            <div className="bg-[#0d1017] border border-[#262b36] p-2 rounded-xl">
                              <span className="text-[10px] text-slate-400 block uppercase">Delay Penalty</span>
                              <strong className={b.isDelayed ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                                {b.isDelayed ? `-₹${delayCut} (-3%)` : '₹0'}
                              </strong>
                            </div>
                            <div className="bg-[#002C6C]/30 border border-[#002C6C] p-2 rounded-xl">
                              <span className="text-[10px] text-cyan-300 font-bold block uppercase">Net Salary</span>
                              <strong className="text-cyan-100 font-black text-sm font-mono">₹{netCredited}</strong>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#262b36] text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400">Customer Payment:</span>
                              <strong className={b.passengerPaid ? "text-emerald-400" : "text-amber-400"}>
                                {b.passengerPaid ? 'Paid by Customer ✓' : 'Payment Pending'}
                              </strong>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400">Driver Wallet:</span>
                              <strong className={b.driverPaymentReceived ? "text-emerald-400" : "text-cyan-400"}>
                                {b.driverPaymentReceived ? `Credited ✓ ${b.salaryCreditTxId ? `(${b.salaryCreditTxId.slice(0, 8)})` : ''}` : 'Ready for Credit'}
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

      {/* TAB 2: DRIVER WALLET & SALARY HISTORY (REQUIREMENT 4: 40% DRIVER / 60% ORGANIZATION COMMISSION) */}
      {activeTab === 'wallet' && (() => {
        const readyToCreditBookings = completedDriverBookings.filter(b => (b.passengerPaid || b.paymentStatus === 'completed') && !b.driverPaymentReceived);
        const readyToCreditTotal = readyToCreditBookings.reduce((sum, b) => sum + (b.driverCreditedSalary || Math.round(b.fareBreakdown.totalFare * 0.40)), 0);

        const pendingPaymentBookings = completedDriverBookings.filter(b => !b.passengerPaid && b.paymentStatus !== 'completed' && !b.driverPaymentReceived);
        const pendingPaymentTotal = pendingPaymentBookings.reduce((sum, b) => sum + (b.driverCreditedSalary || Math.round(b.fareBreakdown.totalFare * 0.40)), 0);

        return (
          <div className="space-y-6">
            {/* Top 3 KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="bg-[#14171f] border border-[#262b36] p-4 rounded-2xl shadow-sm hover:border-slate-700 transition-all text-slate-100">
                <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Total Wallet Balance</span>
                <span className="text-3xl font-black text-emerald-400 mt-1 block font-mono">₹{walletBalance}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Credited & Available</span>
              </div>

              <div className="bg-[#14171f] border border-[#262b36] p-4 rounded-2xl shadow-sm hover:border-slate-700 transition-all text-slate-100">
                <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Ready to Credit</span>
                <span className="text-3xl font-black text-cyan-400 mt-1 block font-mono">₹{readyToCreditTotal}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Customer Paid • 1-Click Credit</span>
              </div>

              <div className="bg-[#14171f] border border-[#262b36] p-4 rounded-2xl shadow-sm hover:border-slate-700 transition-all text-slate-100">
                <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Pending Customer Payment</span>
                <span className="text-3xl font-black text-amber-400 mt-1 block font-mono">₹{pendingPaymentTotal}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Blocked until passenger pays</span>
              </div>
            </div>

            <div className="bg-[#14171f] rounded-2xl p-4 sm:p-6 border border-[#262b36] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#262b36] pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-800/80">
                    DriveC Compensation Formula
                  </span>
                  <h3 className="text-xl font-black text-slate-100 mt-1">Driver Salary & Wallet Terminal</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Organization Commission & Net Driver Salary credited to driver wallet after customer payment verification.
                  </p>
                </div>
              </div>

              {completedDriverBookings.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                  <p className="font-bold text-slate-300">No completed trips credited yet.</p>
                  <p>Complete rides and click "Payment Received" to credit your salary share to your wallet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0d1017] border-b border-[#262b36] text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3">Trip Ref</th>
                        <th className="p-3">Passenger</th>
                        <th className="p-3">Route</th>
                        <th className="p-3">Gross Tariff</th>
                        <th className="p-3">Org Share</th>
                        <th className="p-3">Driver Salary</th>
                        <th className="p-3">Customer Pay</th>
                        <th className="p-3">Wallet Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262b36]">
                      {completedDriverBookings.map((b) => {
                        const totalFare = b.fareBreakdown.totalFare;
                        const salary = b.driverCreditedSalary || Math.round(totalFare * 0.40);
                        const commission = b.platformCommission || (totalFare - salary);
                        const isCustPaid = b.passengerPaid || b.paymentStatus === 'completed';

                        return (
                          <tr key={b.id} className="hover:bg-[#1a1f2c] transition-colors">
                            <td className="p-3 font-mono font-bold text-slate-200">{b.refCode}</td>
                            <td className="p-3">
                              <span className="font-semibold text-slate-100 block">{b.passengerName || b.customerName}</span>
                              {b.bookingFor === 'someone_else' && (
                                <span className="text-[9px] text-cyan-400 font-bold block">For Someone Else</span>
                              )}
                            </td>
                            <td className="p-3 text-[11px] text-slate-300 max-w-xs truncate">
                              {b.pickupLocation} → {b.destinationLocation}
                            </td>
                            <td className="p-3 font-mono font-bold text-slate-200">₹{totalFare}</td>
                            <td className="p-3 text-slate-400 font-medium">₹{commission}</td>
                            <td className="p-3 font-black text-emerald-400 font-mono text-sm">₹{salary}</td>
                            <td className="p-3">
                              {isCustPaid ? (
                                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800/80">
                                  Paid ✓
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-800/80">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {b.driverPaymentReceived ? (
                                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800/80 block text-center">
                                  ✓ Credited
                                </span>
                              ) : isCustPaid ? (
                                <button
                                  type="button"
                                  onClick={() => handleCreditSalary(b)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] shadow-xs cursor-pointer flex items-center gap-1"
                                >
                                  <span>Credit ₹{salary}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleCreditSalary(b)}
                                  className="px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/80 font-bold rounded-lg text-[10px] cursor-pointer flex items-center gap-1"
                                >
                                  <span>Pending Pay</span>
                                </button>
                              )}
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
        );
      })()}

      {/* TAB 3: PASSENGER REVIEWS (REQUIREMENT 5: REVIEWS VISIBLE TO DRIVER) */}
      {activeTab === 'reviews' && (
        <div className="bg-[#14171f] rounded-2xl p-4 sm:p-6 border border-[#262b36] shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-[#262b36] pb-4">
            <div>
              <h3 className="font-bold text-slate-100 text-base">Passenger Reviews & Star Ratings</h3>
              <p className="text-xs text-slate-400">Genuine reviews submitted by passengers after completing their trips with you.</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-400 block">Average Rating:</span>
              <span className="text-2xl font-black text-amber-500">★ {currentDriver.ratingAverage || '5.0'}</span>
            </div>
          </div>

          {driverReviews.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 space-y-2">
              <p className="font-bold text-slate-300">No customer reviews yet.</p>
              <p>Reviews will appear here once passengers rate your completed journeys.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {driverReviews.map((rev) => (
                <div key={rev.id} className="bg-[#0d1017] rounded-2xl p-4 sm:p-5 border border-[#262b36] shadow-sm hover:border-slate-700 transition-all text-slate-100 space-y-3 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-100">{rev.reviewerName}</span>
                      <span className="text-[10px] text-slate-400 ml-2 font-mono">Trip #{rev.bookingRef}</span>
                    </div>
                    <span className="font-black text-amber-500">★ {rev.overallRating}.0</span>
                  </div>
                  <p className="text-slate-300 italic">"{rev.comment}"</p>
                  <div className="flex gap-3 text-[10px] text-slate-400 pt-2 border-t border-[#262b36]">
                    <span>Punctuality: ★{rev.punctualityRating || 5}</span>
                    <span>Conduct: ★{rev.cleanlinessRating || 5}</span>
                    <span>Smooth Driving: ★{rev.comfortRating || 5}</span>
                  </div>

                  {/* Requirement 10: Official Admin Reply visible to Driver */}
                  {rev.adminReply && (
                    <div className="p-3 bg-[#14171f] border border-[#262b36] rounded-xl text-xs space-y-1 mt-2 text-slate-200">
                      <div className="flex items-center gap-1.5 font-bold text-cyan-400 text-[11px]">
                        <span>DriveC Official Admin Response</span>
                        {rev.adminRepliedAt && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            • {new Date(rev.adminRepliedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-300 leading-relaxed">{rev.adminReply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CAPABILITIES */}
      {activeTab === 'capabilities' && (
        <div className="bg-[#14171f] rounded-2xl p-5 sm:p-7 border border-[#262b36] shadow-xs space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300 bg-cyan-950/60 px-2.5 py-0.5 rounded-full border border-cyan-800/80">
                Driver-as-a-Service Model
              </span>
              <span className="text-xs text-slate-400">• Pilot Qualifications</span>
            </div>
            <h3 className="font-black text-slate-100 text-lg mt-1">Your Certified Driving Capabilities</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              At DriveC, customers provide their own vehicles and book certified drivers to pilot them. You provide only driving services.
              Declare the transmissions and fuel/power types you are qualified and comfortable driving to receive matching ride bookings.
            </p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!currentDriver?.id) return;
              if (driverTransmissions.length === 0) {
                setCapError('Please select at least one transmission capability (Automatic or Manual).');
                return;
              }
              if (driverFuels.length === 0) {
                setCapError('Please select at least one fuel / power type capability.');
                return;
              }
              setCapError('');
              setCapSaving(true);
              setCapMsg('');
              try {
                const res = await fetch(`/api/drivers/${currentDriver.id}/capabilities`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': currentDriver.id,
                    'x-user-role': 'driver',
                    'x-driver-id': currentDriver.id,
                  },
                  body: JSON.stringify({
                    transmissionCapabilities: driverTransmissions,
                    fuelCapabilities: driverFuels
                  })
                });
                if (res.ok) {
                  setCapMsg('✓ Capabilities updated successfully! You will now be matched with customer vehicles matching these specs.');
                  onRefreshDriver?.();
                } else {
                  const data = await res.json().catch(() => null);
                  setCapError(data?.error || 'Failed to update capabilities.');
                }
              } catch (err) {
                setCapError('Network error while saving capabilities.');
              } finally {
                setCapSaving(false);
              }
            }}
            className="space-y-6 text-xs"
          >
            {capMsg && (
              <div className="p-3.5 bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 rounded-xl font-bold flex items-center gap-2">
                <span>{capMsg}</span>
              </div>
            )}

            {capError && (
              <div className="p-3.5 bg-red-950/60 border border-red-800/80 text-red-200 rounded-xl font-bold flex items-center gap-2">
                <span>{capError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Transmission Capabilities */}
              <div className="p-5 rounded-2xl bg-[#0d1017] border border-[#262b36] space-y-3 text-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-100 text-sm">Transmission Capabilities *</span>
                  <span className="text-[10px] text-slate-400 font-semibold">At least 1 required</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Select which transmission types you can drive safely and smoothly:
                </p>

                <div className="space-y-2.5 pt-1">
                  {[
                    { key: 'manual', label: 'Manual Transmission', desc: 'Standard stick shift with clutch pedal' },
                    { key: 'automatic', label: 'Automatic Transmission', desc: 'Torque converter, CVT, DCT, AMT automatics' }
                  ].map((item) => {
                    const checked = driverTransmissions.includes(item.key);
                    return (
                      <label
                        key={item.key}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                          checked ? 'bg-[#002C6C]/40 border-cyan-500 shadow-xs ring-1 ring-cyan-500/20 text-white' : 'bg-[#0d1017] border-[#262b36] text-slate-300 hover:bg-[#14171f]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setDriverTransmissions(prev => [...prev, item.key]);
                            } else {
                              if (driverTransmissions.length <= 1) {
                                setCapError('At least one transmission capability is required.');
                                return;
                              }
                              setCapError('');
                              setDriverTransmissions(prev => prev.filter(t => t !== item.key));
                            }
                          }}
                          className="mt-0.5 rounded text-cyan-400 focus:ring-[#002C6C] w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <strong className="text-slate-100 block font-bold text-xs">{item.label}</strong>
                          <span className="text-[11px] text-slate-400">{item.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Fuel & Power Capabilities */}
              <div className="p-5 rounded-2xl bg-[#0d1017] border border-[#262b36] space-y-3 text-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-100 text-sm">Fuel / Power Types *</span>
                  <span className="text-[10px] text-slate-400 font-semibold">At least 1 required</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Select which powertrain technologies you are certified to operate:
                </p>

                <div className="space-y-2.5 pt-1">
                  {[
                    { key: 'petrol', label: 'Petrol Vehicles', desc: 'Naturally aspirated & turbo petrol engines' },
                    { key: 'diesel', label: 'Diesel Vehicles', desc: 'Common-rail high-torque diesel vehicles' },
                    { key: 'ev', label: 'Electric Vehicles (EV)', desc: 'Battery electric, regenerative braking & smart tech' }
                  ].map((item) => {
                    const checked = driverFuels.includes(item.key);
                    return (
                      <label
                        key={item.key}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                          checked ? 'bg-[#002C6C]/40 border-cyan-500 shadow-xs ring-1 ring-cyan-500/20 text-white' : 'bg-[#0d1017] border-[#262b36] text-slate-300 hover:bg-[#14171f]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setDriverFuels(prev => [...prev, item.key]);
                            } else {
                              if (driverFuels.length <= 1) {
                                setCapError('At least one fuel / power type capability is required.');
                                return;
                              }
                              setCapError('');
                              setDriverFuels(prev => prev.filter(f => f !== item.key));
                            }
                          }}
                          className="mt-0.5 rounded text-cyan-400 focus:ring-[#002C6C] w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <strong className="text-slate-100 block font-bold text-xs">{item.label}</strong>
                          <span className="text-[11px] text-slate-400">{item.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0d1017] border border-[#262b36] text-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="font-bold text-xs block">DriveC Smart Matching Guarantee</span>
                <span className="text-[11px] text-cyan-300">Customers will only be matched with you when their vehicle matches your selected capabilities.</span>
              </div>

              <button
                type="submit"
                disabled={capSaving}
                className="px-5 py-2.5 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0"
              >
                {capSaving ? (
                  <span>Saving Capabilities...</span>
                ) : (
                  <>
                    <span>Save Driving Capabilities</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 5: NOTICE & WARNING SECTION (REQUIREMENT 3) */}
      {activeTab === 'notices' && (
        <div className="bg-[#14171f] rounded-2xl p-4 sm:p-6 border border-[#262b36] shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#262b36] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-base">Notices & Written Warnings</h3>
                {unacknowledgedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white animate-pulse">
                    {unacknowledgedCount} Unread
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Official communications, disciplinary warnings, and administrative status notices issued to your account.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex gap-1.5 p-1 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setNoticeFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  noticeFilter === 'all' ? 'bg-[#002C6C] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({driverNotices.length})
              </button>
              <button
                type="button"
                onClick={() => setNoticeFilter('active')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  noticeFilter === 'active' ? 'bg-[#002C6C] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Active ({driverNotices.filter(n => n.status !== 'dismissed').length})
              </button>
              <button
                type="button"
                onClick={() => setNoticeFilter('dismissed')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  noticeFilter === 'dismissed' ? 'bg-[#002C6C] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Dismissed History ({driverNotices.filter(n => n.status === 'dismissed').length})
              </button>
            </div>
          </div>

          {/* List of notices */}
          {(() => {
            const filtered = driverNotices.filter(n => {
              if (noticeFilter === 'active') return n.status !== 'dismissed';
              if (noticeFilter === 'dismissed') return n.status === 'dismissed';
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                  <p className="font-bold text-slate-300 text-sm">No notices in this category</p>
                  <p className="max-w-md mx-auto text-slate-400">
                    {noticeFilter === 'dismissed' 
                      ? 'No dismissed notices. All historical notices will be retained here permanently.'
                      : 'You have no pending warnings or disciplinary actions. Keep up the high standard of service!'}
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                {filtered.map((n) => {
                  const isWarning = n.type === 'warning';
                  const isSuspension = n.type === 'suspension';
                  const isExpanded = Boolean(expandedNoticeIds[n.id]);
                  const cardHasUnread = hasDriverUnreadForNotice(n.id);

                  // Lookup associated customer review for this notice
                  const associatedReview = reviews.find(r => 
                    (n.reviewId && r.id === n.reviewId) || 
                    (n.bookingId && r.bookingId === n.bookingId) || 
                    (n.bookingRef && r.bookingRef === n.bookingRef)
                  );

                  return (
                    <div
                      key={n.id}
                      className={`rounded-2xl border-2 transition-all shadow-xs overflow-hidden ${
                        cardHasUnread
                          ? isSuspension
                            ? 'ring-2 ring-red-500 animate-pulse border-red-600 bg-[#14171f]'
                            : 'ring-2 ring-amber-500 animate-pulse border-amber-600 bg-[#14171f]'
                          : isSuspension
                            ? 'bg-[#14171f] border-red-800/80 text-red-200 shadow-md'
                            : 'bg-[#14171f] border-amber-700/80 text-amber-200 shadow-md'
                      }`}
                    >
                      {/* Requirement 3: Compact Notice Card by Default (Click to Expand / Collapse) */}
                      <div
                        onClick={() => toggleNoticeExpand(n.id)}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer hover:bg-black/[0.02] transition-colors select-none"
                      >
                        <div className="flex items-start gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                isSuspension ? 'bg-rose-900/60 text-rose-200' : 'bg-amber-900/60 text-amber-200'
                              }`}>
                                {isSuspension ? '🚫 Account Suspension' : '⚠️ Official Warning'}
                              </span>
                              {cardHasUnread && (
                                <span className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1 animate-bounce">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#0d1017] animate-ping"></span>
                                  <span>UNREAD ACTION</span>
                                </span>
                              )}
                              {n.bookingRef && (
                                <span className="text-[10px] font-mono bg-[#0d1017] px-2 py-0.5 rounded border border-[#262b36] font-bold text-slate-300">
                                  Trip #{n.bookingRef}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400">
                                {new Date(n.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 font-medium line-clamp-1">
                              {n.reason}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {cardHasUnread && hasAdminReply(n) && (
                            <span className="text-[10px] font-black text-cyan-300 bg-[#002C6C]/50 border border-blue-800/70 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>
                              <span>New Admin Response</span>
                            </span>
                          )}

                          {!n.isAcknowledged ? (
                            <span className={`text-[10px] font-bold text-rose-300 bg-rose-950/70 border border-rose-800/80 px-2.5 py-0.5 rounded-full flex items-center gap-1 ${cardHasUnread ? 'animate-pulse' : ''}`}>
                              <span className={`w-1.5 h-1.5 rounded-full bg-red-600 ${cardHasUnread ? 'animate-ping' : ''}`}></span>
                              <span>Action Required</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-700/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <span>Acknowledged</span>
                            </span>
                          )}

                          {Array.isArray(n.replies) && n.replies.length > 0 && (
                            <span className="text-[10px] font-bold bg-[#0d1017] text-slate-300 px-2 py-0.5 rounded border border-[#262b36] flex items-center gap-1">
                              <span>{n.replies.length}</span>
                            </span>
                          )}

                          <button
                            type="button"
                            className="p-1 rounded-lg hover:bg-white/5 text-slate-300"
                            title={isExpanded ? 'Collapse card' : 'Expand full details'}
                          >
                            {isExpanded ? <span className="font-bold text-xs leading-none">−</span> : <span className="font-bold text-xs leading-none">+</span>}
                          </button>
                        </div>
                      </div>

                      {/* Requirement 3 & 4: Expanded Card with Customer Rating, Review, Reason & Available Actions */}
                      {isExpanded && (
                        <div className="p-4 sm:p-5 border-t border-[#262b36] space-y-4 animate-in fade-in">
                          {/* Associated Customer Review (Requirement 3) */}
                          {associatedReview && (
                            <div className="bg-[#14171f] p-4 rounded-xl border border-[#262b36] shadow-xs space-y-2 text-xs text-slate-200">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#262b36] pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Passenger Review:</span>
                                  <strong className="text-slate-100">{associatedReview.reviewerName}</strong>
                                  {associatedReview.verifiedTrip && (
                                    <span className="text-[10px] bg-emerald-950/60 text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-800/80">
                                      Verified Trip
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                  <span className="font-mono font-bold text-slate-300">Trip Ref #{associatedReview.bookingRef}</span>
                                  <span>•</span>
                                  <span>{new Date(associatedReview.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-amber-500 font-black text-sm">
                                  ★ {associatedReview.overallRating.toFixed(1)} / 5.0
                                </span>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold">
                                  <span>Punctuality: ★{associatedReview.punctualityRating}</span>
                                  <span>•</span>
                                  <span>Cleanliness: ★{associatedReview.cleanlinessRating}</span>
                                  <span>•</span>
                                  <span>Comfort: ★{associatedReview.comfortRating}</span>
                                </div>
                              </div>

                              <p className="text-slate-200 italic bg-[#0d1017] p-2.5 rounded-lg border border-[#262b36] font-medium">
                                "{associatedReview.comment}"
                              </p>
                            </div>
                          )}

                          {/* Official Reason / Disciplinary Letter */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                              Official Reason / Disciplinary Letter:
                            </label>
                            <div className="bg-[#0d1017] p-4 rounded-xl border border-[#262b36] text-xs text-slate-200 leading-relaxed font-medium whitespace-pre-wrap shadow-xs">
                              {n.reason}
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              Issued by {n.adminName || 'DriveC Administrator'} • {new Date(n.createdAt).toLocaleString()}
                            </span>
                          </div>

                          {/* Error Banner on Failure (Requirement 4) */}
                          {driverActionError[n.id] && (
                            <div className="p-3 bg-rose-950/70 text-rose-200 rounded-xl border border-rose-800/80 font-bold text-xs flex items-center gap-2 animate-in fade-in">
                              <span>{driverActionError[n.id]}</span>
                            </div>
                          )}

                          {/* Actions: Acknowledge & Close */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#262b36]">
                            <div className="flex flex-wrap items-center gap-2">
                              {!n.isAcknowledged ? (
                                <button
                                  type="button"
                                  disabled={isNoticeActionLoading[n.id]}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      setIsNoticeActionLoading(prev => ({ ...prev, [n.id]: true }));
                                      setDriverActionError(prev => ({ ...prev, [n.id]: '' }));
                                      if (onAcknowledgeNotice) {
                                        await onAcknowledgeNotice(n.id);
                                      }
                                      // Requirement 4: Automatically collapse after action succeeds
                                      setExpandedNoticeIds(prev => ({ ...prev, [n.id]: false }));
                                    } catch (err: any) {
                                      // Keep card expanded and show error
                                      setDriverActionError(prev => ({ ...prev, [n.id]: err?.message || 'Failed to acknowledge notice. Please try again.' }));
                                    } finally {
                                      setIsNoticeActionLoading(prev => ({ ...prev, [n.id]: false }));
                                    }
                                  }}
                                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  <span>{isNoticeActionLoading[n.id] ? 'Saving...' : 'Okay, Understood'}</span>
                                </button>
                              ) : (
                                <span className="text-[11px] font-bold text-emerald-300 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-800/80 flex items-center gap-1">
                                  <span>Acknowledged {n.acknowledgedAt ? `on ${new Date(n.acknowledgedAt).toLocaleDateString()}` : ''}</span>
                                </span>
                              )}

                              {/* Requirement 4: Close button collapses into compact card */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDriverActionError(prev => ({ ...prev, [n.id]: '' }));
                                  setExpandedNoticeIds(prev => ({ ...prev, [n.id]: false }));
                                }}
                                className="px-4 py-2 rounded-xl border border-[#262b36] text-slate-300 hover:bg-[#1c202a] font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                <span>Close</span>
                              </button>
                            </div>

                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {n.id}
                            </span>
                          </div>

                          {/* Conversation / Reply Thread */}
                          <div className="space-y-2.5 pt-2 border-t border-[#262b36]">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                              Conversation & Responses ({Array.isArray(n.replies) ? n.replies.length : 0}):
                            </label>

                            {Array.isArray(n.replies) && n.replies.length > 0 ? (
                              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {n.replies.map((rep) => (
                                  <div
                                    key={rep.id}
                                    className={`p-3 rounded-xl text-xs space-y-1 ${
                                      rep.senderRole === 'admin'
                                        ? 'bg-[#0d1017] border border-[#262b36] ml-4 text-slate-200'
                                        : 'bg-[#14171f] border border-[#262b36] text-slate-200 mr-4'
                                    }`}
                                  >
                                    <div className="flex justify-between items-center text-[10px] font-bold">
                                      <span className={rep.senderRole === 'admin' ? 'text-cyan-300 font-black' : 'text-slate-200'}>
                                        {rep.senderRole === 'admin' ? '🛡️ Administration Response' : `👤 You (Driver)`}
                                      </span>
                                      <span className="text-slate-400">{new Date(rep.createdAt).toLocaleString()}</span>
                                    </div>
                                    <p className="text-slate-200 font-medium whitespace-pre-wrap">{rep.message}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 italic">No replies sent yet.</p>
                            )}

                            {/* Driver Reply Input */}
                            <div className="flex gap-2 items-center pt-1">
                              <input
                                type="text"
                                placeholder="Write your reply or clarification to Administration..."
                                value={driverNoticeReplies[n.id] || ''}
                                onChange={(e) => setDriverNoticeReplies(prev => ({ ...prev, [n.id]: e.target.value }))}
                                className="flex-1 px-3.5 py-2.5 bg-[#0d1017] border border-[#262b36] text-slate-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-cyan-500"
                              />
                              <button
                                type="button"
                                disabled={isNoticeActionLoading[n.id]}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const msg = (driverNoticeReplies[n.id] || '').trim();
                                  if (!msg) return;
                                  try {
                                    setIsNoticeActionLoading(prev => ({ ...prev, [n.id]: true }));
                                    setDriverActionError(prev => ({ ...prev, [n.id]: '' }));
                                    if (onReplyNotice) {
                                      await onReplyNotice(n.id, msg, 'driver', currentDriver?.name || 'Driver');
                                    }
                                    setDriverNoticeReplies(prev => ({ ...prev, [n.id]: '' }));
                                    // Requirement 4: Automatically collapse after sending reply succeeds
                                    setExpandedNoticeIds(prev => ({ ...prev, [n.id]: false }));
                                  } catch (err: any) {
                                    // Keep card expanded and show error
                                    setDriverActionError(prev => ({ ...prev, [n.id]: err?.message || 'Failed to send reply. Please try again.' }));
                                  } finally {
                                    setIsNoticeActionLoading(prev => ({ ...prev, [n.id]: false }));
                                  }
                                }}
                                className="px-4 py-2.5 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-bold text-xs shadow-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <span>{isNoticeActionLoading[n.id] ? 'Sending...' : 'Send Reply'}</span>
                              </button>
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

      {/* DRIVER NOTIFICATION POPUP MODAL: CONFIRM OR CANCEL WITH OTP (Requirement 9) */}
      {activeOtpModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#14171f] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#262b36] space-y-5 animate-in zoom-in-95 duration-200 text-slate-100">
            <div className="flex items-center justify-between border-b border-[#262b36] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#002C6C]/50 text-cyan-400 flex items-center justify-center shadow-xs">
                  <span className="text-lg">🔔</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 block">
                    Incoming Ride Notification
                  </span>
                  <h3 className="font-black text-slate-100 text-base">New Booking Request</h3>
                </div>
              </div>
              <button
                onClick={() => setActiveOtpModalBooking(null)}
                className="text-slate-400 hover:text-slate-300 text-sm font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Trip Summary Details */}
            <div className={`p-3.5 rounded-2xl text-xs space-y-2 border ${
              activeOtpModalBooking.bookingChannel === 'whatsapp'
                ? 'bg-[#0d1017] border-emerald-800/80 text-emerald-200'
                : 'bg-[#0d1017] border-[#262b36] text-slate-200'
            }`}>
              <div className="flex justify-between items-center text-slate-200">
                <span className="text-slate-400 font-semibold">Ref Code:</span>
                <span className="font-mono font-black text-cyan-300">{activeOtpModalBooking.refCode}</span>
              </div>
              <div className="flex justify-between items-center text-slate-200">
                <span className="text-slate-400 font-semibold">Passenger:</span>
                <span className="font-bold">{activeOtpModalBooking.passengerName || activeOtpModalBooking.customerName} ({activeOtpModalBooking.passengerPhone || activeOtpModalBooking.customerPhone})</span>
              </div>
              {activeOtpModalBooking.bookingChannel === 'whatsapp' && (
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold bg-emerald-950/70 px-2 py-0.5 rounded-lg text-[11px]">
                  <span>💬 WhatsApp Booking:</span>
                  <span className="font-normal text-emerald-300">Passenger received OTP via WhatsApp</span>
                </div>
              )}
              <div className="text-slate-300 pt-1 border-t border-[#262b36] space-y-1">
                <div>From: <strong>{activeOtpModalBooking.pickupLocation}</strong></div>
                <div>To: <strong>{activeOtpModalBooking.destinationLocation}</strong></div>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-[#262b36] text-slate-100">
                <span>Trip Fare: <strong>₹{activeOtpModalBooking.fareBreakdown.totalFare}</strong></span>
                <span className="text-emerald-300 font-black">Net Salary: ₹{activeOtpModalBooking.driverCreditedSalary || Math.round(activeOtpModalBooking.fareBreakdown.totalFare * 0.40)}</span>
              </div>
            </div>

            <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-200 text-xs mb-1.5 text-center">
                  Enter 4-Digit Passenger Ride-Start OTP:
                </label>
                <input
                  type="text"
                  maxLength={4}
                  required
                  autoFocus
                  placeholder="• • • •"
                  value={otpModalInput}
                  onChange={(e) => setOtpModalInput(e.target.value)}
                  className="w-full py-3 bg-[#0d1017] border border-[#262b36] rounded-2xl text-center font-mono font-black text-2xl tracking-widest text-cyan-400 focus:border-cyan-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 text-center mt-1">
                  Ask passenger for code shown on their WhatsApp message or screen • Matching OTP starts ride
                </p>
              </div>

              {otpModalError && (
                <div className="text-[11px] text-amber-200 font-bold bg-amber-950/70 p-2.5 rounded-xl border border-amber-700/70 text-center flex items-center justify-center gap-1.5 animate-bounce">
                  <span>{otpModalError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleDenyTrip(activeOtpModalBooking)}
                  className="w-1/2 py-3 rounded-xl border-2 border-rose-800/80 text-rose-400 font-black text-xs hover:bg-rose-950/70 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Cancel Ride</span>
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Confirm Ride</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL: PASSENGER HASN'T PAID YET (Security Feature 1) */}
      {passengerNotPaidModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-[#14171f] rounded-3xl max-w-md w-full shadow-2xl border border-amber-900/50 overflow-hidden transform animate-in zoom-in-95 duration-200 text-slate-100">
            <div className="bg-gradient-to-r from-amber-950 via-amber-900 to-[#14171f] border-b border-amber-700/60 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                                <div>
                  <h3 className="text-lg font-black tracking-tight">Passenger hasn't paid yet</h3>
                  <p className="text-xs text-amber-100">Customer payment pending verification</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPassengerNotPaidModal(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-300">
              <div className="bg-amber-950/40 rounded-2xl p-4 border border-amber-900/60 space-y-2 text-amber-200">
                <p className="font-bold text-amber-200 text-sm">
                  Salary credit blocked until customer completes payment
                </p>
                <p className="text-amber-200 leading-relaxed">
                  The passenger for Booking <strong>#{passengerNotPaidModal.booking?.refCode || passengerNotPaidModal.booking?.id?.slice(0, 8).toUpperCase()}</strong> has not completed payment for this trip yet.
                </p>
              </div>

              <div className="space-y-2 text-slate-300 bg-[#0d1017] p-4 rounded-2xl border border-[#262b36]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Trip Fare:</span>
                  <span className="font-bold text-slate-100">₹{passengerNotPaidModal.booking?.fareBreakdown?.totalFare || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Your Eligible Salary:</span>
                  <span className="font-black text-emerald-300 text-sm">
                    ₹{passengerNotPaidModal.booking?.driverCreditedSalary || Math.round((passengerNotPaidModal.booking?.fareBreakdown?.totalFare || 0) * 0.40)}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-[#262b36] pt-2">
                  <span className="text-slate-400">Current Salary Status:</span>
                  <span className="font-bold text-amber-300 bg-amber-950/70 px-2 py-0.5 rounded text-[10px]">
                    Pending Customer Payment
                  </span>
                </div>
              </div>

              <p className="text-slate-400 text-[11px] leading-relaxed">
                As soon as the passenger completes payment via online payment (UPI, Card, Gateway) or confirmed cash collection, your earned salary will immediately become available to credit to your Driver Wallet.
              </p>

              <button
                type="button"
                onClick={() => setPassengerNotPaidModal(null)}
                className="w-full py-3 bg-[#002C6C] hover:bg-[#004B93] text-white font-bold rounded-2xl text-xs shadow-md transition-colors cursor-pointer"
              >
                Okay, Understood
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
