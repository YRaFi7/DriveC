"use client";

import React, { useState, useEffect } from 'react';
import { 
  Language, 
  UserRole, 
  Booking, 
  User, 
  Complaint, 
  Review, 
  Driver, 
  CustomerVehicle, 
  VehicleCategory, 
  TransmissionType, 
  FuelType,
  RentalVehicle,
  RentalExtension
} from '../types';
import { translations } from '../lib/translations';

interface UserPortalProps {
  language: Language;
  currentUser: {
    id: string;
    role: UserRole;
    name: string;
    phone: string;
    email: string;
  };
  customerData?: User;
  onRefreshCustomer?: () => void;
  bookings: Booking[];
  rentalVehicles?: RentalVehicle[];
  rentalExtensions?: RentalExtension[];
  reviews?: Review[];
  drivers?: Driver[];
  favouriteDriverIds?: string[];
  onToggleFavouriteDriver?: (driverId: string) => void;
  onOpenGuestWarning: (actionName?: string) => void;
  onNavigateToBooking: () => void;
  onCancelBooking: (bookingId: string) => void;
  onOpenReviewModalForBooking: (booking: Booking) => void;
  onSubmitReview?: (review: Review) => void;
  onFileComplaint: (complaint: Complaint) => void;
  onPassengerPayment?: (bookingId: string, paymentMethod: 'cash' | 'upi' | 'card') => void;
  onUpdateBookingStatus?: (bookingId: string, status: Booking['status'], extra?: Record<string, unknown>) => void;
  onRequestRentalExtension?: (bookingId: string, requestedReturnDate: string, notes?: string) => Promise<any>;
  onPayRentalExtension?: (extensionId: string, paymentMethod: 'upi' | 'card' | 'cash') => Promise<any>;
  complaints: Complaint[];
}

interface SavedPlace {
  id: string;
  label: string;
  address: string;
  iconType: 'home' | 'work' | 'airport' | 'hospital';
}

export const UserPortal: React.FC<UserPortalProps> = ({
  language,
  currentUser,
  customerData,
  onRefreshCustomer,
  bookings,
  rentalVehicles = [],
  rentalExtensions = [],
  reviews = [],
  drivers = [],
  favouriteDriverIds = [],
  onToggleFavouriteDriver,
  onOpenGuestWarning,
  onNavigateToBooking,
  onCancelBooking,
  onOpenReviewModalForBooking,
  onSubmitReview,
  onFileComplaint,
  onPassengerPayment,
  onUpdateBookingStatus,
  onRequestRentalExtension,
  onPayRentalExtension,
  complaints
}) => {
  const t = translations[language];
  const isGuest = currentUser.role === 'guest';

  // Sub tabs: rides, vehicles, payments, favourites, reviews, savedPlaces, complaints
  const [activeTab, setActiveTab] = useState<'rides' | 'vehicles' | 'payments' | 'favourites' | 'reviews' | 'savedPlaces' | 'complaints'>('rides');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  // Collapse expanded booking cards whenever sub-navbar tab or filter changes
  useEffect(() => {
    setExpandedBookingId(null);
  }, [activeTab, filterStatus]);

  // Collapse expanded booking cards when top navbar options or external collapse events fire
  useEffect(() => {
    const handleCollapse = () => setExpandedBookingId(null);
    window.addEventListener('drivec_collapse_cards', handleCollapse);
    return () => window.removeEventListener('drivec_collapse_cards', handleCollapse);
  }, []);

  const toggleBookingExpand = (bookingId: string) => {
    setExpandedBookingId(prev => {
      const isOpening = prev !== bookingId;
      if (isOpening) {
        setTimeout(() => {
          const el = document.getElementById(`user-booking-card-${bookingId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el.focus({ preventScroll: true });
          }
        }, 60);
      }
      return isOpening ? bookingId : null;
    });
  };

  // Vehicles state (Requirement 1: Manage customer vehicles in profile)
  const [vehicles, setVehicles] = useState<CustomerVehicle[]>(customerData?.vehicles || []);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<CustomerVehicle | null>(null);
  const [vMakeModel, setVMakeModel] = useState('');
  const [vType, setVType] = useState<VehicleCategory>('sedan');
  const [vTransmission, setVTransmission] = useState<TransmissionType>('manual');
  const [vFuel, setVFuel] = useState<FuelType>('petrol');
  const [vNotes, setVNotes] = useState('');
  const [vIsDefault, setVIsDefault] = useState(false);
  const [vLoading, setVLoading] = useState(false);
  const [vFeedbackMsg, setVFeedbackMsg] = useState('');
  
  // Passenger Search (Requirement 6: Passenger can search by passenger name / ref / route)
  const [passengerSearchQuery, setPassengerSearchQuery] = useState('');

  // Payment Modal
  const [paymentModalBooking, setPaymentModalBooking] = useState<Booking | null>(null);
  const [selectedPayMethod, setSelectedPayMethod] = useState<'cash' | 'upi' | 'card'>('upi');
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState('');

  // Review Modal State (Requirement 10: Customer can review driver)
  const [reviewModalBooking, setReviewModalBooking] = useState<Booking | null>(null);
  const [punctualityRating, setPunctualityRating] = useState(5);
  const [cleanlinessRating, setCleanlinessRating] = useState(5);
  const [comfortRating, setComfortRating] = useState(5);
  const [overallRating, setOverallRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Driver Denied Alert Popup
  const [deniedBookingPopup, setDeniedBookingPopup] = useState<Booking | null>(null);

  // Digital Receipt Modal
  const [selectedReceiptBooking, setSelectedReceiptBooking] = useState<Booking | null>(null);

  // File Complaint Modal
  const [complaintModalBooking, setComplaintModalBooking] = useState<Booking | null>(null);

  // Feature 2: Free Real-Time Trip Sharing
  const [shareTripModalBooking, setShareTripModalBooking] = useState<Booking | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [shareToken, setShareToken] = useState('');
  const [isSharingActive, setIsSharingActive] = useState(false);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const handleOpenShareModal = async (booking: Booking) => {
    setShareTripModalBooking(booking);
    setIsShareLoading(true);
    setShareCopied(false);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': booking.customerId || booking.customerPhone || currentUser?.id || currentUser?.phone || 'customer',
          'x-user-role': 'customer'
        },
      });
      const data = await res.json();
      if (res.ok && data.shareUrl) {
        setShareUrl(data.shareUrl);
        setShareToken(data.shareToken);
        setIsSharingActive(data.isSharingActive ?? true);
      } else {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const token = booking.shareToken || booking.id;
        setShareUrl(`${origin}/track/${token}`);
        setShareToken(token);
        setIsSharingActive(true);
      }
    } catch (err) {
      console.error('Error generating share link:', err);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setShareUrl(`${origin}/track/${booking.id}`);
      setShareToken(booking.id);
      setIsSharingActive(true);
    } finally {
      setIsShareLoading(false);
    }
  };

  const handleStopSharing = async () => {
    if (!shareTripModalBooking) return;
    setIsShareLoading(true);
    try {
      await fetch(`/api/bookings/${shareTripModalBooking.id}/share`, {
        method: 'DELETE',
        headers: {
          'x-customer-id': shareTripModalBooking.customerId || shareTripModalBooking.customerPhone || currentUser?.id || currentUser?.phone || 'customer',
          'x-user-role': 'customer'
        }
      });
      setIsSharingActive(false);
    } catch (err) {
      console.error('Error revoking share:', err);
    } finally {
      setIsShareLoading(false);
    }
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (typeof window === 'undefined' || !text) return false;
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('navigator.clipboard.writeText failed, using fallback:', err);
      }
    }
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      textArea.style.opacity = '0';
      textArea.setAttribute('readonly', '');
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('Fallback clipboard copy failed:', err);
      return false;
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    const url = getClickableShareUrl(shareUrl);
    const success = await copyToClipboard(url);
    if (success) {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }
  };

  const getClickableShareUrl = (rawUrl: string) => {
    if (!rawUrl) return '';
    // Ensure localhost is replaced with 127.0.0.1 or LAN IP so WhatsApp/SMS turns it into a clickable blue link
    if (rawUrl.includes('localhost:')) {
      return rawUrl.replace('localhost:', '127.0.0.1:');
    }
    return rawUrl;
  };

  const handleNativeShare = async () => {
    if (!shareUrl || !shareTripModalBooking) return;
    const clickableUrl = getClickableShareUrl(shareUrl);
    const pilotVehicle = shareTripModalBooking.driverVehicle ? ` (${shareTripModalBooking.driverVehicle})` : '';
    const pilotName = shareTripModalBooking.driverName || 'Verified Chauffeur';
    const shareMessage = `* Track my DriveC ride live in real-time!\n* Pickup: ${shareTripModalBooking.pickupLocation}\n* Destination: ${shareTripModalBooking.destinationLocation}\n* Pilot: ${pilotName}${pilotVehicle}\n\n* Free Live OpenStreetMap Route:\n${clickableUrl}\n\nReal-time tracking • No app download or login required.`;

    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: 'DriveC Live Trip Tracking',
          text: shareMessage,
        });
      } catch (e) {
        console.warn('Native share dismissed or not supported:', e);
      }
    } else {
      handleCopyShareLink();
    }
  };
  const [complaintCategory, setComplaintCategory] = useState<Complaint['category']>('fare_dispute');
  const [complaintDesc, setComplaintDesc] = useState('');

  // Requirement 2: Rental Cancellation Modal with 80% Refund / 20% Fee calculation
  const [cancelModalBooking, setCancelModalBooking] = useState<Booking | null>(null);

  // Complete Rental Modal State (User completes self rental ride & pays remaining)
  const [completeRentalModalBooking, setCompleteRentalModalBooking] = useState<Booking | null>(null);
  const [rentalPaymentSuccessMsg, setRentalPaymentSuccessMsg] = useState('');
  const [isVehicleReturnedConfirmed, setIsVehicleReturnedConfirmed] = useState(true);
  const [isSubmittingRentalPayment, setIsSubmittingRentalPayment] = useState(false);

  // Requirement 3: Rental Extension Modal
  const [extendModalBooking, setExtendModalBooking] = useState<Booking | null>(null);
  const [newExtendReturnDate, setNewExtendReturnDate] = useState('');
  const [extendErrorMsg, setExtendErrorMsg] = useState('');
  const [extendSuccessMsg, setExtendSuccessMsg] = useState('');
  const [isSubmittingExtension, setIsSubmittingExtension] = useState(false);

  // Pay Approved Extension Modal
  const [payExtensionModalExt, setPayExtensionModalExt] = useState<RentalExtension | null>(null);
  const [extensionPaymentSuccessMsg, setExtensionPaymentSuccessMsg] = useState('');
  const [isSubmittingExtPayment, setIsSubmittingExtPayment] = useState(false);
  const [selectedExtPayMethod, setSelectedExtPayMethod] = useState<'upi' | 'card' | 'cash'>('upi');

  // Saved places
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([
    { id: 'sp-1', label: 'Home Residence', address: 'Panampilly Nagar, Ernakulam Central, Kochi', iconType: 'home' },
    { id: 'sp-2', label: 'Workplace / Tech Hub', address: 'Infopark Phase 1, Kakkanad, Kochi', iconType: 'work' },
    { id: 'sp-3', label: 'Cochin Airport Depot', address: 'Cochin International Airport Terminal 3, Nedumbassery', iconType: 'airport' },
    { id: 'sp-4', label: 'Hospital Escort', address: 'Aster Medcity, South Chittoor, Cheranalloor, Kochi', iconType: 'hospital' }
  ]);
  const [newPlaceLabel, setNewPlaceLabel] = useState('');
  const [newPlaceAddress, setNewPlaceAddress] = useState('');
  const [showAddPlace, setShowAddPlace] = useState(false);

  // Trip sharing alert banner
  const [sharedToast, setSharedToast] = useState<string | null>(null);

  // Detect if a driver denied/declined any booking
  React.useEffect(() => {
    const denied = bookings.find(b => 
      (b.customerId === currentUser.id || b.customerPhone === currentUser.phone) && 
      (b.status === 'declined' || (b.status === 'cancelled' && b.cancelledBy === 'driver'))
    );
    if (denied && !deniedBookingPopup) {
      setDeniedBookingPopup(denied);
    }
  }, [bookings, currentUser, deniedBookingPopup]);

  // Requirement 5: Automatically show Final Fare Popup on Ride Completion
  React.useEffect(() => {
    const completedUnpaid = bookings.find(b =>
      (b.customerId === currentUser.id || b.customerPhone === currentUser.phone) &&
      b.status === 'completed' &&
      !b.passengerPaid &&
      b.serviceType !== 'self-drive'
    );
    if (completedUnpaid && !paymentModalBooking) {
      setPaymentModalBooking(completedUnpaid);
    }
  }, [bookings, currentUser, paymentModalBooking]);

  // Fetch vehicles on mount or update
  const fetchVehicles = React.useCallback(async () => {
    if (!currentUser.id || isGuest) return;
    try {
      const res = await fetch(`/api/customers/${currentUser.id}/vehicles`);
      if (res.ok) {
        const data = await res.json();
        setVehicles(data);
      }
    } catch (e) {
      console.warn('Failed to fetch vehicles:', e);
    }
  }, [currentUser.id, isGuest]);

  React.useEffect(() => {
    if (customerData?.vehicles && customerData.vehicles.length > 0) {
      setVehicles(customerData.vehicles);
    } else {
      fetchVehicles();
    }
  }, [customerData?.vehicles, fetchVehicles]);

  const handleOpenAddVehicle = () => {
    setEditingVehicle(null);
    setVMakeModel('');
    setVType('sedan');
    setVTransmission('manual');
    setVFuel('petrol');
    setVNotes('');
    setVIsDefault(vehicles.length === 0);
    setVFeedbackMsg('');
    setShowVehicleModal(true);
  };

  const handleOpenEditVehicle = (veh: CustomerVehicle) => {
    setEditingVehicle(veh);
    setVMakeModel(veh.makeModel);
    setVType((veh.vehicleType as VehicleCategory) || 'sedan');
    setVTransmission((veh.transmission as TransmissionType) || 'manual');
    setVFuel((veh.fuelType as FuelType) || 'petrol');
    setVNotes(veh.notes || '');
    setVIsDefault(veh.isDefault || false);
    setVFeedbackMsg('');
    setShowVehicleModal(true);
  };

  const handleSaveVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vMakeModel.trim()) return;
    setVLoading(true);
    setVFeedbackMsg('');

    try {
      if (editingVehicle) {
        const res = await fetch(`/api/customers/${currentUser.id}/vehicles`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vehicleId: editingVehicle.id,
            makeModel: vMakeModel.trim(),
            vehicleType: vType,
            transmission: vTransmission,
            fuelType: vFuel,
            notes: vNotes.trim(),
            isDefault: vIsDefault
          })
        });
        if (res.ok) {
          await fetchVehicles();
          onRefreshCustomer?.();
          setShowVehicleModal(false);
        } else {
          setVFeedbackMsg('Failed to update vehicle.');
        }
      } else {
        const res = await fetch(`/api/customers/${currentUser.id}/vehicles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            makeModel: vMakeModel.trim(),
            vehicleType: vType,
            transmission: vTransmission,
            fuelType: vFuel,
            notes: vNotes.trim(),
            isDefault: vIsDefault || vehicles.length === 0
          })
        });
        if (res.ok) {
          await fetchVehicles();
          onRefreshCustomer?.();
          setShowVehicleModal(false);
        } else {
          setVFeedbackMsg('Failed to add vehicle.');
        }
      }
    } catch (err) {
      setVFeedbackMsg('Network error while saving vehicle.');
    } finally {
      setVLoading(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!window.confirm('Are you sure you want to remove this vehicle from your garage?')) return;
    try {
      const res = await fetch(`/api/customers/${currentUser.id}/vehicles?vehicleId=${vehicleId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchVehicles();
        onRefreshCustomer?.();
      }
    } catch (e) {
      console.warn('Failed to delete vehicle:', e);
    }
  };

  const handleSetDefaultVehicle = async (veh: CustomerVehicle) => {
    try {
      const res = await fetch(`/api/customers/${currentUser.id}/vehicles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: veh.id,
          isDefault: true
        })
      });
      if (res.ok) {
        await fetchVehicles();
        onRefreshCustomer?.();
      }
    } catch (e) {
      console.warn('Failed to set default vehicle:', e);
    }
  };

  if (isGuest) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-[#0d1424] border border-blue-800/70 rounded-3xl p-8 sm:p-12 space-y-4 shadow-sm">
                    <span className="text-[11px] font-black uppercase tracking-widest text-cyan-400 bg-blue-200/60 px-3 py-1 rounded-full">
            Customer Profile Protected
          </span>
          <h3 className="text-2xl font-black text-slate-100">
            {language === 'en' ? 'DriveC Portal Locked in Guest Mode' : 'ഗസ്റ്റ് മോഡിൽ പോർട്ടൽ ലഭ്യമല്ല'}
          </h3>
          <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
            Please register or sign in with mobile OTP to access your personal dashboard, view active trips, manage favourite drivers, and retrieve digital receipts.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onOpenGuestWarning('Access Customer Portal')}
              className="px-6 py-3 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-bold text-xs shadow-md transition-all"
            >
              Register with Mobile OTP First
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter bookings for this user
  const userBookings = bookings.filter(b => b.customerId === currentUser.id || b.customerPhone === currentUser.phone);
  
  // Requirement 6: Passenger Search Query Filtering
  const searchedBookings = userBookings.filter(b => {
    if (!passengerSearchQuery.trim()) return true;
    const q = passengerSearchQuery.toLowerCase();
    const pName = (b.passengerName || b.customerName || '').toLowerCase();
    const ref = (b.refCode || '').toLowerCase();
    const route = `${b.pickupLocation} ${b.destinationLocation}`.toLowerCase();
    const dName = (b.driverName || '').toLowerCase();
    return pName.includes(q) || ref.includes(q) || route.includes(q) || dName.includes(q);
  });

  const filteredBookings = searchedBookings.filter(b => {
    if (filterStatus === 'active') return b.status === 'pending' || b.status === 'accepted' || b.status === 'driver_arriving' || b.status === 'arrived' || b.status === 'in_progress';
    if (filterStatus === 'completed') return b.status === 'completed';
    return true;
  });

  // Filter user's submitted reviews
  const userReviews = reviews.filter(r => r.reviewerId === currentUser.id || r.reviewerName === currentUser.name);

  // Favourite Drivers list
  const favouriteDriversList = drivers.filter(d => favouriteDriverIds.includes(d.id));

  const handleShareTrip = async (booking: Booking) => {
    const link = `https://drivec.in/track/${booking.refCode}`;
    await copyToClipboard(link);
    setSharedToast(`Safety Tracking Link copied: ${link}`);
    setTimeout(() => setSharedToast(null), 4000);
  };

  const handleAddSavedPlace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaceLabel || !newPlaceAddress) return;
    setSavedPlaces([
      ...savedPlaces,
      {
        id: 'sp-' + Date.now(),
        label: newPlaceLabel,
        address: newPlaceAddress,
        iconType: 'home'
      }
    ]);
    setNewPlaceLabel('');
    setNewPlaceAddress('');
    setShowAddPlace(false);
  };

  const handleSubmitComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintModalBooking) return;
    const newComplaint: Complaint = {
      id: 'cmp-' + Date.now(),
      bookingId: complaintModalBooking.id,
      bookingRef: complaintModalBooking.refCode,
      complainantId: currentUser.id,
      complainantName: currentUser.name,
      complainantRole: 'customer',
      category: complaintCategory,
      description: complaintDesc,
      status: 'submitted',
      createdAt: new Date().toISOString()
    };
    onFileComplaint(newComplaint);
    setComplaintModalBooking(null);
    setComplaintDesc('');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-4 sm:space-y-5 animate-in fade-in">
      
      {/* Toast Notification */}
      {sharedToast && (
        <div className="fixed top-24 right-4 z-50 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl border border-cyan-400 text-xs flex items-center gap-3 animate-in fade-in">
          <span>{sharedToast}</span>
        </div>
      )}

      {/* Top Customer Profile Banner */}
      <div className="bg-gradient-to-r from-[#002C6C] via-[#003882] to-[#004B93] text-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5 border border-white/10">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-cyan-400/20 border border-blue-800/70 flex items-center justify-center text-white font-black text-xl uppercase">
            {currentUser.name.charAt(0)}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-cyan-300 bg-white/10 px-2 py-0.5 rounded-full border border-white/15">
                Verified DriveC Customer
              </span>
              <span className="text-[10px] sm:text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
                Mobile Authenticated
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">{currentUser.name}</h2>
            <div className="flex flex-wrap gap-3 text-xs text-slate-300">
              <span>Mobile: <strong>{currentUser.phone}</strong></span>
              <span>Email: <strong>{currentUser.email}</strong></span>
              <span>Favourite Drivers: <strong className="text-rose-300">{favouriteDriverIds.length}</strong></span>
            </div>
          </div>
        </div>

        <button
          onClick={onNavigateToBooking}
          className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 shrink-0"
        >
          <span>Book Driver / Rent Car</span>
        </button>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-[#14171f] p-3.5 sm:p-4 rounded-2xl border border-[#262b36] shadow-sm">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Bookings</span>
          <p className="text-xl sm:text-2xl font-black text-white mt-0.5">{userBookings.length}</p>
          <span className="text-[10px] text-emerald-400 font-medium">Driver & Self-Drive Trips</span>
        </div>
        <div className="bg-[#14171f] p-3.5 sm:p-4 rounded-2xl border border-[#262b36] shadow-sm">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Active / En Route</span>
          <p className="text-xl sm:text-2xl font-black text-cyan-400 mt-0.5">
            {userBookings.filter(b => b.status === 'accepted' || b.status === 'driver_arriving' || b.status === 'in_progress').length}
          </p>
          <span className="text-[10px] text-slate-400">Live GPS tracking active</span>
        </div>
        <div className="bg-[#14171f] p-3.5 sm:p-4 rounded-2xl border border-[#262b36] shadow-sm">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Completed Journeys</span>
          <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">
            {userBookings.filter(b => b.status === 'completed').length}
          </p>
          <span className="text-[10px] text-slate-400">Digital receipts archived</span>
        </div>
        <div className="bg-[#14171f] p-3.5 sm:p-4 rounded-2xl border border-[#262b36] shadow-sm">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Favourite Drivers</span>
          <p className="text-xl sm:text-2xl font-black text-rose-400 mt-0.5">{favouriteDriverIds.length}</p>
          <span className="text-[10px] text-slate-400">Direct 1-click driver select</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[#262b36] gap-2 overflow-x-auto text-xs font-bold text-slate-400">
        <button
          onClick={() => { setActiveTab('rides'); setExpandedBookingId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'rides' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>My Bookings</span>
        </button>

        <button
          onClick={() => { setActiveTab('vehicles'); setExpandedBookingId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'vehicles' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>My Vehicles</span>
        </button>

        <button
          onClick={() => { setActiveTab('payments'); setExpandedBookingId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'payments' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>Payment History</span>
        </button>

        <button
          onClick={() => { setActiveTab('favourites'); setExpandedBookingId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'favourites' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>Favourite Drivers</span>
        </button>

        <button
          onClick={() => { setActiveTab('reviews'); setExpandedBookingId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'reviews' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>My Reviews</span>
        </button>

        <button
          onClick={() => { setActiveTab('savedPlaces'); setExpandedBookingId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'savedPlaces' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>Saved Places</span>
        </button>

        <button
          onClick={() => { setActiveTab('complaints'); setExpandedBookingId(null); }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'complaints' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>Disputes & Safety</span>
        </button>
      </div>

      {/* SUB-TAB 1: MY BOOKINGS (WITH PASSENGER NAME SEARCH - REQUIREMENT 6) */}
      {activeTab === 'rides' && (
        <div className="space-y-4">
          
          {/* Search & Filter Bar (Requirement 6) */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search by Passenger Name, Booking Ref, Route..."
                value={passengerSearchQuery}
                onChange={(e) => setPassengerSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs text-slate-100 outline-none focus:border-[#002C6C]"
              />
              {passengerSearchQuery && (
                <button onClick={() => setPassengerSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400">
                  <span className="font-bold text-sm leading-none">✕</span>
                </button>
              )}
            </div>

            <div className="flex gap-1.5 bg-[#14171f] p-1 rounded-xl border border-[#262b36] text-xs font-semibold self-start sm:self-auto">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${filterStatus === 'all' ? 'bg-[#002C6C] text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus('active')}
                className={`px-3 py-1.5 rounded-lg transition-all ${filterStatus === 'active' ? 'bg-[#002C6C] text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
              >
                Active
              </button>
              <button
                onClick={() => setFilterStatus('completed')}
                className={`px-3 py-1.5 rounded-lg transition-all ${filterStatus === 'completed' ? 'bg-[#002C6C] text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
              >
                Completed
              </button>
            </div>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="bg-[#14171f] border border-[#262b36] rounded-3xl p-12 text-center space-y-3">
              <h4 className="font-bold text-slate-100 text-sm">No bookings found</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {passengerSearchQuery ? 'No results matched your search query.' : 'Book a qualified driver for your car or rent a self-drive vehicle with DriveC.'}
              </p>
              <button
                onClick={onNavigateToBooking}
                className="px-5 py-2.5 rounded-xl bg-[#002C6C] hover:bg-[#001f4d] text-white font-bold text-xs"
              >
                Book a Ride Now
              </button>
            </div>
          ) : (
            <div 
              className="grid gap-4 items-start"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
            >
              {filteredBookings.map((b) => {
                const isExpanded = expandedBookingId === b.id;
                const isRental = b.bookingType === 'self_drive_rental' || b.serviceType === 'self-drive' || (b.serviceType as string) === 'self_drive' || Boolean(b.rentalVehicleId);
                const vehicle = isRental ? rentalVehicles.find(v => v.id === b.rentalVehicleId || v.model === b.rentalVehicleModel) : undefined;
                const pendingExt = isRental ? rentalExtensions.find(e => e.bookingId === b.id && e.status === 'pending') : undefined;
                const approvedExt = isRental ? rentalExtensions.find(e => e.bookingId === b.id && e.status === 'approved') : undefined;
                const declinedExt = isRental ? rentalExtensions.find(e => e.bookingId === b.id && e.status === 'declined') : undefined;

                const baseTotalFare = b.fareBreakdown?.totalFare || 0;
                const baseAdvance = b.advanceAmount || b.fareBreakdown?.advanceAmount || 1000;
                const approvedExtPrice = approvedExt ? approvedExt.extensionPrice : 0;
                const hasExtensionInFare = (b.extensionFee !== undefined && b.extensionFee !== null && b.extensionFee > 0) ||
                  Boolean((b.fareBreakdown as any)?.extensionFee && (b.fareBreakdown as any)?.extensionFee > 0);
                const effectiveTotalFare = hasExtensionInFare ? baseTotalFare : (baseTotalFare + approvedExtPrice);
                const rawRemaining = b.remainingAmount ?? (b.fareBreakdown?.remainingAmount ?? Math.max(0, baseTotalFare - baseAdvance));
                const effectiveRemaining = hasExtensionInFare ? rawRemaining : (rawRemaining + approvedExtPrice);
                const effectiveReturnDate = approvedExt?.requestedReturnDate || b.returnDate || b.scheduledDate;

                return (
                  <div 
                    id={`user-booking-card-${b.id}`}
                    key={b.id} 
                    tabIndex={-1}
                    className={`bg-[#14171f] rounded-2xl border transition-all overflow-hidden scroll-mt-24 outline-none ${
                      isExpanded 
                        ? 'col-span-full border-[#002C6C] shadow-md ring-1 ring-[#002C6C]/50' 
                        : 'border-[#262b36] shadow-2xs hover:border-slate-600 hover:shadow-xs'
                    }`}
                    style={isExpanded ? { gridColumn: '1 / -1' } : undefined}
                  >
                    {/* Small Card (Lined Vertically with minimal initial information) */}
                    <div
                      onClick={() => toggleBookingExpand(b.id)}
                      className="p-3.5 sm:p-4 cursor-pointer flex flex-col gap-2.5 select-none hover:bg-[#181c26] transition-colors"
                    >
                      {/* Top line: Ref Code & Service Type on Left, Status Badge on Right */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-mono uppercase bg-[#0d1017] text-slate-300 px-2 py-0.5 rounded font-bold border border-[#262b36] shrink-0">
                            Ref: {b.refCode}
                          </span>
                          <span className="text-xs font-bold text-slate-100 capitalize truncate">
                            {isRental ? 'Self-Drive Rental' : b.serviceType.replace('-', ' ')}
                          </span>
                        </div>

                        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full shrink-0 ${
                          b.status === 'completed' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' :
                          b.status === 'approved' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' :
                          b.status === 'in_progress' ? 'bg-blue-950/60 text-cyan-300 border border-cyan-800 animate-pulse' :
                          b.status === 'driver_arriving' ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800 animate-pulse' :
                          b.status === 'cancelled' ? 'bg-rose-950/60 text-rose-300 border border-rose-800' :
                          'bg-[#002C6C] text-white border border-blue-800'
                        }`}>
                          {b.status === 'pending' ? 'Pending' : b.status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Middle line: Route or Vehicle (Concise, lined vertically) */}
                      {isRental ? (
                        <div className="flex items-center gap-2 text-xs text-slate-300">
                          <span className="font-semibold text-slate-100 truncate">
                            {vehicle?.model || b.rentalVehicleModel || 'Self-Drive Vehicle'}
                          </span>
                          <span className="text-[11px] text-slate-400 shrink-0">
                            • Return: <strong className="text-slate-200">{effectiveReturnDate}</strong> {approvedExt ? `(+${approvedExt.additionalDays}d)` : pendingExt ? '⏳' : ''}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-300 truncate">
                            <span className="truncate font-medium">{b.pickupLocation}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-300 truncate">
                            <span className="truncate font-medium">{b.destinationLocation}</span>
                          </div>
                        </div>
                      )}

                      {/* Bottom line: Date & Fare on Left, Click to Extend indicator on Right */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#262b36] text-xs">
                        <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                          <span>📅 {b.scheduledDate}</span>
                          <span className="font-black text-xs text-white font-mono">
                            ₹{effectiveTotalFare}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {['approved', 'accepted', 'driver_arriving', 'arrived', 'in_progress'].includes(b.status) && !isRental && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenShareModal(b);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800 font-bold text-[10px] flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                              title="Share Live Route via WhatsApp or Social Apps"
                            >
                              <span>Share Live</span>
                            </button>
                          )}

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
                    </div>

                    {/* Extended Section: Full Details & All Actions (Shown on Click) */}
                    {isExpanded && (
                      <div className="border-t border-[#262b36] p-4 sm:p-5 bg-[#0d1017] space-y-3.5 animate-in fade-in duration-150">
                        {/* Requirement 2: Customer Notification on Admin Approval */}
                        {b.status === 'approved' && (
                          <div className="bg-emerald-950/60 border border-emerald-800 rounded-2xl p-3 flex items-center gap-2 text-xs text-emerald-300 font-bold animate-in fade-in">
                            <span>Your vehicle has been successfully booked.</span>
                          </div>
                        )}

                        {/* Requirement 2: Cancelled Reservation Refund & Fee Details */}
                        {b.status === 'cancelled' && (
                          <div className="bg-rose-950/60 border border-rose-900/60 rounded-2xl p-3 text-xs space-y-1.5 text-rose-200">
                            <div className="flex justify-between items-center font-bold">
                              <span className="flex items-center gap-1 text-rose-300">
                                Reservation Cancelled
                              </span>
                              <span className="text-[10px] bg-rose-950/70 text-rose-300 px-2 py-0.5 rounded-full font-bold">
                                {b.paymentStatus === 'refunded' ? 'Refund Processed ✓' : 'Cancelled'}
                              </span>
                            </div>
                            {(b.advanceAmount || (b.fareBreakdown as any)?.advanceAmount) && (
                              <div className="bg-[#0d1017] p-2.5 rounded-xl border border-rose-800/80 space-y-1 text-[11px]">
                                <div className="flex justify-between text-slate-300">
                                  <span>Advance Amount Paid:</span>
                                  <strong>₹{b.advanceAmount || (b.fareBreakdown as any)?.advanceAmount}</strong>
                                </div>
                                <div className="flex justify-between text-rose-300">
                                  <span>Cancellation Fee (20%):</span>
                                  <strong>₹{b.cancellationFee || Math.round(((b.advanceAmount || (b.fareBreakdown as any)?.advanceAmount) || 1000) * 0.2)}</strong>
                                </div>
                                <div className="flex justify-between text-emerald-300 font-bold border-t border-[#262b36] pt-1">
                                  <span>Refund to Original Payment Method (80%):</span>
                                  <strong className="text-emerald-300 font-mono">₹{b.refundAmount || Math.round(((b.advanceAmount || (b.fareBreakdown as any)?.advanceAmount) || 1000) * 0.8)}</strong>
                                </div>
                                <p className="text-[10px] text-slate-400 pt-0.5 italic">
                                  Refund credited back to original payment method.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Passenger Name & Phone Display - Distinguishes Myself vs Someone Else */}
                        {b.bookingFor === 'someone_else' || (b.passengerName && b.customerName && b.passengerName.trim().toLowerCase() !== b.customerName.trim().toLowerCase()) ? (
                          <div className="bg-[#0d1424] border border-blue-800/70 rounded-2xl p-3 text-xs space-y-1.5 text-cyan-300">
                            <div className="flex items-center justify-between font-bold">
                              <span className="flex items-center gap-1.5 text-cyan-300">
                                <span>Booked for Someone Else</span>
                                {b.passengerRelationship && (
                                  <span className="text-[10px] bg-[#002C6C]/50 text-cyan-300 px-2 py-0.5 rounded-full font-bold">
                                    {b.passengerRelationship}
                                  </span>
                                )}
                              </span>
                              <span className="text-[10px] text-cyan-300 font-semibold">You are the billing customer</span>
                            </div>
                            <div className="bg-[#0d1017] p-2 rounded-xl border border-blue-800/70 flex justify-between items-center text-[11px]">
                              <span className="text-slate-300 font-medium">Travelling Passenger:</span>
                              <strong className="text-slate-100 font-bold">{b.passengerName} ({b.passengerPhone})</strong>
                            </div>
                            {b.passengerSpecialInstructions && (
                              <div className="bg-[#0d1424] border border-blue-800/70 rounded-xl p-2 text-[11px] text-cyan-400 flex items-start gap-1">
                                <div>
                                  <span className="font-bold text-[10px] uppercase block">Special Instructions for Driver:</span>
                                  <span className="text-slate-300">"{b.passengerSpecialInstructions}"</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-[#0d1017] p-2 rounded-xl text-xs border border-[#262b36] flex justify-between">
                            <span className="text-slate-400">Passenger:</span>
                            <strong className="text-slate-100">{b.passengerName || b.customerName} ({b.passengerPhone || b.customerPhone})</strong>
                          </div>
                        )}

                        {/* Boarding OTP Box if ride is active */}
                        {(b.status === 'pending' || b.status === 'accepted' || b.status === 'driver_arriving' || b.status === 'arrived') && (
                          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-800/70 rounded-2xl p-3 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div>
                                <span className="font-bold text-cyan-300 block text-[11px]">Boarding Ride-Start OTP</span>
                                <span className="text-[10px] text-slate-400">Provide to driver upon arrival</span>
                              </div>
                            </div>
                            <span className="text-xl font-black font-mono tracking-widest text-cyan-400 bg-[#0d1017] px-3 py-1 rounded-xl border border-[#262b36]">
                              {b.rideStartOtp}
                            </span>
                          </div>
                        )}

                        {/* Route or Rental Details */}
                        {isRental ? (
                          <div className="bg-[#14171f] rounded-2xl p-4 border border-[#262b36] space-y-3 text-xs text-slate-200">
                            {/* Vehicle Card Header with Image & Name & License Plate */}
                            <div className="flex items-center gap-3 pb-3 border-b border-[#262b36]">
                                                            <div className="flex-1 min-w-0">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Approved Self-Drive Vehicle</span>
                                <h5 className="font-black text-slate-100 text-sm truncate">{vehicle?.model || b.rentalVehicleModel || 'Self-Drive Vehicle'}</h5>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="font-mono text-[10px] font-bold bg-[#252b38] text-slate-200 px-1.5 py-0.2 rounded border border-[#262b36]">
                                    {vehicle?.licensePlate || (b.customerVehicle as any)?.registrationNumber || `KL-07-SD-${b.refCode.slice(-4)}`}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium">Rental ID: <strong className="font-mono text-slate-200">{b.refCode}</strong></span>
                                </div>
                              </div>
                            </div>

                            {/* Pickup Date & Scheduled Return Date (Strictly Dates Only, No Location) */}
                            <div className="grid grid-cols-2 gap-2 bg-[#0d1017] p-2.5 rounded-xl border border-[#262b36]">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase">Pickup Date</span>
                                <strong className="text-slate-100 font-black text-xs flex items-center gap-1 mt-0.5">
                                  {b.scheduledDate}
                                </strong>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase">Scheduled Return Date</span>
                                <strong className="text-indigo-300 font-black text-xs flex items-center gap-1 mt-0.5">
                                  {effectiveReturnDate}
                                </strong>
                              </div>
                            </div>

                            {/* Payment Breakdown & Status */}
                            <div className="space-y-1.5 text-[11px] pt-1">
                              <div className="flex justify-between items-center text-slate-300">
                                <span>Total Rental Amount:</span>
                                <strong className="text-slate-100 font-bold">₹{effectiveTotalFare}</strong>
                              </div>
                              {approvedExtPrice > 0 && (
                                <div className="flex justify-between items-center text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-800/70">
                                  <span>Approved Extension Amount (+{approvedExt?.additionalDays} day{approvedExt && approvedExt.additionalDays > 1 ? 's' : ''}):</span>
                                  <span className="font-mono font-bold">+₹{approvedExtPrice}</span>
                                </div>
                              )}
                              <div className="flex justify-between items-center text-emerald-300">
                                <span>Advance Payment Status:</span>
                                <span className="font-bold flex items-center gap-1 font-mono">
                                  ₹{baseAdvance} (Advance Paid ✓)
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-cyan-300 border-t border-[#262b36] pt-1 font-bold">
                                <span>Remaining Due on Return:</span>
                                <strong className="font-mono text-xs text-indigo-300 font-black">
                                  ₹{effectiveRemaining}
                                </strong>
                              </div>
                            </div>

                            {/* Extension Status Banners */}
                            {pendingExt && (
                              <div className="p-2.5 bg-[#0d1424] border border-blue-800/70 rounded-xl text-cyan-400 text-[11px] space-y-1 animate-pulse">
                                <div className="flex items-center gap-1.5 font-bold text-cyan-400">
                                  <span>Extension Request Pending Admin Review</span>
                                </div>
                                <p className="text-[10px] text-slate-300">
                                  Requested new return date: <strong>{pendingExt.requestedReturnDate}</strong> (+{pendingExt.additionalDays} day(s), ₹{pendingExt.extensionPrice}). Awaiting Admin verification.
                                </p>
                              </div>
                            )}

                            {approvedExt && (
                              <div className="p-2.5 bg-indigo-950/50 border border-indigo-800/70 rounded-xl text-indigo-300 text-[11px] space-y-1.5">
                                <div className="flex items-center justify-between font-bold text-indigo-300">
                                  <span className="flex items-center gap-1">
                                    Rental Extension Approved by Admin
                                  </span>
                                  <span className="text-[10px] bg-emerald-950/70 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                                    Added to Remaining Payment
                                  </span>
                                </div>
                                <p className="text-[10px] text-indigo-300">
                                  Return date extended to <strong>{approvedExt.requestedReturnDate}</strong> (+{approvedExt.additionalDays} day{approvedExt.additionalDays > 1 ? 's' : ''}). The extension amount of <strong>₹{approvedExt.extensionPrice}</strong> has been added along with your remaining payment payable on vehicle return.
                                </p>
                              </div>
                            )}

                            {!pendingExt && declinedExt && (
                              <div className="p-2 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-200 text-[10px] flex items-center gap-1.5">
                                <span>Previous extension request was declined by Admin. Scheduled return date remains {b.returnDate || b.scheduledDate}.</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1.5 text-xs text-slate-300 bg-[#14171f] p-3 rounded-2xl border border-[#262b36]">
                            <div className="flex items-start gap-2">
                              <span>Pickup: <strong>{b.pickupLocation}</strong></span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span>Drop: <strong>{b.destinationLocation}</strong></span>
                            </div>
                          </div>
                        )}

                        {/* Driver details if assigned */}
                        {b.driverName && (
                          <div className="bg-[#14171f] rounded-2xl p-3 flex items-center justify-between text-xs border border-[#262b36]">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Assigned Driver</span>
                              <span className="font-bold text-slate-100">{b.driverName}</span>
                              <span className="text-slate-400 block text-[10px]">{b.driverVehicle || ''}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-400 block text-[10px]">Total Tariff</span>
                              <span className="text-sm font-black text-cyan-400 font-mono">₹{b.fareBreakdown?.totalFare || 0}</span>
                              <span className="text-[10px] text-slate-400 uppercase">{b.paymentMethod}</span>
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="pt-2 border-t border-[#262b36] flex flex-wrap gap-2 text-xs">
                          {/* SHARE TRIP BUTTON FOR ACTIVE ONGOING RIDES */}
                          {['approved', 'accepted', 'driver_arriving', 'arrived', 'in_progress'].includes(b.status) && b.bookingType !== 'self_drive_rental' && (
                            <button
                              type="button"
                              onClick={() => handleOpenShareModal(b)}
                              className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-[#002C6C] to-blue-700 hover:from-[#003882] hover:to-blue-800 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                            >
                              <span>Share Live Road Route</span>
                            </button>
                          )}

                          {/* COMPLETE PAYMENT BUTTON IF COMPLETED AND UNPAID */}
                          {b.status === 'completed' && !b.passengerPaid && (
                            <button
                              onClick={() => {
                                setPaymentModalBooking(b);
                                setSelectedPayMethod(b.paymentMethod || 'upi');
                                setPaymentSuccessMsg('');
                              }}
                              className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-xs"
                            >
                              <span>Pay ₹{b.fareBreakdown?.totalFare || 0}</span>
                            </button>
                          )}

                          {/* RATE & REVIEW DRIVER BUTTON */}
                          {b.status === 'completed' && (() => {
                            const existingRev = reviews.find(r => r.bookingId === b.id || r.bookingRef === b.refCode);
                            if (existingRev) {
                              return (
                                <span className="py-2 px-3 rounded-xl bg-[#002C6C]/40 text-cyan-200 border border-cyan-700/60 font-bold flex items-center gap-1.5 text-xs">
                                  <span>Reviewed (★ {existingRev.overallRating}.0)</span>
                                </span>
                              );
                            }
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewModalBooking(b);
                                  setReviewComment('');
                                  setOverallRating(5);
                                  setPunctualityRating(5);
                                  setCleanlinessRating(5);
                                  setComfortRating(5);
                                }}
                                className="py-2 px-3.5 rounded-xl bg-[#002C6C] hover:bg-[#001f4d] text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                              >
                                <span>Rate & Review Driver</span>
                              </button>
                            );
                          })()}

                          {/* COMPLETE RIDE & PAY REMAINING FOR SELF-DRIVE RENTAL */}
                          {isRental && (b.status === 'approved' || b.status === 'in_progress' || (b.status === 'completed' && !b.remainingPaid)) && (
                            <button
                              onClick={() => {
                                setCompleteRentalModalBooking(b);
                                setSelectedPayMethod(b.paymentMethod || 'upi');
                                setRentalPaymentSuccessMsg('');
                                setIsVehicleReturnedConfirmed(true);
                              }}
                              className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center justify-center gap-1.5 shadow-xs transition-all text-xs"
                            >
                              <span>Complete Ride & Pay Remaining (₹{effectiveRemaining})</span>
                            </button>
                          )}

                          {isRental && (b.remainingPaid || (b.status === 'completed' && b.passengerPaid)) && (
                            <span className="py-1.5 px-3 rounded-xl bg-emerald-950/50 text-emerald-300 border border-emerald-700/80 font-bold flex items-center gap-1 text-[11px]">
                              <span>Ride Completed • All Dues Cleared ✓</span>
                            </span>
                          )}

                          {/* EXTEND RENTAL BUTTON */}
                          {isRental && (b.status === 'approved' || b.status === 'in_progress') && (
                            pendingExt ? (
                              <div className="py-2 px-3.5 rounded-xl bg-[#002C6C]/40 text-cyan-200 border border-cyan-700/60 font-bold flex items-center justify-center gap-1.5 text-xs">
                                <span>Extension Pending Admin Review</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setExtendModalBooking(b);
                                  const curReturn = effectiveReturnDate;
                                  const nextD = new Date(curReturn);
                                  nextD.setDate(nextD.getDate() + 1);
                                  setNewExtendReturnDate(nextD.toISOString().split('T')[0]);
                                  setExtendErrorMsg('');
                                  setExtendSuccessMsg('');
                                }}
                                className="py-2 px-3.5 rounded-xl bg-indigo-950/50 hover:bg-[#152238] text-indigo-300 border border-indigo-800/70 font-bold flex items-center justify-center gap-1.5 transition-all text-xs"
                              >
                                <span>Extend Rental</span>
                              </button>
                            )
                          )}

                          {/* CANCEL BUTTON WITH REFUND CALCULATION */}
                          {b.status !== 'completed' && b.status !== 'cancelled' && (
                            <button
                              onClick={() => {
                                if (b.bookingType === 'self_drive_rental') {
                                  setCancelModalBooking(b);
                                } else {
                                  onCancelBooking(b.id);
                                }
                              }}
                              className="py-2 px-3 rounded-xl text-rose-400 hover:bg-rose-950/70 border border-rose-800/80 font-semibold"
                            >
                              Cancel
                            </button>
                          )}

                          <button
                            onClick={() => setComplaintModalBooking(b)}
                            className="py-2 px-3 rounded-xl text-slate-400 hover:text-rose-300 hover:bg-rose-950/70 text-[11px] font-medium"
                          >
                            Report Issue
                          </button>
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

      {/* SUB-TAB: MY VEHICLES (GARAGE) */}
      {activeTab === 'vehicles' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#14171f] p-5 rounded-2xl border border-[#262b36] shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300 bg-[#0d1424] px-2.5 py-0.5 rounded-full border border-blue-800/70">
                  DriveC Customer Garage
                </span>
                <span className="text-xs text-slate-400">• Customer-Provided Vehicles</span>
              </div>
              <h3 className="text-lg font-black text-slate-100 mt-1">My Saved Vehicles</h3>
              <p className="text-xs text-slate-400">
                You provide your vehicle and DriveC provides certified professional drivers. Saved vehicles automatically match compatible drivers without retyping.
              </p>
            </div>

            <button
              onClick={handleOpenAddVehicle}
              className="px-4 py-2.5 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0"
            >
              <span>Add New Vehicle</span>
            </button>
          </div>

          {vehicles.length === 0 ? (
            <div className="bg-[#14171f] border border-[#262b36] rounded-3xl p-12 text-center space-y-4">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-100 text-base">No vehicles registered yet</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Add your car once (transmission, fuel type, model) so you can book certified drivers in seconds without retyping your car details every time.
                </p>
              </div>
              <button
                onClick={handleOpenAddVehicle}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-sm transition-all inline-flex items-center gap-2"
              >
                <span>Add Your Vehicle Now</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  className={`bg-[#14171f] rounded-2xl p-5 border border-[#262b36] text-slate-100 transition-all flex flex-col justify-between gap-4 shadow-xs relative ${
                    v.isDefault ? 'border-cyan-500 ring-2 ring-cyan-400/20' : 'border-[#262b36] hover:border-[#262b36]'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div>
                          <h4 className="font-black text-slate-100 text-sm">{v.makeModel}</h4>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{v.vehicleType}</span>
                        </div>
                      </div>

                      {v.isDefault && (
                        <span className="px-2 py-0.5 rounded-full bg-[#002C6C]/50 text-cyan-300 font-bold text-[10px] border border-blue-800/70 flex items-center gap-1 shrink-0">
                          <span>Primary</span>
                        </span>
                      )}
                    </div>

                    {/* Transmission & Fuel badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-950/50 text-emerald-300 font-bold text-[11px] border border-emerald-700/80 uppercase">
                        {v.transmission}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#0d1424] text-cyan-300 font-bold text-[11px] border border-blue-800/70 uppercase flex items-center gap-1">
                        <span>{v.fuelType}</span>
                      </span>
                    </div>

                    {v.notes && (
                      <p className="text-[11px] text-slate-400 bg-[#0d1017] p-2.5 rounded-xl border border-[#262b36] italic">
                        "{v.notes}"
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-[#262b36] flex items-center justify-between gap-2">
                    {!v.isDefault ? (
                      <button
                        onClick={() => handleSetDefaultVehicle(v)}
                        className="text-[11px] font-bold text-slate-300 hover:text-cyan-300 transition-colors"
                      >
                        Set as Primary
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">Default for Bookings</span>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditVehicle(v)}
                        className="p-1.5 rounded-lg text-slate-300 hover:bg-[#1c202a] hover:text-cyan-400 transition-all"
                        title="Edit Vehicle"
                      >
                        <span className="text-[11px] font-bold">Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteVehicle(v.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-950/70 hover:text-rose-400 transition-all"
                        title="Delete Vehicle"
                      >
                        <span className="text-[11px] font-bold">Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: PAYMENT HISTORY */}
      {activeTab === 'payments' && (() => {
        const paidBookings = userBookings.filter(b => b.passengerPaid || b.paymentStatus === 'completed');
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Payment History & Digital Tax Invoices</h3>
                <p className="text-xs text-slate-400">Every transaction processed with DriveC in Kochi.</p>
              </div>
              <span className="text-xs font-semibold text-slate-400">{paidBookings.length} Records</span>
            </div>

            {paidBookings.length === 0 ? (
              <div className="bg-[#14171f] border border-[#262b36] rounded-3xl p-10 text-center space-y-2">
                <p className="font-bold text-slate-300 text-xs">No payment records yet.</p>
              </div>
            ) : (
              <div className="bg-[#14171f] rounded-2xl border border-[#262b36] overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0d1017] border-b border-[#262b36] text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3.5">Ref</th>
                      <th className="p-3.5">Passenger</th>
                      <th className="p-3.5">Driver / Vehicle</th>
                      <th className="p-3.5">Amount</th>
                      <th className="p-3.5">Method</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262b36]">
                    {paidBookings.map((b) => (
                      <tr key={b.id} className="hover:bg-[#1c202a]">
                        <td className="p-3.5 font-mono font-bold text-slate-100">{b.refCode}</td>
                        <td className="p-3.5">{b.passengerName || b.customerName}</td>
                        <td className="p-3.5 font-semibold text-slate-200">{b.driverName || b.rentalVehicleModel || 'DriveC Driver'}</td>
                        <td className="p-3.5 font-black text-cyan-400 font-mono text-sm">₹{b.fareBreakdown.totalFare}</td>
                        <td className="p-3.5">
                          <span className="uppercase font-bold text-slate-300 bg-[#1c202a] px-2 py-0.5 rounded text-[10px]">
                            {b.paymentMethod}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-700/80 flex items-center gap-1 w-fit">
                            Paid
                          </span>
                        </td>
                        <td className="p-3.5 text-[11px] text-slate-400">{b.scheduledDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* SUB-TAB 3: FAVOURITE DRIVERS (REQUIREMENT 7) */}
      {activeTab === 'favourites' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-100 text-sm">My Favourite Drivers</h3>
              <p className="text-xs text-slate-400">Pre-select your trusted, highly-rated drivers for your next Kerala trip.</p>
            </div>
            <span className="text-xs font-semibold text-rose-400">{favouriteDriversList.length} Favourites</span>
          </div>

          {favouriteDriversList.length === 0 ? (
            <div className="bg-[#14171f] border border-[#262b36] rounded-3xl p-10 text-center space-y-3">
              <p className="font-bold text-slate-300 text-xs">No favourite drivers saved yet.</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                When booking a driver, click the heart icon on any approved driver card to pin them to your favourites.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {favouriteDriversList.map((d) => (
                <div key={d.id} className="bg-[#14171f] rounded-2xl p-4 sm:p-5 border border-[#262b36] shadow-xs space-y-3 flex flex-col justify-between text-slate-100">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm">{d.name}</h4>
                        <p className="text-[10px] text-slate-400">{d.vehicleModel} • {d.city}</p>
                      </div>
                      <button
                        onClick={() => onToggleFavouriteDriver && onToggleFavouriteDriver(d.id)}
                        className="text-rose-500 hover:text-slate-400 p-1"
                        title="Remove from favourites"
                      >
                        </button>
                    </div>

                    <div className="mt-2 text-xs text-slate-300 space-y-1">
                      <div className="flex justify-between">
                        <span>Rating:</span>
                        <strong className="text-amber-400">★ {d.ratingAverage || '5.0'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Category:</span>
                        <strong className="uppercase">{d.vehicleCategory}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <span className={`text-[10px] font-bold ${d.isOnline ? 'text-emerald-300' : 'text-slate-400'}`}>
                          {d.isOnline ? '🟢 Online' : '⚪ Offline'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={onNavigateToBooking}
                    className="w-full py-2 bg-[#002C6C] text-white font-bold text-xs rounded-xl hover:bg-[#004B93]"
                  >
                    Book This Driver
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: REVIEWS (REQUIREMENT 5: PASSENGER REVIEWS) */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Reviews Given by You</h3>
              <p className="text-xs text-slate-400">Reviews left for professional drivers and self-drive cars.</p>
            </div>
            <span className="text-xs text-slate-400">{userReviews.length} Reviews</span>
          </div>

          {userReviews.length === 0 ? (
            <div className="bg-[#14171f] border border-[#262b36] rounded-3xl p-10 text-center space-y-2">
              <p className="font-bold text-slate-300 text-xs">No reviews submitted yet.</p>
              <p className="text-xs text-slate-400">After completing a ride, you can rate and review your driver.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userReviews.map((r) => (
                <div key={r.id} className="bg-[#14171f] rounded-2xl p-4 sm:p-5 border border-[#262b36] shadow-xs space-y-2 text-xs text-slate-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-100">Driver: {r.targetName}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">Booking #{r.bookingRef}</span>
                    </div>
                    <span className="font-black text-amber-400 text-sm">★ {r.overallRating}.0</span>
                  </div>
                  <p className="text-slate-300 italic">"{r.comment}"</p>
                  <div className="flex gap-3 text-[10px] text-slate-400 pt-1 border-t border-[#262b36]">
                    <span>Punctuality: ★{r.punctualityRating || 5}</span>
                    <span>Cleanliness: ★{r.cleanlinessRating || 5}</span>
                    <span>Comfort: ★{r.comfortRating || 5}</span>
                  </div>

                  {/* Requirement 10: Admin Reply visible to everyone */}
                  {r.adminReply && (
                    <div className="p-3 bg-[#0d1424] border border-blue-800/70 rounded-2xl text-xs space-y-1 mt-2">
                      <div className="flex items-center gap-1.5 font-bold text-cyan-400 text-[11px]">
                        <span>DriveC Official Admin Reply</span>
                        {r.adminRepliedAt && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            • {new Date(r.adminRepliedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-300 leading-relaxed">{r.adminReply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 5: SAVED PLACES */}
      {activeTab === 'savedPlaces' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Frequently Traveled Kerala Shortcuts</h3>
              <p className="text-xs text-slate-400">1-click pickup points for regular commutes and airport runs.</p>
            </div>
            <button
              onClick={() => setShowAddPlace(!showAddPlace)}
              className="px-4 py-2 rounded-xl bg-[#002C6C] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <span>Add Shortcut</span>
            </button>
          </div>

          {showAddPlace && (
            <form onSubmit={handleAddSavedPlace} className="p-4 sm:p-5 bg-[#14171f] rounded-2xl border border-[#262b36] shadow-xs space-y-3 text-xs text-slate-200">
              <span className="font-bold text-slate-100 block">Create New Shortcut</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Label (e.g. My Flat / Clinic / Office)"
                  value={newPlaceLabel}
                  onChange={(e) => setNewPlaceLabel(e.target.value)}
                  className="px-3.5 py-2 border border-[#262b36] rounded-xl outline-none"
                />
                <input
                  type="text"
                  required
                  placeholder="Exact Address / Landmark in Kochi"
                  value={newPlaceAddress}
                  onChange={(e) => setNewPlaceAddress(e.target.value)}
                  className="px-3.5 py-2 border border-[#262b36] rounded-xl outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPlace(false)}
                  className="px-3 py-1.5 rounded-lg border border-[#262b36] text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#002C6C] text-white font-bold"
                >
                  Save Shortcut
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {savedPlaces.map((sp) => (
              <div key={sp.id} className="bg-[#14171f] rounded-2xl p-4 sm:p-5 border border-[#262b36] shadow-xs flex items-start justify-between gap-4 text-slate-100">
                <div className="flex items-start gap-3">
                  <div>
                    <h4 className="font-bold text-slate-100 text-xs">{sp.label}</h4>
                    <p className="text-slate-300 text-xs mt-0.5 leading-relaxed">{sp.address}</p>
                  </div>
                </div>
                <button
                  onClick={onNavigateToBooking}
                  className="px-3 py-1.5 rounded-xl bg-[#1c202a] hover:bg-[#002C6C] hover:text-white text-slate-200 text-[11px] font-bold transition-all shrink-0"
                >
                  Book
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 6: COMPLAINTS & DISPUTES */}
      {activeTab === 'complaints' && (
        <div className="space-y-4">
          <div>
            <h3 className="font-bold text-slate-100 text-sm">Dispute & Customer Support Tickets</h3>
            <p className="text-xs text-slate-400">Every dispute is audited by DriveC administrative operations in Kochi.</p>
          </div>

          {complaints.length === 0 ? (
            <div className="bg-[#14171f] border border-[#262b36] rounded-2xl p-8 text-center text-xs text-slate-400">
              No dispute tickets filed. DriveC guarantees 100% verified drivers and transparent zero-surge pricing.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {complaints.map((c) => (
                <div key={c.id} className="bg-[#14171f] rounded-2xl p-4 sm:p-5 border border-[#262b36] shadow-xs space-y-2 text-xs text-slate-200">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100 uppercase font-mono">{c.category.replace('_', ' ')}</span>
                      <span className="text-slate-400">Ref #{c.bookingRef}</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase bg-amber-950/50 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-700/70">
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-slate-300 italic">"{c.description}"</p>
                  {c.actionTaken && (
                    <div className="p-2 bg-emerald-950/50 rounded-xl text-emerald-200 font-semibold text-[11px]">
                      Admin Action Taken: <strong>{c.actionTaken.toUpperCase()}</strong> ({c.resolutionNotes || 'Case investigated & resolved'})
                    </div>
                  )}
                  <span className="text-[10px] text-slate-400 block">Filed on {new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DIGITAL RECEIPT MODAL */}
      {selectedReceiptBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#14171f] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#262b36] space-y-5 animate-in fade-in text-slate-100">
            <div className="flex justify-between items-start border-b border-[#262b36] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-lg text-white">DriveC</span>
                  <span className="text-[10px] bg-[#1c202a] text-slate-300 px-1.5 py-0.5 rounded font-bold uppercase">Digital Receipt</span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">Ref: {selectedReceiptBooking.refCode}</p>
              </div>
              <button onClick={() => setSelectedReceiptBooking(null)} className="text-slate-400 hover:text-slate-300">
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1 bg-[#0d1017] p-3 rounded-2xl border border-[#262b36]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Service:</span>
                  <strong className="capitalize text-slate-100">{selectedReceiptBooking.serviceType.replace('-', ' ')}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Category:</span>
                  <strong className="text-slate-100">{selectedReceiptBooking.vehicleCategory?.toUpperCase()}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Passenger:</span>
                  <span className="text-slate-100">{selectedReceiptBooking.passengerName || selectedReceiptBooking.customerName}</span>
                </div>
              </div>

              <div className="space-y-2 border-t border-[#262b36] pt-2">
                <div className="flex justify-between text-slate-300">
                  <span>Base Flag Down:</span>
                  <span>₹{selectedReceiptBooking.fareBreakdown.baseFare}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Distance Charge:</span>
                  <span>₹{selectedReceiptBooking.fareBreakdown.distanceCharge}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>DriveC Platform Fee:</span>
                  <span>₹{selectedReceiptBooking.fareBreakdown.platformFee}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Kerala GST (5%):</span>
                  <span>₹{selectedReceiptBooking.fareBreakdown.serviceTaxGST}</span>
                </div>
              </div>

              <div className="border-t-2 border-dashed border-[#262b36] pt-3 flex justify-between items-baseline font-bold">
                <span className="text-slate-100 text-sm">Total Paid:</span>
                <span className="text-2xl font-black text-cyan-400 font-mono">₹{selectedReceiptBooking.fareBreakdown.totalFare}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedReceiptBooking(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}

      {/* FREE REAL-TIME TRIP SHARING MODAL (Feature 2) */}
      {shareTripModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-[#14171f] rounded-3xl p-6 sm:p-7 shadow-2xl border border-[#262b36] space-y-5 text-slate-100">
            <div className="flex justify-between items-start border-b border-[#262b36] pb-3">
              <div className="flex items-center gap-2.5">
                                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Live Trip Sharing</span>
                  <h3 className="text-base font-bold text-slate-100 mt-0.5">Share Real-Time Trip Progress</h3>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShareTripModalBooking(null)} 
                className="text-slate-400 hover:text-slate-300 p-1 rounded-lg cursor-pointer"
              >
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            {/* Trip Summary Pill */}
            <div className="bg-[#0d1017] p-3.5 rounded-2xl border border-[#262b36] space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-mono text-[11px] font-bold text-slate-300">Ref: #{shareTripModalBooking.refCode}</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#002C6C]/50 text-cyan-300 border border-blue-800/70">
                  {shareTripModalBooking.status.replace('_', ' ')}
                </span>
              </div>
              <div className="space-y-1 text-slate-300">
                <p className="truncate">📍 Pickup: <strong>{shareTripModalBooking.pickupLocation}</strong></p>
                <p className="truncate">🏁 Drop: <strong>{shareTripModalBooking.destinationLocation}</strong></p>
                {shareTripModalBooking.driverName && (
                  <p className="text-[11px] text-slate-400">
                    Pilot: <strong>{shareTripModalBooking.driverName}</strong> {shareTripModalBooking.driverVehicle ? `(${shareTripModalBooking.driverVehicle})` : ''}
                  </p>
                )}
              </div>
            </div>

            {isShareLoading ? (
              <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
                Generating secure tracking token...
              </div>
            ) : isSharingActive && shareUrl ? (
              <div className="space-y-4">
                {/* Copy Link Input */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 block">Public Tracking Link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 px-3 py-2.5 rounded-xl border border-[#262b36] bg-[#0d1017] text-slate-200 text-xs font-mono select-all focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleCopyShareLink}
                      className="px-4 py-2.5 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                    >
                      {shareCopied ? (
                        <>
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Instant Share Channels */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-300 block">Share Real-Time Live Map via:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* WhatsApp */}
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `* Track my DriveC ride live in real-time!\n* Pickup: ${shareTripModalBooking.pickupLocation}\n* Destination: ${shareTripModalBooking.destinationLocation}\n* Pilot: ${shareTripModalBooking.driverName || 'Verified Chauffeur'}${shareTripModalBooking.driverVehicle ? ` (${shareTripModalBooking.driverVehicle})` : ''}\n\n* Free Live OpenStreetMap Route:\n${getClickableShareUrl(shareUrl)}\n\nReal-time tracking • No app download or login required.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                    >
                      <span>WhatsApp</span>
                    </a>

                    {/* Telegram */}
                    <a
                      href={`https://t.me/share/url?url=${encodeURIComponent(getClickableShareUrl(shareUrl))}&text=${encodeURIComponent(
                        `* Track my DriveC ride live in real-time!\n* Pickup: ${shareTripModalBooking.pickupLocation}\n* Destination: ${shareTripModalBooking.destinationLocation}\n* Pilot: ${shareTripModalBooking.driverName || 'Verified Chauffeur'}${shareTripModalBooking.driverVehicle ? ` (${shareTripModalBooking.driverVehicle})` : ''}\n\n* Free Live OpenStreetMap Route:`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                    >
                      <span>Telegram</span>
                    </a>

                    {/* SMS */}
                    <a
                      href={`sms:?body=${encodeURIComponent(
                        `* Track my DriveC ride live in real-time!\n* Pickup: ${shareTripModalBooking.pickupLocation}\n* Destination: ${shareTripModalBooking.destinationLocation}\n* Pilot: ${shareTripModalBooking.driverName || 'Verified Chauffeur'}${shareTripModalBooking.driverVehicle ? ` (${shareTripModalBooking.driverVehicle})` : ''}\n\n* Free Live OpenStreetMap Route:\n${getClickableShareUrl(shareUrl)}\n\nReal-time tracking • No app download or login required.`
                      )}`}
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                    >
                      <span>SMS</span>
                    </a>

                    {/* Native Share Sheet */}
                    <button
                      type="button"
                      onClick={handleNativeShare}
                      className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                    >
                      <span>All Apps</span>
                    </button>
                  </div>
                </div>

                {/* Free Tech & Privacy Banner */}
                <div className="bg-emerald-950/50 border border-emerald-700/80 rounded-2xl p-3.5 text-[11px] text-emerald-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-200">
                    <span>Free OpenStreetMap Live GPS & Route (Zero Google Maps Cost)</span>
                  </div>
                  <p className="text-emerald-300/90 leading-relaxed text-[11px]">
                    Anyone opening this link sees the verified road route and live chauffeur GPS without logging in or downloading an app. Live tracking automatically expires when the ride completes.
                  </p>
                </div>

                {/* Revoke / Stop Sharing Button */}
                <button
                  type="button"
                  onClick={handleStopSharing}
                  className="w-full py-2.5 rounded-xl border border-rose-800/80 text-rose-400 hover:bg-rose-950/70 font-bold text-xs cursor-pointer transition-colors"
                >
                  Stop Sharing Trip (Revoke Link)
                </button>
              </div>
            ) : (
              <div className="space-y-3 py-2 text-center text-xs">
                <div className="p-4 bg-[#0d1424] rounded-2xl border border-blue-800/70 text-cyan-400">
                  <p className="font-bold text-sm">Trip Sharing is currently stopped</p>
                  <p className="text-[11px] text-slate-300 mt-1">Previous tracking links have been deactivated.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenShareModal(shareTripModalBooking)}
                  className="w-full py-2.5 bg-[#002C6C] hover:bg-[#004B93] text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  Re-activate Trip Sharing
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PASSENGER PAYMENT MODAL */}
      {paymentModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#14171f] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#262b36] space-y-5 text-slate-100">
            <div className="flex justify-between items-start border-b border-[#262b36] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">DriveC Payment Gateway</span>
                <h3 className="text-base font-bold text-slate-100 mt-0.5">Payment for #{paymentModalBooking.refCode}</h3>
              </div>
              <button onClick={() => setPaymentModalBooking(null)} className="text-slate-400 hover:text-slate-300">
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            {paymentSuccessMsg ? (
              <div className="p-5 bg-emerald-950/50 border border-emerald-700/80 rounded-2xl text-center space-y-2">
                <p className="font-black text-emerald-200">{paymentSuccessMsg}</p>
                <button
                  onClick={() => setPaymentModalBooking(null)}
                  className="mt-2 px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Comprehensive Final Fare Breakdown (Requirement 5) */}
                <div className="bg-[#0d1017] rounded-2xl p-4 border border-[#262b36] space-y-2.5">
                  <div className="flex justify-between text-slate-300 pb-2 border-b border-[#262b36]">
                    <span className="font-medium">Booking ID:</span>
                    <strong className="font-mono text-slate-100">{paymentModalBooking.refCode}</strong>
                  </div>
                  {(paymentModalBooking.bookingType === 'self_drive_rental' || paymentModalBooking.serviceType === 'self-drive' || (paymentModalBooking.serviceType as string) === 'self_drive' || Boolean(paymentModalBooking.rentalVehicleId)) ? (
                    <>
                      <div className="flex justify-between text-slate-300">
                        <span className="font-medium">Rental Vehicle:</span>
                        <strong className="text-slate-100">{paymentModalBooking.rentalVehicleModel || 'Self-Drive Vehicle'}</strong>
                      </div>
                      <div className="flex justify-between text-slate-300 text-[11px]">
                        <span className="font-medium">Pickup Date:</span>
                        <strong className="text-slate-200">{paymentModalBooking.scheduledDate}</strong>
                      </div>
                      <div className="flex justify-between text-slate-300 text-[11px]">
                        <span className="font-medium">Scheduled Return Date:</span>
                        <strong className="text-slate-200">{paymentModalBooking.returnDate || paymentModalBooking.scheduledDate}</strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-slate-300">
                        <span className="font-medium">Assigned Driver:</span>
                        <strong className="text-slate-100">{paymentModalBooking.driverName || 'DriveC Chauffeur'}</strong>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span className="font-medium">Trip Type:</span>
                        <span className="font-bold capitalize text-slate-200">{paymentModalBooking.serviceType.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex justify-between text-slate-300 text-[11px]">
                        <span className="font-medium">Pickup:</span>
                        <span className="text-right font-medium max-w-[65%] truncate text-slate-200">{paymentModalBooking.pickupLocation}</span>
                      </div>
                      <div className="flex justify-between text-slate-300 text-[11px]">
                        <span className="font-medium">Drop-off:</span>
                        <span className="text-right font-medium max-w-[65%] truncate text-slate-200">{paymentModalBooking.destinationLocation}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span className="font-medium">Actual Billable Distance & Duration:</span>
                        <strong className="font-mono text-indigo-300">
                          {paymentModalBooking.actualDistanceKm ?? (paymentModalBooking.fareBreakdown as any)?.distanceKm ?? 25} km · {paymentModalBooking.actualDurationMinutes ?? (paymentModalBooking.fareBreakdown as any)?.durationMinutes ?? 45} mins
                        </strong>
                      </div>
                    </>
                  )}

                  <div className="pt-2 border-t border-[#262b36] space-y-1.5 text-slate-300">
                    <div className="flex justify-between">
                      <span>Base Ride Fare:</span>
                      <span className="font-mono">₹{(paymentModalBooking.fareBreakdown as any)?.baseFare ?? Math.round(paymentModalBooking.fareBreakdown.totalFare * 0.85)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GST (5%):</span>
                      <span className="font-mono">₹{(paymentModalBooking.fareBreakdown as any)?.gstAmount ?? (paymentModalBooking.fareBreakdown as any)?.serviceTaxGST ?? Math.round(paymentModalBooking.fareBreakdown.totalFare * 0.05 / 1.05)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Platform Convenience Fee:</span>
                      <span className="font-mono">₹{(paymentModalBooking.fareBreakdown as any)?.platformFee ?? 25}</span>
                    </div>
                  </div>

                  <div className="flex justify-between font-black text-base border-t border-[#262b36] pt-2.5 mt-1 text-slate-100">
                    <span>Final Payable Amount:</span>
                    <span className="text-cyan-400 font-mono text-lg font-bold">₹{paymentModalBooking.fareBreakdown.totalFare}</span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-2">Select Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['upi', 'cash', 'card'] as const).map((method) => (
                      <button
                        key={method}
                        onClick={() => setSelectedPayMethod(method)}
                        className={`py-3 rounded-2xl border-2 font-bold flex flex-col items-center gap-1.5 transition-all ${
                          selectedPayMethod === method
                            ? 'border-[#002C6C] bg-[#002C6C] text-white'
                            : 'border-[#262b36] bg-[#0d1017] text-slate-300 hover:border-[#262b36]'
                        }`}
                      >
                        <span className="text-[11px] uppercase">{method}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setPaymentModalBooking(null)}
                    className="w-1/3 py-3 rounded-xl border border-[#262b36] text-slate-300 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (onPassengerPayment) {
                        onPassengerPayment(paymentModalBooking.id, selectedPayMethod);
                        setPaymentSuccessMsg(`✓ ₹${paymentModalBooking.fareBreakdown.totalFare} paid successfully via ${selectedPayMethod.toUpperCase()} — Driver Wallet Credited!`);
                      }
                    }}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99]"
                  >
                    <span>Pay ₹{paymentModalBooking.fareBreakdown.totalFare}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* COMPLETE RENTAL RIDE & REMAINING PAYMENT MODAL */}
      {completeRentalModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-[#14171f] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#262b36] space-y-5 text-slate-100">
            <div className="flex justify-between items-start border-b border-[#262b36] pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-700/80">
                  Self-Drive Rental Return
                </span>
                <h3 className="text-lg font-black text-slate-100 mt-1">
                  Complete Ride & Pay Remaining
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Ref: {completeRentalModalBooking.refCode}
                </p>
              </div>
              <button onClick={() => setCompleteRentalModalBooking(null)} className="text-slate-400 hover:text-slate-300">
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            {rentalPaymentSuccessMsg ? (
              <div className="text-center py-6 space-y-3">
                                <h4 className="text-base font-black text-slate-100">Rental Ride Completed!</h4>
                <p className="text-xs text-emerald-300 font-semibold">{rentalPaymentSuccessMsg}</p>
                <button
                  onClick={() => setCompleteRentalModalBooking(null)}
                  className="mt-3 px-6 py-2.5 rounded-xl bg-[#002C6C] text-white font-bold text-xs"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Vehicle & Tariff Breakdown */}
                {(() => {
                  const b = completeRentalModalBooking;
                  const approvedExt = rentalExtensions.find(e => e.bookingId === b.id && e.status === 'approved');
                  const baseTotalFare = b.fareBreakdown?.totalFare || 0;
                  const baseAdvance = b.advanceAmount || (b.fareBreakdown as any)?.advanceAmount || 1000;
                  const approvedExtPrice = approvedExt ? approvedExt.extensionPrice : 0;
                  const hasExtensionInFare = (b.extensionFee !== undefined && b.extensionFee !== null && b.extensionFee > 0) ||
                    Boolean((b.fareBreakdown as any)?.extensionFee && (b.fareBreakdown as any)?.extensionFee > 0);
                  const effectiveTotalFare = hasExtensionInFare ? baseTotalFare : (baseTotalFare + approvedExtPrice);
                  const rawRemaining = b.remainingAmount ?? ((b.fareBreakdown as any)?.remainingAmount ?? Math.max(0, baseTotalFare - baseAdvance));
                  const effectiveRemaining = hasExtensionInFare ? rawRemaining : (rawRemaining + approvedExtPrice);

                  return (
                    <div className="bg-[#0d1017] rounded-2xl p-4 border border-[#262b36] space-y-2 text-xs">
                      <div className="flex justify-between text-slate-300">
                        <span>Vehicle:</span>
                        <strong className="text-slate-100">{b.rentalVehicleModel || 'Self-Drive Car'}</strong>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Rental Schedule:</span>
                        <span className="font-semibold text-slate-200">
                          {b.scheduledDate} → {b.returnDate || b.scheduledDate} ({b.rentalDays || 1} day(s))
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-300 border-t border-[#262b36] pt-2">
                        <span>Total Rental Tariff:</span>
                        <span className="font-bold text-slate-100">₹{effectiveTotalFare}</span>
                      </div>
                      {approvedExtPrice > 0 && (
                        <div className="flex justify-between items-center text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-800/70">
                          <span>Approved Extension Amount (+{approvedExt?.additionalDays} day{approvedExt && approvedExt.additionalDays > 1 ? 's' : ''}):</span>
                          <span className="font-mono font-bold">+₹{approvedExtPrice}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-emerald-300">
                        <span>Advance Amount (Already Paid):</span>
                        <span className="font-black font-mono">- ₹{baseAdvance} (PAID ✓)</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-black border-t-2 border-[#262b36] pt-2 text-cyan-400">
                        <span>Remaining Balance Due on Return:</span>
                        <span className="text-lg text-emerald-300 font-mono font-black">
                          ₹{effectiveRemaining}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Return Confirmation */}
                <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-indigo-950/50 border border-indigo-800/70 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={isVehicleReturnedConfirmed}
                    onChange={(e) => setIsVehicleReturnedConfirmed(e.target.checked)}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-indigo-300 font-medium">
                    I confirm that the vehicle has been returned to the DriveC depot with keys handed over.
                  </span>
                </label>

                {/* Payment Method Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">Select Payment Method for Remaining Balance:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['upi', 'card', 'cash'] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setSelectedPayMethod(method)}
                        className={`py-2.5 px-3 rounded-xl border flex flex-col items-center justify-center gap-1 font-bold text-xs transition-all ${
                          selectedPayMethod === method
                            ? 'border-[#002C6C] bg-[#0d1424] text-cyan-400 shadow-xs'
                            : 'border-[#262b36] text-slate-300 hover:bg-[#1c202a]'
                        }`}
                      >
                        <span className="uppercase text-[10px] tracking-wider font-extrabold">{method === 'upi' ? 'UPI / GPay' : method}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCompleteRentalModalBooking(null)}
                    className="w-1/3 py-3 rounded-xl border border-[#262b36] text-slate-300 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!isVehicleReturnedConfirmed || isSubmittingRentalPayment}
                    onClick={async () => {
                      if (!completeRentalModalBooking) return;
                      setIsSubmittingRentalPayment(true);
                      const b = completeRentalModalBooking;
                      const approvedExt = rentalExtensions.find(e => e.bookingId === b.id && e.status === 'approved');
                      const baseTotalFare = b.fareBreakdown?.totalFare || 0;
                      const baseAdvance = b.advanceAmount || (b.fareBreakdown as any)?.advanceAmount || 1000;
                      const approvedExtPrice = approvedExt ? approvedExt.extensionPrice : 0;
                      const hasExtensionInFare = (b.extensionFee !== undefined && b.extensionFee !== null && b.extensionFee > 0) ||
                        Boolean((b.fareBreakdown as any)?.extensionFee && (b.fareBreakdown as any)?.extensionFee > 0);
                      const rawRemaining = b.remainingAmount ?? ((b.fareBreakdown as any)?.remainingAmount ?? Math.max(0, baseTotalFare - baseAdvance));
                      const rem = hasExtensionInFare ? rawRemaining : (rawRemaining + approvedExtPrice);

                      try {
                        if (onUpdateBookingStatus) {
                          await onUpdateBookingStatus(completeRentalModalBooking.id, 'completed', {
                            remainingPaid: true,
                            passengerPaid: true,
                            paymentStatus: 'completed',
                            paymentMethod: selectedPayMethod,
                            remainingPaidAt: new Date().toISOString(),
                            remainingAmount: rem,
                          });
                        } else if (onPassengerPayment) {
                          await onPassengerPayment(completeRentalModalBooking.id, selectedPayMethod);
                        }
                        setRentalPaymentSuccessMsg(`✓ ₹${rem} settled via ${selectedPayMethod.toUpperCase()}. Ride completed and vehicle return recorded!`);
                      } catch (e) {
                        console.error('Error completing rental ride:', e);
                      } finally {
                        setIsSubmittingRentalPayment(false);
                      }
                    }}
                    className={`flex-1 py-3 rounded-xl text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 ${
                      !isVehicleReturnedConfirmed || isSubmittingRentalPayment
                        ? 'bg-emerald-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99]'
                    }`}
                  >
                    <span>Complete Ride & Pay ₹{(() => {
                      const b = completeRentalModalBooking;
                      const approvedExt = rentalExtensions.find(e => e.bookingId === b.id && e.status === 'approved');
                      const baseTotalFare = b.fareBreakdown?.totalFare || 0;
                      const baseAdvance = b.advanceAmount || (b.fareBreakdown as any)?.advanceAmount || 1000;
                      const approvedExtPrice = approvedExt ? approvedExt.extensionPrice : 0;
                      const hasExtensionInFare = (b.extensionFee !== undefined && b.extensionFee !== null && b.extensionFee > 0) ||
                        Boolean((b.fareBreakdown as any)?.extensionFee && (b.fareBreakdown as any)?.extensionFee > 0);
                      const rawRemaining = b.remainingAmount ?? ((b.fareBreakdown as any)?.remainingAmount ?? Math.max(0, baseTotalFare - baseAdvance));
                      return hasExtensionInFare ? rawRemaining : (rawRemaining + approvedExtPrice);
                    })()}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DRIVER DENIED POPUP (FAVOURITE VS SPECIFIC) */}
      {deniedBookingPopup && (() => {
        const isFav = Boolean(deniedBookingPopup.favouriteDriverId || deniedBookingPopup.requestQueueStatus === 'exclusive_favourite' || (deniedBookingPopup as any).driverSelectionMode === 'favourite');
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-sm bg-[#14171f] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#262b36] space-y-5 text-center text-slate-100">
                            <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400">Ride Request Update</span>
                <h3 className="text-xl font-black text-slate-100 mt-1">Driver Declined</h3>
                <p className="text-xs text-slate-300 font-bold mt-2 leading-relaxed">
                  Driver has declined your request.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Reference: <span className="font-mono font-bold">{deniedBookingPopup.refCode}</span>
                </p>
              </div>
              {isFav ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => {
                      setDeniedBookingPopup(null);
                      onNavigateToBooking();
                    }}
                    className="flex-1 py-3 rounded-xl border-2 border-[#002C6C] text-cyan-400 hover:bg-[#152238] font-black text-xs transition-all"
                  >
                    Pick a Driver
                  </button>
                  <button
                    onClick={async () => {
                      const id = deniedBookingPopup.id;
                      setDeniedBookingPopup(null);
                      try {
                        await fetch(`/api/bookings/${id}/status`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'accept_random_drivers' }),
                        });
                      } catch (e) {
                        console.error('Error switching to random:', e);
                      }
                    }}
                    className="flex-1 py-3 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-black text-xs shadow-md transition-all"
                  >
                    Accept Random Drivers
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => {
                      setDeniedBookingPopup(null);
                      onNavigateToBooking();
                    }}
                    className="w-full py-3 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Select Another Driver</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* REPORT COMPLAINT MODAL */}
      {complaintModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="w-full max-w-lg bg-[#14171f] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#262b36] space-y-4 animate-in fade-in text-slate-100">
            <div className="flex justify-between items-start border-b border-[#262b36] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">DriveC Safety & Dispute Ticket</span>
                <h3 className="text-base font-bold text-slate-100">Report Issue for #{complaintModalBooking.refCode}</h3>
              </div>
              <button onClick={() => setComplaintModalBooking(null)} className="text-slate-400 hover:text-slate-300">
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            <form onSubmit={handleSubmitComplaint} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Issue Category *</label>
                <select
                  value={complaintCategory}
                  onChange={(e) => setComplaintCategory(e.target.value as Complaint['category'])}
                  className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none bg-[#0d1017] text-slate-100 font-medium"
                >
                  <option value="fare_dispute">Fare Calculation Dispute</option>
                  <option value="rash_driving">Driving Conduct / Rash Driving</option>
                  <option value="cleanliness">Vehicle Cleanliness</option>
                  <option value="unprofessional">Driver Courtesy & Conduct</option>
                  <option value="route_deviation">Unwarranted Route Deviation</option>
                  <option value="other">Other Operational Matter</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Detailed Description *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide precise details of the incident..."
                  value={complaintDesc}
                  onChange={(e) => setComplaintDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none"
                ></textarea>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setComplaintModalBooking(null)}
                  className="w-1/3 py-2.5 rounded-xl border border-[#262b36] text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  Submit Ticket to Operations Desk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER REVIEW SUBMISSION MODAL (Requirement 10) */}
      {reviewModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-[#14171f] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-[#262b36] space-y-5 text-slate-100">
            <div className="flex justify-between items-center border-b border-[#262b36] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 bg-[#0d1424] px-2 py-0.5 rounded border border-blue-800/70">
                  Verified Trip Review
                </span>
                <h3 className="text-lg font-black text-cyan-400 mt-1">
                  Rate Driver: {reviewModalBooking.driverName || 'DriveC Driver'}
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">Trip #{reviewModalBooking.refCode}</span>
              </div>
              <button onClick={() => setReviewModalBooking(null)} className="text-slate-400 hover:text-slate-300 text-sm font-bold">
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!onSubmitReview) return;
                if (reviewModalBooking.status !== 'completed') {
                  alert('Reviews are only permitted after the ride is marked completed.');
                  return;
                }
                if (reviews.some(r => r.bookingId === reviewModalBooking.id || r.bookingRef === reviewModalBooking.refCode)) {
                  alert('A review has already been submitted for this booking.');
                  return;
                }
                const newRev: Review = {
                  id: 'rev-' + Date.now(),
                  bookingId: reviewModalBooking.id,
                  bookingRef: reviewModalBooking.refCode,
                  reviewerId: currentUser.id,
                  reviewerName: currentUser.name,
                  reviewerRole: 'customer',
                  targetId: reviewModalBooking.driverId || 'drv-general',
                  targetName: reviewModalBooking.driverName || 'Kerala Driver',
                  targetRole: 'driver',
                  punctualityRating,
                  cleanlinessRating,
                  comfortRating,
                  overallRating,
                  comment: reviewComment.trim() || 'Professional pilot service across Kerala.',
                  createdAt: new Date().toISOString(),
                  verifiedTrip: true
                };
                onSubmitReview(newRev);
                setReviewModalBooking(null);
                setReviewComment('');
              }}
              className="space-y-4 text-xs"
            >
              {/* Star Ratings Grid */}
              <div className="grid grid-cols-2 gap-3 bg-[#0d1017] p-4 rounded-2xl border border-[#262b36]">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Overall Rating (1-5)</label>
                  <select
                    value={overallRating}
                    onChange={(e) => setOverallRating(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl font-bold text-cyan-400 outline-none"
                  >
                    <option value={5}>★★★★★ (5 - Excellent)</option>
                    <option value={4}>★★★★☆ (4 - Good)</option>
                    <option value={3}>★★★☆☆ (3 - Average)</option>
                    <option value={2}>★★☆☆☆ (2 - Fair)</option>
                    <option value={1}>★☆☆☆☆ (1 - Poor)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Punctuality</label>
                  <select
                    value={punctualityRating}
                    onChange={(e) => setPunctualityRating(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl font-bold text-slate-100 outline-none"
                  >
                    <option value={5}>★ 5 On Time</option>
                    <option value={4}>★ 4 Minor Delay</option>
                    <option value={3}>★ 3 Late</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Driving Conduct</label>
                  <select
                    value={cleanlinessRating}
                    onChange={(e) => setCleanlinessRating(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl font-bold text-slate-100 outline-none"
                  >
                    <option value={5}>★ 5 Safe & Smooth</option>
                    <option value={4}>★ 4 Good</option>
                    <option value={3}>★ 3 Moderate</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Cabin Comfort</label>
                  <select
                    value={comfortRating}
                    onChange={(e) => setComfortRating(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl font-bold text-slate-100 outline-none"
                  >
                    <option value={5}>★ 5 Highly Comfortable</option>
                    <option value={4}>★ 4 Comfortable</option>
                    <option value={3}>★ 3 Average</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1">Your Review & Driver Feedback *</label>
                <textarea
                  required
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share your experience with this driver (route knowledge, conduct, hygiene)..."
                  className="w-full px-3.5 py-2.5 bg-[#0d1017] border border-[#262b36] text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500"
                ></textarea>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setReviewModalBooking(null)}
                  className="w-1/3 py-3 rounded-xl border border-[#262b36] text-slate-300 font-bold hover:bg-[#1c202a]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-black shadow-md flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Submit Verified Review</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REQUIREMENT 2: RENTAL CANCELLATION & 80% REFUND MODAL */}
      {cancelModalBooking && (() => {
        const adv = cancelModalBooking.advanceAmount || (cancelModalBooking.fareBreakdown as any)?.advanceAmount || 1000;
        const fee = Math.round(adv * 0.20); // 20% cancellation fee
        const ref = adv - fee;              // 80% refund
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
            <div className="bg-[#14171f] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#262b36] space-y-4 text-slate-100">
              <div className="flex items-center justify-between border-b border-[#262b36] pb-3">
                <div className="flex items-center gap-2">
                                    <div>
                    <h3 className="font-black text-slate-100 text-base">Cancel Rental Reservation</h3>
                    <p className="text-[11px] text-slate-400">Ref: {cancelModalBooking.refCode}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCancelModalBooking(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-300"
                >
                  <span className="font-bold text-sm leading-none">✕</span>
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to cancel your rental reservation for <strong>{cancelModalBooking.rentalVehicleModel || 'this vehicle'}</strong>?
              </p>

              {/* Exact 80% refund calculation breakdown */}
              <div className="p-3.5 bg-[#0d1017] rounded-2xl border border-[#262b36] space-y-2 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Advance Amount Paid:</span>
                  <span className="font-mono font-bold text-slate-100">₹{adv}</span>
                </div>
                <div className="flex justify-between text-rose-300">
                  <span>Cancellation Fee (20%):</span>
                  <span className="font-mono font-bold">-₹{fee}</span>
                </div>
                <div className="border-t border-[#262b36] pt-2 flex justify-between text-emerald-300 font-bold text-sm">
                  <span>Refund to Original Payment (80%):</span>
                  <span className="font-mono font-black text-emerald-300">₹{ref}</span>
                </div>
              </div>

              <div className="bg-amber-950/50 rounded-xl p-2.5 border border-amber-700/70 text-[11px] text-amber-200">
                ℹ️ The refund of <strong>₹{ref}</strong> will be processed immediately back to your original payment method.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalBooking(null)}
                  className="w-1/3 py-3 rounded-xl border border-[#262b36] text-slate-300 font-bold hover:bg-[#1c202a] text-xs"
                >
                  Keep Booking
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onUpdateBookingStatus) {
                      onUpdateBookingStatus(cancelModalBooking.id, 'cancelled', {
                        cancelledBy: 'customer',
                        cancellationReason: 'Cancelled by customer',
                        cancellationFee: fee,
                        refundAmount: ref,
                        advanceAmount: adv
                      });
                    } else {
                      onCancelBooking(cancelModalBooking.id);
                    }
                    setCancelModalBooking(null);
                  }}
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-md transition-colors"
                >
                  Confirm Cancellation & Refund ₹{ref}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* REQUIREMENT 3: RENTAL EXTENSION MODAL */}
      {extendModalBooking && (() => {
        const approvedForModal = rentalExtensions.find(e => e.bookingId === extendModalBooking.id && e.status === 'approved');
        const curReturn = approvedForModal?.requestedReturnDate || extendModalBooking.returnDate || extendModalBooking.scheduledDate;
        const dailyRate = extendModalBooking.fareBreakdown?.rentalDailyRate || 1000;
        
        let additionalDays = 0;
        let additionalFee = 0;
        if (newExtendReturnDate && newExtendReturnDate > curReturn) {
          const d1 = new Date(curReturn);
          const d2 = new Date(newExtendReturnDate);
          additionalDays = Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
          additionalFee = additionalDays * dailyRate;
        }

        const existingTotal = extendModalBooking.fareBreakdown?.totalFare || 0;
        const updatedTotal = existingTotal + additionalFee;

        const handleConfirmExtension = async () => {
          if (!newExtendReturnDate || newExtendReturnDate <= curReturn) {
            setExtendErrorMsg(`Please select a return date strictly later than the current return date (${curReturn}).`);
            return;
          }

          setIsSubmittingExtension(true);
          setExtendErrorMsg('');
          try {
            if (onRequestRentalExtension) {
              await onRequestRentalExtension(extendModalBooking.id, newExtendReturnDate);
            } else {
              const res = await fetch('/api/rental-extensions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-user-id': currentUser.id,
                  'x-user-role': currentUser.role,
                },
                body: JSON.stringify({
                  bookingId: extendModalBooking.id,
                  requestedReturnDate: newExtendReturnDate
                })
              });
              if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || errData.error || 'Failed to submit extension request.');
              }
            }

            setExtendSuccessMsg(`Extension request for ${additionalDays} day(s) until ${newExtendReturnDate} (+₹${additionalFee}) submitted! Awaiting Admin approval.`);
            setTimeout(() => {
              setExtendModalBooking(null);
            }, 1800);
          } catch (err: any) {
            setExtendErrorMsg(err.message || 'Error submitting rental extension request.');
          } finally {
            setIsSubmittingExtension(false);
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
            <div className="bg-[#14171f] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#262b36] space-y-4 text-slate-100">
              <div className="flex items-center justify-between border-b border-[#262b36] pb-3">
                <div className="flex items-center gap-2">
                                    <div>
                    <h3 className="font-black text-slate-100 text-base">Extend Rental Date</h3>
                    <p className="text-[11px] text-slate-400 font-mono">Booking Ref: {extendModalBooking.refCode}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExtendModalBooking(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-300"
                >
                  <span className="font-bold text-sm leading-none">✕</span>
                </button>
              </div>

              {extendSuccessMsg && (
                <div className="p-3 bg-emerald-950/50 border border-emerald-700/80 rounded-xl text-xs text-emerald-200 font-bold flex items-center gap-2">
                  <span>{extendSuccessMsg}</span>
                </div>
              )}

              {extendErrorMsg && (
                <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl text-xs text-rose-200 font-bold flex items-center gap-2">
                  <span>{extendErrorMsg}</span>
                </div>
              )}

              <div className="space-y-3 text-xs">
                {/* Vehicle & Current Return Date */}
                <div className="bg-[#0d1017] p-3 rounded-xl border border-[#262b36] space-y-1.5">
                  <div className="flex justify-between text-slate-300">
                    <span>Vehicle:</span>
                    <strong className="text-slate-100">{extendModalBooking.rentalVehicleModel || 'Self-Drive Vehicle'}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Current Scheduled Return Date:</span>
                    <strong className="text-slate-100 font-mono">{curReturn}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Daily Rental Rate:</span>
                    <strong className="text-slate-100 font-mono">₹{dailyRate} / day</strong>
                  </div>
                </div>

                {/* Date Selection */}
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Select New Return Date *</label>
                  <input
                    type="date"
                    min={(() => {
                      const d = new Date(curReturn);
                      d.setDate(d.getDate() + 1);
                      return d.toISOString().split('T')[0];
                    })()}
                    value={newExtendReturnDate}
                    onChange={(e) => {
                      setNewExtendReturnDate(e.target.value);
                      setExtendErrorMsg('');
                    }}
                    className="w-full px-3 py-2.5 bg-[#0d1017] border border-[#262b36] rounded-xl outline-none font-bold text-slate-200 focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Must be strictly later than {curReturn}</p>
                </div>

                {/* Pricing & Separate Amounts Breakdown (Requirement 2 & 5) */}
                {additionalDays > 0 && (
                  <div className="p-3.5 bg-indigo-950/50 rounded-2xl border border-indigo-800/70 space-y-2">
                    <div className="flex justify-between text-indigo-300">
                      <span>Additional Rental Period:</span>
                      <strong>{additionalDays} Additional Day(s)</strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Existing Rental Amount:</span>
                      <strong className="font-mono">₹{existingTotal}</strong>
                    </div>
                    <div className="flex justify-between text-indigo-300 font-bold border-t border-indigo-800/70 pt-1.5">
                      <span>Additional Extension Amount:</span>
                      <strong className="font-mono text-emerald-300">+₹{additionalFee}</strong>
                    </div>
                    <div className="flex justify-between text-indigo-300 font-black text-sm border-t border-indigo-800/70 pt-1.5">
                      <span>Updated Estimated Total Rental:</span>
                      <strong className="font-mono text-cyan-400 font-bold">₹{updatedTotal}</strong>
                    </div>
                    <p className="text-[10px] text-indigo-300 pt-1 leading-relaxed">
                      * Submitting sends this extension request to DriveC Admin for fleet scheduling review. Your approved return date will update once approved.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExtendModalBooking(null)}
                  disabled={isSubmittingExtension}
                  className="w-1/3 py-3 rounded-xl border border-[#262b36] text-slate-300 font-bold hover:bg-[#1c202a] text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmExtension}
                  disabled={additionalDays <= 0 || isSubmittingExtension}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
                >
                  {isSubmittingExtension ? (
                    <span>Submitting Request...</span>
                  ) : (
                    <span>Submit Extension Request (+₹{additionalFee})</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* REQUIREMENT 6: PAY APPROVED EXTENSION MODAL */}
      {payExtensionModalExt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#14171f] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#262b36] space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-[#262b36] pb-3">
              <div className="flex items-center gap-2">
                                <div>
                  <h3 className="font-black text-slate-100 text-base">Pay Extension Amount</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Ref: {payExtensionModalExt.bookingRef}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayExtensionModalExt(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-300"
              >
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            {extensionPaymentSuccessMsg ? (
              <div className="text-center py-6 space-y-3">
                                <h4 className="text-base font-black text-slate-100">Payment Successful!</h4>
                <p className="text-xs text-emerald-300 font-semibold">{extensionPaymentSuccessMsg}</p>
                <button
                  type="button"
                  onClick={() => setPayExtensionModalExt(null)}
                  className="mt-3 px-6 py-2.5 rounded-xl bg-[#002C6C] text-white font-bold text-xs"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="bg-[#0d1017] rounded-2xl p-4 border border-[#262b36] space-y-2">
                  <div className="flex justify-between text-slate-300">
                    <span>Vehicle:</span>
                    <strong className="text-slate-100">{payExtensionModalExt.vehicleModel}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Registration:</span>
                    <strong className="font-mono text-slate-100">{payExtensionModalExt.licensePlate}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Approved Return Date:</span>
                    <strong className="text-indigo-300 font-bold">{payExtensionModalExt.requestedReturnDate} (+{payExtensionModalExt.additionalDays} Days)</strong>
                  </div>
                  <div className="flex justify-between items-center text-sm font-black border-t-2 border-[#262b36] pt-2 text-cyan-400">
                    <span>Extension Amount Payable:</span>
                    <span className="font-mono text-emerald-300 text-base">₹{payExtensionModalExt.extensionPrice}</span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-2">
                  <label className="block font-bold text-slate-300">Choose Payment Method:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'upi' as const, label: 'UPI / QR' },
                      { id: 'card' as const, label: 'Card / Debit' },
                      { id: 'cash' as const, label: 'Direct Cash' },
                    ].map(pm => (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setSelectedExtPayMethod(pm.id)}
                          className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            selectedExtPayMethod === pm.id
                              ? 'bg-[#002C6C] border-cyan-500 text-white font-bold ring-2 ring-cyan-500/40'
                              : 'bg-[#0d1017] border-[#262b36] text-slate-300 hover:bg-[#1c202a]'
                          }`}
                        >
                          <span className="text-[11px]">{pm.label}</span>
                        </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPayExtensionModalExt(null)}
                    disabled={isSubmittingExtPayment}
                    className="w-1/3 py-3 rounded-xl border border-[#262b36] text-slate-300 font-bold hover:bg-[#1c202a] text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingExtPayment}
                    onClick={async () => {
                      setIsSubmittingExtPayment(true);
                      try {
                        if (onPayRentalExtension) {
                          await onPayRentalExtension(payExtensionModalExt.id, selectedExtPayMethod);
                        } else {
                          const res = await fetch(`/api/rental-extensions/${payExtensionModalExt.id}`, {
                            method: 'PATCH',
                            headers: {
                              'Content-Type': 'application/json',
                              'x-user-id': currentUser.id,
                              'x-user-role': currentUser.role,
                            },
                            body: JSON.stringify({ action: 'pay', paymentMethod: selectedExtPayMethod })
                          });
                          if (!res.ok) {
                            const errData = await res.json();
                            throw new Error(errData.message || 'Payment processing failed.');
                          }
                        }
                        setExtensionPaymentSuccessMsg(`Payment of ₹${payExtensionModalExt.extensionPrice} via ${selectedExtPayMethod.toUpperCase()} confirmed successfully!`);
                        setTimeout(() => {
                          setPayExtensionModalExt(null);
                        }, 1800);
                      } catch (err: any) {
                        alert(err.message || 'Payment failed.');
                      } finally {
                        setIsSubmittingExtPayment(false);
                      }
                    }}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
                  >
                    {isSubmittingExtPayment ? (
                      <span>Processing...</span>
                    ) : (
                      <span>Pay ₹{payExtensionModalExt.extensionPrice} Now</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD / EDIT VEHICLE MODAL */}
      {showVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-[#14171f] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#262b36] space-y-5 text-slate-100">
            <div className="flex justify-between items-start border-b border-[#262b36] pb-3">
              <div className="flex items-center gap-2.5">
                                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block">
                    {editingVehicle ? 'Update Vehicle' : 'Register Vehicle'}
                  </span>
                  <h3 className="text-lg font-black text-slate-100">
                    {editingVehicle ? 'Edit Vehicle Details' : 'Add Vehicle to Garage'}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowVehicleModal(false)}
                className="text-slate-400 hover:text-slate-300 p-1 rounded-lg"
              >
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            <form onSubmit={handleSaveVehicleSubmit} className="space-y-4 text-xs">
              {vFeedbackMsg && (
                <div className="p-3 bg-rose-950/50 text-rose-300 border border-rose-800/80 rounded-xl font-semibold">
                  {vFeedbackMsg}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-200 mb-1">Make & Model *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maruti Suzuki Swift Dzire / Hyundai Creta"
                  value={vMakeModel}
                  onChange={(e) => setVMakeModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0d1017] border border-[#262b36] text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1">Vehicle Category</label>
                <select
                  value={vType}
                  onChange={(e) => setVType(e.target.value as VehicleCategory)}
                  className="w-full px-3.5 py-2.5 bg-[#0d1017] border border-[#262b36] rounded-xl font-medium outline-none"
                >
                  <option value="sedan">Executive Sedan (City, Ciaz, Verna, Dzire)</option>
                  <option value="suv">SUV / MUV (Creta, Seltos, Innova, Nexon)</option>
                  <option value="hatchback">Hatchback (Swift, Baleno, i20, Tiago)</option>
                  <option value="premium">Luxury / Premium (Crysta, Fortuner, BMW, Merc)</option>
                  <option value="auto">Auto / Utility</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1.5">Transmission *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setVTransmission('manual')}
                      className={`py-2 px-3 rounded-xl border font-bold text-xs transition-all ${
                        vTransmission === 'manual'
                          ? 'border-[#002C6C] bg-[#002C6C] text-white shadow-xs'
                          : 'border-[#262b36] bg-[#0d1017] text-slate-300 hover:bg-[#1c202a]'
                      }`}
                    >
                      Manual
                    </button>
                    <button
                      type="button"
                      onClick={() => setVTransmission('automatic')}
                      className={`py-2 px-3 rounded-xl border font-bold text-xs transition-all ${
                        vTransmission === 'automatic'
                          ? 'border-[#002C6C] bg-[#002C6C] text-white shadow-xs'
                          : 'border-[#262b36] bg-[#0d1017] text-slate-300 hover:bg-[#1c202a]'
                      }`}
                    >
                      Automatic
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-200 mb-1.5">Fuel / Power Type *</label>
                  <select
                    value={vFuel}
                    onChange={(e) => setVFuel(e.target.value as FuelType)}
                    className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl font-medium outline-none"
                  >
                    <option value="petrol">Petrol</option>
                    <option value="diesel">Diesel</option>
                    <option value="ev">Electric (EV)</option>
                    <option value="cng">CNG</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1">Vehicle Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Electronic handbrake, child lock on left, sunroof"
                  value={vNotes}
                  onChange={(e) => setVNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0d1017] border border-[#262b36] rounded-xl font-medium outline-none"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={vIsDefault}
                  onChange={(e) => setVIsDefault(e.target.checked)}
                  className="rounded text-cyan-400 focus:ring-[#002C6C] w-4 h-4 cursor-pointer"
                />
                <span className="font-bold text-slate-300">Set as my primary vehicle for 1-click booking</span>
              </label>

              <div className="flex gap-2 pt-3 border-t border-[#262b36]">
                <button
                  type="button"
                  onClick={() => setShowVehicleModal(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-[#262b36] text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={vLoading}
                  className="flex-1 py-2.5 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-black shadow-md flex items-center justify-center gap-2 transition-all"
                >
                  {vLoading ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <span>{editingVehicle ? 'Update Vehicle' : 'Save to My Garage'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
