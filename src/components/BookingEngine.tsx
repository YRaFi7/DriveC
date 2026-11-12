"use client";

import React, { useState, useEffect, useRef } from 'react';
import { validateMobileNumber } from '../lib/validation';
import { 
  MapPin, 
  Navigation, 
  Calendar, 
  Clock 
} from 'lucide-react';
import { 
  Language, 
  UserRole, 
  RideServiceType, 
  VehicleCategory, 
  TransmissionType, 
  FuelType, 
  Booking, 
  BookingStop, 
  Driver, 
  RentalVehicle, 
  BookingType,
  CustomerVehicle,
  User as CustomerUser,
  HourlyPricingConfig,
  DriverServicesPricingConfig
} from '../types';
import { translations } from '../lib/translations';
import { calculateFare, calculateRentalQuote, defaultHourlyPricingConfig, defaultDriverServicesPricingConfig } from '../lib/store';

interface BookingEngineProps {
  language: Language;
  currentUser: {
    id: string;
    role: UserRole;
    name: string;
    phone: string;
  };
  customerData?: CustomerUser | {
    id?: string;
    phone?: string;
    firstRidePromoUsed?: boolean;
    hasCompletedRide?: boolean;
    vehicles?: CustomerVehicle[];
  };
  onOpenGuestWarning: (actionName?: string) => void;
  onBookingCreated: (booking: Booking) => Promise<{ success: boolean; booking?: Booking; activeBooking?: Booking; error?: string; errorCode?: string; mode?: string }> | void;
  onCancelBooking?: (bookingId: string) => Promise<void> | void;
  approvedDrivers: Driver[];
  rentalVehicles?: RentalVehicle[];
  bookings?: Booking[];
  favouriteDriverIds?: string[];
  onToggleFavouriteDriver?: (driverId: string) => void;
  onNavigateToPortal?: (tab: string) => void;
  onPassengerPayment?: (
    bookingId: string,
    paymentMethod: 'cash' | 'upi' | 'card',
    options?: { cashHandedConfirmed?: boolean; gatewayVerified?: boolean; gatewayPaymentId?: string }
  ) => Promise<void> | void;
}

export const BookingEngine: React.FC<BookingEngineProps> = ({
  language,
  currentUser,
  customerData,
  onOpenGuestWarning,
  onBookingCreated,
  onCancelBooking,
  approvedDrivers,
  rentalVehicles = [],
  bookings = [],
  favouriteDriverIds = [],
  onToggleFavouriteDriver,
  onNavigateToPortal,
  onPassengerPayment
}) => {
  const t = translations[language];
  const isGuest = currentUser.role === 'guest';

  // Primary mode: 'driver_booking' (driver for your car) or 'self_drive_rental'
  const [bookingMode, setBookingMode] = useState<BookingType>('driver_booking');

  // Customer's Vehicles from Garage (Requirement: Customers provide vehicle, drivers provide service)
  const [vehicles, setVehicles] = useState<CustomerVehicle[]>(customerData?.vehicles || []);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [showAddCarInline, setShowAddCarInline] = useState(false);
  const [newCarModel, setNewCarModel] = useState('');
  const [newCarCategory, setNewCarCategory] = useState<VehicleCategory>('sedan');
  const [newCarTransmission, setNewCarTransmission] = useState<TransmissionType>('manual');
  const [newCarFuel, setNewCarFuel] = useState<FuelType>('petrol');
  const [newCarNotes, setNewCarNotes] = useState('');
  const [hasSearchedDrivers, setHasSearchedDrivers] = useState(false);
  const [airportTripType, setAirportTripType] = useState<'drop' | 'pickup'>('drop');

  // Active Selected Vehicle from Garage
  const selectedVehicle: CustomerVehicle | null = vehicles.find(v => v.id === selectedVehicleId) || vehicles[0] || null;

  // Active Car attributes for pricing and matching
  const [carModel, setCarModel] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory>('sedan');
  const [transmission, setTransmission] = useState<TransmissionType>('manual');
  const [fuelType, setFuelType] = useState<FuelType>('petrol');

  // Sync customer vehicles from props
  useEffect(() => {
    if (customerData?.vehicles && customerData.vehicles.length > 0) {
      setVehicles(customerData.vehicles);
      const defaultVeh = customerData.vehicles.find(v => v.isDefault) || customerData.vehicles[0];
      if (defaultVeh && !selectedVehicleId) {
        setSelectedVehicleId(defaultVeh.id);
      }
    }
  }, [customerData?.vehicles]);

  // Fetch vehicles if customer is logged in and not yet loaded
  useEffect(() => {
    if (currentUser.id && currentUser.role === 'customer' && (!customerData?.vehicles || customerData.vehicles.length === 0)) {
      fetch(`/api/customers/${currentUser.id}/vehicles`)
        .then(res => res.ok ? res.json() : [])
        .then((data: CustomerVehicle[]) => {
          if (data && data.length > 0) {
            setVehicles(data);
            const defaultVeh = data.find(v => v.isDefault) || data[0];
            setSelectedVehicleId(defaultVeh.id);
          }
        })
        .catch(() => {});
    }
  }, [currentUser.id, currentUser.role, customerData?.vehicles]);

  // Sync selected vehicle details to pricing state
  useEffect(() => {
    if (selectedVehicle) {
      setCarModel(selectedVehicle.makeModel);
      setSelectedCategory((selectedVehicle.vehicleType as VehicleCategory) || 'sedan');
      setTransmission((selectedVehicle.transmission as TransmissionType) || 'manual');
      setFuelType((selectedVehicle.fuelType as FuelType) || 'petrol');
    }
  }, [selectedVehicle]);

  // Inline Add Car Handler
  const handleAddNewCarInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCarModel.trim()) return;

    if (currentUser.id && currentUser.role === 'customer') {
      try {
        const res = await fetch(`/api/customers/${currentUser.id}/vehicles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            makeModel: newCarModel.trim(),
            vehicleType: newCarCategory,
            transmission: newCarTransmission,
            fuelType: newCarFuel,
            notes: newCarNotes.trim(),
            isDefault: vehicles.length === 0
          })
        });
        if (res.ok) {
          const created = await res.json();
          setVehicles(prev => [...prev, created]);
          setSelectedVehicleId(created.id);
          setShowAddCarInline(false);
          setNewCarModel('');
          setNewCarNotes('');
          // Immediately transfer interaction control to Service Type section
          setVehicleSelectionDone(true);
          setActiveFlowSection('service');
          setTimeout(() => {
            document.getElementById('service-type-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 60);
          return;
        }
      } catch (err) {
        console.warn('Error saving vehicle inline:', err);
      }
    }

    const tempVeh: CustomerVehicle = {
      id: 'veh-' + Date.now(),
      customerId: currentUser.id,
      makeModel: newCarModel.trim(),
      vehicleType: newCarCategory,
      transmission: newCarTransmission,
      fuelType: newCarFuel,
      notes: newCarNotes.trim(),
      isDefault: vehicles.length === 0,
      createdAt: new Date().toISOString()
    };
    setVehicles(prev => [...prev, tempVeh]);
    setSelectedVehicleId(tempVeh.id);
    setShowAddCarInline(false);
    setNewCarModel('');
    setNewCarNotes('');
    // Immediately transfer interaction control to Service Type section
    setVehicleSelectionDone(true);
    setActiveFlowSection('service');
    setTimeout(() => {
      document.getElementById('service-type-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  // Driver Selection state
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [driverErrorMsg, setDriverErrorMsg] = useState('');
  const [driverSelectionMode, setDriverSelectionMode] = useState<'favourite' | 'specific' | 'random'>(() => {
    return (favouriteDriverIds && favouriteDriverIds.length > 0) ? 'favourite' : 'random';
  });
  const [driverModalState, setDriverModalState] = useState<{
    isOpen: boolean;
    mode: 'favourite' | 'specific';
    type: 'busy' | 'offline' | 'declined';
    message: string;
    driverName?: string;
    bookingRef?: string;
    bookingId?: string;
  }>({
    isOpen: false,
    mode: 'specific',
    type: 'busy',
    message: '',
  });

  // Self-Drive Rental state
  const [selectedRentalVehicleId, setSelectedRentalVehicleId] = useState<string>('');
  const [rentalPickupDate, setRentalPickupDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [rentalReturnDate, setRentalReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [rentalDays, setRentalDays] = useState(1);

  // Requirement 6 & 7 Popups
  const [maintenancePopup, setMaintenancePopup] = useState<{
    isOpen: boolean;
    vehicleModel?: string;
    expectedDate?: string;
    vehicleId?: string;
    notified?: boolean;
  }>({ isOpen: false });

  const [unavailablePopup, setUnavailablePopup] = useState<{
    isOpen: boolean;
    vehicleModel?: string;
    dates?: string;
  }>({ isOpen: false });

  // Compute rental days from pickup and return dates (Requirement 3)
  const calculatedRentalDays = (() => {
    if (!rentalPickupDate || !rentalReturnDate) return 1;
    const d1 = new Date(rentalPickupDate);
    const d2 = new Date(rentalReturnDate);
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  })();

  // Helper: Check vehicle overlap / double booking (Requirement 7)
  const checkVehicleOverlap = (vehicleId: string, pickupD: string, returnD: string) => {
    const reqStart = pickupD;
    const reqEnd = returnD || pickupD;
    return bookings.some(b => {
      if (b.rentalVehicleId !== vehicleId) return false;
      if (!['pending', 'approved', 'accepted', 'in_progress'].includes(b.status)) return false;
      const bStart = b.scheduledDate;
      const bEnd = b.returnDate || b.scheduledDate;
      return reqStart <= bEnd && reqEnd >= bStart;
    });
  };

  // Promo Code
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [promoMsg, setPromoMsg] = useState('');

  // Requirement 3: Dynamic Pricing for Every Service (Dafy-Inspired)
  const [pricingConfig, setPricingConfig] = useState<DriverServicesPricingConfig>(defaultDriverServicesPricingConfig);
  const hourlyConfig = pricingConfig.hourly || defaultHourlyPricingConfig;

  useEffect(() => {
    fetch('/api/pricing')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          if (data.services) {
            setPricingConfig(data);
          } else if (Array.isArray(data.packages)) {
            setPricingConfig(prev => ({
              ...prev,
              hourly: {
                packages: data.packages,
                extraHourRate: Number(data.extraHourRate) || 150
              }
            }));
          }
        }
      })
      .catch(err => console.warn('Could not load dynamic pricing:', err));
  }, []);

  // Form selections & Stepped Flow
  const [selectedService, setSelectedService] = useState<RideServiceType>('one-way');
  const [bookingFlowStep, setBookingFlowStep] = useState<'trip_type' | 'vehicle' | 'booking'>('trip_type');
  const [activeFlowSection, setActiveFlowSection] = useState<'vehicle' | 'service' | 'booking'>('vehicle');
  const [vehicleSelectionDone, setVehicleSelectionDone] = useState<boolean>(false);
  const [serviceSelectionDone, setServiceSelectionDone] = useState<boolean>(false);
  const [noVehiclePrompt, setNoVehiclePrompt] = useState(false);
  
  // Locations (Requirement: Only pickup and drop-off, intermediate stops removed)
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const stops: BookingStop[] = [];

  // Requirement 2: Option A (Choose My Location GPS) & Option B (Manual Entry with suggestions)
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [pickupSuggestions, setPickupSuggestions] = useState<Array<{ title: string; subtitle?: string; lat?: number; lon?: number }>>([]);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [destSuggestions, setDestSuggestions] = useState<Array<{ title: string; subtitle?: string; lat?: number; lon?: number }>>([]);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);

  const searchLocationSuggestions = async (query: string, setResults: (res: any[]) => void) => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const localLandmarks: Array<{ title: string; subtitle?: string; lat?: number; lon?: number }> = [
      { title: 'Edappally Toll, Kochi', subtitle: 'Ernakulam, Kerala', lat: 10.0247, lon: 76.3079 },
      { title: 'Kakkanad Infopark, Kochi', subtitle: 'IT Expressway, Kakkanad, Kerala', lat: 10.0104, lon: 76.3639 },
      { title: 'MG Road Metro Station', subtitle: 'Ernakulam Central, Kochi', lat: 9.9723, lon: 76.2844 },
      { title: 'Marine Drive, Kochi', subtitle: 'Ernakulam Waterfront, Kochi', lat: 9.9816, lon: 76.2758 },
      { title: 'Fort Kochi Beach', subtitle: 'Heritage Zone, Kochi', lat: 9.9658, lon: 76.2421 },
      { title: 'Aluva Metro Terminal', subtitle: 'Periyar Riverside, Aluva', lat: 10.1099, lon: 76.3533 },
      { title: 'Panampilly Nagar', subtitle: 'Main Avenue, Ernakulam', lat: 9.9621, lon: 76.2991 },
      { title: 'Palarivattom Bypass Junction', subtitle: 'NH 66 / Civil Line Rd, Kochi', lat: 10.0035, lon: 76.3115 },
      { title: 'Cochin International Airport (COK)', subtitle: 'Terminal 3 / International, Nedumbassery', lat: 10.1556, lon: 76.4019 },
      { title: 'Vytilla Mobility Hub', subtitle: 'Kaniyampuzha Road, Kochi', lat: 9.9678, lon: 76.3211 },
      { title: 'Tripunithura Statue Junction', subtitle: 'Hill Palace Road, Kochi', lat: 9.9507, lon: 76.3473 },
      { title: 'Cherai Beach', subtitle: 'Vypin Island, Kochi', lat: 10.1416, lon: 76.1783 },
      { title: 'Kalamassery Premier Junction', subtitle: 'CUSAT Road, Kochi', lat: 10.0538, lon: 76.3218 },
      { title: 'Kaloor Jawaharlal Nehru Stadium', subtitle: 'Banerji Road, Kochi', lat: 10.0016, lon: 76.2999 },
      { title: 'Thoppumpady BOT Bridge', subtitle: 'West Kochi, Kerala', lat: 9.9328, lon: 76.2625 }
    ];

    const localMatches = localLandmarks.filter(item => 
      item.title.toLowerCase().includes(q) || (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
    setResults(localMatches);

    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lat=9.9312&lon=76.2673`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.features) {
          const fetched = data.features.map((f: any) => {
            const p = f.properties;
            const title = [p.name || p.street || p.district].filter(Boolean).join(', ');
            const subtitle = [p.district || p.suburb, p.city || p.county, p.state || 'Kerala'].filter(Boolean).join(', ');
            const coords = f.geometry?.coordinates;
            return {
              title: title || query,
              subtitle: subtitle || 'Kerala, India',
              lat: coords && coords.length >= 2 ? coords[1] : undefined,
              lon: coords && coords.length >= 2 ? coords[0] : undefined
            };
          }).filter((item: any) => Boolean(item.title));

          const combined = [...localMatches];
          for (const item of fetched) {
            if (!combined.some(c => c.title.toLowerCase() === item.title.toLowerCase())) {
              combined.push(item);
            }
          }
          setResults(combined.slice(0, 7));
        }
      }
    } catch {
      // Keep local matches if offline or API unavailable
    }
  };

  const handleDetectCurrentLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser. Please enter your location manually.');
      return;
    }
    setIsDetectingLocation(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setPickupCoords({ lat, lon });
        try {
          const res = await fetch(`https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.features?.[0]?.properties) {
              const p = data.features[0].properties;
              const parts = [p.name, p.street, p.district || p.suburb, p.city || p.county, p.state || 'Kerala'].filter(Boolean);
              const address = parts.length > 0 ? parts.join(', ') : `${p.name || 'Current Location'}, Kerala`;
              setPickup(address);
              setShowPickupSuggestions(false);
              setIsDetectingLocation(false);
              return;
            }
          }

          const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
          if (nomRes.ok) {
            const nomData = await nomRes.json();
            if (nomData?.display_name) {
              const cleanName = nomData.display_name.split(',').slice(0, 4).join(',').trim();
              setPickup(cleanName);
              setShowPickupSuggestions(false);
              setIsDetectingLocation(false);
              return;
            }
          }

          setPickup(`Current Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
          setIsDetectingLocation(false);
        } catch {
          setPickup(`Current Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
          setIsDetectingLocation(false);
        }
      },
      (err) => {
        setIsDetectingLocation(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location permission denied. Please allow location permissions in your browser or type address manually.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setLocationError('GPS position unavailable. Please enter your pickup location manually.');
        } else if (err.code === err.TIMEOUT) {
          setLocationError('Location request timed out. Please enter your pickup location manually.');
        } else {
          setLocationError('Could not retrieve current location. Please enter your pickup address manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };
  
  // Timing
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('14:30');
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [durationHours, setDurationHours] = useState(4);
  
  // Service-specific details
  const [flightTrainNumber, setFlightTrainNumber] = useState('');
  const [hospitalNotes, setHospitalNotes] = useState('');
  const [tourNotes, setTourNotes] = useState('');
  
  // Requirement 3: Passenger identity (Who is this booking for?)
  const [bookingFor, setBookingFor] = useState<'myself' | 'someone_else'>('myself');
  const [isForOther, setIsForOther] = useState(false);
  const [otherName, setOtherName] = useState('');
  const [otherCountryCode, setOtherCountryCode] = useState('+91');
  const [otherPhone, setOtherPhone] = useState('');
  const [passengerRelationship, setPassengerRelationship] = useState<string>('Family');
  const [passengerSpecialInstructions, setPassengerSpecialInstructions] = useState<string>('');

  useEffect(() => {
    setIsForOther(bookingFor === 'someone_else');
  }, [bookingFor]);
  
  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('upi');

  // Road Distance Calculation (via OSRM road network & OpenStreetMap)
  const [calculatedKm, setCalculatedKm] = useState<number>(24);
  const [routeDurationMins, setRouteDurationMins] = useState<number>(35);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string>('');
  const [showRateCardModal, setShowRateCardModal] = useState<boolean>(false);

  // Automatically recalculate road distance whenever pickup or drop-off changes
  useEffect(() => {
    const p = pickup.trim();
    const d = destination.trim();

    if (selectedService === 'hourly-driver') {
      // Hourly bookings have fixed included distance based on duration/package
      const pkg = pricingConfig?.hourly?.packages?.find((x: any) => x.hours === durationHours);
      setCalculatedKm(pkg?.kmIncluded || pkg?.includedKm || (durationHours * 10));
      setRouteDurationMins(durationHours * 60);
      setRouteError('');
      setIsCalculatingRoute(false);
      return;
    }

    if (p.length < 2 || d.length < 2) {
      return;
    }

    let isMounted = true;
    const timeout = setTimeout(async () => {
      setIsCalculatingRoute(true);
      setRouteError('');
      try {
        const res = await fetch('/api/distance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pickup: p,
            destination: d,
            pickupCoords: pickupCoords || undefined
          })
        });

        if (!isMounted) return;

        if (res.ok) {
          const data = await res.json();
          if (data.success && typeof data.distanceKm === 'number') {
            setCalculatedKm(data.distanceKm);
            if (typeof data.durationMinutes === 'number') {
              setRouteDurationMins(data.durationMinutes);
            }
            setRouteError('');
          } else {
            setRouteError(data.error || 'Could not find a motorable road route.');
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          setRouteError(errData.error || 'Failed to calculate road route.');
        }
      } catch {
        if (isMounted) {
          setRouteError('Network error calculating road distance.');
        }
      } finally {
        if (isMounted) {
          setIsCalculatingRoute(false);
        }
      }
    }, 450);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [pickup, destination, pickupCoords, selectedService, durationHours, pricingConfig]);

  // Backward compatibility alias
  const simulatedKm = calculatedKm;
  
  // Requirement 2: 50% discount strictly for each customer's first COMPLETED ride
  const customerCompletedBookings = bookings.filter(b => 
    (b.customerId === currentUser.id || (Boolean(currentUser.phone) && b.customerPhone === currentUser.phone)) && 
    b.status === 'completed'
  );

  const firstRidePromoAlreadyUsed = Boolean(
    currentUser.role === 'customer' && (
      customerData?.firstRidePromoUsed || 
      customerData?.hasCompletedRide ||
      customerCompletedBookings.length > 0
    )
  );

  const isFirstRide = isGuest || (currentUser.role === 'customer' && !firstRidePromoAlreadyUsed);

  // Requirement 1: Submission states for Rental Reservation
  const [isSubmittingRental, setIsSubmittingRental] = useState(false);
  const [rentalSubmitError, setRentalSubmitError] = useState('');
  const [rentalSuccessModal, setRentalSuccessModal] = useState<{ isOpen: boolean; booking?: Booking }>({ isOpen: false });

  // WhatsApp Booking Confirmation Modal
  const [whatsAppSuccessModal, setWhatsAppSuccessModal] = useState<{
    isOpen: boolean;
    booking?: Booking;
    whatsappUrl?: string;
    isPendingSend?: boolean;
    rawMessage?: string;
  }>({ isOpen: false });
  const [isSubmittingWhatsApp, setIsSubmittingWhatsApp] = useState(false);
  const [isSimulatingSend, setIsSimulatingSend] = useState(false);

  // Automatically mark promo as not available if already completed first ride
  useEffect(() => {
    if (firstRidePromoAlreadyUsed) {
      setPromoCodeInput('Not available');
      setPromoMsg('Your first-ride 50% off offer has already been used.');
      setAppliedPromo('');
    }
  }, [firstRidePromoAlreadyUsed]);

  // Auto-detect when the WhatsApp booking is received on the receiver side and registered in PostgreSQL
  useEffect(() => {
    if (!whatsAppSuccessModal.isOpen || !whatsAppSuccessModal.isPendingSend || !whatsAppSuccessModal.booking?.refCode) return;
    const ref = whatsAppSuccessModal.booking.refCode;
    const matchingBooking = bookings.find(b => b.refCode === ref || (b.bookingChannel === 'whatsapp' && b.refCode === ref));
    if (matchingBooking) {
      setWhatsAppSuccessModal(prev => ({
        ...prev,
        booking: matchingBooking,
        isPendingSend: false,
      }));
      setActiveCreatedBooking(matchingBooking);
    }
  }, [bookings, whatsAppSuccessModal.isOpen, whatsAppSuccessModal.isPendingSend, whatsAppSuccessModal.booking?.refCode]);

  // Helper to trigger receiver side webhook for the sent WhatsApp message
  const handleSimulateWhatsAppReceive = async () => {
    if (!whatsAppSuccessModal.rawMessage || !whatsAppSuccessModal.booking) return;
    setIsSimulatingSend(true);
    try {
      const res = await fetch('/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderPhone: currentUser.phone,
          senderName: currentUser.name,
          rawMessage: whatsAppSuccessModal.rawMessage,
        }),
      });
      const data = await res.json();
      if (data?.enquiries?.[0]?.booking) {
        const createdBkg = data.enquiries[0].booking;
        setWhatsAppSuccessModal(prev => ({
          ...prev,
          booking: createdBkg,
          isPendingSend: false,
        }));
        setActiveCreatedBooking(createdBkg);
      }
    } catch (err) {
      console.error('Error simulating WhatsApp message delivery:', err);
    } finally {
      setIsSimulatingSend(false);
    }
  };

  // Calculations using actual road route distance
  const effectiveDistanceKm = calculatedKm || 20;
  const fare = calculateFare(
    selectedService, 
    selectedCategory, 
    effectiveDistanceKm, 
    0, 
    durationHours, 
    isRoundTrip, 
    appliedPromo,
    isFirstRide,
    pricingConfig
  );

  const selectedRentalVehicle = rentalVehicles.find(v => v.id === selectedRentalVehicleId) || rentalVehicles[0];
  const rentalFare = selectedRentalVehicle 
    ? calculateRentalQuote(selectedRentalVehicle, calculatedRentalDays, 0, appliedPromo, isFirstRide)
    : fare;

  // Active created booking for live tracking
  const [activeCreatedBooking, setActiveCreatedBooking] = useState<Booking | null>(null);

  // Ride Completion & Payment Modal (Requirement: Website Pay for Ride after destination reached)
  const [ridePaymentModal, setRidePaymentModal] = useState<{
    isOpen: boolean;
    booking: Booking | null;
    paymentMethod: 'upi' | 'cash' | 'card';
    isSuccess: boolean;
  }>({
    isOpen: false,
    booking: null,
    paymentMethod: 'upi',
    isSuccess: false,
  });
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [cashHandedConfirmed, setCashHandedConfirmed] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const dismissedPaymentBookingIds = useRef<Set<string>>(new Set());
  const dismissedDeclinedBookingIds = useRef<Set<string>>(new Set());

  // Duplicate Booking Prevention States
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const isSubmittingBookingRef = useRef(false);
  const [alreadyBookedModal, setAlreadyBookedModal] = useState<{
    isOpen: boolean;
    booking: Booking | null;
  }>({ isOpen: false, booking: null });
  const [isCancellingExistingBooking, setIsCancellingExistingBooking] = useState(false);

  // 20-Second Cancellation Countdown Window (Requirement 4)
  const [cancelSecondsLeft, setCancelSecondsLeft] = useState<number>(20);

  // 10-Second Driver Arriving Countdown (Requirement 4)
  const [arrivingSecondsLeft, setArrivingSecondsLeft] = useState<number>(10);

  // Track live booking updates from DRIVER & auto-trigger Pay for Ride when destination reached
  useEffect(() => {
    if (bookings.length > 0) {
      if (activeCreatedBooking) {
        const live = bookings.find(b => b.id === activeCreatedBooking.id || b.refCode === activeCreatedBooking.refCode);
        if (live) {
          setActiveCreatedBooking(live);
          if (live.status === 'declined' || (live.status === 'cancelled' && live.cancelledBy === 'driver')) {
            if (!dismissedDeclinedBookingIds.current.has(live.id)) {
              const isFav = Boolean(live.favouriteDriverId || live.requestQueueStatus === 'exclusive_favourite' || (live as any).driverSelectionMode === 'favourite');
              setDriverModalState({
                isOpen: true,
                mode: isFav ? 'favourite' : 'specific',
                type: 'declined',
                message: 'Driver has declined your request.',
                driverName: live.driverName,
                bookingRef: live.refCode,
                bookingId: live.id,
              });
            }
          }
          // When driver reaches destination (awaiting_payment or completed unpaid), auto-open payment modal
          if ((live.status === 'awaiting_payment' || live.status === 'completed') && !live.passengerPaid && live.serviceType !== 'self-drive') {
            if (!dismissedPaymentBookingIds.current.has(live.id) && !ridePaymentModal.isOpen) {
              setCashHandedConfirmed(false);
              setPaymentError('');
              setRidePaymentModal({
                isOpen: true,
                booking: live,
                paymentMethod: 'cash',
                isSuccess: false,
              });
            }
          }
        }
      } else if (currentUser.role !== 'guest') {
        // If no active booking in local state, find any ongoing or awaiting-payment unpaid ride for customer
        const liveUnpaid = bookings.find(b =>
          (b.customerId === currentUser.id || (Boolean(currentUser.phone) && b.customerPhone === currentUser.phone)) &&
          ['pending', 'accepted', 'driver_arriving', 'arrived', 'in_progress', 'awaiting_payment', 'completed'].includes(b.status) &&
          !b.passengerPaid &&
          b.serviceType !== 'self-drive' &&
          !b.rentalVehicleId
        );
        if (liveUnpaid) {
          setActiveCreatedBooking(liveUnpaid);
          if ((liveUnpaid.status === 'awaiting_payment' || liveUnpaid.status === 'completed') && !dismissedPaymentBookingIds.current.has(liveUnpaid.id) && !ridePaymentModal.isOpen) {
            setCashHandedConfirmed(false);
            setPaymentError('');
            setRidePaymentModal({
              isOpen: true,
              booking: liveUnpaid,
              paymentMethod: 'cash',
              isSuccess: false,
            });
          }
        }
      }
    }
  }, [bookings, activeCreatedBooking, currentUser, ridePaymentModal.isOpen]);

  // 20-Second Cancellation Window Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeCreatedBooking && activeCreatedBooking.status === 'pending' && cancelSecondsLeft > 0) {
      timer = setInterval(() => {
        setCancelSecondsLeft(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeCreatedBooking, cancelSecondsLeft]);

  // 10-Second Driver Arriving Countdown Timer (Requirement 4)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeCreatedBooking && activeCreatedBooking.status === 'driver_arriving' && arrivingSecondsLeft > 0) {
      timer = setInterval(() => {
        setArrivingSecondsLeft(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeCreatedBooking, arrivingSecondsLeft]);

  // Category change handler (Requirements 6 & 7: sync Fuel Type with Category)
  const handleCategoryChange = (newCat: VehicleCategory) => {
    setSelectedCategory(newCat);
    if (newCat === 'auto') {
      setFuelType('cng');
      setTransmission('manual');
    } else if (newCat === 'suv') {
      setFuelType('ev');
      setTransmission('automatic');
    } else if (newCat === 'hatchback') {
      setFuelType('petrol');
      setTransmission('manual');
    } else if (newCat === 'premium') {
      setFuelType('diesel');
      setTransmission('automatic');
    } else if (newCat === 'sedan') {
      setFuelType('petrol');
      setTransmission('manual');
    }
  };

  // Fuel Type change handler (Requirements 6 & 7: sync Category with Fuel Type)
  const handleFuelTypeChange = (newFuel: FuelType) => {
    setFuelType(newFuel);
    if (newFuel === 'cng') {
      setSelectedCategory('auto');
      setTransmission('manual');
    } else if (newFuel === 'ev') {
      setSelectedCategory('suv');
      setTransmission('automatic');
    } else if (newFuel === 'petrol') {
      setSelectedCategory('hatchback');
    } else if (newFuel === 'diesel') {
      setSelectedCategory('premium');
    }
  };

  // Driver change handler
  const handleDriverChange = (driverId: string) => {
    setSelectedDriverId(driverId);
  };

  // Requirement: Filter & match drivers based on selected vehicle transmission (Automatic / Manual) and fuel type (Petrol, Diesel, EV)
  const activeTransmission = (selectedVehicle?.transmission as TransmissionType) || transmission;
  const activeFuel = (selectedVehicle?.fuelType as FuelType) || fuelType;

  const allApprovedDrivers = approvedDrivers.filter(d => d.approvalStatus === 'approved');

  // Capability matching strictly against customer's vehicle
  const capabilityMatchedDrivers = allApprovedDrivers.filter(d => {
    const dTrans = (d.transmissionCapabilities || ['manual', 'automatic']).map(t => t.toLowerCase());
    const transOk = dTrans.includes(activeTransmission.toLowerCase());

    const dFuels = (d.fuelCapabilities || ['petrol', 'diesel', 'ev']).map(f => f.toLowerCase());
    const targetFuel = activeFuel.toLowerCase();
    const fuelOk = dFuels.some(f => {
      if (targetFuel === 'ev' || targetFuel === 'electric') return f === 'ev' || f === 'electric';
      return f === targetFuel;
    });

    return transOk && fuelOk;
  });

  // Always include every online approved driver while keeping capability-matched drivers prioritized
  const capabilityMatchedIds = new Set(capabilityMatchedDrivers.map(d => d.id));
  const displayedDrivers = capabilityMatchedDrivers.length > 0
    ? allApprovedDrivers.filter(d => d.isOnline || capabilityMatchedIds.has(d.id))
    : allApprovedDrivers;
  const sortedApprovedDrivers = [...displayedDrivers].sort((a, b) => {
    const onlineDiff = (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0);
    if (onlineDiff !== 0) return onlineDiff;
    return (capabilityMatchedIds.has(b.id) ? 1 : 0) - (capabilityMatchedIds.has(a.id) ? 1 : 0);
  });
  const matchedDrivers = sortedApprovedDrivers;
  const availableOnlineDrivers = sortedApprovedDrivers.filter(d => d.isOnline);
  const availableCompatibleOnlineDrivers = sortedApprovedDrivers.filter(d => d.isOnline && capabilityMatchedIds.has(d.id));
  const customerFavDrivers = allApprovedDrivers.filter(d => favouriteDriverIds.includes(d.id));

  // Auto-select only an online compatible driver; clear selection if selected driver is offline or incompatible
  useEffect(() => {
    const onlineCompatibleFavs = customerFavDrivers.filter(d => d.isOnline && capabilityMatchedIds.has(d.id));
    const currentSelected = sortedApprovedDrivers.find(d => d.id === selectedDriverId);

    if (!selectedDriverId) {
      if (onlineCompatibleFavs.length >= 1) {
        handleDriverChange(onlineCompatibleFavs[0].id);
      } else if (availableCompatibleOnlineDrivers.length > 0) {
        handleDriverChange(availableCompatibleOnlineDrivers[0].id);
      }
    } else if (
      currentSelected &&
      (!currentSelected.isOnline || !capabilityMatchedIds.has(currentSelected.id)) &&
      driverSelectionMode === 'specific'
    ) {
      handleDriverChange(availableCompatibleOnlineDrivers[0]?.id || '');
    }
  }, [customerFavDrivers, availableCompatibleOnlineDrivers, sortedApprovedDrivers, selectedDriverId, driverSelectionMode]);

  // Promo code apply (Requirement 2: 50% discount strictly for each customer's first completed ride)
  const handleApplyPromo = () => {
    if (firstRidePromoAlreadyUsed) {
      setPromoMsg('Your first-ride 50% off offer has already been used.');
      return;
    }
    const code = promoCodeInput.trim().toUpperCase();
    if (code === 'DRIVECFIRST' || code === 'FIRST50') {
      if (isFirstRide) {
        setAppliedPromo(code);
        setPromoMsg('✓ Code Applied: 50% First-Ride Special Discount Active!');
      } else {
        setPromoMsg('Your first-ride 50% off offer has already been used.');
      }
    } else if (code === 'KOCHI2026') {
      setAppliedPromo(code);
      setPromoMsg('✓ Code KOCHI2026 Applied: ₹150 Flat Discount!');
    } else {
      setPromoMsg('✗ Invalid promo code.');
    }
  };

  // WhatsApp Booking Handler (Creates operational booking with Ride-Start OTP & notifies fleet in real-time)
  const handleBookOnWhatsApp = async () => {
    if (isGuest) {
      onOpenGuestWarning('Book on WhatsApp');
      return;
    }

    // 1. Vehicle validation
    if (!selectedVehicle && !carModel && vehicles.length === 0) {
      setDriverErrorMsg('Please register or select your vehicle before booking.');
      setShowAddCarInline(true);
      setActiveFlowSection('vehicle');
      document.getElementById('vehicle-selection-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // 2. Service type validation
    if (!selectedService) {
      setDriverErrorMsg('Please select your trip type.');
      setActiveFlowSection('service');
      document.getElementById('service-type-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // 3. Pickup validation
    if (!pickup.trim()) {
      setDriverErrorMsg('Please enter your pickup location.');
      setActiveFlowSection('booking');
      const pickupEl = document.getElementById('pickup-input');
      pickupEl?.focus();
      pickupEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // 4. Drop-off validation (required except for hourly-driver)
    if (selectedService !== 'hourly-driver' && !destination.trim()) {
      setDriverErrorMsg('Please enter your drop-off location.');
      setActiveFlowSection('booking');
      const destEl = document.getElementById('destination-input');
      destEl?.focus();
      destEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // 5. Date validation
    if (!date || !date.trim()) {
      setDriverErrorMsg('Please select a booking date.');
      setActiveFlowSection('booking');
      const dateEl = document.getElementById('date-input');
      dateEl?.focus();
      dateEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // 6. Time validation
    if (!time || !time.trim()) {
      setDriverErrorMsg('Please select a booking time.');
      setActiveFlowSection('booking');
      const timeEl = document.getElementById('time-input');
      timeEl?.focus();
      timeEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // 7. Passenger validation when booking for Someone Else
    if (bookingFor === 'someone_else') {
      if (!otherName.trim()) {
        setDriverErrorMsg('Please enter the passenger full name.');
        return;
      }
      if (!otherPhone.trim()) {
        setDriverErrorMsg('Please enter the passenger mobile number.');
        return;
      }
      const otherPhoneErr = validateMobileNumber(otherPhone);
      if (otherPhoneErr) {
        setDriverErrorMsg(otherPhoneErr);
        return;
      }
    }

    setDriverErrorMsg('');

    const serviceLabels: Record<string, string> = {
      'one-way': 'One Way',
      'round-trip': 'Round Trip',
      'hourly-driver': 'Hourly Chauffeur',
      'tour-package': 'Outstation',
      'airport-transfer': 'Airport Transfer',
      'bar-pickup': 'Night Driver',
      'hospital-assistance': 'Hospital Escort',
      'advance-event': 'Advance Event Chauffeur',
      'self-drive': 'Self-Drive Rental'
    };
    const serviceLabel = serviceLabels[selectedService] || selectedService;

    const pickupAddress = pickup.trim();
    const pickupPin = pickupCoords
      ? `https://www.openstreetmap.org/?mlat=${pickupCoords.lat.toFixed(5)}&mlon=${pickupCoords.lon.toFixed(5)}#map=16/${pickupCoords.lat.toFixed(5)}/${pickupCoords.lon.toFixed(5)}`
      : pickupAddress;

    const dropOffAddress = selectedService === 'hourly-driver'
      ? (destination.trim() || 'Local Kochi (As Directed)')
      : destination.trim();

    const whatsappBusinessNumber = process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_PHONE_NUMBER || '918547325636';

    const isFavMode = driverSelectionMode === 'favourite';
    const isSpecificMode = driverSelectionMode === 'specific';
    const isRandomMode = driverSelectionMode === 'random';

    let chosenDriver: Driver | null = null;
    let targetFavId: string | undefined = undefined;

    if (isFavMode) {
      const onlineCompatibleFavs = customerFavDrivers.filter(d => d.isOnline && capabilityMatchedIds.has(d.id));
      chosenDriver = onlineCompatibleFavs.find(d => d.id === selectedDriverId) || onlineCompatibleFavs[0] || null;
      targetFavId = chosenDriver?.id;
    } else if (isSpecificMode) {
      chosenDriver = availableCompatibleOnlineDrivers.find(d => d.id === selectedDriverId) ||
        availableCompatibleOnlineDrivers[0] || null;
    }

    const preferredDriverName = chosenDriver?.name || 'Any Available';
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    const refCode = `DC-WA-${Math.floor(10000 + Math.random() * 90000)}`;

    const currentVehicle = selectedVehicle || {
      id: 'veh-adhoc',
      customerId: currentUser.id,
      makeModel: carModel || 'Private Vehicle',
      vehicleType: selectedCategory,
      transmission,
      fuelType,
      createdAt: new Date().toISOString()
    };

    const newBooking: Booking = {
      id: 'bk-wa-' + Date.now(),
      refCode,
      bookingType: 'driver_booking',
      bookingChannel: 'whatsapp',
      selectedDriverExclusive: isSpecificMode,
      driverSelectionMode,
      customerId: currentUser.id,
      customerName: currentUser.name,
      customerPhone: currentUser.phone,
      bookingFor,
      passengerName: bookingFor === 'someone_else' && otherName.trim() ? otherName.trim() : currentUser.name,
      passengerPhone: bookingFor === 'someone_else' && otherPhone.trim() ? `${otherCountryCode} ${otherPhone.trim()}` : currentUser.phone,
      passengerRelationship: bookingFor === 'someone_else' ? passengerRelationship : undefined,
      passengerSpecialInstructions: bookingFor === 'someone_else' ? passengerSpecialInstructions.trim() : undefined,
      serviceType: selectedService,
      vehicleCategory: ((currentVehicle.vehicleType as VehicleCategory) || selectedCategory),
      transmission: (currentVehicle.transmission as TransmissionType) || transmission,
      fuelType: ((currentVehicle.fuelType as FuelType) || fuelType),
      customerVehicle: {
        id: currentVehicle.id,
        model: currentVehicle.makeModel,
        category: (currentVehicle.vehicleType as VehicleCategory) || 'sedan',
        transmission: (currentVehicle.transmission as TransmissionType) || 'manual',
        fuel: (currentVehicle.fuelType as FuelType) || 'petrol',
        notes: currentVehicle.notes
      },
      pickupLocation: pickupAddress,
      destinationLocation: dropOffAddress,
      stops,
      scheduledDate: date,
      scheduledTime: time,
      isRoundTrip: selectedService === 'round-trip' || isRoundTrip,
      returnDate: (selectedService === 'round-trip' || isRoundTrip) ? returnDate : undefined,
      returnTime: (selectedService === 'round-trip' || isRoundTrip) ? returnTime : undefined,
      durationHours: selectedService === 'hourly-driver' ? durationHours : undefined,
      flightTrainNumber: flightTrainNumber || undefined,
      hospitalNotes: hospitalNotes || undefined,
      tourNotes: tourNotes || undefined,
      promoCode: appliedPromo || undefined,
      fareBreakdown: fare,
      rideStartOtp: otpCode,
      status: 'pending',
      driverId: (chosenDriver?.id || null) as any,
      driverName: chosenDriver?.name || undefined,
      driverPhone: chosenDriver?.phone || undefined,
      driverRating: chosenDriver?.ratingAverage || 5.0,
      favouriteDriverId: targetFavId,
      requestedDriverName: chosenDriver?.name || undefined,
      requestQueueStatus: isFavMode ? 'exclusive_favourite' : (isSpecificMode ? 'exclusive_selected' : 'broadcast'),
      acceptRandomDrivers: isRandomMode,
      pricingModel: fare.pricingModel || (['one-way', 'tour-package', 'airport-transfer', 'bar-pickup'].includes(selectedService) ? 'kilometer' : 'minute'),
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      passengerPaid: false,
      driverPaymentReceived: false,
      createdAt: new Date().toISOString()
    };

    setIsSubmittingWhatsApp(true);

    try {
      // Prefilled WhatsApp booking message including Ride-Start OTP & Booking Ref
      const message = [
        "Hi DriveC, I'd like to book a driver.",
        "",
        `Booking Ref: ${refCode}`,
        `Ride-Start OTP: ${otpCode}`,
        `Customer: ${currentUser.name} (${currentUser.phone})`,
        `Service: ${serviceLabel}`,
        `Preferred Driver: ${preferredDriverName}`,
        `Pickup: ${pickupAddress}`,
        `Pickup Pin: ${pickupPin}`,
        `Drop-off: ${dropOffAddress}`,
        `Date: ${date}`,
        `Time: ${time}`,
        `Estimated Fare: ₹${fare.totalFare} (${fare.distanceKm} km)`
      ].join('\n');

      const whatsappUrl = `https://wa.me/${whatsappBusinessNumber}?text=${encodeURIComponent(message)}`;

      // 1. Open WhatsApp web or mobile application so the customer sends the message
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

      // 2. Deliver the sent WhatsApp message to receiver side endpoint (/api/whatsapp/webhook)
      // This immediately processes the booking on the receiver side and dispatches the request to the driver portal
      try {
        const webhookRes = await fetch('/api/whatsapp/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            waMessageId: 'wa_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            senderPhone: currentUser.phone,
            senderName: currentUser.name,
            rawMessage: message,
            serviceType: selectedService,
            preferredDriver: preferredDriverName,
            pickupLocation: pickupAddress,
            pickupPin,
            dropoffLocation: dropOffAddress,
            scheduledDate: date,
            scheduledTime: time,
          }),
        });

        if (webhookRes.ok) {
          const webhookData = await webhookRes.json();
          const createdBooking = webhookData.enquiries?.[0]?.booking;
          if (createdBooking) {
            setActiveCreatedBooking(createdBooking);
            setWhatsAppSuccessModal({
              isOpen: true,
              booking: createdBooking,
              whatsappUrl,
              isPendingSend: false,
              rawMessage: message,
            });
            return;
          }
        }
      } catch (webhookErr) {
        console.warn('Direct WhatsApp receiver delivery fallback:', webhookErr);
      }

      setWhatsAppSuccessModal({
        isOpen: true,
        booking: newBooking,
        whatsappUrl,
        isPendingSend: true,
        rawMessage: message,
      });
    } catch (err) {
      console.error('Error opening WhatsApp booking:', err);
    } finally {
      setIsSubmittingWhatsApp(false);
    }
  };

  // Handle Booking Confirmation
  const handleConfirmBooking = async (e?: React.FormEvent, modeOverride?: 'favourite' | 'specific' | 'random') => {
    if (e && e.preventDefault) e.preventDefault();
    if (isGuest) {
      onOpenGuestWarning(bookingMode === 'driver_booking' ? 'Confirm Professional Driver Booking' : 'Confirm Self-Drive Car Rental');
      return;
    }

    if (bookingMode === 'driver_booking') {
      // Prevent concurrent in-flight duplicate submission on rapid double-click
      if (isSubmittingBookingRef.current) {
        return;
      }

      // Check for an existing active driver booking for this customer (unless retrying with random drivers after decline)
      if (!modeOverride) {
        const activeStatuses = ['pending', 'approved', 'accepted', 'driver_arriving', 'arrived', 'in_progress', 'awaiting_payment'];
        const existingFromState = activeCreatedBooking &&
          activeStatuses.includes(activeCreatedBooking.status) &&
          activeCreatedBooking.serviceType !== 'self-drive' &&
          !activeCreatedBooking.rentalVehicleId
            ? activeCreatedBooking
            : null;
        const existingFromList = bookings.find(b =>
          (b.customerId === currentUser.id || (Boolean(currentUser.phone) && b.customerPhone === currentUser.phone)) &&
          activeStatuses.includes(b.status) &&
          b.serviceType !== 'self-drive' &&
          !b.rentalVehicleId
        );
        const existingActive = existingFromState || existingFromList || null;
        if (existingActive) {
          setAlreadyBookedModal({ isOpen: true, booking: existingActive });
          return;
        }
      }

      // Vehicle validation: Must have a vehicle selected
      if (!selectedVehicle && !carModel && vehicles.length === 0) {
        setDriverErrorMsg('Please register or select your vehicle before booking.');
        setShowAddCarInline(true);
        setActiveFlowSection('vehicle');
        document.getElementById('vehicle-selection-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // Trip type validation: Must have a trip service selected
      if (!selectedService) {
        setDriverErrorMsg('Please select your trip type.');
        setActiveFlowSection('service');
        document.getElementById('service-type-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // Booking details: Pickup location required
      if (!pickup.trim()) {
        setDriverErrorMsg('Please enter your pickup location.');
        setActiveFlowSection('booking');
        document.getElementById('pickup-input')?.focus();
        return;
      }

      // Drop-off location required for non-hourly services
      if (selectedService !== 'hourly-driver' && !destination.trim()) {
        setDriverErrorMsg('Please enter your drop-off location.');
        setActiveFlowSection('booking');
        document.getElementById('destination-input')?.focus();
        return;
      }

      // Passenger validation when booking for Someone Else
      if (bookingFor === 'someone_else') {
        if (!otherName.trim()) {
          setDriverErrorMsg('Please enter passenger full name.');
          return;
        }
        if (!otherPhone.trim()) {
          setDriverErrorMsg('Please enter passenger mobile number.');
          return;
        }
        const otherPhoneErr = validateMobileNumber(otherPhone);
        if (otherPhoneErr) {
          setDriverErrorMsg(otherPhoneErr);
          return;
        }
      }

      // Must have matched driver
      if (approvedDrivers.length === 0) {
        setDriverErrorMsg('No approved drivers in Kochi fleet. Please wait for Administrator review.');
        return;
      }

      // ── 3-way Driver Selection Resolution ──
      const activeMode = modeOverride || driverSelectionMode;
      const isFavMode = activeMode === 'favourite';
      const isSpecificMode = activeMode === 'specific';
      const isRandomMode = activeMode === 'random';

      let chosenDriver: Driver | null = null;
      let targetFavId: string | undefined = undefined;

      if (isFavMode) {
        const onlineCompatibleFavs = customerFavDrivers.filter(d => d.isOnline && capabilityMatchedIds.has(d.id));
        chosenDriver = onlineCompatibleFavs.find(d => d.id === selectedDriverId) || onlineCompatibleFavs[0] || null;
        if (!chosenDriver) {
          setDriverErrorMsg(`Your favourite driver is offline or not compatible with your ${activeTransmission.toUpperCase()} ${activeFuel.toUpperCase()} vehicle. Please select a compatible online driver or choose Random Drivers.`);
          return;
        }
        targetFavId = chosenDriver.id;
      } else if (isSpecificMode) {
        chosenDriver = availableCompatibleOnlineDrivers.find(d => d.id === selectedDriverId) ||
          availableCompatibleOnlineDrivers[0] ||
          null;

        if (!chosenDriver) {
          setDriverErrorMsg(`No online driver is currently compatible with your ${activeTransmission.toUpperCase()} ${activeFuel.toUpperCase()} vehicle. Please select Random Drivers or update your vehicle.`);
          return;
        }
      } else {
        // Random Broadcast mode
        chosenDriver = null;
      }

      setDriverErrorMsg('');

      // 4-digit Ride-Start OTP generated strictly at the passenger side
      const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
      const refCode = `DC-DRV-${Math.floor(10000 + Math.random() * 90000)}`;

      const currentVehicle = selectedVehicle || {
        id: 'veh-adhoc',
        customerId: currentUser.id,
        makeModel: carModel || 'Private Vehicle',
        vehicleType: selectedCategory,
        transmission,
        fuelType,
        createdAt: new Date().toISOString()
      };

      const newBooking: Booking = {
        id: 'bk-' + Date.now(),
        refCode,
        bookingType: 'driver_booking',
        bookingChannel: 'website',
        selectedDriverExclusive: isSpecificMode,
        driverSelectionMode: activeMode,
        customerId: currentUser.id,
        customerName: currentUser.name,
        customerPhone: currentUser.phone,
        bookingFor,
        passengerName: bookingFor === 'someone_else' && otherName.trim() ? otherName.trim() : currentUser.name,
        passengerPhone: bookingFor === 'someone_else' && otherPhone.trim() ? `${otherCountryCode} ${otherPhone.trim()}` : currentUser.phone,
        passengerRelationship: bookingFor === 'someone_else' ? passengerRelationship : undefined,
        passengerSpecialInstructions: bookingFor === 'someone_else' ? passengerSpecialInstructions.trim() : undefined,
        serviceType: selectedService,
        vehicleCategory: ((currentVehicle.vehicleType as VehicleCategory) || selectedCategory),
        transmission: (currentVehicle.transmission as TransmissionType) || transmission,
        fuelType: ((currentVehicle.fuelType as FuelType) || fuelType),
        customerVehicle: {
          id: currentVehicle.id,
          model: currentVehicle.makeModel,
          category: (currentVehicle.vehicleType as VehicleCategory) || 'sedan',
          transmission: (currentVehicle.transmission as TransmissionType) || 'manual',
          fuel: (currentVehicle.fuelType as FuelType) || 'petrol',
          notes: currentVehicle.notes
        },
        pickupLocation: pickup,
        destinationLocation: selectedService === 'hourly-driver' ? (destination || 'Local Kochi (As Directed)') : destination,
        stops,
        scheduledDate: date,
        scheduledTime: time,
        isRoundTrip: selectedService === 'round-trip' || isRoundTrip,
        returnDate: (selectedService === 'round-trip' || isRoundTrip) ? returnDate : undefined,
        returnTime: (selectedService === 'round-trip' || isRoundTrip) ? returnTime : undefined,
        durationHours: selectedService === 'hourly-driver' ? durationHours : undefined,
        flightTrainNumber: flightTrainNumber || undefined,
        hospitalNotes: hospitalNotes || undefined,
        tourNotes: tourNotes || undefined,
        promoCode: appliedPromo || undefined,
        fareBreakdown: fare,
        rideStartOtp: otpCode,
        status: 'pending',
        driverId: (chosenDriver?.id || null) as any,
        driverName: chosenDriver?.name || undefined,
        driverPhone: chosenDriver?.phone || undefined,
        driverRating: chosenDriver?.ratingAverage || 5.0,
        favouriteDriverId: targetFavId,
        requestedDriverName: chosenDriver?.name || undefined,
        requestQueueStatus: isFavMode ? 'exclusive_favourite' : (isSpecificMode ? 'exclusive_selected' : 'broadcast'),
        acceptRandomDrivers: isRandomMode,
        pricingModel: fare.pricingModel || (['one-way', 'tour-package', 'airport-transfer', 'bar-pickup'].includes(selectedService) ? 'kilometer' : 'minute'),
        paymentMethod,
        paymentStatus: 'pending',
        passengerPaid: false,
        driverPaymentReceived: false,
        createdAt: new Date().toISOString()
      };

      isSubmittingBookingRef.current = true;
      setIsSubmittingBooking(true);
      try {
        const res = await onBookingCreated(newBooking);
        if (res && !res.success) {
          const errCode = (res as any).errorCode || '';
          const errMsg = res.error || '';
          const returnedMode = (res as any).mode || activeMode;

          if (errCode === 'ALREADY_BOOKED' || errCode === 'already_booked') {
            const activeBk = (res as any).activeBooking || activeCreatedBooking || null;
            if (activeBk) {
              setActiveCreatedBooking(activeBk);
            }
            setAlreadyBookedModal({ isOpen: true, booking: activeBk });
            return;
          }

          if (returnedMode === 'favourite') {
            if (errCode === 'driver_busy' || errMsg.includes('another ride')) {
              setDriverModalState({
                isOpen: true,
                mode: 'favourite',
                type: 'busy',
                message: 'Driver is on another ride.',
                driverName: chosenDriver?.name,
              });
              return;
            }
            if (errCode === 'driver_offline' || errMsg.includes('offline')) {
              setDriverModalState({
                isOpen: true,
                mode: 'favourite',
                type: 'offline',
                message: 'Driver is offline.',
                driverName: chosenDriver?.name,
              });
              return;
            }
          } else if (returnedMode === 'specific') {
            if (errCode === 'driver_busy' || errMsg.includes('another ride')) {
              setDriverModalState({
                isOpen: true,
                mode: 'specific',
                type: 'busy',
                message: 'This driver is currently on another ride.',
                driverName: chosenDriver?.name,
              });
              return;
            }
            if (errCode === 'driver_unavailable' || errMsg.includes('offline')) {
              setDriverModalState({
                isOpen: true,
                mode: 'specific',
                type: 'offline',
                message: 'This driver is currently offline.',
                driverName: chosenDriver?.name,
              });
              return;
            }
          }

          setDriverErrorMsg(errMsg || 'Failed to dispatch booking. Please retry.');
          return;
        }
        if (res?.booking) {
          setActiveCreatedBooking(res.booking);
        } else {
          setActiveCreatedBooking(newBooking);
        }
        setCancelSecondsLeft(20);
        setArrivingSecondsLeft(10);
      } catch (err: any) {
        const errText = err?.message || 'Failed to dispatch booking. Please retry.';
        setDriverErrorMsg(errText);
      } finally {
        isSubmittingBookingRef.current = false;
        setIsSubmittingBooking(false);
      }

    } else {
      // Self-Drive Car Rental
      handleConfirmRentalReservation();
    }
  };

  const handleConfirmRandomBroadcast = async () => {
    if (activeCreatedBooking?.id) {
      try {
        const patchRes = await fetch(`/api/bookings/${activeCreatedBooking.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'accept_random_drivers' }),
        });
        if (patchRes.ok) {
          const data = await patchRes.json();
          if (data?.booking) {
            setActiveCreatedBooking(data.booking);
          }
        }
      } catch (e) {
        console.error('Error switching to random broadcast:', e);
      }
    } else {
      setDriverSelectionMode('random');
      setTimeout(() => {
        handleConfirmBooking(undefined, 'random');
      }, 50);
    }
  };

  const handleConfirmRentalReservation = async () => {
    if (isGuest) {
      onOpenGuestWarning('Confirm Self-Drive Car Rental');
      return;
    }

    const vehicle = selectedRentalVehicle;
    if (!vehicle) {
      setRentalSubmitError('Please select an available rental vehicle.');
      return;
    }

    if (!rentalPickupDate || !rentalReturnDate) {
      setRentalSubmitError('Please select both pickup date and return date.');
      return;
    }

    if (rentalReturnDate < rentalPickupDate) {
      setRentalSubmitError('Return date must be on or after the pickup date.');
      return;
    }

    // Check maintenance offline dates (Requirement 1, 2, 3)
    const isMaintenanceBlocked = !vehicle.isAvailable && (!vehicle.offlineUntil || rentalPickupDate < vehicle.offlineUntil);
    if (isMaintenanceBlocked) {
      setMaintenancePopup({
        isOpen: true,
        vehicleModel: `${vehicle.brand} ${vehicle.model}`,
        expectedDate: vehicle.offlineUntil || 'a future date',
        vehicleId: vehicle.id,
        notified: false,
      });
      return;
    }

    // Check double-booking for the selected dates (Requirement 7)
    const isOverlapping = checkVehicleOverlap(vehicle.id, rentalPickupDate, rentalReturnDate);
    if (isOverlapping) {
      setUnavailablePopup({
        isOpen: true,
        vehicleModel: `${vehicle.brand} ${vehicle.model}`,
        dates: `${rentalPickupDate} to ${rentalReturnDate}`,
      });
      return;
    }

    setIsSubmittingRental(true);
    setRentalSubmitError('');

    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    const refCode = `DC-RNT-${Math.floor(10000 + Math.random() * 90000)}`;

    const newRentalBooking: Booking = {
      id: 'bk-' + Date.now(),
      refCode,
      bookingType: 'self_drive_rental',
      customerId: currentUser.id,
      customerName: currentUser.name,
      customerPhone: currentUser.phone,
      passengerName: isForOther ? otherName : currentUser.name,
      passengerPhone: isForOther ? otherPhone : currentUser.phone,
      serviceType: 'self-drive',
      vehicleCategory: vehicle.category,
      transmission: vehicle.transmission,
      fuelType: vehicle.fuel,
      rentalVehicleId: vehicle.id,
      rentalVehicleModel: `${vehicle.brand} ${vehicle.model}`,
      rentalVehicleOwnerId: vehicle.ownerId,
      rentalDays: calculatedRentalDays,
      advanceAmount: rentalFare.advanceAmount,
      remainingAmount: rentalFare.remainingAmount,
      advancePaid: true,
      advancePaidAt: new Date().toISOString(),
      pickupLocation: vehicle.location,
      destinationLocation: `${vehicle.location} (Return Depot)`,
      stops: [],
      scheduledDate: rentalPickupDate,
      scheduledTime: time,
      returnDate: rentalReturnDate,
      returnTime: time,
      isRoundTrip: true,
      promoCode: appliedPromo || undefined,
      fareBreakdown: rentalFare,
      rideStartOtp: otpCode,
      status: 'pending', // Requirement 1: Booking created with "Pending Approval" status
      paymentMethod,
      paymentStatus: 'pending',
      passengerPaid: false, // Remaining amount paid after completing rental
      notificationMessage: 'New self-drive rental reservation submitted. Pending Admin Approval.',
      createdAt: new Date().toISOString()
    };

    try {
      const result = await onBookingCreated(newRentalBooking);
      if (result && result.success === false) {
        setRentalSubmitError(result.error || 'Failed to submit reservation. Please try again.');
      } else {
        setRentalSuccessModal({
          isOpen: true,
          booking: result?.booking || newRentalBooking,
        });
      }
    } catch (err: any) {
      setRentalSubmitError(err?.message || 'Error communicating with server.');
    } finally {
      setIsSubmittingRental(false);
    }
  };

  const handleCancelActiveBooking = () => {
    if (activeCreatedBooking && onCancelBooking) {
      onCancelBooking(activeCreatedBooking.id);
      setActiveCreatedBooking(prev => prev ? { ...prev, status: 'cancelled', cancelledBy: 'customer' } : null);
    }
  };

  
  return (
    <div id="booking-engine" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
      
      {/* Title & Service Mode Selector */}
      <div className="text-center max-w-3xl mx-auto mb-4 sm:mb-5 space-y-2">
        <span className="text-[11px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-950/50 px-3 py-1 rounded-full border border-cyan-800/60">
          DriveC KOCHI MOBILITY PLATFORM
        </span>
        <h2 className="text-3xl sm:text-4xl font-black text-slate-100 tracking-tight">
          {t.booking.title}
        </h2>
        <p className="text-sm text-slate-400">
          {t.booking.subtitle}
        </p>

        {/* Dual Core Mode Switcher */}
        <div className="inline-flex p-1.5 bg-[#14171f] rounded-2xl border border-[#262b36] shadow-inner max-w-md w-full mt-2">
          <button
            type="button"
            onClick={() => setBookingMode('driver_booking')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              bookingMode === 'driver_booking'
                ? 'bg-[#002C6C] text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>{t.booking.tabDriver}</span>
          </button>

          <button
            type="button"
            onClick={() => setBookingMode('self_drive_rental')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              bookingMode === 'self_drive_rental'
                ? 'bg-[#002C6C] text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>{t.booking.tabRental}</span>
          </button>
        </div>
      </div>

      {/* MODE 1: PROFESSIONAL DRIVER BOOKING (Inspired by Dafy.in) */}
      {bookingMode === 'driver_booking' && (
        <div className="space-y-4 mb-4">
          
          {/* 1. SELECT YOUR VEHICLE TO PILOT */}
          <div id="vehicle-selection-section" className={`bg-[#14171f] rounded-2xl p-4 sm:p-5 border transition-all space-y-3 animate-in fade-in duration-300 ${
            activeFlowSection === 'vehicle' ? 'ring-2 ring-[#002C6C]/40 border-[#002C6C] shadow-md' : 'border-[#262b36] shadow-xs'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#262b36] pb-2.5">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-100">Select Your Vehicle to Pilot</h3>
                {selectedVehicle && (vehicleSelectionDone || selectedVehicleId) && (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-0.5 rounded-full shadow-xs animate-in fade-in">
                    <span>Selected: {selectedVehicle.makeModel} ✓</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                  Drivers matched strictly by transmission ({activeTransmission.toUpperCase()}) & fuel ({activeFuel.toUpperCase()})
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddCarInline(prev => !prev)}
                  className="px-3 py-1.5 rounded-xl bg-[#1c202a] hover:bg-[#252b38] text-cyan-300 border border-[#262b36] font-bold text-xs flex items-center gap-1 transition-colors"
                >
                  <span>{showAddCarInline ? 'Cancel' : '+ Add Another Car'}</span>
                </button>
              </div>
            </div>

            {/* Prompt when customer has no saved vehicles */}
            {noVehiclePrompt && vehicles.length === 0 && (
              <div className="p-3.5 bg-blue-950/40 border border-blue-900/60 rounded-2xl flex items-center gap-2.5 text-xs text-cyan-300 font-bold animate-in fade-in">
                <span>Please add your vehicle details to proceed with your booking.</span>
              </div>
            )}

            {/* Quick Inline Add Car Form */}
            {showAddCarInline && (
              <form onSubmit={handleAddNewCarInline} className="p-4 bg-[#0d1017] rounded-2xl border border-[#262b36] space-y-3 animate-in fade-in text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100 flex items-center gap-1.5">
                    <span>Register Vehicle into Your DriveC Garage</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Saved once, available for all future bookings</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Make & Model *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Hyundai Creta / Honda City"
                      value={newCarModel}
                      onChange={(e) => setNewCarModel(e.target.value)}
                      className="w-full px-3 py-2 bg-[#14171f] border border-[#262b36] text-white rounded-xl outline-none font-medium focus:border-[#002C6C]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Category</label>
                    <select
                      value={newCarCategory}
                      onChange={(e) => setNewCarCategory(e.target.value as VehicleCategory)}
                      className="w-full px-3 py-2 bg-[#14171f] border border-[#262b36] text-white rounded-xl outline-none font-medium focus:border-[#002C6C]"
                    >
                      <option value="sedan">Executive Sedan</option>
                      <option value="suv">SUV / MUV</option>
                      <option value="hatchback">Hatchback</option>
                      <option value="premium">Luxury / Premium</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Transmission *</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setNewCarTransmission('manual')}
                        className={`py-1.5 rounded-lg border font-bold text-xs transition-all ${
                          newCarTransmission === 'manual' ? 'bg-[#002C6C] text-white border-[#002C6C]' : 'bg-[#14171f] text-slate-300 border-[#262b36] hover:bg-[#1c202a]'
                        }`}
                      >
                        Manual
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewCarTransmission('automatic')}
                        className={`py-1.5 rounded-lg border font-bold text-xs transition-all ${
                          newCarTransmission === 'automatic' ? 'bg-[#002C6C] text-white border-[#002C6C]' : 'bg-[#14171f] text-slate-300 border-[#262b36] hover:bg-[#1c202a]'
                        }`}
                      >
                        Automatic
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Fuel / Power *</label>
                    <select
                      value={newCarFuel}
                      onChange={(e) => setNewCarFuel(e.target.value as FuelType)}
                      className="w-full px-3 py-2 bg-[#14171f] border border-[#262b36] text-white rounded-xl outline-none font-medium focus:border-[#002C6C]"
                    >
                      <option value="petrol">Petrol</option>
                      <option value="diesel">Diesel</option>
                      <option value="ev">Electric (EV)</option>
                      <option value="cng">CNG</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddCarInline(false)}
                    className="px-3 py-1.5 rounded-lg border border-[#262b36] text-slate-400 hover:bg-[#14171f]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-[#002C6C] hover:bg-[#001f4d] text-white font-bold"
                  >
                    Save & Select Vehicle
                  </button>
                </div>
              </form>
            )}

            {/* Vehicle Selector Cards */}
            {vehicles.length === 0 && !showAddCarInline ? (
              <div className="p-6 bg-[#0d1017] border border-[#262b36] rounded-2xl text-center space-y-3">
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">No vehicles registered yet</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-0.5">
                    DriveC operates on a driver-as-a-service model: enter your vehicle details once so you never have to re-enter them during bookings.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCarInline(true)}
                  className="px-4 py-2 rounded-xl bg-[#002C6C] hover:bg-[#001f4d] text-white font-bold text-xs shadow-sm inline-flex items-center gap-1.5"
                >
                  <span>Register Your Vehicle Now</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {vehicles.map((v) => {
                  const isChosen = (selectedVehicleId === v.id) || (!selectedVehicleId && vehicles[0]?.id === v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setSelectedVehicleId(v.id);
                        setHasSearchedDrivers(false);
                        setVehicleSelectionDone(true);
                        // Immediately after vehicle selection, automatically transfer interaction control to the Service Type section
                        setActiveFlowSection('service');
                        setTimeout(() => {
                          document.getElementById('service-type-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 50);
                      }}
                      className={`p-4 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between gap-3 ${
                        isChosen
                          ? 'border-[#002C6C] bg-gradient-to-br from-[#002C6C]/25 to-[#14171f] shadow-md shadow-blue-950/40 ring-1 ring-[#002C6C]/50'
                          : 'border-[#262b36] bg-[#0d1017] hover:border-slate-600 hover:bg-[#14171f]'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div>
                              <strong className="text-slate-100 font-black text-sm block leading-snug">{v.makeModel}</strong>
                              <span className="text-[10px] text-slate-400 uppercase font-bold">{v.vehicleType}</span>
                            </div>
                          </div>
                          {isChosen && (
                            <span className="w-5 h-5 bg-[#002C6C] text-white rounded-full flex items-center justify-center text-[10px] font-black shrink-0">
                              ✓
                            </span>
                          )}
                        </div>

                        {v.notes && (
                          <p className="text-[10px] text-slate-400 italic line-clamp-1">"{v.notes}"</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 pt-2 border-t border-[#262b36]">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${
                          isChosen ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800' : 'bg-[#1c202a] text-slate-300 border-[#262b36]'
                        }`}>
                          {v.transmission}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border flex items-center gap-1 ${
                          isChosen ? 'bg-blue-950/60 text-blue-300 border-blue-800' : 'bg-[#1c202a] text-slate-300 border-[#262b36]'
                        }`}>
                          <span>{v.fuelType}</span>
                        </span>
                        {v.isDefault && (
                          <span className="text-[10px] text-cyan-400 font-bold ml-auto">Primary</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. SELECT TRIP TYPE */}
          <div id="service-type-section" className={`bg-[#14171f] rounded-2xl p-3 sm:p-4 border transition-all space-y-2.5 ${
            activeFlowSection === 'service' ? 'ring-2 ring-[#002C6C]/40 border-[#002C6C] shadow-md' : 'border-[#262b36] shadow-xs'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#262b36] pb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-100">Select Trip Type</h3>
                {serviceSelectionDone && (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-0.5 rounded-full shadow-xs animate-in fade-in">
                    <span>Selected: {selectedService.replace('-', ' ').toUpperCase()} ✓</span>
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400 font-medium">DriveC certified pilots drive your personal car</span>
            </div>

            {/* Compact Trip Type Cards (~48-52px height, Dafy.in-inspired) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
              {[
                { id: 'one-way' as RideServiceType, label: 'One Way', subtitle: 'Point to Point' },
                { id: 'round-trip' as RideServiceType, label: 'Round Trip', subtitle: 'Return Journey' },
                { id: 'hourly-driver' as RideServiceType, label: 'Hourly Chauffeur', subtitle: 'In-City / As Directed' },
                { id: 'tour-package' as RideServiceType, label: 'Outstation', subtitle: 'Intercity Kerala' },
                { id: 'airport-transfer' as RideServiceType, label: 'Airport Transfer', subtitle: 'Airport Pick / Drop' },
                { id: 'bar-pickup' as RideServiceType, label: 'Night Driver', subtitle: 'Safe Party Chauffeur' },
                { id: 'hospital-assistance' as RideServiceType, label: 'Hospital Escort', subtitle: 'Care & Waiting' },
              ].map((trip) => {
                const isSelected = selectedService === trip.id;
                return (
                  <button
                    key={trip.id}
                    type="button"
                    onClick={() => {
                      if (isGuest) {
                        onOpenGuestWarning(trip.label);
                        return;
                      }
                      setSelectedService(trip.id);
                      if (trip.id === 'round-trip') setIsRoundTrip(true);
                      else setIsRoundTrip(false);
                      setHasSearchedDrivers(false);
                      setServiceSelectionDone(true);

                      // Immediately after service selection, automatically transfer interaction control to Booking section
                      setActiveFlowSection('booking');
                      setTimeout(() => {
                        document.getElementById('booking-details-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        const pickupInput = document.getElementById('pickup-input') as HTMLInputElement;
                        pickupInput?.focus();
                      }, 50);
                    }}
                    className={`min-h-[48px] h-12 px-2.5 sm:px-3 rounded-xl border flex items-center justify-between gap-2 transition-all font-bold text-xs relative ${
                      isSelected
                        ? 'border-[#002C6C] bg-[#002C6C] text-white shadow-sm ring-1 ring-[#002C6C]'
                        : 'border-[#262b36] bg-[#0d1017] text-slate-300 hover:border-slate-600 hover:bg-[#14171f]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="text-left truncate">
                        <span className={`font-black text-xs block leading-tight truncate ${isSelected ? 'text-white' : 'text-slate-100'}`}>
                          {trip.label}
                        </span>
                        <span className={`text-[10px] hidden sm:block truncate ${isSelected ? 'text-cyan-200' : 'text-slate-400'}`}>
                          {trip.subtitle}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center text-[10px] font-black shrink-0">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. BOOKING */}
          <div id="booking-details-section" className="space-y-4 animate-in fade-in duration-300">
            <div className={`bg-[#14171f] rounded-2xl p-4 sm:p-5 border transition-all space-y-3 ${
              activeFlowSection === 'booking' ? 'ring-2 ring-[#002C6C]/40 border-[#002C6C] shadow-md' : 'border-[#262b36] shadow-xs'
            }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#262b36] pb-2.5">
              <div>
                <h3 className="text-base font-black text-slate-100">Booking</h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {t.services[selectedService]?.title || ''} — {t.services[selectedService]?.desc || ''}
              </span>
            </div>

            {/* Conditional Trip Controls: Dynamic Hourly Pricing & Airport */}
            {selectedService === 'hourly-driver' && (
              <div className="p-3.5 bg-emerald-950/50 border border-emerald-700/80 rounded-2xl space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="block font-black text-emerald-200">
                    Select Chauffeur Duration *
                  </label>
                  <span className="text-[11px] font-bold text-emerald-300 bg-emerald-950/70 px-2 py-0.5 rounded-md border border-emerald-700/80">
                    Extra hours charged at ₹{hourlyConfig.extraHourRate}/hr
                  </span>
                </div>

                {/* Dynamic Duration Packages from Database/System */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {hourlyConfig.packages.map((pkg) => {
                    const isSelected = durationHours === pkg.hours;
                    return (
                      <button
                        key={pkg.hours}
                        type="button"
                        onClick={() => setDurationHours(pkg.hours)}
                        className={`p-2.5 rounded-xl text-center border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#002C6C] text-white border-[#002C6C] shadow-sm ring-2 ring-[#002C6C]/20'
                            : 'bg-[#0d1017] border-emerald-700/80 text-emerald-200 hover:bg-emerald-950/70'
                        }`}
                      >
                        <div className="text-xs font-black">{pkg.hours} Hours</div>
                        <div className={`text-sm font-black mt-0.5 ${isSelected ? 'text-cyan-300' : 'text-cyan-400'}`}>
                          ₹{pkg.rate}
                        </div>
                        <div className={`text-[10px] font-medium ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                          Up to {pkg.includedKm ?? pkg.kmIncluded ?? (pkg.hours * 10)} km
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Duration Stepper & Real-time Tariff Preview */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0d1017] p-2.5 rounded-xl border border-emerald-700/80">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300">Custom Duration:</span>
                    <div className="flex items-center gap-1.5 bg-[#0d1017] border border-[#262b36] rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => setDurationHours(prev => Math.max(1, prev - 1))}
                        className="w-6 h-6 rounded bg-[#0d1017] hover:bg-[#252b38] text-slate-200 font-black flex items-center justify-center text-xs shadow-xs"
                      >
                        -
                      </button>
                      <span className="font-black text-xs text-cyan-400 min-w-[50px] text-center">
                        {durationHours} Hours
                      </span>
                      <button
                        type="button"
                        onClick={() => setDurationHours(prev => Math.min(24, prev + 1))}
                        className="w-6 h-6 rounded bg-[#0d1017] hover:bg-[#252b38] text-slate-200 font-black flex items-center justify-center text-xs shadow-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="text-xs font-black text-emerald-200">
                    Applicable Base: ₹{fare.hourlyPackageRate || fare.baseFare}
                    {(fare.extraHoursCharge || 0) > 0 && (
                      <span className="text-cyan-400 ml-1 font-semibold">
                        (+₹{fare.extraHoursCharge} for extra {Math.max(0, durationHours - (hourlyConfig.packages[hourlyConfig.packages.length - 1]?.hours || 12))}h)
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-emerald-300">
                  Includes professional pilot, waiting, and city travel within Kochi municipal & suburban limits.
                </p>
              </div>
            )}

            {selectedService === 'airport-transfer' && (
              <div className="p-4 bg-[#0d1424] border border-blue-800/70 rounded-2xl space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-black text-sky-950">Airport Transfer Direction:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAirportTripType('drop');
                        setDestination('Cochin International Airport (COK), Terminal 3');
                      }}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                        airportTripType === 'drop' ? 'bg-[#002C6C] text-white' : 'bg-[#0d1017] text-slate-300 border border-blue-800/70'
                      }`}
                    >
                      Drop to Airport
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAirportTripType('pickup');
                        setPickup('Cochin International Airport (COK), Terminal 3');
                        setPickupCoords({ lat: 10.1556, lon: 76.4019 });
                      }}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                        airportTripType === 'pickup' ? 'bg-[#002C6C] text-white' : 'bg-[#0d1017] text-slate-300 border border-blue-800/70'
                      }`}
                    >
                      Pickup from Airport
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-sky-950 mb-1">Flight Number (Optional for delay monitoring)</label>
                  <input
                    type="text"
                    placeholder="e.g. AI-468 / 6E-214"
                    value={flightTrainNumber}
                    onChange={(e) => setFlightTrainNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] text-slate-100 rounded-xl outline-none font-medium"
                  />
                </div>
              </div>
            )}

            {selectedService === 'round-trip' && (
              <div className="p-4 bg-indigo-950/50 border border-indigo-800/70 rounded-2xl space-y-2 text-xs">
                <label className="block font-bold text-indigo-300 mb-1">Return Schedule (Round Trip)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Return Date</label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] text-slate-100 rounded-xl outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Return Time</label>
                    <input
                      type="time"
                      value={returnTime}
                      onChange={(e) => setReturnTime(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] text-slate-100 rounded-xl outline-none text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Requirement 3: Who is this booking for? (Myself vs Someone Else) */}
            <div className="bg-[#0d1017] p-4 rounded-2xl border border-[#262b36] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                    Who is this booking for?
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Book a chauffeur for yourself or on behalf of family members & friends from anywhere.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-[#14171f] p-1 rounded-xl border border-[#262b36] shadow-xs self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setBookingFor('myself');
                      setIsForOther(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      bookingFor === 'myself'
                        ? 'bg-[#002C6C] text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>1. Myself</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBookingFor('someone_else');
                      setIsForOther(true);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      bookingFor === 'someone_else'
                        ? 'bg-[#002C6C] text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>2. Someone Else – Family / Friend / Other Person</span>
                  </button>
                </div>
              </div>

              {/* Additional Passenger Details when booking for Someone Else */}
              {bookingFor === 'someone_else' && (
                <div className="p-4 bg-[#14171f] rounded-xl border border-[#262b36] space-y-3.5 animate-in fade-in duration-200 shadow-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Passenger Full Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Passenger Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ananya Menon"
                        value={otherName}
                        onChange={(e) => setOtherName(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-medium text-slate-100 outline-none focus:border-[#002C6C] transition-all"
                      />
                    </div>

                    {/* Passenger Mobile Number with Country Code */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Passenger Mobile Number *
                      </label>
                      <div className="flex gap-1.5">
                        <select
                          value={otherCountryCode}
                          onChange={(e) => setOtherCountryCode(e.target.value)}
                          className="px-2 py-2 bg-[#0d1017] border border-[#262b36] text-slate-100 rounded-xl text-xs font-bold outline-none"
                        >
                          <option value="+91">+91 (IN)</option>
                          <option value="+971">+971 (UAE)</option>
                          <option value="+966">+966 (KSA)</option>
                          <option value="+44">+44 (UK)</option>
                          <option value="+1">+1 (US)</option>
                        </select>
                        <input
                          type="tel"
                          required
                          placeholder="e.g. 98470 12345"
                          value={otherPhone}
                          onChange={(e) => setOtherPhone(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-medium text-slate-100 outline-none focus:border-[#002C6C] transition-all font-mono"
                        />
                      </div>
                      {otherPhone.trim() && validateMobileNumber(otherPhone) && (
                        <p className="mt-1 text-[11px] font-semibold text-rose-400">
                          {validateMobileNumber(otherPhone)}
                        </p>
                      )}
                    </div>

                    {/* Passenger Relationship */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Relationship to Passenger
                      </label>
                      <select
                        value={passengerRelationship}
                        onChange={(e) => setPassengerRelationship(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-semibold text-slate-100 outline-none focus:border-[#002C6C] transition-all"
                      >
                        <option value="Family">Family Member (Parent / Spouse / Child / Relative)</option>
                        <option value="Friend">Friend</option>
                        <option value="Colleague">Colleague / Business Associate</option>
                        <option value="Other">Other Person</option>
                      </select>
                    </div>
                  </div>

                  {/* Optional Special Instructions */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Special Instructions for Driver (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Elderly passenger, assistance with luggage requested, meet at airport terminal gate 3"
                      value={passengerSpecialInstructions}
                      onChange={(e) => setPassengerSpecialInstructions(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-medium text-slate-100 outline-none focus:border-[#002C6C] transition-all"
                    />
                  </div>

                  <div className="p-2.5 bg-[#0d1017] rounded-lg border border-blue-900/40 text-[11px] text-blue-300 flex items-center gap-2">
                    <span>
                      You ({currentUser.name}) remain the booking account holder and can complete payment. The driver will greet your designated passenger at the pickup location.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* SINGLE HORIZONTAL CONTROLS LINE ON DESKTOP */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-end gap-2.5 pt-1">
              {/* 1. Pickup location: Option A (Choose My Location GPS) & Option B (Manual Entry with Suggestions) */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-300 flex items-center gap-1.5 text-xs">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Pickup</span>
                  </label>
                  {/* Option A: Choose My Location */}
                  <button
                    type="button"
                    onClick={handleDetectCurrentLocation}
                    disabled={isDetectingLocation}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-300 hover:text-cyan-200 bg-[#1c202a] hover:bg-[#252b38] px-2 py-0.5 rounded-md border border-[#262b36] transition-colors cursor-pointer"
                    title="Choose My Location via real-time GPS"
                  >
                    {isDetectingLocation ? (
                      <>
                        <span>Detecting GPS...</span>
                      </>
                    ) : (
                      <>
                        <span>Choose My Location</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Option B: Manual Entry with independent real-time suggestions */}
                <div className="relative">
                  <input
                    id="pickup-input"
                    type="text"
                    required
                    value={pickup}
                    onChange={(e) => {
                      setPickup(e.target.value);
                      setPickupCoords(null);
                      setShowPickupSuggestions(true);
                      searchLocationSuggestions(e.target.value, setPickupSuggestions);
                    }}
                    onFocus={() => {
                      if (pickup.length >= 2) setShowPickupSuggestions(true);
                    }}
                    placeholder="e.g. Edappally Toll, Kochi"
                    className="w-full h-11 px-3.5 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-medium text-slate-100 focus:border-[#002C6C] outline-none transition-all placeholder:text-slate-400"
                  />
                  {showPickupSuggestions && pickupSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-[#14171f] border border-[#262b36] rounded-xl shadow-2xl z-50 divide-y divide-[#262b36] max-h-56 overflow-y-auto">
                      {pickupSuggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const full = item.title + (item.subtitle ? `, ${item.subtitle}` : '');
                            setPickup(full);
                            if (item.lat !== undefined && item.lon !== undefined) {
                              setPickupCoords({ lat: item.lat, lon: item.lon });
                            } else {
                              setPickupCoords(null);
                            }
                            setShowPickupSuggestions(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-[#1c2230] transition-colors flex items-start gap-2"
                        >
                          <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                          <div className="truncate">
                            <div className="text-xs font-bold text-slate-100 truncate">{item.title}</div>
                            {item.subtitle && <div className="text-[10px] text-slate-400 truncate">{item.subtitle}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {locationError && (
                  <div className="mt-1 flex items-center justify-between text-[11px] text-rose-300 bg-rose-950/40 border border-rose-900/60 px-2 py-0.5 rounded-lg">
                    <span className="truncate">{locationError}</span>
                    <button type="button" onClick={() => setLocationError('')} className="text-rose-400 font-bold ml-1 text-xs">✕</button>
                  </div>
                )}
              </div>

              {/* 2. Drop-off location with autocomplete suggestions */}
              <div className="flex-1 min-w-0">
                <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1.5 text-xs">
                  <Navigation className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Drop off</span>
                </label>
                <div className="relative">
                  <input
                    id="destination-input"
                    type="text"
                    required
                    value={destination}
                    onChange={(e) => {
                      setDestination(e.target.value);
                      setShowDestSuggestions(true);
                      searchLocationSuggestions(e.target.value, setDestSuggestions);
                    }}
                    onFocus={() => {
                      if (destination.length >= 2) setShowDestSuggestions(true);
                    }}
                    placeholder={selectedService === 'hourly-driver' ? 'Local Kochi (As Directed)' : 'e.g. Fort Kochi / TVM'}
                    className="w-full h-11 px-3.5 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-medium text-slate-100 focus:border-[#002C6C] outline-none transition-all placeholder:text-slate-400"
                  />
                  {showDestSuggestions && destSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-[#14171f] border border-[#262b36] rounded-xl shadow-2xl z-50 divide-y divide-[#262b36] max-h-56 overflow-y-auto">
                      {destSuggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const full = item.title + (item.subtitle ? `, ${item.subtitle}` : '');
                            setDestination(full);
                            setShowDestSuggestions(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-[#1c2230] transition-colors flex items-start gap-2"
                        >
                          <Navigation className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <div className="truncate">
                            <div className="text-xs font-bold text-slate-100 truncate">{item.title}</div>
                            {item.subtitle && <div className="text-[10px] text-slate-400 truncate">{item.subtitle}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Date */}
              <div className="w-full lg:w-[140px] shrink-0">
                <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1.5 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Date</span>
                </label>
                <input
                  id="date-input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-11 px-3 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-medium text-slate-100 focus:border-[#002C6C] outline-none transition-all"
                />
              </div>

              {/* 4. Time */}
              <div className="w-full lg:w-[115px] shrink-0">
                <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1.5 text-xs">
                  <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Time</span>
                </label>
                <input
                  id="time-input"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full h-11 px-3 bg-[#0d1017] border border-[#262b36] rounded-xl text-xs font-medium text-slate-100 focus:border-[#002C6C] outline-none transition-all"
                />
              </div>

              {/* 5. Booking Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0 pt-1 lg:pt-0">
                <button
                  type="button"
                  onClick={() => {
                    if (isGuest) {
                      onOpenGuestWarning('Book a Driver');
                      return;
                    }
                    if (!selectedVehicle && !newCarModel && vehicles.length === 0) {
                      setShowAddCarInline(true);
                      setDriverErrorMsg('Please register or select your vehicle first.');
                      setActiveFlowSection('vehicle');
                      document.getElementById('vehicle-selection-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      return;
                    }
                    if (!selectedService) {
                      setDriverErrorMsg('Please select your trip type.');
                      setActiveFlowSection('service');
                      document.getElementById('service-type-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      return;
                    }
                    if (!pickup.trim()) {
                      setDriverErrorMsg('Please enter your pickup location.');
                      setActiveFlowSection('booking');
                      document.getElementById('pickup-input')?.focus();
                      return;
                    }
                    if (selectedService !== 'hourly-driver' && !destination.trim()) {
                      setDriverErrorMsg('Please enter your drop-off location.');
                      setActiveFlowSection('booking');
                      document.getElementById('destination-input')?.focus();
                      return;
                    }
                    setDriverErrorMsg('');
                    setHasSearchedDrivers(true);
                    if (availableCompatibleOnlineDrivers.length > 0 && !selectedDriverId) {
                      setSelectedDriverId(availableCompatibleOnlineDrivers[0].id);
                    }
                    setTimeout(() => {
                      document.getElementById('driver-selection-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 50);
                  }}
                  className="flex-1 lg:flex-none h-11 px-4 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] whitespace-nowrap"
                  title="Book a driver"
                >
                  <span>Book Driver</span>
                </button>
                <button
                  type="button"
                  onClick={handleBookOnWhatsApp}
                  className="flex-1 lg:flex-none h-11 px-3.5 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] shrink-0 whitespace-nowrap"
                  title="Book directly on WhatsApp with pre-filled details"
                >
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>

            {/* Actual Road Route Distance Indicator (Requirement 1) */}
            <div className="w-full pt-1">
              {isCalculatingRoute ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300 bg-[#0d1424] border border-blue-800/70 px-3 py-1.5 rounded-xl animate-pulse">
                  <span>Calculating verified road network distance between pickup & drop-off...</span>
                </div>
              ) : routeError ? (
                <div className="flex items-center justify-between text-xs font-semibold text-rose-300 bg-rose-950/50 border border-rose-800/80 px-3 py-1.5 rounded-xl">
                  <div className="flex items-center gap-1.5">
                    <span>{routeError}</span>
                  </div>
                </div>
              ) : selectedService !== 'hourly-driver' && pickup.trim().length >= 2 && destination.trim().length >= 2 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-200 bg-emerald-950/50 border border-emerald-700/80 px-3.5 py-2 rounded-xl shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>
                    <span className="text-emerald-200 font-black">
                      Verified Road Route: {calculatedKm} km
                    </span>
                    {isRoundTrip && (
                      <span className="text-[10px] bg-emerald-900/60 text-emerald-200 px-1.5 py-0.5 rounded font-black">
                        Round-Trip: ~{(calculatedKm * 1.8).toFixed(1)} billable km
                      </span>
                    )}
                    <span className="text-slate-400 font-normal hidden sm:inline">
                      • Est. Driving Time: ~{routeDurationMins || Math.round((calculatedKm / 35) * 60)} mins (OSRM Road Network)
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-300 font-mono bg-[#0d1017] px-2 py-0.5 rounded border border-emerald-700/80">
                    Live Meter Rate Active
                  </span>
                </div>
              ) : null}
            </div>

            {/* Error Message banner */}
            {driverErrorMsg && (
              <div className="pt-2 animate-in fade-in">
                <span className="text-xs text-rose-400 font-bold bg-rose-950/50 px-3.5 py-1.5 rounded-xl border border-rose-800/80 inline-flex items-center gap-1.5 shadow-xs">
                  <span>{driverErrorMsg}</span>
                </span>
              </div>
            )}
          </div>

          {/* Form and Quote Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left: Driver Selection, Payment & Final Confirmation */}
            <div className="lg:col-span-7 bg-[#14171f] rounded-2xl p-5 sm:p-6 border border-[#262b36] shadow-sm space-y-5 text-slate-100">
              
              <form onSubmit={handleConfirmBooking} className="space-y-5 text-xs">

                {/* 4. DRIVER SELECTION: 3-WAY SELECTION STYLES */}
                {hasSearchedDrivers && (
                  <div id="driver-selection-section" className="space-y-4 bg-[#0d1017] p-4 sm:p-5 rounded-2xl border border-[#262b36] animate-in fade-in">
                    
                    {/* SELECTION STYLE TABS */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#262b36] pb-3">
                      <div>
                        <h4 className="font-black text-slate-100 text-xs flex items-center gap-1.5">
                          <span>Driver Selection Style</span>
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          Select your chauffeur assignment preference
                        </p>
                      </div>

                      <div className="inline-flex p-1 bg-[#14171f] rounded-xl border border-[#262b36] gap-1 self-start sm:self-auto">
                        {customerFavDrivers.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setDriverSelectionMode('favourite')}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                              driverSelectionMode === 'favourite'
                                ? 'bg-[#002C6C] text-white shadow-xs'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <span>Favourite Driver</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDriverSelectionMode('specific')}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                            driverSelectionMode === 'specific'
                              ? 'bg-[#002C6C] text-white shadow-xs'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>Pick a Driver</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDriverSelectionMode('random')}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                            driverSelectionMode === 'random'
                              ? 'bg-[#002C6C] text-white shadow-xs'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>Accept Random Drivers</span>
                        </button>
                      </div>
                    </div>

                    {/* VIEW 1: FAVOURITE DRIVER SELECTION */}
                    {driverSelectionMode === 'favourite' && customerFavDrivers.length > 0 && (
                      <div className="space-y-3">
                        {customerFavDrivers.length === 1 && (() => {
                          const favDriver = customerFavDrivers[0];
                          const isOfflineOrBusy = !favDriver.isOnline;
                          return (
                            <div className="space-y-2">
                              <div className="p-3.5 bg-[#14171f] rounded-xl border border-rose-900/50 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="relative">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#002C6C] to-pink-900 text-white font-black text-xs flex items-center justify-center">
                                      {favDriver.name.charAt(0)}
                                    </div>
                                    <span
                                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-[#090a0f] ${
                                        favDriver.isOnline ? 'bg-emerald-500' : 'bg-rose-500'
                                      }`}
                                    />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-100 text-xs">Favourite: {favDriver.name}</span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                        favDriver.isOnline ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' : 'bg-rose-950/60 text-rose-300 border border-rose-800'
                                      }`}>
                                        {favDriver.isOnline ? 'Online' : 'Offline'}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400">★ {favDriver.ratingAverage || '5.0'} • {favDriver.city}</p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800">Pre-selected ✓</span>
                              </div>
                              {isOfflineOrBusy && (
                                <div className="p-3 bg-blue-950/40 border border-blue-900/60 rounded-xl flex items-start gap-2.5 text-cyan-300">
                                  <div className="space-y-1">
                                    <p className="font-bold text-xs text-slate-100">
                                      Your favourite driver is currently offline or on another ride.
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                      You can still send the request, or switch to <strong>Pick a Driver</strong> or <strong>Accept Random Drivers</strong>.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {customerFavDrivers.length > 1 && (() => {
                          const activeFav = customerFavDrivers.find(d => d.id === selectedDriverId) || customerFavDrivers[0];
                          const isFavOffline = activeFav && !activeFav.isOnline;
                          return (
                            <div className="space-y-2 bg-[#14171f] p-3 rounded-xl border border-rose-900/50">
                              <label className="block font-bold text-rose-300 text-xs flex items-center gap-1.5">
                                <span>Select Favourite Driver ({customerFavDrivers.length} saved):</span>
                              </label>
                              <select
                                value={selectedDriverId || customerFavDrivers[0].id}
                                onChange={(e) => handleDriverChange(e.target.value)}
                                className="w-full p-2 bg-[#0d1017] border border-[#262b36] rounded-lg text-xs font-semibold text-slate-100 outline-none focus:border-[#002C6C]"
                              >
                                {customerFavDrivers.map(fd => {
                                  const isCompat = capabilityMatchedIds.has(fd.id);
                                  const canPick = fd.isOnline && isCompat;
                                  return (
                                    <option key={fd.id} value={fd.id} disabled={!canPick}>
                                      {fd.name} ({!fd.isOnline ? 'Offline — Unavailable' : !isCompat ? 'Not Compatible' : 'Online'}) • ★ {fd.ratingAverage || '5.0'}
                                    </option>
                                  );
                                })}
                              </select>
                              {isFavOffline && (
                                <div className="p-2.5 bg-blue-950/40 border border-blue-900/60 rounded-lg text-cyan-300 text-xs font-bold flex items-center gap-2">
                                  <span>Your favourite driver is currently offline or on another ride.</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* VIEW 2: PICK A SPECIFIC DRIVER */}
                    {driverSelectionMode === 'specific' && (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                          <div>
                            <label className="block font-black text-slate-100 flex items-center gap-1.5 text-xs">
                              <span>Matched Qualified Drivers ({capabilityMatchedDrivers.length}) *</span>
                            </label>
                            <p className="text-[10px] text-slate-400">
                              Certified for your {activeTransmission.toUpperCase()} • {activeFuel.toUpperCase()} vehicle
                            </p>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] font-bold">
                            <span className="flex items-center gap-1 text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></span>
                              <span>{sortedApprovedDrivers.filter(d => d.isOnline).length} Online</span>
                            </span>
                            <span className="flex items-center gap-1 text-slate-400 bg-[#1c202a] px-2 py-0.5 rounded-full border border-[#262b36]">
                              <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-400"></span>
                              <span>{sortedApprovedDrivers.filter(d => !d.isOnline).length} Offline</span>
                            </span>
                          </div>
                        </div>

                        {capabilityMatchedDrivers.length === 0 && (
                          <p className="text-[11px] font-semibold text-cyan-300 bg-blue-950/40 p-2.5 rounded-xl border border-blue-900/60">
                            ℹ️ No drivers currently declared exact match for {activeTransmission.toUpperCase()} + {activeFuel.toUpperCase()}. Showing all approved certified Kerala drivers below:
                          </p>
                        )}

                        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                          {sortedApprovedDrivers.map((driver) => {
                            const isOnline = Boolean(driver.isOnline);
                            const isCompatible = capabilityMatchedIds.has(driver.id);
                            const canSelect = isOnline && isCompatible;
                            const isChosen = canSelect && ((selectedDriverId === driver.id) || (!selectedDriverId && availableCompatibleOnlineDrivers[0]?.id === driver.id));
                            const isFav = favouriteDriverIds.includes(driver.id);

                            return (
                              <div
                                key={driver.id}
                                onClick={() => {
                                  if (!canSelect) return;
                                  setSelectedDriverId(driver.id);
                                }}
                                aria-disabled={!canSelect}
                                className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                                  !canSelect
                                    ? 'border-[#262b36] bg-[#0d1017]/60 opacity-55 cursor-not-allowed'
                                    : isChosen
                                      ? 'border-[#002C6C] bg-[#1c2230] shadow-sm ring-1 ring-[#002C6C] cursor-pointer'
                                      : 'border-[#262b36] bg-[#0d1017] hover:border-slate-600 hover:bg-[#14171f] cursor-pointer'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="relative">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#002C6C] to-cyan-700 text-white font-black text-xs flex items-center justify-center">
                                      {driver.name.charAt(0)}
                                    </div>
                                    <span
                                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-[#090a0f] ${
                                        driver.isOnline ? 'bg-emerald-500' : 'bg-rose-500'
                                      }`}
                                      title={driver.isOnline ? 'Online' : 'Offline'}
                                    />
                                  </div>

                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <strong className="text-slate-100 font-bold text-xs">{driver.name}</strong>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                        driver.isOnline ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' : 'bg-[#1c202a] text-slate-400 border border-[#262b36]'
                                      }`}>
                                        {driver.isOnline ? 'Online' : 'Offline'}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                      <span className="text-cyan-400 font-bold">★ {driver.ratingAverage || '5.0'}</span>
                                      <span>•</span>
                                      <span>{driver.city}</span>
                                      <span>•</span>
                                      <span className="text-emerald-400 font-bold">✓ {activeTransmission.toUpperCase()}</span>
                                      <span className="text-cyan-400 font-bold">✓ {activeFuel.toUpperCase()}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {onToggleFavouriteDriver && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleFavouriteDriver(driver.id);
                                      }}
                                      className={`p-1 rounded-full border transition-all ${
                                        isFav ? 'text-rose-400 bg-rose-950/60 border-rose-800' : 'text-slate-400 hover:text-rose-400'
                                      }`}
                                      title="Favourite"
                                    >
                                      </button>
                                  )}

                                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                                    !isOnline
                                      ? 'bg-[#14171f] text-slate-500 border border-[#262b36]'
                                      : !isCompatible
                                        ? 'bg-amber-950/50 text-amber-300 border border-amber-800/70'
                                        : isChosen
                                          ? 'bg-[#002C6C] text-white shadow-xs'
                                          : 'bg-[#14171f] text-slate-400 border border-[#262b36]'
                                  }`}>
                                    {!isOnline ? 'Offline' : !isCompatible ? 'Not Compatible' : isChosen ? 'Selected ✓' : 'Select'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* VIEW 3: ACCEPT RANDOM DRIVERS (MULTI-DRIVER BROADCAST) */}
                    {driverSelectionMode === 'random' && (
                      <div className="p-4 bg-[#14171f] rounded-xl border border-[#262b36] space-y-2">
                        <div className="flex items-center gap-2 text-cyan-300 font-black text-xs">
                          <span>Multi-Driver Instant Broadcast</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Your trip request will be broadcasted simultaneously to all online, certified drivers matching your vehicle category ({activeTransmission.toUpperCase()} • {activeFuel.toUpperCase()}). The first driver to accept will immediately take your booking.
                        </p>
                        <div className="flex items-center gap-2 pt-1 text-[11px] font-bold text-emerald-400">
                          <span>Fastest assignment • Certified professionals only</span>
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* 5. Promo Code Input */}
                <div className={`p-3 rounded-2xl flex items-center gap-2 border ${
                  firstRidePromoAlreadyUsed 
                    ? 'bg-[#0d1017] border-[#262b36] opacity-90' 
                    : 'bg-[#0d1017] border-[#262b36]'
                }`}>
                  <input
                    type="text"
                    placeholder={firstRidePromoAlreadyUsed ? 'Not available' : t.booking.promoPlaceholder}
                    value={firstRidePromoAlreadyUsed ? 'Not available' : promoCodeInput}
                    disabled={firstRidePromoAlreadyUsed}
                    onChange={(e) => {
                      if (!firstRidePromoAlreadyUsed) setPromoCodeInput(e.target.value);
                    }}
                    className={`flex-1 px-3 py-1.5 border rounded-xl text-xs font-mono uppercase outline-none ${
                      firstRidePromoAlreadyUsed 
                        ? 'bg-[#14171f] border-[#262b36] text-slate-400 cursor-not-allowed font-semibold' 
                        : 'bg-[#14171f] border-[#262b36] text-white focus:border-[#002C6C]'
                    }`}
                  />
                  <button
                    type="button"
                    disabled={firstRidePromoAlreadyUsed}
                    onClick={handleApplyPromo}
                    className={`px-4 py-1.5 font-bold text-xs rounded-xl transition-all ${
                      firstRidePromoAlreadyUsed 
                        ? 'bg-[#1c202a] text-slate-400 cursor-not-allowed border border-[#262b36]' 
                        : 'bg-[#002C6C] text-white hover:bg-[#001f4d]'
                    }`}
                  >
                    {t.booking.applyPromo}
                  </button>
                </div>
                {firstRidePromoAlreadyUsed ? (
                  <p className="text-[11px] font-bold text-cyan-300 bg-[#0d1017] px-2.5 py-1.5 rounded-lg border border-[#262b36]">
                    Your first-ride 50% off offer has already been used.
                  </p>
                ) : promoMsg && (
                  <p className={`text-[11px] font-bold ${promoMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
                    {promoMsg}
                  </p>
                )}

                {/* 6. Payment Method */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">{t.booking.paymentLabel}</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('upi')}
                      className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-semibold transition-all ${
                        paymentMethod === 'upi' ? 'border-[#002C6C] bg-[#002C6C] text-white' : 'border-[#262b36] bg-[#0d1017] text-slate-300 hover:bg-[#14171f]'
                      }`}
                    >
                      <span>UPI GPay</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-semibold transition-all ${
                        paymentMethod === 'cash' ? 'border-[#002C6C] bg-[#002C6C] text-white' : 'border-[#262b36] bg-[#0d1017] text-slate-300 hover:bg-[#14171f]'
                      }`}
                    >
                      <span>Cash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-semibold transition-all ${
                        paymentMethod === 'card' ? 'border-[#002C6C] bg-[#002C6C] text-white' : 'border-[#262b36] bg-[#0d1017] text-slate-300 hover:bg-[#14171f]'
                      }`}
                    >
                      <span>Card</span>
                    </button>
                  </div>
                </div>

                {/* Submit Booking */}
                <button
                  type="submit"
                  disabled={isSubmittingBooking}
                  className="w-full py-4 rounded-2xl bg-[#002C6C] hover:bg-[#001f4d] disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-sm shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  <span>{isSubmittingBooking ? 'Confirming Booking...' : `${t.booking.confirmBooking} (₹${fare.totalFare})`}</span>
                </button>

                <p className="text-[11px] text-slate-400 text-center">
                  {t.booking.otpNote}
                </p>
              </form>
            </div>

            {/* Right: Transparent Quote Breakdown */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#14171f] rounded-2xl p-4 sm:p-5 border border-[#262b36] shadow-sm space-y-3.5 text-slate-100">
                <div className="flex items-center justify-between border-b border-[#262b36] pb-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {t.booking.fareSummary}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
                    Approved Kerala Tariff
                  </span>
                </div>

                {/* Requirement 1: 50% off for each customer ONLY on their first ride */}
                {isFirstRide ? (
                  <div className="p-2.5 bg-gradient-to-r from-emerald-950/60 to-cyan-950/60 border border-emerald-800/80 rounded-xl flex items-center gap-2 text-xs text-emerald-300 font-bold">
                    <span>🎉 50% OFF Applied Automatically on First Ride!</span>
                  </div>
                ) : (
                  currentUser.role === 'customer' && (
                    <div className="p-2.5 bg-[#0d1017] border border-[#262b36] rounded-xl flex items-center justify-between text-xs text-slate-400">
                      <span className="font-medium">First-ride 50% promo already redeemed</span>
                      <span className="text-[10px] bg-[#1c202a] text-slate-300 px-2 py-0.5 rounded font-bold border border-[#262b36]">Regular Tariff</span>
                    </div>
                  )
                )}

                {/* Dafy-Inspired Real-Time Pricing Transparency Badge & Route Details */}
                <div className={`p-3 rounded-xl border text-xs space-y-2 transition-all ${
                  fare.isEstimate
                    ? 'bg-[#0d1017] border-[#262b36] text-cyan-300'
                    : 'bg-[#0d1017] border-emerald-900/60 text-emerald-300'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${fare.isEstimate ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'}`} />
                      <span className="font-black text-sm text-slate-100">{fare.pricingLabel || (fare.isEstimate ? '⚡ Live Metered Estimate' : '✓ Confirmed Fixed Tariff')}</span>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      fare.isEstimate ? 'bg-[#002C6C] text-white' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}>
                      {fare.isEstimate ? 'Road Route Metered' : 'Fixed Package'}
                    </span>
                  </div>

                  {/* Route Summary */}
                  <div className="bg-[#14171f] p-2.5 rounded-lg border border-[#262b36] text-[11px] space-y-1">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-400">Service:</span>
                      <strong className="text-slate-100">{selectedService.replace(/-/g, ' ').toUpperCase()}</strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-400">Pickup:</span>
                      <span className="font-semibold text-slate-100 truncate max-w-[200px]">{pickup || 'Not specified'}</span>
                    </div>
                    {selectedService !== 'hourly-driver' && (
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-400">Drop-off:</span>
                        <span className="font-semibold text-slate-100 truncate max-w-[200px]">{destination || 'Not specified'}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-slate-300 pt-1 border-t border-[#262b36]">
                      <span className="text-slate-400 font-bold">Calculated Road Distance:</span>
                      <span className="font-black text-emerald-400">
                        {selectedService === 'hourly-driver' 
                          ? `${calculatedKm} km Included Allowance`
                          : `${calculatedKm} km (${isRoundTrip ? `${(calculatedKm * 1.8).toFixed(1)} billable km` : 'One-way'})`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* STRICT TWO-MODEL PRICING BREAKDOWN */}
                {fare.pricingModel === 'kilometer' ? (
                  <div className="space-y-2 p-3 bg-[#0d1017] border border-[#262b36] rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-black text-cyan-300 text-xs">
                        <span>🛣️ Kilometer-Based Pricing</span>
                        <span className="text-[10px] bg-[#002C6C] text-white px-1.5 py-0.5 rounded font-mono font-bold">₹1.00 / km</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">Road Distance via OSRM</span>
                    </div>
                    <div className="space-y-1 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span>Distance Charge ({calculatedKm} km @ ₹1.00/km):</span>
                        <span className="font-bold text-slate-100">₹{fare.distanceCharge}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Time / Duration Charge:</span>
                        <span className="font-semibold text-emerald-400">₹0 (Strictly Free / No Time Charges)</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 p-3 bg-[#0d1017] border border-[#262b36] rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-black text-emerald-300 text-xs">
                        <span>⏱️ Minute-Based Pricing</span>
                        <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">₹1.20 / min</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400">Duration-Based</span>
                    </div>
                    <div className="space-y-1 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span>Duration Charge ({fare.durationMinutes || routeDurationMins || 60} mins @ ₹1.20/min):</span>
                        <span className="font-bold text-slate-100">₹{fare.durationCharge || fare.timeCharge}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Kilometer / Road Distance Charge:</span>
                        <span className="font-semibold text-emerald-400">₹0 (Strictly Free / No KM Charges)</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Platform & Safety Fee</span>
                    <span className="font-semibold text-slate-200">₹{fare.platformFee}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>State GST (5%)</span>
                    <span className="font-semibold text-slate-200">₹{fare.serviceTaxGST || fare.gstAmount}</span>
                  </div>

                  {fare.discountAmount && fare.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-300 font-bold bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-800">
                      <span>{isFirstRide ? '🎉 50% First Ride Discount' : `Promo Discount (${appliedPromo})`}</span>
                      <span>-₹{fare.discountAmount}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-[#262b36] pt-3 flex justify-between items-baseline">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{t.booking.totalEstimate}</span>
                  </div>
                  <span className="text-3xl font-black text-white font-mono">₹{fare.totalFare}</span>
                </div>
              </div>

              {/* LIVE ACTIVE BOOKING CARD (REQUIREMENT 4: 20-SEC CANCEL WINDOW + 10-SEC ARRIVING TIMER) */}
              {activeCreatedBooking && (
                <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-800 space-y-3.5 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                        Live Booking Status
                      </span>
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-300">
                      Ref: {activeCreatedBooking.refCode}
                    </span>
                  </div>

                  {/* 4-digit Ride-Start OTP */}
                  <div className="bg-gradient-to-r from-cyan-900/60 to-blue-900/60 border border-cyan-400/30 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-300 flex items-center gap-1">
                        Boarding Ride-Start OTP
                      </span>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Share with driver upon arrival
                      </p>
                    </div>
                    <div className="text-2xl font-black tracking-widest text-white bg-black/40 px-3 py-1 rounded-xl border border-white/20 font-mono">
                      {activeCreatedBooking.rideStartOtp}
                    </div>
                  </div>

                  {/* 20-Second Cancellation Window Banner (Requirement 4) */}
                  {activeCreatedBooking.status === 'pending' && (
                    <div className="bg-blue-950/60 border border-blue-500/40 rounded-2xl p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                          <span>Cancellation Window: {cancelSecondsLeft}s Left</span>
                        </span>
                        <span className="text-[10px] text-cyan-200">Zero cancellation fee</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        You can cancel without fee before the driver confirms arrival at pickup.
                      </p>
                      <button
                        type="button"
                        onClick={handleCancelActiveBooking}
                        className="w-full py-2 bg-red-600/80 hover:bg-red-600 text-white font-bold rounded-xl transition-all"
                      >
                        Cancel Ride Request ({cancelSecondsLeft}s)
                      </button>
                    </div>
                  )}

                  {/* 10-Second Driver Arriving Progress (Requirement 4) */}
                  {activeCreatedBooking.status === 'driver_arriving' && (
                    <div className="bg-cyan-950/60 border border-cyan-500/40 rounded-2xl p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                          <span>Driver is Arriving in {arrivingSecondsLeft}s</span>
                        </span>
                        <span className="text-[10px] text-cyan-200">Approaching Pickup</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-cyan-400 h-full transition-all duration-1000"
                          style={{ width: `${((10 - arrivingSecondsLeft) / 10) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Status Indicator */}
                  <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                        {activeCreatedBooking.serviceType === 'self-drive' ? 'Self-Drive Reservation' : 'Ride Request'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        activeCreatedBooking.status === 'approved' 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : activeCreatedBooking.status === 'pending'
                            ? 'bg-blue-500/20 text-cyan-300 border border-blue-500/40'
                            : 'bg-cyan-500/20 text-cyan-300'
                      }`}>
                        {activeCreatedBooking.status === 'pending' ? 'Pending Approval' : activeCreatedBooking.status.replace('_', ' ')}
                      </span>
                    </div>

                    {activeCreatedBooking.serviceType === 'self-drive' ? (
                      <div className="space-y-1.5 pt-1">
                        <p className="font-bold text-white text-sm">
                          {activeCreatedBooking.rentalVehicleModel}
                        </p>
                        <div className="flex justify-between text-[11px] text-slate-300">
                          <span>Advance Paid:</span>
                          <strong className="text-emerald-400 font-mono">₹{activeCreatedBooking.advanceAmount || activeCreatedBooking.fareBreakdown.advanceAmount}</strong>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>Balance on Return:</span>
                          <strong className="text-slate-300 font-mono">₹{activeCreatedBooking.remainingAmount || activeCreatedBooking.fareBreakdown.remainingAmount}</strong>
                        </div>
                        {activeCreatedBooking.status === 'approved' ? (
                          <div className="space-y-2 mt-2">
                            <div className="p-2 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                              <span>Your vehicle has been successfully booked.</span>
                            </div>
                            {onNavigateToPortal && (
                              <button
                                type="button"
                                onClick={() => onNavigateToPortal('user')}
                                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                              >
                                <span>Complete Ride & Pay Remaining →</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-cyan-300/90 pt-1">
                            ℹ️ Admin notified for reservation review & approval.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[11px] text-slate-400">
                          Driver: {activeCreatedBooking.driverName || 'Matching nearby driver'}
                        </p>
                        {/* Requirement: Website Pay for Ride after Destination Reached */}
                        {(activeCreatedBooking.status === 'awaiting_payment' || activeCreatedBooking.status === 'completed') && (
                          <div className="pt-2 border-t border-white/10 space-y-2">
                            {!activeCreatedBooking.passengerPaid ? (
                              <div className="p-3 bg-gradient-to-r from-emerald-950/90 to-blue-950/90 border border-emerald-700/80 rounded-xl space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-black text-emerald-300 flex items-center gap-1.5">
                                    Destination Reached!
                                  </span>
                                  <span className="font-mono font-bold text-white bg-emerald-500/20 border border-emerald-700/80 px-2 py-0.5 rounded text-[11px]">
                                    Due: ₹{activeCreatedBooking.fareBreakdown.totalFare}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-300">
                                  Your driver has arrived at the destination. Please choose Cash, Card, or UPI to complete payment.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCashHandedConfirmed(false);
                                    setPaymentError('');
                                    setRidePaymentModal({
                                      isOpen: true,
                                      booking: activeCreatedBooking,
                                      paymentMethod: 'cash',
                                      isSuccess: false,
                                    });
                                  }}
                                  className="w-full py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                                >
                                  <span>Pay for Ride (₹{activeCreatedBooking.fareBreakdown.totalFare}) →</span>
                                </button>
                              </div>
                            ) : (
                              <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-300 font-bold text-xs flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <span>Paid ₹{activeCreatedBooking.fareBreakdown.totalFare}</span>
                                </span>
                                <span className="text-[10px] font-mono uppercase bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded border border-emerald-600/40">
                                  {activeCreatedBooking.paymentMethod || 'Paid'}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
          </div>
        </div>
      )}

      {/* MODE 2: SELF-DRIVE CAR RENTAL */}
      {bookingMode === 'self_drive_rental' && (
        <div className="space-y-8 animate-in fade-in">
          
          <div className="bg-[#14171f] border border-[#262b36] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-800">
                DriveC Approved Owner Fleet
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-100 mt-1">Rent Approved Self-Drive Cars in Kochi</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Select your pickup and return dates. Pay the advance amount to reserve with instant admin approval dispatch.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 bg-[#0d1017] p-2.5 rounded-xl border border-[#262b36]">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5">Pickup Date:</label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={rentalPickupDate}
                  onChange={(e) => {
                    const newPick = e.target.value;
                    setRentalPickupDate(newPick);
                    if (rentalReturnDate < newPick) {
                      setRentalReturnDate(newPick);
                    }
                  }}
                  className="px-2.5 py-1.5 bg-[#14171f] border border-[#262b36] rounded-xl text-xs font-bold text-slate-100 outline-none focus:border-[#002C6C]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5">Return Date:</label>
                <input
                  type="date"
                  min={rentalPickupDate}
                  value={rentalReturnDate}
                  onChange={(e) => {
                    if (e.target.value >= rentalPickupDate) {
                      setRentalReturnDate(e.target.value);
                    }
                  }}
                  className="px-2.5 py-1.5 bg-[#14171f] border border-[#262b36] rounded-xl text-xs font-bold text-slate-100 outline-none focus:border-[#002C6C]"
                />
              </div>
              <div className="pt-3">
                <span className="text-xs font-black text-white bg-[#002C6C] px-3 py-1.5 rounded-xl border border-blue-800 block whitespace-nowrap">
                  {calculatedRentalDays} Day(s) Rental
                </span>
              </div>
            </div>
          </div>

          {/* Rental Cars Grid */}
          <div id="rental-fleet-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {rentalVehicles.map((car) => {
              const isSelected = selectedRentalVehicleId === car.id;
              const quote = calculateRentalQuote(car, calculatedRentalDays, 0, appliedPromo);
              const isOffline = !car.isAvailable || Boolean(car.offlineUntil);
              const isOverlapping = checkVehicleOverlap(car.id, rentalPickupDate, rentalReturnDate);
              const isBlockedByMaintenance = isOffline && (!car.offlineUntil || rentalPickupDate < car.offlineUntil);

              return (
                <div
                  key={car.id}
                  onClick={() => {
                    // Check if car is blocked by maintenance for the selected dates (Requirement 1, 2, 3)
                    if (isBlockedByMaintenance) {
                      setMaintenancePopup({
                        isOpen: true,
                        vehicleModel: `${car.brand} ${car.model}`,
                        expectedDate: car.offlineUntil || 'a future date',
                        vehicleId: car.id,
                        notified: false,
                      });
                      return;
                    }

                    // Check overlapping bookings
                    if (isOverlapping) {
                      setUnavailablePopup({
                        isOpen: true,
                        vehicleModel: `${car.brand} ${car.model}`,
                        dates: `${rentalPickupDate} to ${rentalReturnDate}`,
                      });
                      return;
                    }

                    setSelectedRentalVehicleId(car.id);
                  }}
                  className={`cursor-pointer bg-[#14171f] rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between space-y-3 relative ${
                    isSelected
                      ? 'border-[#002C6C] ring-2 ring-[#002C6C]/40 shadow-md shadow-blue-950/40'
                      : 'border-[#262b36] hover:border-slate-600 shadow-xs'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-start gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                        {car.category}
                      </span>
                      {isOffline ? (
                        <span className="text-[10px] font-bold text-cyan-300 bg-[#0d1017] px-2.5 py-0.5 rounded-full border border-blue-900/50 flex items-center gap-1">
                          Unavailable – Under Maintenance
                        </span>
                      ) : isOverlapping ? (
                        <span className="text-[10px] font-bold text-rose-300 bg-rose-950/60 px-2.5 py-0.5 rounded-full border border-rose-800">
                          Unavailable
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800">
                          Available
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-black text-slate-100 text-base leading-tight">{car.model}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{car.brand} • {car.licensePlate}</p>
                    </div>

                    {/* Requirement 1: Display expected return-to-service date on offline vehicle card */}
                    {isOffline && (
                      <div className="p-2 bg-[#0d1017] rounded-xl border border-blue-900/50 text-[11px] text-cyan-300">
                        <span className="text-[10px] font-bold text-cyan-400 block">Expected Return-to-Service:</span>
                        <strong className="text-slate-100 font-mono text-xs">{car.offlineUntil || 'Maintenance Ongoing'}</strong>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs bg-[#0d1017] p-2.5 rounded-xl border border-[#262b36]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Transmission</span>
                        <strong className="capitalize text-slate-200">{car.transmission}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Fuel</span>
                        <strong className="capitalize text-slate-200">{car.fuel}</strong>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-1 bg-[#0d1017] p-2.5 rounded-xl border border-[#262b36]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Depot:</span>
                        <strong className="text-slate-200">{car.location.split(',')[0]}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Advance Amount:</span>
                        <strong className="text-emerald-400 font-mono">₹{quote.advanceAmount}</strong>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Balance on Return:</span>
                        <span>₹{quote.remainingAmount}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-[#262b36] flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">{calculatedRentalDays} Day Total:</span>
                      <span className="text-lg font-black text-white font-mono">₹{quote.totalFare}</span>
                    </div>
                    <button
                      type="button"
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        isSelected 
                          ? 'bg-[#002C6C] text-white shadow-xs' 
                          : isBlockedByMaintenance
                            ? 'bg-[#0d1017] text-cyan-300 hover:bg-[#14171f] border border-blue-900/50' 
                            : isOverlapping
                              ? 'bg-rose-950/60 text-rose-300 hover:bg-rose-900/60 border border-rose-800'
                              : 'bg-[#0d1017] text-slate-300 border border-[#262b36] hover:bg-[#14171f]'
                      }`}
                    >
                      {isSelected 
                        ? 'Selected ✓' 
                        : 'Select'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Confirm Rental Box */}
          {selectedRentalVehicle && (
            <div className="bg-[#14171f] rounded-2xl p-4 sm:p-6 border border-[#262b36] shadow-xs space-y-4 text-slate-100">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#262b36] pb-4">
                <div>
                  <h4 className="font-black text-slate-100 text-base">
                    Reserve {selectedRentalVehicle.model} for {calculatedRentalDays} Day(s)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Pickup & Return: <strong>{rentalPickupDate}</strong> to <strong>{rentalReturnDate}</strong> at {selectedRentalVehicle.location}
                  </p>
                </div>
                <div className="text-right sm:text-right">
                  <span className="text-xs text-slate-400 block">Total Rental Fare:</span>
                  <span className="text-2xl font-black text-slate-100">₹{rentalFare.totalFare}</span>
                </div>
              </div>

              {/* Requirement 1: Advance Amount vs Remaining Amount Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-[#0d1017] rounded-2xl border border-[#262b36]">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">1. Total Rental Price</span>
                  <span className="text-lg font-black text-slate-100">₹{rentalFare.totalFare}</span>
                  <p className="text-[10px] text-slate-400">Includes {calculatedRentalDays} day(s) daily rate + GST & protection</p>
                </div>
                <div className="space-y-1 border-y sm:border-y-0 sm:border-x border-[#262b36] sm:px-4 py-2 sm:py-0">
                  <span className="text-[10px] font-black uppercase text-emerald-300 block">2. Advance Amount (Pay Now)</span>
                  <span className="text-xl font-black text-emerald-300 font-mono">₹{rentalFare.advanceAmount}</span>
                  <p className="text-[10px] text-emerald-300">Deducted from total price. Required to confirm reservation</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-cyan-300 block">3. Remaining Balance</span>
                  <span className="text-lg font-black text-cyan-300 font-mono">₹{rentalFare.remainingAmount}</span>
                  <p className="text-[10px] text-slate-400">Payable after completing rental upon returning the vehicle</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Pickup Date</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={rentalPickupDate}
                    onChange={(e) => {
                      const newP = e.target.value;
                      setRentalPickupDate(newP);
                      if (rentalReturnDate < newP) setRentalReturnDate(newP);
                    }}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Return Date</label>
                  <input
                    type="date"
                    min={rentalPickupDate}
                    value={rentalReturnDate}
                    onChange={(e) => {
                      if (e.target.value >= rentalPickupDate) {
                        setRentalReturnDate(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Pickup Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">{t.booking.promoLabel}</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder={firstRidePromoAlreadyUsed ? 'Not available' : 'e.g. DRIVECFIRST'}
                      value={firstRidePromoAlreadyUsed ? 'Not available' : promoCodeInput}
                      disabled={firstRidePromoAlreadyUsed}
                      onChange={(e) => {
                        if (!firstRidePromoAlreadyUsed) setPromoCodeInput(e.target.value);
                      }}
                      className={`w-full px-3 py-2 border rounded-xl outline-none font-mono uppercase ${
                        firstRidePromoAlreadyUsed
                          ? 'bg-[#1c202a] border-[#262b36] text-slate-400 cursor-not-allowed font-semibold'
                          : 'border-[#262b36]'
                      }`}
                    />
                    <button
                      type="button"
                      disabled={firstRidePromoAlreadyUsed}
                      onClick={handleApplyPromo}
                      className={`px-3 py-2 text-white rounded-xl font-bold transition-all ${
                        firstRidePromoAlreadyUsed
                          ? 'bg-slate-300 text-slate-400 cursor-not-allowed'
                          : 'bg-slate-900 hover:bg-slate-800'
                      }`}
                    >
                      Apply
                    </button>
                  </div>
                  {firstRidePromoAlreadyUsed && (
                    <p className="text-[10px] font-bold text-cyan-400 bg-[#0d1424] px-2 py-1 rounded-lg border border-blue-800/70 mt-1">
                      Your first-ride 50% off offer has already been used.
                    </p>
                  )}
                </div>
              </div>

              {rentalSubmitError && (
                <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-2xl text-xs text-rose-300 font-bold flex items-center gap-2">
                  <span>{rentalSubmitError}</span>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmittingRental}
                  onClick={handleConfirmRentalReservation}
                  className={`w-full py-4 rounded-2xl text-white font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                    isSubmittingRental 
                      ? 'bg-emerald-400 cursor-not-allowed' 
                      : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99]'
                  }`}
                >
                  {isSubmittingRental ? (
                    <>
                      <span>Submitting Rental Reservation...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm Self-Drive Rental Reservation (Pay Advance ₹{rentalFare.advanceAmount})</span>
                    </>
                  )}
                </button>
                <p className="text-center text-[11px] text-slate-400">
                  * Clicking confirm pays the required <strong>Advance Amount of ₹{rentalFare.advanceAmount}</strong>. Your reservation will be submitted under <strong>Pending Approval</strong>. Remaining balance of <strong>₹{rentalFare.remainingAmount}</strong> is paid after completing the rental and returning the vehicle.
                </p>
              </div>
            </div>
          )}

        </div>
      )}

      {/* POPUP 1: VEHICLE UNDER MAINTENANCE (REQUIREMENT 2) */}
      {maintenancePopup.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#14171f] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#262b36] text-center space-y-4 text-slate-100">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-[#0d1424] px-2.5 py-0.5 rounded-full border border-blue-800/70">
                Maintenance Notice
              </span>
              <h3 className="text-xl font-black text-slate-100 mt-2">Vehicle Under Maintenance</h3>
            </div>
            <div className="text-xs text-slate-300 leading-relaxed space-y-3 font-normal text-left sm:text-center">
              <p>This vehicle is currently under maintenance.</p>
              <p>
                We expect it to be available again on{' '}
                <strong className="text-cyan-400 font-bold">{maintenancePopup.expectedDate}</strong>.
              </p>
              <p className="text-slate-300">
                Thank you for your patience. We appreciate your understanding and look forward to serving you.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMaintenancePopup({ isOpen: false })}
                className="flex-1 py-3 rounded-xl bg-[#002C6C] hover:bg-[#001f4d] text-white font-bold text-xs transition-all shadow-sm"
              >
                OK
              </button>
              <button
                type="button"
                onClick={() => setMaintenancePopup({ isOpen: false })}
                className="px-5 py-3 rounded-xl bg-[#1c202a] hover:bg-[#252b38] text-slate-300 font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 2: VEHICLE UNAVAILABLE / DOUBLE BOOKING PREVENTED (REQUIREMENT 7) */}
      {unavailablePopup.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#14171f] rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-rose-900/60 text-center space-y-3.5 text-slate-100">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-rose-300 bg-rose-950/50 px-2.5 py-0.5 rounded-full border border-rose-800/80">
                Overlap Prevented
              </span>
              <h3 className="text-lg font-black text-slate-100 mt-1.5">Vehicle Unavailable</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
              Sorry, this vehicle is already booked for your selected dates. Please select another vehicle or choose different rental dates.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1.5">
              <button
                type="button"
                onClick={() => {
                  setUnavailablePopup({ isOpen: false });
                  setSelectedRentalVehicleId('');
                  const el = document.getElementById('rental-fleet-grid');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-bold text-xs shadow-xs transition-all"
              >
                View Other Available Vehicles
              </button>
              <button
                type="button"
                onClick={() => setUnavailablePopup({ isOpen: false })}
                className="px-4 py-2.5 rounded-xl bg-[#1c202a] hover:bg-[#252b38] text-slate-300 font-bold text-xs"
              >
                Choose Different Dates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRIVER POPUP MODAL (FAVOURITE VS SPECIFIC: BUSY, OFFLINE, DECLINED) */}
      {driverModalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#14171f] rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-[#262b36] text-center space-y-3.5 text-slate-100">
            <div>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                driverModalState.type === 'declined' ? 'bg-rose-950/50 text-rose-300 border-rose-800/80' : 'bg-[#0d1424] text-cyan-400 border-blue-800/70'
              }`}>
                {driverModalState.type === 'declined' ? 'Request Declined' : 'Driver Unavailable'}
              </span>
              <h3 className="text-lg font-black text-slate-100 mt-1.5">
                {driverModalState.type === 'declined' ? 'Driver Declined' : (driverModalState.type === 'offline' ? 'Driver Offline' : 'Driver Busy')}
              </h3>
            </div>
            <p className="text-sm text-slate-200 font-bold leading-relaxed">
              {driverModalState.message}
            </p>
            {driverModalState.bookingRef && (
              <p className="text-[11px] text-slate-400 font-medium">
                Booking Reference: <span className="font-mono font-bold text-slate-300">{driverModalState.bookingRef}</span>
              </p>
            )}

            {driverModalState.mode === 'favourite' ? (
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (driverModalState.bookingId) {
                      dismissedDeclinedBookingIds.current.add(driverModalState.bookingId);
                    }
                    setDriverModalState({ isOpen: false, mode: 'specific', type: 'busy', message: '' });
                    setDriverSelectionMode('specific');
                    setHasSearchedDrivers(true);
                    setTimeout(() => {
                      document.getElementById('driver-selection-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 60);
                  }}
                  className="flex-1 py-2.5 rounded-xl border-2 border-[#002C6C] text-cyan-400 hover:bg-[#152238] font-black text-xs transition-all cursor-pointer"
                >
                  Pick a Driver
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (driverModalState.bookingId) {
                      dismissedDeclinedBookingIds.current.add(driverModalState.bookingId);
                    }
                    setDriverModalState({ isOpen: false, mode: 'favourite', type: 'busy', message: '' });
                    handleConfirmRandomBroadcast();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-black text-xs shadow-md transition-all cursor-pointer"
                >
                  Accept Random Drivers
                </button>
              </div>
            ) : (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (driverModalState.bookingId) {
                      dismissedDeclinedBookingIds.current.add(driverModalState.bookingId);
                    }
                    setDriverModalState({ isOpen: false, mode: 'specific', type: 'busy', message: '' });
                    setDriverSelectionMode('specific');
                    setHasSearchedDrivers(true);
                    setTimeout(() => {
                      document.getElementById('driver-selection-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 60);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-black text-xs shadow-md transition-all cursor-pointer"
                >
                  Select Another Driver
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (driverModalState.bookingId) {
                  dismissedDeclinedBookingIds.current.add(driverModalState.bookingId);
                }
                if (activeCreatedBooking && (activeCreatedBooking.status === 'declined' || (activeCreatedBooking.status === 'cancelled' && activeCreatedBooking.cancelledBy === 'driver'))) {
                  setActiveCreatedBooking(null);
                }
                setDriverModalState({ isOpen: false, mode: 'specific', type: 'busy', message: '' });
              }}
              className="w-full py-2 rounded-xl bg-[#1c202a] hover:bg-[#252b38] text-slate-300 font-bold text-xs border border-[#262b36] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* RENTAL RESERVATION CONFIRMED MODAL (REQUIREMENT 1) */}
      {rentalSuccessModal.isOpen && rentalSuccessModal.booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#14171f] rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-[#262b36] space-y-3.5 text-slate-100">
            <div className="text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-700/80">
                Reservation Submitted
              </span>
              <h3 className="text-2xl font-black text-slate-100 mt-2">
                Rental Reservation Submitted!
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Ref Code: <span className="font-mono font-bold text-slate-100">{rentalSuccessModal.booking.refCode}</span>
              </p>
            </div>

            <div className="p-4 bg-[#0d1017] rounded-2xl border border-[#262b36] space-y-2 text-xs text-slate-200">
              <div className="flex justify-between items-center py-1 border-b border-[#262b36]">
                <span className="text-slate-300">Vehicle:</span>
                <span className="font-bold text-slate-100">{rentalSuccessModal.booking.rentalVehicleModel || 'Self-Drive Vehicle'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#262b36]">
                <span className="text-slate-300">Rental Period:</span>
                <span className="font-semibold text-slate-100">
                  {rentalSuccessModal.booking.scheduledDate} to {rentalSuccessModal.booking.returnDate || rentalSuccessModal.booking.scheduledDate} ({rentalSuccessModal.booking.rentalDays || 1} day(s))
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#262b36]">
                <span className="text-slate-300">Advance Amount Paid:</span>
                <span className="font-black text-emerald-300">₹{rentalSuccessModal.booking.advanceAmount || 0} (PAID ✓)</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#262b36]">
                <span className="text-slate-300">Remaining Balance Due:</span>
                <span className="font-bold text-slate-200">₹{rentalSuccessModal.booking.remainingAmount || 0} (Due after return)</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-300">Booking Status:</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#0d1424] text-cyan-400 border border-blue-800/70">
                  Pending Approval
                </span>
              </div>
            </div>

            <div className="p-3 bg-[#0d1424] border border-blue-800/70 rounded-2xl text-xs text-cyan-300 flex items-start gap-2">
              <div>
                <strong>Admin Notified:</strong> DriveC fleet administration has received your reservation request and will approve it shortly.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {onNavigateToPortal && (
                <button
                  type="button"
                  onClick={() => {
                    setRentalSuccessModal({ isOpen: false });
                    onNavigateToPortal('user');
                  }}
                  className="flex-1 py-3.5 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-black text-xs shadow-md transition-all text-center"
                >
                  View in Rental History
                </button>
              )}
              <button
                type="button"
                onClick={() => setRentalSuccessModal({ isOpen: false })}
                className="px-5 py-3.5 rounded-xl bg-[#1c202a] hover:bg-[#252b38] text-slate-300 font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP BOOKING SUCCESS MODAL */}
      {whatsAppSuccessModal.isOpen && whatsAppSuccessModal.booking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-[#14171f] rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-[#262b36] space-y-4 text-slate-100">
            <div className="text-center space-y-1">
              <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                whatsAppSuccessModal.isPendingSend
                  ? 'bg-[#0d1424] text-cyan-400 border border-blue-800/70'
                  : 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/80'
              }`}>
                {whatsAppSuccessModal.isPendingSend ? '⏳ Send WhatsApp Message to Confirm' : '💬 WhatsApp Booking Received & Dispatched'}
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-100">
                {whatsAppSuccessModal.isPendingSend ? 'Send WhatsApp Message to Book' : 'Driver Notified in Real-Time!'}
              </h3>
              <p className="text-xs text-slate-300">
                Ref Code: <span className="font-mono font-bold text-slate-100">{whatsAppSuccessModal.booking.refCode}</span>
              </p>
            </div>

            {/* Explanation banner when pending send */}
            {whatsAppSuccessModal.isPendingSend ? (
              <div className="p-3 bg-[#0d1424] rounded-xl border border-blue-800/70 text-xs text-cyan-400 space-y-1 text-left">
                <p className="font-bold text-slate-100">
                  ℹ️ Booking happens only after message is sent & received:
                </p>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  Please tap <strong>Open WhatsApp</strong> below and send the pre-filled message. Once your message is received on DriveC's receiver side, your booking is registered and dispatched to drivers.
                </p>
                <div className="text-[11px] leading-relaxed text-cyan-400 pt-1 border-t border-blue-800/70 space-y-0.5">
                  <p>• If your favourite driver is online & free ➔ booking request shows on their page.</p>
                  <p>• If that driver is offline or on another ride ➔ request goes to other online drivers.</p>
                </div>
              </div>
            ) : null}

            {/* Prominent Ride-Start OTP Box */}
            <div className="p-4 bg-emerald-950/50 rounded-2xl border-2 border-emerald-700/80 text-center space-y-1">
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">
                🔑 Passenger Ride-Start OTP:
              </span>
              <div className="font-mono font-black text-3xl tracking-widest text-emerald-300">
                {whatsAppSuccessModal.booking.rideStartOtp}
              </div>
              <p className="text-[11px] text-emerald-200 font-medium">
                Provide this 4-digit code to your driver upon arrival to start your ride.
              </p>
            </div>

            <div className="p-3.5 bg-[#0d1017] rounded-2xl border border-[#262b36] space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-[#262b36]">
                <span className="text-slate-300">Driver Assignment:</span>
                <span className="font-bold text-slate-100">
                  {whatsAppSuccessModal.booking.driverName
                    ? `Assigned to ${whatsAppSuccessModal.booking.driverName}`
                    : (whatsAppSuccessModal.isPendingSend
                        ? (whatsAppSuccessModal.booking.requestedDriverName
                            ? `Target: ${whatsAppSuccessModal.booking.requestedDriverName} (Fallback to Fleet if Busy/Offline)`
                            : 'Will Dispatch to Online Fleet')
                        : 'Dispatched to Online Fleet')}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#262b36]">
                <span className="text-slate-300">Route:</span>
                <span className="font-semibold text-slate-100 truncate max-w-[240px]">
                  {whatsAppSuccessModal.booking.pickupLocation} ➔ {whatsAppSuccessModal.booking.destinationLocation}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-300">Total Tariff:</span>
                <span className="font-black text-cyan-400">₹{whatsAppSuccessModal.booking.fareBreakdown.totalFare}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              {whatsAppSuccessModal.whatsappUrl && (
                <button
                  type="button"
                  onClick={() => window.open(whatsAppSuccessModal.whatsappUrl, '_blank', 'noopener,noreferrer')}
                  className="flex-1 py-3 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Open WhatsApp</span>
                </button>
              )}
              {whatsAppSuccessModal.isPendingSend && (
                <button
                  type="button"
                  onClick={handleSimulateWhatsAppReceive}
                  disabled={isSimulatingSend}
                  className="flex-1 py-3 rounded-xl bg-[#002C6C] hover:bg-[#001f4d] disabled:opacity-50 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Simulates webhook delivery of the sent WhatsApp message to receiver side"
                >
                  {isSimulatingSend ? (
                    <>
                      <span>Receiving...</span>
                    </>
                  ) : (
                    <span>⚡ Confirm Message Sent</span>
                  )}
                </button>
              )}
              {!whatsAppSuccessModal.isPendingSend && onNavigateToPortal && (
                <button
                  type="button"
                  onClick={() => {
                    setWhatsAppSuccessModal({ isOpen: false });
                    onNavigateToPortal('user');
                  }}
                  className="flex-1 py-3 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-black text-xs shadow-md transition-all text-center cursor-pointer"
                >
                  View in My Bookings
                </button>
              )}
              <button
                type="button"
                onClick={() => setWhatsAppSuccessModal({ isOpen: false })}
                className="px-4 py-3 rounded-xl bg-[#1c202a] hover:bg-[#252b38] text-slate-300 font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RIDE COMPLETION PAYMENT MODAL (TRIGGERED AFTER DESTINATION REACHED) */}
      {ridePaymentModal.isOpen && ridePaymentModal.booking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-[#14171f] rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-[#262b36] space-y-4 text-slate-100">
            {ridePaymentModal.isSuccess ? (
              <div className="text-center space-y-3 py-4">
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/70 text-emerald-300 border border-emerald-700/80">
                  ✓ Payment Completed
                </span>
                <h3 className="text-xl font-black text-slate-100">
                  Payment Received Successfully!
                </h3>
                <p className="text-xs text-slate-300 max-w-xs mx-auto">
                  ₹{ridePaymentModal.booking.fareBreakdown.totalFare} has been received via {ridePaymentModal.paymentMethod.toUpperCase()}. Driver salary crediting has been unlocked.
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRidePaymentModal(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                  >
                    Close
                  </button>
                  {onNavigateToPortal && (
                    <button
                      type="button"
                      onClick={() => {
                        setRidePaymentModal(prev => ({ ...prev, isOpen: false }));
                        onNavigateToPortal('user');
                      }}
                      className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-[#002C6C] text-white font-bold text-xs transition-all cursor-pointer"
                    >
                      View in My Bookings
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="text-center space-y-1">
                  <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/70 text-emerald-300 border border-emerald-700/80">
                    🏁 Destination Reached • Payment Due
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-slate-100">
                    Pay for DriveC Ride
                  </h3>
                  <p className="text-xs text-slate-300">
                    Ref Code: <span className="font-mono font-bold text-slate-100">{ridePaymentModal.booking.refCode}</span>
                  </p>
                </div>

                {/* Prominent Payable Fare Box (WhatsApp style) */}
                <div className="p-4 bg-emerald-950/50 rounded-2xl border-2 border-emerald-700/80 text-center space-y-1">
                  <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">
                    💳 Total Payable Fare:
                  </span>
                  <div className="font-mono font-black text-3xl tracking-tight text-emerald-300">
                    ₹{ridePaymentModal.booking.fareBreakdown.totalFare}
                  </div>
                  <p className="text-[11px] text-emerald-200 font-medium">
                    Regulated exact fare • No hidden or surge fees
                  </p>
                </div>

                {/* Ride & Tariff Summary */}
                <div className="p-3.5 bg-[#0d1017] rounded-2xl border border-[#262b36] space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-[#262b36]">
                    <span className="text-slate-300">Driver:</span>
                    <span className="font-bold text-slate-100">
                      {ridePaymentModal.booking.driverName || 'DriveC Chauffeur'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#262b36]">
                    <span className="text-slate-300">Route:</span>
                    <span className="font-semibold text-slate-100 truncate max-w-[240px]">
                      {ridePaymentModal.booking.pickupLocation} ➔ {ridePaymentModal.booking.destinationLocation}
                    </span>
                  </div>
                  <div className="space-y-1 pt-1 text-slate-300">
                    <div className="flex justify-between">
                      <span>Base Fare:</span>
                      <span className="font-mono text-slate-200">
                        ₹{(ridePaymentModal.booking.fareBreakdown as any).baseFare ?? Math.round(ridePaymentModal.booking.fareBreakdown.totalFare * 0.85)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>GST (5%):</span>
                      <span className="font-mono text-slate-200">
                        ₹{(ridePaymentModal.booking.fareBreakdown as any).gstAmount ?? (ridePaymentModal.booking.fareBreakdown as any).serviceTaxGST ?? Math.round(ridePaymentModal.booking.fareBreakdown.totalFare * 0.05 / 1.05)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Platform Convenience Fee:</span>
                      <span className="font-mono text-slate-200">
                        ₹{(ridePaymentModal.booking.fareBreakdown as any).platformFee ?? 25}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">Choose Payment Method:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['cash', 'card', 'upi'] as const).map(method => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => {
                          setCashHandedConfirmed(false);
                          setPaymentError('');
                          setRidePaymentModal(prev => ({ ...prev, paymentMethod: method }));
                        }}
                        className={`py-2.5 px-2 rounded-xl border-2 font-bold text-xs flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          ridePaymentModal.paymentMethod === method
                            ? 'border-[#002C6C] bg-[#002C6C] text-white shadow-sm'
                            : 'border-[#262b36] bg-[#0d1017] text-slate-300 hover:border-[#262b36]'
                        }`}
                      >
                        <span className="uppercase text-[11px] font-black">{method}</span>
                      </button>
                    ))}
                  </div>

                  {ridePaymentModal.paymentMethod === 'cash' && (
                    <div className="p-3 bg-emerald-950/50 border border-emerald-700/80 rounded-xl text-xs space-y-2.5">
                      <div className="text-center space-y-1">
                        <span className="text-[11px] font-bold text-emerald-200 block">Direct Cash to Driver</span>
                        <span className="text-[10px] text-emerald-300">
                          Please hand ₹{ridePaymentModal.booking.fareBreakdown.totalFare} directly to your driver, then confirm below.
                        </span>
                      </div>
                      <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#0d1017]/80 border border-emerald-700/60 cursor-pointer text-left">
                        <input
                          type="checkbox"
                          checked={cashHandedConfirmed}
                          onChange={(e) => {
                            setCashHandedConfirmed(e.target.checked);
                            setPaymentError('');
                          }}
                          className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-[11px] font-semibold text-emerald-100 leading-snug">
                          I confirm that I have handed ₹{ridePaymentModal.booking.fareBreakdown.totalFare} in cash to the driver.
                        </span>
                      </label>
                    </div>
                  )}

                  {ridePaymentModal.paymentMethod === 'card' && (
                    <div className="p-3 bg-[#0d1424] border border-blue-800/70 rounded-xl text-center text-xs space-y-1">
                      <span className="text-[11px] font-bold text-cyan-300 block">Credit / Debit Card Payment</span>
                      <span className="text-[10px] text-cyan-300/80">
                        Pay ₹{ridePaymentModal.booking.fareBreakdown.totalFare} securely via Visa, Mastercard, or RuPay
                      </span>
                    </div>
                  )}

                  {ridePaymentModal.paymentMethod === 'upi' && (
                    <div className="p-3 bg-[#0d1424] border border-blue-800/70 rounded-xl text-center text-xs space-y-1">
                      <span className="text-[11px] font-bold text-cyan-300 block">UPI ID: drivec@icici</span>
                      <span className="text-[10px] text-cyan-300/80">
                        Pay ₹{ridePaymentModal.booking.fareBreakdown.totalFare} with GPay, PhonePe, Paytm, or BHIM
                      </span>
                    </div>
                  )}

                  {paymentError && (
                    <div className="p-2.5 bg-rose-950/60 border border-rose-700/80 rounded-xl text-[11px] font-semibold text-rose-200">
                      {paymentError}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isSubmittingPayment || (ridePaymentModal.paymentMethod === 'cash' && !cashHandedConfirmed)}
                    onClick={async () => {
                      const b = ridePaymentModal.booking;
                      const method = ridePaymentModal.paymentMethod;
                      if (!b) return;
                      if (method === 'cash' && !cashHandedConfirmed) return;
                      setIsSubmittingPayment(true);
                      setPaymentError('');
                      try {
                        const options = method === 'cash' ? { cashHandedConfirmed: true } : undefined;
                        if (onPassengerPayment) {
                          await onPassengerPayment(b.id, method, options);
                        } else {
                          const res = await fetch(`/api/bookings/${b.id}/status`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              passengerPaid: true,
                              paymentMethod: method,
                              ...(options || {}),
                            }),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (!res.ok) {
                            throw new Error(data.error || data.message || 'Payment confirmation failed');
                          }
                        }
                        setActiveCreatedBooking(prev => prev ? {
                          ...prev,
                          passengerPaid: true,
                          paymentStatus: 'completed',
                          paymentMethod: method,
                          status: 'completed',
                        } : null);
                        setRidePaymentModal(prev => ({ ...prev, isSuccess: true }));
                      } catch (err: any) {
                        console.error('Payment failed:', err);
                        setPaymentError(err?.message || 'Failed to confirm payment.');
                      } finally {
                        setIsSubmittingPayment(false);
                      }
                    }}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmittingPayment ? (
                      <span>Processing Payment...</span>
                    ) : ridePaymentModal.paymentMethod === 'cash' ? (
                      <span>Confirm Cash Handed (₹{ridePaymentModal.booking.fareBreakdown.totalFare})</span>
                    ) : (
                      <span>Pay ₹{ridePaymentModal.booking.fareBreakdown.totalFare} via {ridePaymentModal.paymentMethod.toUpperCase()}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (ridePaymentModal.booking) {
                        dismissedPaymentBookingIds.current.add(ridePaymentModal.booking.id);
                      }
                      setRidePaymentModal(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="px-4 py-3 rounded-xl bg-[#1c202a] hover:bg-[#252b38] text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ALREADY BOOKED CONFIRMATION MODAL */}
      {alreadyBookedModal.isOpen && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-[#14171f] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-[#262b36] space-y-4 text-slate-100">
            <div className="space-y-1.5 text-center">
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-950/70 text-amber-300 border border-amber-700/80">
                Active Booking Exists
              </span>
              <h3 className="text-lg font-black text-slate-100">
                Already Booked
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                You have already booked. Do you want to cancel the ride and look for another driver?
              </p>
              {alreadyBookedModal.booking && (
                <div className="mt-2 p-2.5 bg-[#0d1017] rounded-xl border border-[#262b36] text-[11px] text-slate-300 flex items-center justify-between">
                  <span>Ref: <strong className="font-mono text-white">{alreadyBookedModal.booking.refCode}</strong></span>
                  <span className="uppercase font-bold text-cyan-300">{alreadyBookedModal.booking.status.replace('_', ' ')}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                disabled={isCancellingExistingBooking}
                onClick={async () => {
                  const targetBooking = alreadyBookedModal.booking || activeCreatedBooking;
                  if (!targetBooking) {
                    setAlreadyBookedModal({ isOpen: false, booking: null });
                    setActiveCreatedBooking(null);
                    return;
                  }
                  setIsCancellingExistingBooking(true);
                  try {
                    if (onCancelBooking) {
                      await onCancelBooking(targetBooking.id);
                    } else {
                      await fetch(`/api/bookings/${targetBooking.id}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          status: 'cancelled',
                          cancelledBy: 'customer',
                          cancellationReason: 'Customer cancelled to look for another driver',
                        }),
                      });
                    }
                    setActiveCreatedBooking(null);
                    setAlreadyBookedModal({ isOpen: false, booking: null });
                  } catch (err) {
                    console.error('Failed to cancel existing booking:', err);
                  } finally {
                    setIsCancellingExistingBooking(false);
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-xs shadow-md transition-all cursor-pointer"
              >
                {isCancellingExistingBooking ? 'Cancelling...' : 'Cancel Ride'}
              </button>
              <button
                type="button"
                disabled={isCancellingExistingBooking}
                onClick={() => setAlreadyBookedModal({ isOpen: false, booking: null })}
                className="flex-1 py-3 rounded-xl bg-[#002C6C] hover:bg-[#001f4d] text-white font-black text-xs shadow-md transition-all cursor-pointer"
              >
                Keep Current Booking
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
