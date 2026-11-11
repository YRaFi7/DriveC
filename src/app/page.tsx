"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  Sparkles, 
  HeartHandshake,
  Wine,
  Palmtree,
  Plane,
  Timer,
  Navigation
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { HeroSection } from '../components/HeroSection';
import { GuestGateModal } from '../components/GuestGateModal';
import { AuthModal } from '../components/AuthModal';
import { BookingEngine } from '../components/BookingEngine';
import { DriverPortal } from '../components/DriverPortal';
import { AdminPortal } from '../components/AdminPortal';
import { UserPortal } from '../components/UserPortal';
import { ReviewsSection } from '../components/ReviewsSection';
import { SeoSections } from '../components/SeoSections';
import { 
  Language, 
  UserRole, 
  User, 
  Driver, 
  Booking, 
  Review, 
  Complaint, 
  VehicleCategory, 
  RideServiceType,
  RentalVehicle,
  RentalExtension,
  DriverNotice,
  DisputeNotification
} from '../types';
import { translations, KERALA_SERVICE_AREAS } from '../lib/translations';
import { loadSavedState, saveState, AppState, getInitialState, calculateDriverSalary } from '../lib/store';

const SYNC_CHANNEL_NAME = 'drivec_realtime_sync_v1';

function broadcastSyncEvent(message: { type: string; payload?: any }) {
  if (typeof window === 'undefined') return;
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      channel.postMessage(message);
      channel.close();
    }
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent('drivec_extension_sync', { detail: message }));
  } catch {
    // ignore
  }
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<AppState>(getInitialState());
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Active view tab: 'explore' (the guest / customer landing page), 'driver' (driver terminal), 'admin' (admin operations)
  const [activeTab, setActiveTab] = useState<string>('explore');
  const [adminInitialTab, setAdminInitialTab] = useState<'drivers' | 'bookings' | 'history' | 'rentals' | 'users' | 'reviews' | 'complaints' | 'finance'>('drivers');
  const [driverInitialTab, setDriverInitialTab] = useState<'rides' | 'history' | 'wallet' | 'reviews' | 'capabilities' | 'notices'>('rides');

  const handleOpenDrivingHistory = () => {
    if (state.currentUser.role === 'admin') {
      setAdminInitialTab('history');
      setActiveTab('admin');
    } else if (state.currentUser.role === 'driver') {
      setDriverInitialTab('history');
      setActiveTab('driver');
    } else {
      setActiveTab('user');
    }
  };
  
  // Modal states
  const [guestWarningOpen, setGuestWarningOpen] = useState(false);
  const [guestActionAttempted, setGuestActionAttempted] = useState<string | undefined>();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'customerRegister' | 'driverRegister' | 'adminRegister'>('customerRegister');

  // Load state from localStorage & fetch fresh data from PostgreSQL on client mount
  useEffect(() => {
    const loaded = loadSavedState();
    setState(loaded);
    setMounted(true);

    const fetchFreshData = async () => {
      try {
        const [custRes, drvRes, bkgRes, revRes, cmpRes, vehRes, notRes, waRes, notifRes, extRes] = await Promise.all([
          fetch('/api/customers').catch(() => null),
          fetch('/api/drivers').catch(() => null),
          fetch('/api/bookings').catch(() => null),
          fetch('/api/reviews').catch(() => null),
          fetch('/api/complaints').catch(() => null),
          fetch('/api/rental-vehicles').catch(() => null),
          fetch('/api/notices', {
            headers: {
              'x-user-id': loaded.currentUser.id,
              'x-user-role': loaded.currentUser.role,
            }
          }).catch(() => null),
          fetch('/api/whatsapp/enquiries').catch(() => null),
          fetch('/api/notifications').catch(() => null),
          fetch('/api/rental-extensions', {
            headers: {
              'x-user-id': loaded.currentUser.id,
              'x-user-role': loaded.currentUser.role,
            }
          }).catch(() => null),
        ]);

        const customers = custRes && custRes.ok ? await custRes.json() : null;
        const drivers = drvRes && drvRes.ok ? await drvRes.json() : null;
        const bookings = bkgRes && bkgRes.ok ? await bkgRes.json() : null;
        const reviews = revRes && revRes.ok ? await revRes.json() : null;
        const complaints = cmpRes && cmpRes.ok ? await cmpRes.json() : null;
        const rentalVehicles = vehRes && vehRes.ok ? await vehRes.json() : null;
        const notices = notRes && notRes.ok ? await notRes.json() : null;
        const whatsAppEnquiries = waRes && waRes.ok ? await waRes.json() : null;
        const notifications = notifRes && notifRes.ok ? await notifRes.json() : null;
        const rentalExtensions = extRes && extRes.ok ? await extRes.json() : [];

        setState(prev => ({
          ...prev,
          customers: customers ?? [],
          drivers: drivers ?? [],
          bookings: bookings ?? [],
          reviews: reviews ?? [],
          complaints: complaints ?? [],
          notices: notices ?? [],
          rentalVehicles: rentalVehicles ?? [],
          rentalExtensions: rentalExtensions ?? [],
          whatsAppEnquiries: whatsAppEnquiries ?? [],
          notifications: notifications ?? [],
        }));
      } catch (err) {
        console.warn('Failed to fetch from PostgreSQL:', err);
      }
    };

    fetchFreshData();

    // Real-Time Polling: Check for new bookings, drivers, notices, whatsapp enquiries & notifications every 1.2 seconds
    const pollInterval = setInterval(async () => {
      try {
        const [bkgRes, drvRes, vehRes, notRes, waRes, notifRes, extRes] = await Promise.all([
          fetch('/api/bookings').catch(() => null),
          fetch('/api/drivers').catch(() => null),
          fetch('/api/rental-vehicles').catch(() => null),
          fetch('/api/notices', {
            headers: {
              'x-user-id': stateRef.current.currentUser.id,
              'x-user-role': stateRef.current.currentUser.role,
            }
          }).catch(() => null),
          fetch('/api/whatsapp/enquiries').catch(() => null),
          fetch('/api/notifications').catch(() => null),
          fetch('/api/rental-extensions', {
            headers: {
              'x-user-id': stateRef.current.currentUser.id,
              'x-user-role': stateRef.current.currentUser.role,
            }
          }).catch(() => null),
        ]);
        if (bkgRes && bkgRes.ok) {
          const freshBookings = await bkgRes.json();
          setState(prev => {
            if (Array.isArray(freshBookings)) {
              const currentIds = prev.bookings.map(b => `${b.id}-${b.status}-${b.driverId}-${b.driverPaymentReceived}-${b.passengerPaid}-${b.requestQueueStatus}-${b.returnDate}-${b.extendedDays}-${b.extensionFee}-${b.remainingAmount}-${(b.fareBreakdown as any)?.totalFare}`);
              const freshIds = freshBookings.map((b: Booking) => `${b.id}-${b.status}-${b.driverId}-${b.driverPaymentReceived}-${b.passengerPaid}-${b.requestQueueStatus}-${b.returnDate}-${b.extendedDays}-${b.extensionFee}-${b.remainingAmount}-${(b.fareBreakdown as any)?.totalFare}`);
              if (JSON.stringify(currentIds) !== JSON.stringify(freshIds)) {
                return { ...prev, bookings: freshBookings };
              }
            }
            return prev;
          });
        }
        if (drvRes && drvRes.ok) {
          const freshDrivers = await drvRes.json();
          setState(prev => {
            if (Array.isArray(freshDrivers) && freshDrivers.length > 0) {
              return { ...prev, drivers: freshDrivers };
            }
            return prev;
          });
        }
        if (notRes && notRes.ok) {
          const freshNotices = await notRes.json();
          setState(prev => {
            if (Array.isArray(freshNotices)) {
              return { ...prev, notices: freshNotices };
            }
            return prev;
          });
        }
        if (vehRes && vehRes.ok) {
          const freshVehicles = await vehRes.json();
          setState(prev => {
            if (Array.isArray(freshVehicles)) {
              return { ...prev, rentalVehicles: freshVehicles };
            }
            return prev;
          });
        }
        if (waRes && waRes.ok) {
          const freshWa = await waRes.json();
          setState(prev => {
            if (Array.isArray(freshWa)) {
              return { ...prev, whatsAppEnquiries: freshWa };
            }
            return prev;
          });
        }
        if (notifRes && notifRes.ok) {
          const freshNotifs = await notifRes.json();
          setState(prev => {
            if (Array.isArray(freshNotifs)) {
              return { ...prev, notifications: freshNotifs };
            }
            return prev;
          });
        }
        if (extRes && extRes.ok) {
          const freshExts = await extRes.json();
          if (Array.isArray(freshExts)) {
            setState(prev => {
              const currentExtKey = (prev.rentalExtensions || []).map(e => `${e.id}-${e.status}-${e.requestedReturnDate}-${e.paymentStatus}`).join('|');
              const freshExtKey = freshExts.map((e: RentalExtension) => `${e.id}-${e.status}-${e.requestedReturnDate}-${e.paymentStatus}`).join('|');
              if (currentExtKey !== freshExtKey) {
                return { ...prev, rentalExtensions: freshExts };
              }
              return prev;
            });
          }
        }
      } catch {
        // Ignore background polling errors
      }
    }, 1200);

    // Cross-tab synchronization via BroadcastChannel (instant 0ms sync)
    let broadcastChannel: BroadcastChannel | null = null;
    const handleSyncMessage = (data: any) => {
      if (!data || !data.type) return;

      if (data.type === 'RENTAL_EXTENSION_CREATED' && data.payload?.extension) {
        const newExt = data.payload.extension;
        setState(prev => ({
          ...prev,
          rentalExtensions: [newExt, ...(prev.rentalExtensions || []).filter(e => e.id !== newExt.id)]
        }));
      } else if (data.type === 'RENTAL_EXTENSION_APPROVED' && data.payload?.extension) {
        const ext = data.payload.extension;
        setState(prev => ({
          ...prev,
          rentalExtensions: (prev.rentalExtensions || []).map(e => e.id === ext.id ? ext : e),
          bookings: prev.bookings.map(b => {
            if (b.id === ext.bookingId) {
              const fare = (b.fareBreakdown as any) || {};
              const newTotal = (fare.totalFare || 0) + ext.extensionPrice;
              const newRem = (b.remainingAmount ?? (fare.remainingAmount ?? Math.max(0, (fare.totalFare || 0) - (b.advanceAmount || 1000)))) + ext.extensionPrice;
              return {
                ...b,
                returnDate: ext.requestedReturnDate,
                extendedDays: (b.extendedDays || 0) + ext.additionalDays,
                extensionFee: (b.extensionFee || 0) + ext.extensionPrice,
                remainingAmount: newRem,
                fareBreakdown: { 
                  ...fare, 
                  totalFare: newTotal, 
                  remainingAmount: newRem, 
                  extendedDays: (b.extendedDays || 0) + ext.additionalDays,
                  extensionFee: (b.extensionFee || 0) + ext.extensionPrice 
                },
                notificationMessage: `Rental extension approved until ${ext.requestedReturnDate}. Extension amount of ₹${ext.extensionPrice} added along with remaining payment.`
              };
            }
            return b;
          })
        }));
      } else if (data.type === 'RENTAL_EXTENSION_DECLINED' && data.payload?.extension) {
        const ext = data.payload.extension;
        setState(prev => ({
          ...prev,
          rentalExtensions: (prev.rentalExtensions || []).map(e => e.id === ext.id ? ext : e)
        }));
      }
    };

    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        broadcastChannel.onmessage = (event) => {
          handleSyncMessage(event.data);
        };
      }
    } catch {
      // ignore
    }

    const handleCustomSyncEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        handleSyncMessage(customEvent.detail);
      }
    };
    window.addEventListener('drivec_extension_sync', handleCustomSyncEvent);

    // Cross-tab synchronization via localStorage events (instant 0ms sync across tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'drivec_platform_state_clean_v3' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setState(prev => ({
            ...prev,
            bookings: parsed.bookings || prev.bookings,
            drivers: parsed.drivers || prev.drivers,
            reviews: parsed.reviews || prev.reviews,
            complaints: parsed.complaints || prev.complaints,
            rentalExtensions: parsed.rentalExtensions || prev.rentalExtensions,
            rentalVehicles: parsed.rentalVehicles || prev.rentalVehicles,
          }));
        } catch {
          // Ignore parse errors
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(pollInterval);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
      window.removeEventListener('drivec_extension_sync', handleCustomSyncEvent);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Save state on changes
  useEffect(() => {
    if (mounted) {
      saveState(state);
    }
  }, [state, mounted]);

  const t = translations[state.language];
  const isGuest = state.currentUser.role === 'guest';

  // Open Guest Warning when a restricted action is clicked
  const triggerGuestWarning = (actionName?: string) => {
    setGuestActionAttempted(actionName);
    setGuestWarningOpen(true);
  };

  // Language switch
  const handleLanguageChange = (lang: Language) => {
    setState(prev => ({ ...prev, language: lang }));
  };

  // Auth Open
  const handleOpenAuth = (mode: 'login' | 'customerRegister' | 'driverRegister' | 'adminRegister') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  // Register Customer (Requirement 6: when customer registers/signs in, redirect to "Customers hero page" 'explore')
  const handleRegisterCustomer = (newUser: User) => {
    setState(prev => ({
      ...prev,
      customers: prev.customers.some(c => c.id === newUser.id) ? prev.customers : [...prev.customers, newUser],
      currentUser: {
        id: newUser.id,
        role: 'customer',
        name: newUser.name,
        phone: newUser.phone,
        email: newUser.email,
      }
    }));
    setActiveTab('explore'); // Customer redirected directly to the Hero / Explore booking page
  };

  // Register Driver (Strictly manual! Must be approved by Admin before signing in)
  const handleRegisterDriver = (newDriver: Driver) => {
    setState(prev => ({
      ...prev,
      drivers: prev.drivers.some(d => d.id === newDriver.id) ? prev.drivers : [...prev.drivers, newDriver]
    }));
  };

  // Sign in existing user / admin (Requirement 6: customer -> hero page, drivers & admin -> their own portals)
  const handleLogin = (user: { id: string; role: 'customer' | 'driver' | 'admin'; name: string; phone: string; email: string }) => {
    setState(prev => ({
      ...prev,
      currentUser: user
    }));
    if (user.role === 'customer') setActiveTab('explore'); // Redirect to Customers hero page!
    if (user.role === 'driver') setActiveTab('driver');   // Redirect to Driver Portal!
    if (user.role === 'admin') setActiveTab('admin');     // Redirect to Admin Console!
  };

  // Strictly enforce role routing
  // Drivers can NEVER see explore/hero/booking -> always routed to driver portal
  // Admin -> routed to admin portal
  // Only customers and guests can access explore / booking page
  // Customers/guests attempting to access driver portal are immediately blocked and redirected
  useEffect(() => {
    if (state.currentUser.role === 'driver' && activeTab !== 'driver') {
      setActiveTab('driver');
    } else if (state.currentUser.role === 'admin' && activeTab !== 'admin') {
      setActiveTab('admin');
    } else if (state.currentUser.role !== 'driver' && activeTab === 'driver') {
      setActiveTab(state.currentUser.role === 'customer' ? 'user' : 'explore');
    }
  }, [state.currentUser.role, activeTab]);

  // Toggle Favourite Driver
  const handleToggleFavouriteDriver = (driverId: string) => {
    setState(prev => {
      const exists = prev.favouriteDriverIds?.includes(driverId);
      const updated = exists
        ? (prev.favouriteDriverIds || []).filter(id => id !== driverId)
        : [...(prev.favouriteDriverIds || []), driverId];
      return {
        ...prev,
        favouriteDriverIds: updated
      };
    });
  };

  // Admin suspends driver
  const handleSuspendDriver = async (driverId: string, reason: string) => {
    setState(prev => ({
      ...prev,
      drivers: prev.drivers.map(d => d.id === driverId ? { ...d, approvalStatus: 'suspended' } : d)
    }));
    try {
      await fetch(`/api/drivers/${driverId}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': stateRef.current.currentUser.id || 'admin-master',
          'x-user-role': stateRef.current.currentUser.role === 'admin' ? 'admin' : stateRef.current.currentUser.role,
        },
        body: JSON.stringify({ action: 'suspend', notes: reason }),
      });
    } catch (err) {
      console.error('Error suspending driver in DB:', err);
    }
  };

  // Cancel booking (Requirement 2: Cancelled rides = zero payment)
  const handleCancelBooking = (bookingId: string) => {
    handleUpdateBookingStatus(bookingId, 'cancelled', {
      cancelledBy: 'customer',
      cancellationReason: 'Cancelled by customer',
      driverCreditedSalary: 0,
      platformCommission: 0,
      delayPenalty: 0
    });
  };

  // File complaint
  const handleFileComplaint = async (complaint: Complaint) => {
    setState(prev => ({
      ...prev,
      complaints: [complaint, ...prev.complaints]
    }));
    try {
      await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(complaint),
      });
    } catch (err) {
      console.error('Error saving complaint to DB:', err);
    }
  };

  // Admin resolves complaint with action
  const handleResolveComplaint = async (complaintId: string, notes: string, action?: 'warned' | 'suspended' | 'restricted' | 'dismissed') => {
    const targetComp = state.complaints.find(c => c.id === complaintId);
    const relatedBooking = targetComp ? state.bookings.find(b => b.id === targetComp.bookingId) : null;
    const targetDriverId = relatedBooking?.driverId;

    setState(prev => ({
      ...prev,
      complaints: prev.complaints.map(c => c.id === complaintId ? { 
        ...c, 
        status: 'resolved', 
        resolutionNotes: notes,
        actionTaken: action,
        actionDate: new Date().toISOString()
      } : c),
      drivers: (action === 'suspended' && targetDriverId) ? prev.drivers.map(d => d.id === targetDriverId ? { ...d, approvalStatus: 'suspended' } : d) : prev.drivers
    }));
    try {
      await fetch(`/api/complaints/${complaintId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', resolutionNotes: notes, actionTaken: action }),
      });
      if (action === 'suspended' && targetDriverId) {
        await fetch(`/api/drivers/${targetDriverId}/approve`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': stateRef.current.currentUser.id || 'admin-master',
            'x-user-role': stateRef.current.currentUser.role,
          },
          body: JSON.stringify({ action: 'suspend', notes: `Suspended due to complaint ${complaintId}: ${notes}` }),
        });
      }
    } catch (err) {
      console.error('Error resolving complaint in DB:', err);
    }
  };

  // Sign out (revert to guest)
  const handleSignOut = () => {
    setState(prev => ({
      ...prev,
      currentUser: {
        id: 'guest-session',
        role: 'guest',
        name: 'Guest Explorer',
        phone: '',
        email: '',
      }
    }));
    setActiveTab('explore');
  };

  // Booking Created
  const handleBookingCreated = async (newBooking: Booking): Promise<{ success: boolean; booking?: Booking; error?: string; errorCode?: string; mode?: string }> => {
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBooking),
      });
      const data = await res.json();
      if (res.ok) {
        setState(prev => ({
          ...prev,
          bookings: [data, ...prev.bookings.filter(b => b.id !== newBooking.id && b.refCode !== newBooking.refCode)]
        }));
        return { success: true, booking: data };
      } else {
        return {
          success: false,
          error: data.message || data.error || 'Failed to create booking',
          errorCode: data.error,
          mode: data.driverSelectionMode
        };
      }
    } catch (err: any) {
      console.error('Error creating booking in DB:', err);
      return { success: false, error: err?.message || 'Network error communicating with server' };
    }
  };

  // Update Booking Status (with optional extra fields for OTP / cancelledBy etc.)
  const handleUpdateBookingStatus = async (bookingId: string, status: Booking['status'], extra?: Record<string, unknown>) => {
    const isNowCompleted = status === 'completed';
    const isNowCancelled = status === 'cancelled';

    setState(prev => {
      const updated = prev.bookings.map(b => {
        if (b.id === bookingId) {
          const isDelayed = extra?.isDelayed !== undefined ? Boolean(extra.isDelayed) : Boolean(b.isDelayed);
          const { driverSalary, platformCommission, delayPenalty } = isNowCancelled
            ? { driverSalary: 0, platformCommission: 0, delayPenalty: 0 }
            : calculateDriverSalary(b.fareBreakdown.totalFare, isDelayed, status);

          return {
            ...b,
            status,
            isDelayed,
            ...(isNowCancelled ? { driverCreditedSalary: 0, platformCommission: 0, delayPenalty: 0 } : {}),
            ...(isNowCompleted ? { driverCreditedSalary: driverSalary, platformCommission, delayPenalty } : {}),
            ...(extra || {}),
            paymentStatus: isNowCompleted ? ('completed' as const) : (isNowCancelled ? ('refunded' as const) : b.paymentStatus)
          };
        }
        return b;
      });

      // If completed, update driver trip count
      const target = prev.bookings.find(b => b.id === bookingId);
      let updatedDrivers = prev.drivers;
      if (isNowCompleted && target && target.driverId) {
        updatedDrivers = prev.drivers.map(d => {
          if (d.id === target.driverId) {
            return {
              ...d,
              totalTrips: d.totalTrips + 1,
              totalEarnings: d.totalEarnings + target.fareBreakdown.totalFare
            };
          }
          return d;
        });
      }

      return {
        ...prev,
        bookings: updated,
        drivers: updatedDrivers,
        rentalExtensions: extra?.remainingPaid
          ? (prev.rentalExtensions || []).map(e => e.bookingId === bookingId && e.status === 'approved' ? { ...e, paymentStatus: 'completed' as const } : e)
          : prev.rentalExtensions
      };
    });

    try {
      await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(extra || {}) }),
      });
    } catch (err) {
      console.error('Error updating booking status in DB:', err);
    }
  };

  // Passenger completes payment
  const handlePassengerPayment = async (bookingId: string, paymentMethod: 'cash' | 'upi' | 'card') => {
    setState(prev => ({
      ...prev,
      bookings: prev.bookings.map(b =>
        b.id === bookingId
          ? { ...b, passengerPaid: true, paymentStatus: 'completed' as const, paymentMethod }
          : b
      )
    }));
    try {
      await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passengerPaid: true, paymentMethod }),
      });
    } catch (err) {
      console.error('Error saving passenger payment to DB:', err);
    }
  };

  // Driver confirms payment received → credits 40% salary (minus 3% if delayed) to driver wallet
  // Security Feature 1: Allow Drivers to Credit Salary to Their Wallet Only After Customer Payment
  // Strictly verifies customer payment before crediting wallet
  const handleDriverPaymentReceived = async (bookingId: string) => {
    const booking = state.bookings.find(b => b.id === bookingId);
    if (!booking) return;
    if (booking.status === 'cancelled') return; // Zero payment on cancelled
    if (booking.status !== 'completed') return; // Credit salary only if ride is completed

    const isDelayed = Boolean(booking.isDelayed);
    const effectiveDriverId = booking.driverId || state.currentUser.id;

    // Call strict backend verification endpoint with authenticated driver context
    const res = await fetch(`/api/bookings/${bookingId}/credit-salary`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-user-id': state.currentUser.id || effectiveDriverId,
        'x-user-role': state.currentUser.role === 'customer' ? 'driver' : (state.currentUser.role || 'driver'),
        'x-driver-id': effectiveDriverId,
      },
      body: JSON.stringify({ isDelayed, driverId: effectiveDriverId }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data.message || data.error || "Passenger hasn't paid yet";
      const err = new Error(errMsg);
      (err as any).code = data.code;
      (err as any).booking = booking;
      throw err;
    }

    const creditedSalary = data.creditedSalary ?? (booking.driverCreditedSalary || Math.round(booking.fareBreakdown.totalFare * 0.40));
    const platformCommission = data.platformCommission ?? (booking.fareBreakdown.totalFare - creditedSalary);
    const delayPenalty = data.delayPenalty ?? (isDelayed ? Math.round(booking.fareBreakdown.totalFare * 0.40 * 0.03) : 0);

    setState(prev => ({
      ...prev,
      bookings: prev.bookings.map(b =>
        b.id === bookingId
          ? { 
              ...b, 
              driverPaymentReceived: true, 
              driverCreditedSalary: creditedSalary, 
              platformCommission,
              delayPenalty,
              driverPaymentReceivedAt: new Date().toISOString(),
              salaryCreditTxId: data.salaryCreditTxId,
              salaryCreditedAt: data.salaryCreditedAt || new Date().toISOString(),
            }
          : b
      ),
      drivers: prev.drivers.map(d =>
        d.id === booking.driverId
          ? { ...d, walletBalance: typeof data.walletBalance === 'number' ? data.walletBalance : (d.walletBalance || 0) + creditedSalary }
          : d
      )
    }));

    return data;
  };

  // Driver Online Toggle
  const handleToggleOnline = async (driverId: string, isOnline: boolean) => {
    setState(prev => ({
      ...prev,
      drivers: prev.drivers.map(d => d.id === driverId ? { ...d, isOnline } : d)
    }));
    try {
      await fetch(`/api/drivers/${driverId}/online`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': stateRef.current.currentUser.id || driverId,
          'x-user-role': stateRef.current.currentUser.role || 'driver',
          'x-driver-id': driverId,
        },
        body: JSON.stringify({ isOnline }),
      });
    } catch (err) {
      console.error('Error updating driver online status in DB:', err);
    }
  };

  // Admin approves driver
  const handleApproveDriver = async (driverId: string) => {
    setState(prev => ({
      ...prev,
      drivers: prev.drivers.map(d => d.id === driverId ? { ...d, approvalStatus: 'approved' } : d)
    }));
    try {
      await fetch(`/api/drivers/${driverId}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': stateRef.current.currentUser.id || 'admin-master',
          'x-user-role': stateRef.current.currentUser.role,
        },
        body: JSON.stringify({ action: 'approve' }),
      });
    } catch (err) {
      console.error('Error approving driver in DB:', err);
    }
  };

  // Admin rejects driver
  const handleRejectDriver = async (driverId: string) => {
    setState(prev => ({
      ...prev,
      drivers: prev.drivers.map(d => d.id === driverId ? { ...d, approvalStatus: 'rejected' } : d)
    }));
    try {
      await fetch(`/api/drivers/${driverId}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': stateRef.current.currentUser.id || 'admin-master',
          'x-user-role': stateRef.current.currentUser.role,
        },
        body: JSON.stringify({ action: 'reject' }),
      });
    } catch (err) {
      console.error('Error rejecting driver in DB:', err);
    }
  };

  // Submit manual review
  const handleSubmitReview = async (newReview: Review) => {
    setState(prev => {
      const newReviews = [newReview, ...prev.reviews];
      // Update target driver rating if applicable
      let updatedDrivers = prev.drivers;
      if (newReview.targetRole === 'driver') {
        updatedDrivers = prev.drivers.map(d => {
          if (d.id === newReview.targetId) {
            const driverRevs = newReviews.filter(r => r.targetId === d.id);
            const avg = driverRevs.reduce((acc, r) => acc + r.overallRating, 0) / driverRevs.length;
            return {
              ...d,
              ratingAverage: parseFloat(avg.toFixed(1)),
              ratingCount: driverRevs.length
            };
          }
          return d;
        });
      }

      return {
        ...prev,
        reviews: newReviews,
        drivers: updatedDrivers
      };
    });

    try {
      await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReview),
      });
    } catch (err) {
      console.error('Error submitting review to DB:', err);
    }
  };

  // Requirement 10: Admin replies to review
  const handleReplyReview = async (reviewId: string, replyText: string) => {
    const now = new Date().toISOString();
    setState(prev => ({
      ...prev,
      reviews: prev.reviews.map(r => r.id === reviewId ? {
        ...r,
        adminReply: replyText,
        adminRepliedAt: now,
      } : r)
    }));

    try {
      await fetch('/api/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reviewId, adminReply: replyText }),
      });
    } catch (err) {
      console.error('Error replying to review in DB:', err);
    }
  };

  // Admin delete review
  const handleDeleteReview = async (reviewId: string) => {
    setState(prev => ({
      ...prev,
      reviews: prev.reviews.filter(r => r.id !== reviewId)
    }));
    try {
      await fetch(`/api/reviews?id=${reviewId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Error deleting review in DB:', err);
    }
  };

  // Requirement 2 & 3: Admin Issues Warning / Suspension Notice to Driver
  const handleIssueNotice = async (noticeData: {
    driverId: string;
    driverName: string;
    driverPhone?: string;
    type: 'warning' | 'suspension';
    reason: string;
    reviewId?: string;
    bookingId?: string;
    bookingRef?: string;
  }) => {
    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': stateRef.current.currentUser.id || 'admin-master',
          'x-user-role': stateRef.current.currentUser.role,
        },
        body: JSON.stringify({
          ...noticeData,
          adminId: stateRef.current.currentUser.id || 'admin-master',
          adminName: stateRef.current.currentUser.name || 'DriveC Administrator',
        }),
      });
      if (res.ok) {
        const created: DriverNotice = await res.json();
        setState(prev => ({
          ...prev,
          notices: [created, ...(prev.notices || [])],
          drivers: noticeData.type === 'suspension'
            ? prev.drivers.map(d => d.id === noticeData.driverId ? { ...d, approvalStatus: 'suspended' as const, isOnline: false } : d)
            : prev.drivers,
        }));
        return created;
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to issue notice');
      }
    } catch (err) {
      console.error('Error issuing notice:', err);
      throw err;
    }
  };

  // Requirement 3: Driver Acknowledges Notice (stops blinking indicator)
  const handleAcknowledgeNotice = async (noticeId: string) => {
    try {
      const res = await fetch(`/api/notices/${noticeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': stateRef.current.currentUser.id,
          'x-user-role': stateRef.current.currentUser.role,
        },
        body: JSON.stringify({ action: 'acknowledge' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setState(prev => ({
          ...prev,
          notices: (prev.notices || []).map(n => n.id === noticeId ? { ...n, isAcknowledged: true, acknowledgedAt: updated.acknowledgedAt || new Date().toISOString() } : n),
        }));
        return updated;
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to acknowledge notice');
      }
    } catch (err) {
      console.error('Error acknowledging notice:', err);
      throw err;
    }
  };

  // Requirement 3: Driver Dismisses / Closes Notice from Active View (preserved in DB history)
  const handleDismissNotice = async (noticeId: string) => {
    try {
      const res = await fetch(`/api/notices/${noticeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': stateRef.current.currentUser.id,
          'x-user-role': stateRef.current.currentUser.role,
        },
        body: JSON.stringify({ action: 'dismiss' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setState(prev => ({
          ...prev,
          notices: (prev.notices || []).map(n => n.id === noticeId ? { ...n, status: 'dismissed' as const, isAcknowledged: true } : n),
        }));
        return updated;
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to dismiss notice');
      }
    } catch (err) {
      console.error('Error dismissing notice:', err);
      throw err;
    }
  };

  // Requirement 3: Driver or Admin Replies to Notice
  const handleReplyNotice = async (noticeId: string, message: string, senderRole: 'admin' | 'driver', senderName: string) => {
    try {
      const res = await fetch(`/api/notices/${noticeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': stateRef.current.currentUser.id || (senderRole === 'admin' ? 'admin-master' : ''),
          'x-user-role': stateRef.current.currentUser.role || senderRole,
        },
        body: JSON.stringify({ action: 'reply', message, senderRole, senderName }),
      });
      if (res.ok) {
        const updated = await res.json();
        setState(prev => ({
          ...prev,
          notices: (prev.notices || []).map(n => n.id === noticeId ? updated : n),
        }));
        return updated;
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to reply to notice');
      }
    } catch (err) {
      console.error('Error replying to notice:', err);
      throw err;
    }
  };

  // Persistent Read/Unread Notification Tracking
  const handleMarkNotificationRead = async (noticeId: string, targetRole: 'admin' | 'driver') => {
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noticeId, targetRole }),
      });
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      setState(prev => {
        const notifs = prev.notifications || [];
        const hasExisting = notifs.some(n => n.noticeId === noticeId && n.targetRole === targetRole);
        if (hasExisting) {
          return {
            ...prev,
            notifications: notifs.map(n =>
              (n.noticeId === noticeId && n.targetRole === targetRole)
                ? { ...n, isRead: true, readAt: new Date().toISOString() }
                : n
            ),
          };
        } else {
          const synthetic: DisputeNotification = {
            id: `read_${Date.now()}`,
            noticeId,
            driverId: '',
            adminId: 'admin-master',
            targetRole,
            eventType: targetRole === 'admin' ? 'case_reviewed' : 'notice_viewed',
            title: 'Read',
            message: 'Marked as read',
            isRead: true,
            readAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };
          return {
            ...prev,
            notifications: [synthetic, ...notifs],
          };
        }
      });
    } catch (err) {
      console.error('Failed to mark notification as read in database:', err);
      throw err;
    }
  };

  // WhatsApp Enquiry Management
  const handleUpdateWhatsAppEnquiry = async (enquiryId: string, updates: any) => {
    try {
      const res = await fetch(`/api/whatsapp/enquiries/${enquiryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setState(prev => ({
          ...prev,
          whatsAppEnquiries: (prev.whatsAppEnquiries || []).map(w => w.id === enquiryId ? updated : w),
        }));
        return updated;
      }
    } catch (err) {
      console.error('Failed to update WhatsApp enquiry:', err);
    }
  };

  // ── Self-Drive Rental Extension Handlers ─────────────────────────────────────
  const handleRequestRentalExtension = async (bookingId: string, requestedReturnDate: string, notes?: string) => {
    try {
      const res = await fetch('/api/rental-extensions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': stateRef.current.currentUser.id,
          'x-user-role': stateRef.current.currentUser.role,
        },
        body: JSON.stringify({ bookingId, requestedReturnDate, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to submit extension request');
      }
      setState(prev => {
        const nextState = {
          ...prev,
          rentalExtensions: [data, ...(prev.rentalExtensions || []).filter(e => e.id !== data.id)]
        };
        saveState(nextState);
        return nextState;
      });
      broadcastSyncEvent({ type: 'RENTAL_EXTENSION_CREATED', payload: { extension: data } });
      return data;
    } catch (err) {
      console.error('Error submitting extension request:', err);
      throw err;
    }
  };

  const handleApproveRentalExtension = async (extensionId: string, adminNotes?: string) => {
    try {
      const res = await fetch(`/api/rental-extensions/${extensionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': stateRef.current.currentUser.id || 'admin',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({ action: 'approve', adminNotes }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to approve extension');
      }
      setState(prev => {
        const nextState = {
          ...prev,
          rentalExtensions: (prev.rentalExtensions || []).map(e => e.id === extensionId ? data.extension : e),
          bookings: prev.bookings.map(b => {
            if (b.id === data.extension.bookingId) {
              const fare = (b.fareBreakdown as any) || {};
              const newTotal = (fare.totalFare || 0) + data.extension.extensionPrice;
              const newRem = (b.remainingAmount ?? (fare.remainingAmount ?? Math.max(0, (fare.totalFare || 0) - (b.advanceAmount || 1000)))) + data.extension.extensionPrice;
              return {
                ...b,
                returnDate: data.extension.requestedReturnDate,
                extendedDays: (b.extendedDays || 0) + data.extension.additionalDays,
                extensionFee: (b.extensionFee || 0) + data.extension.extensionPrice,
                remainingAmount: newRem,
                fareBreakdown: { 
                  ...fare, 
                  totalFare: newTotal, 
                  remainingAmount: newRem, 
                  extendedDays: (b.extendedDays || 0) + data.extension.additionalDays,
                  extensionFee: (b.extensionFee || 0) + data.extension.extensionPrice 
                },
                notificationMessage: `Rental extension approved until ${data.extension.requestedReturnDate}. Extension amount of ₹${data.extension.extensionPrice} added along with remaining payment.`
              };
            }
            return b;
          })
        };
        saveState(nextState);
        return nextState;
      });
      broadcastSyncEvent({ 
        type: 'RENTAL_EXTENSION_APPROVED', 
        payload: { extension: data.extension, bookingId: data.extension.bookingId } 
      });
      return data.extension;
    } catch (err) {
      console.error('Error approving extension:', err);
      throw err;
    }
  };

  const handleDeclineRentalExtension = async (extensionId: string, adminNotes?: string) => {
    try {
      const res = await fetch(`/api/rental-extensions/${extensionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': stateRef.current.currentUser.id || 'admin',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({ action: 'decline', adminNotes }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to decline extension');
      }
      setState(prev => {
        const nextState = {
          ...prev,
          rentalExtensions: (prev.rentalExtensions || []).map(e => e.id === extensionId ? data.extension : e)
        };
        saveState(nextState);
        return nextState;
      });
      broadcastSyncEvent({ 
        type: 'RENTAL_EXTENSION_DECLINED', 
        payload: { extension: data.extension } 
      });
      return data.extension;
    } catch (err) {
      console.error('Error declining extension:', err);
      throw err;
    }
  };

  const handlePayRentalExtension = async (extensionId: string, paymentMethod: 'upi' | 'card' | 'cash') => {
    try {
      const res = await fetch(`/api/rental-extensions/${extensionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': state.currentUser.id,
          'x-user-role': state.currentUser.role,
        },
        body: JSON.stringify({ action: 'pay', paymentMethod }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to pay extension');
      }
      setState(prev => ({
        ...prev,
        rentalExtensions: (prev.rentalExtensions || []).map(e => e.id === extensionId ? data.extension : e),
        bookings: prev.bookings.map(b => {
          if (b.id === data.extension.bookingId) {
            const currentRemaining = Math.max(0, (b.remainingAmount || 0) - data.extension.extensionPrice);
            return {
              ...b,
              remainingAmount: currentRemaining,
              remainingPaid: currentRemaining === 0 ? true : b.remainingPaid
            };
          }
          return b;
        })
      }));
      return data.extension;
    } catch (err) {
      console.error('Error paying extension:', err);
      throw err;
    }
  };

  // Smooth scroll
  // Collapse expanded cards across all portals whenever active view changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('drivec_collapse_cards'));
    }
  }, [activeTab]);

  const handleNavigateSection = (sectionId: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('drivec_collapse_cards'));
    }
    const targetId = (sectionId === 'faqs' || sectionId === 'faq') ? 'aeo-faqs' : sectionId;
    const el = document.getElementById(targetId) || document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (typeof el.focus === 'function') {
        el.focus({ preventScroll: true });
      }
    }
  };

  // Filter approved drivers for booking
  const approvedDrivers = state.drivers.filter(d => d.approvalStatus === 'approved');
  const currentDriverRecord = state.currentUser.role === 'driver'
    ? state.drivers.find(d => d.id === state.currentUser.id || (Boolean(state.currentUser.phone) && d.phone === state.currentUser.phone))
    : undefined;
  const completedBookings = state.bookings.filter(b => b.status === 'completed');
  const customerCompletedBookings = state.bookings.filter(b => 
    b.status === 'completed' && 
    (b.customerId === state.currentUser.id || (Boolean(state.currentUser.phone) && b.customerPhone === state.currentUser.phone))
  );

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-sm">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Initializing DriveC Executive Mobility Platform...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#090a0f] text-slate-100 selection:bg-[#002C6C] selection:text-white">

      {/* DriveC Navbar — fixed + transparent over hero, solid on scroll */}
      <Navbar
        language={state.language}
        onLanguageChange={handleLanguageChange}
        currentUser={state.currentUser}
        onOpenGuestWarning={() => triggerGuestWarning('Access Protected Terminal')}
        onOpenAuth={handleOpenAuth}
        onSignOut={handleSignOut}
        onNavigateSection={handleNavigateSection}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenDrivingHistory={handleOpenDrivingHistory}
      />

      {/* Main Content Router based on Active Tab */}
      <main className={`flex-1 ${activeTab !== 'explore' ? 'pt-20 sm:pt-24' : 'pt-0'}`}>
        {activeTab === 'explore' && (
          <div className="space-y-0">
            
            {/* KINTO-INSPIRED HERO SECTION WITH PHOTOGRAPHY CAROUSEL */}
            <HeroSection
              language={state.language}
              isGuest={isGuest}
              onOpenGuestWarning={triggerGuestWarning}
              onNavigateSection={handleNavigateSection}
            />

            {/* DYNAMIC BOOKING ENGINE */}
            <BookingEngine
              language={state.language}
              currentUser={state.currentUser}
              customerData={state.customers.find(c => c.id === state.currentUser.id || (Boolean(state.currentUser.phone) && c.phone === state.currentUser.phone))}
              onOpenGuestWarning={triggerGuestWarning}
              onBookingCreated={handleBookingCreated}
              onCancelBooking={handleCancelBooking}
              approvedDrivers={approvedDrivers}
              rentalVehicles={state.rentalVehicles || []}
              bookings={state.bookings}
              favouriteDriverIds={state.favouriteDriverIds || []}
              onToggleFavouriteDriver={handleToggleFavouriteDriver}
              onNavigateToPortal={(tab) => setActiveTab(tab)}
              onPassengerPayment={handlePassengerPayment}
            />

            {/* SERVICES SHOWCASE SECTION */}
            <section id="services" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="text-center max-w-3xl mx-auto mb-8">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-cyan-300 bg-[#002C6C]/40 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                  8 TAILORED MOBILITY PILLARS
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1.5">
                  Comprehensive Driver & Vehicle Services
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Engineered for corporate transit, family events, hospital care, and scenic journeys across Kerala.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(Object.keys(t.services) as RideServiceType[]).map((srv) => {
                  const s = t.services[srv];
                  return (
                    <div 
                      key={srv}
                      onClick={() => {
                        if (isGuest) {
                          triggerGuestWarning(s.title);
                        } else {
                          handleNavigateSection('booking-engine');
                        }
                      }}
                      className="cursor-pointer group bg-[#14171f] rounded-2xl p-4 sm:p-5 border border-[#262b36] shadow-sm hover:border-[#002C6C]/80 hover:shadow-lg transition-all flex flex-col justify-between space-y-3.5"
                    >
                      <div className="space-y-2.5">
                        <div className="w-10 h-10 rounded-xl bg-[#1c2230] group-hover:bg-[#002C6C] group-hover:text-white text-blue-400 transition-colors flex items-center justify-center font-bold">
                          {srv === 'one-way' && <Navigation className="w-5 h-5" />}
                          {srv === 'round-trip' && <Clock className="w-5 h-5" />}
                          {srv === 'hospital-assistance' && <HeartHandshake className="w-5 h-5 text-rose-400 group-hover:text-white" />}
                          {srv === 'bar-pickup' && <Wine className="w-5 h-5 text-purple-400 group-hover:text-white" />}
                          {srv === 'tour-package' && <Palmtree className="w-5 h-5 text-emerald-400 group-hover:text-white" />}
                          {srv === 'airport-transfer' && <Plane className="w-5 h-5 text-sky-400 group-hover:text-white" />}
                          {srv === 'advance-event' && <Sparkles className="w-5 h-5 text-cyan-400 group-hover:text-white" />}
                          {srv === 'hourly-driver' && <Timer className="w-5 h-5 text-cyan-400 group-hover:text-white" />}
                        </div>
                        <h3 className="font-bold text-white text-sm group-hover:text-cyan-300 transition-colors">
                          {s.title}
                        </h3>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {s.desc}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-[#262b36] flex items-center justify-between text-xs font-semibold text-cyan-300">
                        <span>Book Service</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* VEHICLE FLEET & CATEGORIES SECTION */}
            <section id="fleet" className="bg-[#090a0f] border-y border-[#262b36] py-10 sm:py-12">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto mb-8">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-cyan-300 bg-[#002C6C]/40 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                    FLEET SPECIFICATIONS
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white mt-1.5">
                    Premium & Sustainable Vehicle Categories
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Inspected for safety, air-conditioning, sanitized cabins, and luggage capacity.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(Object.keys(t.categories) as (keyof typeof t.categories)[]).map((cat) => {
                    const c = t.categories[cat];
                    return (
                      <div key={cat} className="bg-[#14171f] rounded-2xl p-4 sm:p-5 border border-[#262b36] shadow-sm flex flex-col justify-between space-y-3.5">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                              Category
                            </span>
                            {cat === 'premium' && (
                              <span className="text-[9px] sm:text-[10px] font-bold text-cyan-300 bg-blue-950/70 px-2 py-0.5 rounded-full border border-blue-500/40">
                                Executive Class
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-white text-sm sm:text-base">{c.name}</h3>
                          <p className="text-[11px] text-slate-400 leading-relaxed">{c.desc}</p>
                        </div>

                        <div className="border-t border-[#262b36] pt-2.5 space-y-1 text-[11px] text-slate-400">
                          <div className="flex justify-between">
                            <span>Capacity:</span>
                            <strong className="text-slate-200">{c.seats} Passenger(s)</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Luggage Room:</span>
                            <strong className="text-slate-200">{c.luggage}</strong>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (isGuest) {
                              triggerGuestWarning(`Select ${c.name}`);
                            } else {
                              handleNavigateSection('booking-engine');
                            }
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-[#002C6C] hover:bg-[#001f4d] text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <span>Reserve Category</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* KERALA SERVICE HUBS & AEO FAQs */}
            <div id="areas">
              <SeoSections language={state.language} />
            </div>

            {/* AUTHENTIC REVIEWS SECTION */}
            <div id="reviews">
              <ReviewsSection
                language={state.language}
                reviews={state.reviews}
                completedBookings={customerCompletedBookings}
                currentUser={state.currentUser}
                onOpenGuestWarning={triggerGuestWarning}
                onSubmitReview={handleSubmitReview}
              />
            </div>

          </div>
        )}

        {/* USER / PASSENGER PORTAL TAB */}
        {activeTab === 'user' && (
          <UserPortal
            language={state.language}
            currentUser={state.currentUser}
            customerData={state.customers.find(c => c.id === state.currentUser.id || c.phone === state.currentUser.phone)}
            bookings={state.bookings}
            rentalVehicles={state.rentalVehicles || []}
            rentalExtensions={state.rentalExtensions || []}
            reviews={state.reviews}
            drivers={state.drivers}
            favouriteDriverIds={state.favouriteDriverIds || []}
            onToggleFavouriteDriver={handleToggleFavouriteDriver}
            onOpenGuestWarning={() => triggerGuestWarning('Access User Portal')}
            onNavigateToBooking={() => {
              setActiveTab('explore');
              setTimeout(() => handleNavigateSection('booking-engine'), 100);
            }}
            onCancelBooking={handleCancelBooking}
            onOpenReviewModalForBooking={(booking) => {
              setActiveTab('explore');
              setTimeout(() => handleNavigateSection('reviews'), 100);
            }}
            onSubmitReview={handleSubmitReview}
            onFileComplaint={handleFileComplaint}
            onPassengerPayment={handlePassengerPayment}
            onUpdateBookingStatus={handleUpdateBookingStatus}
            onRequestRentalExtension={handleRequestRentalExtension}
            onPayRentalExtension={handlePayRentalExtension}
            complaints={state.complaints.filter(c => c.complainantId === state.currentUser.id)}
          />
        )}

        {/* DRIVER TERMINAL TAB */}
        {activeTab === 'driver' && (
          state.currentUser.role === 'driver' && currentDriverRecord ? (
            <DriverPortal
              language={state.language}
              initialTab={driverInitialTab}
              currentDriver={currentDriverRecord}
              bookings={state.bookings}
              whatsAppEnquiries={state.whatsAppEnquiries || []}
              reviews={state.reviews}
              notices={state.notices || []}
              onUpdateBookingStatus={handleUpdateBookingStatus}
              onDriverPaymentReceived={handleDriverPaymentReceived}
              onToggleOnline={handleToggleOnline}
              onOpenGuestWarning={() => triggerGuestWarning('Access Driver Terminal')}
              currentUserRole={state.currentUser.role}
              notifications={state.notifications || []}
              onMarkNotificationRead={handleMarkNotificationRead}
              onAcknowledgeNotice={handleAcknowledgeNotice}
              onDismissNotice={handleDismissNotice}
              onReplyNotice={handleReplyNotice}
            />
          ) : (
            <div className="max-w-md mx-auto my-16 p-8 bg-[#14171f] border border-rose-900/60 rounded-3xl text-center shadow-xl">
              <div className="w-12 h-12 bg-rose-950/60 border border-rose-800/60 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4 font-black text-xl">403</div>
              <h2 className="text-xl font-black text-slate-100">403 Forbidden</h2>
              <p className="text-xs text-slate-300 mt-2">Driver Portal access is strictly restricted to authenticated drivers. Customers and guests cannot access this area.</p>
              <button
                onClick={() => setActiveTab(state.currentUser.role === 'customer' ? 'user' : 'explore')}
                className="mt-5 px-5 py-2.5 bg-[#002C6C] text-white rounded-xl text-xs font-bold hover:bg-[#001f4d] transition-colors"
              >
                Return to {state.currentUser.role === 'customer' ? 'Customer Dashboard' : 'Explore'}
              </button>
            </div>
          )
        )}

        {/* ADMIN COMMAND CENTER TAB (Fleet, Rentals, Approvals, Disputes & Operations) */}
        {activeTab === 'admin' && (
          <AdminPortal
            language={state.language}
            currentUserRole={state.currentUser.role}
            initialTab={adminInitialTab}
            drivers={state.drivers}
            customers={state.customers}
            bookings={state.bookings}
            whatsAppEnquiries={state.whatsAppEnquiries || []}
            reviews={state.reviews}
            complaints={state.complaints}
            rentalVehicles={state.rentalVehicles || []}
            rentalExtensions={state.rentalExtensions || []}
            notices={state.notices || []}
            notifications={state.notifications || []}
            onApproveRentalExtension={handleApproveRentalExtension}
            onDeclineRentalExtension={handleDeclineRentalExtension}
            onMarkNotificationRead={handleMarkNotificationRead}
            onUpdateWhatsAppEnquiry={handleUpdateWhatsAppEnquiry}
            onCreateBooking={handleBookingCreated}
            onIssueNotice={handleIssueNotice}
            onReplyNotice={handleReplyNotice}
            onAddRentalVehicle={async (newVeh) => {
              setState(prev => ({
                ...prev,
                rentalVehicles: [newVeh, ...(prev.rentalVehicles || [])]
              }));
              try {
                await fetch('/api/rental-vehicles', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(newVeh),
                });
              } catch (err) {
                console.error('Error saving rental vehicle to DB:', err);
              }
            }}
            onToggleRentalVehicleAvailability={async (vehicleId, isAvailable, offlineUntil) => {
              setState(prev => ({
                ...prev,
                rentalVehicles: (prev.rentalVehicles || []).map(v => v.id === vehicleId ? { ...v, isAvailable, offlineUntil: isAvailable ? undefined : offlineUntil, maintenanceReason: isAvailable ? undefined : v.maintenanceReason } : v)
              }));
              try {
                await fetch(`/api/rental-vehicles/${vehicleId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    isAvailable,
                    offlineUntil: isAvailable ? null : (offlineUntil || null),
                    maintenanceReason: isAvailable ? null : undefined,
                  }),
                });
              } catch (err) {
                console.error('Error toggling rental vehicle availability in DB:', err);
              }
            }}
            onUpdateRentalVehicle={async (updatedVeh) => {
              setState(prev => ({
                ...prev,
                rentalVehicles: (prev.rentalVehicles || []).map(v => v.id === updatedVeh.id ? updatedVeh : v)
              }));
              try {
                await fetch(`/api/rental-vehicles/${updatedVeh.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(updatedVeh),
                });
              } catch (err) {
                console.error('Error updating rental vehicle in DB:', err);
              }
            }}
            onDeleteRentalVehicle={async (vehicleId) => {
              setState(prev => ({
                ...prev,
                rentalVehicles: (prev.rentalVehicles || []).filter(v => v.id !== vehicleId)
              }));
              try {
                await fetch(`/api/rental-vehicles/${vehicleId}`, {
                  method: 'DELETE',
                });
              } catch (err) {
                console.error('Error deleting rental vehicle from DB:', err);
              }
            }}
            onUpdateBookingStatus={handleUpdateBookingStatus}
            onApproveDriver={handleApproveDriver}
            onRejectDriver={handleRejectDriver}
            onSuspendDriver={handleSuspendDriver}
            onDeleteReview={handleDeleteReview}
            onReplyReview={handleReplyReview}
            onResolveComplaint={handleResolveComplaint}
            onOpenGuestWarning={() => triggerGuestWarning('Administrative Command Center')}
          />
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-[#050608] text-slate-400 text-xs py-14 border-t border-[#262b36]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#002C6C] text-white font-black flex items-center justify-center shadow-sm">
                  D
                </div>
                <span className="font-black text-white text-base tracking-wider">
                  DriveC
                </span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                One premium platform for professional driver bookings and self-drive car rentals in Kochi, Kerala. Transparent pricing and verified safety.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-white mb-3">Kerala Service Hubs</h4>
              <ul className="space-y-1.5 text-slate-400">
                <li>Cochin International Airport (COK)</li>
                <li>Trivandrum International Airport (TRV)</li>
                <li>Kozhikode Malabar Coast (CCJ)</li>
                <li>Munnar & High Ranges Tour Zone</li>
                <li>Thrissur Cultural Capital & Guruvayur</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white mb-3">Safety & Compliance</h4>
              <ul className="space-y-1.5 text-slate-400">
                <li>Ride-Start OTP Verification</li>
                <li>Manual Commercial License KYC</li>
                <li>Kerala MVD RC & Insurance Checks</li>
                <li>Hospital Assistance Escort Privacy</li>
                <li>Safe Night Transit Protocol</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white mb-3">Customer & Driver Care</h4>
              <p className="text-slate-400 text-xs mb-2">
                24/7 Operations Desk (Ernakulam Central):
              </p>
              <p className="font-mono font-bold text-cyan-300 text-sm mb-3">
                +91 484 290 8000
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleLanguageChange('en')}
                  className={`px-2.5 py-1 rounded text-[11px] ${state.language === 'en' ? 'bg-[#002C6C] text-white font-bold' : 'bg-white/10'}`}
                >
                  English
                </button>
                <button
                  onClick={() => handleLanguageChange('ml')}
                  className={`px-2.5 py-1 rounded text-[11px] ${state.language === 'ml' ? 'bg-[#002C6C] text-white font-bold' : 'bg-white/10'}`}
                >
                  മലയാളം
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-[#262b36] pt-6 flex flex-col sm:flex-row justify-between items-center text-slate-500 text-[11px] gap-3">
            <p>© {new Date().getFullYear()} DriveC Kerala Mobility Platform. All rights reserved.</p>
            <div className="flex gap-4">
              <span className="hover:underline cursor-pointer">Privacy & Data Governance</span>
              <span className="hover:underline cursor-pointer">Kerala Transport Terms</span>
              <span className="hover:underline cursor-pointer">Fare Transparency Charter</span>
            </div>
          </div>
        </div>
      </footer>

      {/* GUEST INTERCEPTION WARNING MODAL */}
      <GuestGateModal
        isOpen={guestWarningOpen}
        onClose={() => setGuestWarningOpen(false)}
        language={state.language}
        onOpenRegister={(mode) => handleOpenAuth(mode)}
        onOpenLogin={() => handleOpenAuth('login')}
        actionAttempted={guestActionAttempted}
      />

      {/* AUTH MODAL FOR MANUAL REGISTRATION (Customer, Driver, Admin) */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        onClose={() => setAuthModalOpen(false)}
        language={state.language}
        onRegisterCustomer={handleRegisterCustomer}
        onRegisterDriver={handleRegisterDriver}
        onLogin={handleLogin}
        registeredCustomers={state.customers}
        registeredDrivers={state.drivers}
      />

    </div>
  );
}
