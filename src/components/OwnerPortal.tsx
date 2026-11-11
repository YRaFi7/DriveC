"use client";

import React, { useState } from 'react';
import { Language, UserRole, RentalVehicle, Booking, VehicleCategory, TransmissionType, FuelType, Review } from '../types';
import { translations } from '../lib/translations';

interface OwnerPortalProps {
  language: Language;
  currentUser: {
    id: string;
    role: UserRole;
    name: string;
    phone: string;
    email: string;
  };
  rentalVehicles: RentalVehicle[];
  bookings: Booking[];
  reviews?: Review[];
  onAddVehicle: (vehicle: RentalVehicle) => void;
  onToggleVehicleAvailability: (vehicleId: string, isAvailable: boolean) => void;
  onCompleteHandover: (bookingId: string, handover: any) => void;
  onCompleteReturn: (bookingId: string, returnChecklist: any) => void;
  onOpenGuestWarning: () => void;
}

export const OwnerPortal: React.FC<OwnerPortalProps> = ({
  language,
  currentUser,
  rentalVehicles,
  bookings,
  reviews = [],
  onAddVehicle,
  onToggleVehicleAvailability,
  onCompleteHandover,
  onCompleteReturn,
  onOpenGuestWarning,
}) => {
  const t = translations[language];
  const isGuest = currentUser.role === 'guest';

  const [activeTab, setActiveTab] = useState<'listings' | 'rentals' | 'earnings' | 'reviews'>('listings');
  const [showAddModal, setShowAddModal] = useState(false);

  // New vehicle form state
  const [model, setModel] = useState('');
  const [brand, setBrand] = useState('Hyundai');
  const [category, setCategory] = useState<VehicleCategory>('suv');
  const [transmission, setTransmission] = useState<TransmissionType>('automatic');
  const [fuel, setFuel] = useState<FuelType>('petrol');
  const [seats, setSeats] = useState(5);
  const [luggage, setLuggage] = useState('3 Large Bags');
  const [licensePlate, setLicensePlate] = useState('KL-07-');
  const [dailyRate, setDailyRate] = useState(2000);
  const [securityDeposit, setSecurityDeposit] = useState(3000);
  const [location, setLocation] = useState('Kakkanad Infopark, Kochi');

  // Handover checklist modal
  const [activeHandoverBooking, setActiveHandoverBooking] = useState<Booking | null>(null);
  const [handoverOdometer, setHandoverOdometer] = useState(24500);
  const [handoverFuel, setHandoverFuel] = useState(100);
  const [handoverCondition, setHandoverCondition] = useState<'excellent' | 'good' | 'minor_scratches'>('excellent');
  const [handoverCleanliness, setHandoverCleanliness] = useState<'clean' | 'moderate'>('clean');
  const [handoverNotes, setHandoverNotes] = useState('');

  // Return checklist modal
  const [activeReturnBooking, setActiveReturnBooking] = useState<Booking | null>(null);
  const [returnOdometer, setReturnOdometer] = useState(24750);
  const [returnFuel, setReturnFuel] = useState(90);
  const [returnDepositAction, setReturnDepositAction] = useState<'full_refund' | 'deduct_fuel' | 'deduct_damage'>('full_refund');

  if (isGuest) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-amber-950/50 border border-amber-700/70 rounded-3xl p-8 sm:p-12 space-y-4 shadow-sm">
          <h3 className="text-2xl font-black text-amber-200">Vehicle Owner Terminal Protected</h3>
          <p className="text-xs text-amber-200 max-w-md mx-auto">
            Please register or sign in as a Vehicle Owner to list self-drive rental vehicles, manage handovers, and track rental earnings in Kochi.
          </p>
          <button
            onClick={onOpenGuestWarning}
            className="px-6 py-3 rounded-xl bg-[#002C6C] text-white font-bold text-xs"
          >
            Register as Vehicle Owner
          </button>
        </div>
      </div>
    );
  }

  // Filter this owner's vehicles
  const ownerVehicles = rentalVehicles.filter(v => v.ownerId === currentUser.id || v.ownerPhone === currentUser.phone || currentUser.role === 'admin');
  
  // Filter rental bookings for owner's vehicles
  const ownerVehicleIds = ownerVehicles.map(v => v.id);
  const ownerBookings = bookings.filter(b => 
    b.bookingType === 'self_drive_rental' || 
    (b.rentalVehicleId && ownerVehicleIds.includes(b.rentalVehicleId))
  );

  const completedRentals = ownerBookings.filter(b => b.status === 'completed');
  const totalRentalEarnings = completedRentals.reduce((sum, b) => {
    const gross = (b.fareBreakdown.rentalDailyRate || 1800) * (b.rentalDays || 1);
    return sum + Math.round(gross * 0.85); // 85% to vehicle owner, 15% platform management
  }, 0);

  const handleCreateVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    const newVehicle: RentalVehicle = {
      id: 'rv-' + Date.now(),
      ownerId: currentUser.id,
      ownerName: currentUser.name,
      ownerPhone: currentUser.phone,
      model,
      brand,
      category,
      transmission,
      fuel,
      seats,
      luggageCapacity: luggage,
      licensePlate,
      year: 2024,
      dailyRate,
      hourlyRate: Math.round(dailyRate / 10),
      advanceAmount: 1000,
      securityDeposit,
      location,
      isAvailable: true,
      approvalStatus: 'approved',
      features: ['Air Conditioning', 'Power Steering', 'Reverse Sensors', 'Fastag Active'],
      totalRentals: 0,
      ratingAverage: 5.0,
      ratingCount: 0,
      createdAt: new Date().toISOString()
    };
    onAddVehicle(newVehicle);
    setShowAddModal(false);
    setModel('');
  };

  const handleConfirmHandover = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHandoverBooking) return;
    onCompleteHandover(activeHandoverBooking.id, {
      odometerKm: handoverOdometer,
      fuelPercentage: handoverFuel,
      exteriorCondition: handoverCondition,
      cleanliness: handoverCleanliness,
      toolsPresent: true,
      spareTyrePresent: true,
      documentsVerified: true,
      notes: handoverNotes,
      completedAt: new Date().toISOString(),
      signedByCustomer: true,
    });
    setActiveHandoverBooking(null);
  };

  const handleConfirmReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReturnBooking) return;
    onCompleteReturn(activeReturnBooking.id, {
      odometerKm: returnOdometer,
      fuelPercentage: returnFuel,
      exteriorCondition: 'good',
      cleanliness: 'clean',
      toolsPresent: true,
      spareTyrePresent: true,
      documentsVerified: true,
      notes: `Returned with deposit status: ${returnDepositAction}`,
      completedAt: new Date().toISOString(),
      signedByCustomer: true,
    });
    setActiveReturnBooking(null);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-in fade-in">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-cyan-950 to-[#002C6C] text-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl border border-white/10">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-500/30 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-700/80">
              DriveC Vehicle Owner Terminal
            </span>
            <span className="text-xs text-cyan-200">Kochi Self-Drive Car Fleet</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black">{currentUser.name}</h2>
          <div className="flex flex-wrap gap-4 text-xs text-slate-300">
            <span>Contact: <strong>{currentUser.phone}</strong></span>
            <span>Registered Vehicles: <strong>{ownerVehicles.length}</strong></span>
            <span>Active Rentals: <strong>{ownerBookings.filter(b => b.status === 'in_progress' || b.status === 'accepted').length}</strong></span>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-6 py-3.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 shrink-0"
        >
          <span>List New Rental Car</span>
        </button>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#14171f] p-5 rounded-3xl border border-[#262b36] shadow-xs text-slate-100">
          <span className="text-xs font-semibold text-slate-400">Listed Rental Cars</span>
          <p className="text-2xl font-black text-cyan-400 mt-1">{ownerVehicles.length}</p>
          <span className="text-[10px] text-emerald-600 font-medium">Approved Fleet</span>
        </div>
        <div className="bg-[#14171f] p-5 rounded-3xl border border-[#262b36] shadow-xs text-slate-100">
          <span className="text-xs font-semibold text-slate-400">Active Bookings</span>
          <p className="text-2xl font-black text-cyan-400 mt-1">
            {ownerBookings.filter(b => b.status === 'pending' || b.status === 'accepted' || b.status === 'in_progress').length}
          </p>
          <span className="text-[10px] text-slate-400">Reserved & on road</span>
        </div>
        <div className="bg-[#14171f] p-5 rounded-3xl border border-[#262b36] shadow-xs text-slate-100">
          <span className="text-xs font-semibold text-slate-400">Total Completed Rentals</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{completedRentals.length}</p>
          <span className="text-[10px] text-slate-400">Inspections signed</span>
        </div>
        <div className="bg-[#14171f] p-5 rounded-3xl border border-[#262b36] shadow-xs text-slate-100">
          <span className="text-xs font-semibold text-slate-400">Rental Net Earnings</span>
          <p className="text-2xl font-black text-emerald-300 mt-1">₹{totalRentalEarnings}</p>
          <span className="text-[10px] text-emerald-600">85% Net Owner Share</span>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex border-b border-[#262b36] gap-2 text-xs font-bold text-slate-300">
        <button
          onClick={() => setActiveTab('listings')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'listings' ? 'border-[#002C6C] text-cyan-400' : 'border-transparent hover:text-slate-100'
          }`}
        >
          <span>My Rental Fleet ({ownerVehicles.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('rentals')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'rentals' ? 'border-[#002C6C] text-cyan-400' : 'border-transparent hover:text-slate-100'
          }`}
        >
          <span>Rental Reservations & Handovers ({ownerBookings.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('earnings')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'earnings' ? 'border-[#002C6C] text-cyan-400' : 'border-transparent hover:text-slate-100'
          }`}
        >
          <span>Owner Payouts & Deposits</span>
        </button>
        <button
          onClick={() => setActiveTab('reviews')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'reviews' ? 'border-[#002C6C] text-cyan-400' : 'border-transparent hover:text-slate-100'
          }`}
        >
          <span>Customer Reviews & Admin Replies ({reviews.length})</span>
        </button>
      </div>

      {/* TAB 1: VEHICLE LISTINGS */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-100 text-sm">Self-Drive Cars in Your Portfolio</h3>
            <span className="text-xs text-slate-400">{ownerVehicles.length} Vehicles</span>
          </div>

          {ownerVehicles.length === 0 ? (
            <div className="bg-[#14171f] border border-[#262b36] rounded-3xl p-12 text-center space-y-3 text-slate-200">
              <h4 className="font-bold text-slate-100 text-sm">No vehicles listed yet</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                List your car to start earning passive rental income from verified DriveC customers in Kochi.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-5 py-2.5 rounded-xl bg-[#002C6C] text-white font-bold text-xs"
              >
                List Your First Vehicle
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {ownerVehicles.map((v) => (
                <div key={v.id} className="bg-[#14171f] rounded-3xl p-6 border border-[#262b36] shadow-xs flex flex-col justify-between space-y-4 text-slate-100">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 bg-[#0d1424] px-2 py-0.5 rounded">
                          {v.category}
                        </span>
                        <h4 className="font-bold text-slate-100 text-base mt-1">{v.model}</h4>
                        <p className="text-xs font-mono text-slate-400">{v.licensePlate}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        v.isAvailable ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-700/80' : 'bg-[#1c202a] text-slate-300'
                      }`}>
                        {v.isAvailable ? '🟢 Available' : '🔴 Reserved/Blocked'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-[#0d1017] p-3 rounded-2xl border border-[#262b36]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Transmission</span>
                        <strong className="capitalize text-slate-200">{v.transmission}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Fuel</span>
                        <strong className="capitalize text-slate-200">{v.fuel}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Daily Rate</span>
                        <strong className="text-emerald-300 text-sm">₹{v.dailyRate} / day</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Security Deposit</span>
                        <strong className="text-slate-200">₹{v.securityDeposit}</strong>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-300 space-y-0.5">
                      <p>Depot / Location: <strong>{v.location}</strong></p>
                      <p>Capacity: <strong>{v.seats} Seats • {v.luggageCapacity}</strong></p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#262b36] flex items-center justify-between text-xs">
                    <button
                      onClick={() => onToggleVehicleAvailability(v.id, !v.isAvailable)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                        v.isAvailable 
                          ? 'bg-[#1c202a] hover:bg-[#252b38] text-slate-300' 
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <span>{v.isAvailable ? 'Pause Listing' : 'Make Available'}</span>
                    </button>
                    <span className="text-[11px] font-bold text-amber-600">
                      ★ {v.ratingAverage || '5.0'} ({v.totalRentals} rentals)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RENTAL RESERVATIONS & HANDOVERS */}
      {activeTab === 'rentals' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-100 text-sm">Rental Reservations & Digital Checklists</h3>
            <span className="text-xs text-slate-400">{ownerBookings.length} Total Rentals</span>
          </div>

          {ownerBookings.length === 0 ? (
            <div className="bg-[#14171f] border border-[#262b36] rounded-3xl p-10 text-center text-xs text-slate-400">
              No active rental bookings yet. When customers reserve your self-drive cars, the bookings appear here with handover checklists.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ownerBookings.map((b) => (
                <div key={b.id} className="bg-[#14171f] rounded-3xl p-6 border border-[#262b36] shadow-xs space-y-4 flex flex-col justify-between text-slate-100">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-mono uppercase bg-[#1c202a] text-slate-300 px-2 py-0.5 rounded font-bold">
                          Ref: {b.refCode}
                        </span>
                        <h4 className="font-bold text-slate-100 text-sm mt-1">
                          {b.rentalVehicleModel || 'Self-Drive Vehicle'}
                        </h4>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                        b.status === 'completed' ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-700/80' :
                        b.status === 'in_progress' ? 'bg-[#0d1424] text-cyan-300 border border-blue-800/70' :
                        'bg-amber-950/50 text-amber-300 border border-amber-700/70'
                      }`}>
                        {b.status}
                      </span>
                    </div>

                    <div className="p-3 bg-[#0d1017] rounded-2xl text-xs space-y-1 border border-[#262b36]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Renter:</span>
                        <strong className="text-slate-100">{b.passengerName || b.customerName} ({b.passengerPhone || b.customerPhone})</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Duration:</span>
                        <strong className="text-slate-100">{b.rentalDays || 1} Days • {b.scheduledDate}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Handover Location:</span>
                        <span className="text-slate-200 truncate max-w-xs">{b.pickupLocation}</span>
                      </div>
                      <div className="flex justify-between border-t border-[#262b36] pt-1 mt-1 font-bold">
                        <span>Total Rental Value:</span>
                        <span className="text-cyan-400">₹{b.fareBreakdown.totalFare}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-emerald-300">
                        <span>Security Deposit:</span>
                        <strong>₹{b.fareBreakdown.securityDeposit || 3000} ({b.depositStatus || 'Held in Escrow'})</strong>
                      </div>
                    </div>
                  </div>

                  {/* Handover & Return Action Controls */}
                  <div className="pt-2 border-t border-[#262b36] flex gap-2 text-xs">
                    {(b.status === 'pending' || b.status === 'accepted') && (
                      <button
                        onClick={() => setActiveHandoverBooking(b)}
                        className="flex-1 py-2.5 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-bold flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <span>Perform Handover Checklist</span>
                      </button>
                    )}

                    {b.status === 'in_progress' && (
                      <button
                        onClick={() => setActiveReturnBooking(b)}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <span>Verify Vehicle Return & Release Deposit</span>
                      </button>
                    )}

                    {b.status === 'completed' && (
                      <div className="w-full py-2 bg-emerald-950/50 rounded-xl text-center text-xs font-bold text-emerald-200 border border-emerald-700/80">
                        ✓ Handover & Return Completed • Deposit Settled
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EARNINGS & DEPOSITS */}
      {activeTab === 'earnings' && (
        <div className="bg-[#14171f] rounded-3xl p-6 sm:p-8 border border-[#262b36] shadow-xs space-y-4 text-slate-100">
          <div className="flex justify-between items-center border-b border-[#262b36] pb-4">
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Owner Rental Payout Ledger</h3>
              <p className="text-xs text-slate-400">85% of gross daily rental fee is credited directly to your bank account after safe return inspection.</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Total Disbursed:</span>
              <span className="text-2xl font-black text-emerald-300">₹{totalRentalEarnings}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0d1017] border-b border-[#262b36] text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Ref</th>
                  <th className="p-3">Renter</th>
                  <th className="p-3">Vehicle</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Gross Tariff</th>
                  <th className="p-3">Platform Fee (15%)</th>
                  <th className="p-3">Net Owner Payout (85%)</th>
                  <th className="p-3">Deposit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262b36]">
                {completedRentals.map((b) => {
                  const gross = (b.fareBreakdown.rentalDailyRate || 1800) * (b.rentalDays || 1);
                  const net = Math.round(gross * 0.85);
                  const fee = gross - net;
                  return (
                    <tr key={b.id} className="hover:bg-[#1c202a]">
                      <td className="p-3 font-mono font-bold text-slate-100">{b.refCode}</td>
                      <td className="p-3">{b.passengerName || b.customerName}</td>
                      <td className="p-3">{b.rentalVehicleModel || 'Self-Drive Car'}</td>
                      <td className="p-3">{b.rentalDays || 1} Days</td>
                      <td className="p-3 font-bold text-slate-100">₹{gross}</td>
                      <td className="p-3 text-slate-400">₹{fee}</td>
                      <td className="p-3 font-black text-emerald-300">₹{net}</td>
                      <td className="p-3">
                        <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-700/80">
                          Refunded to Renter
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: REVIEWS & ADMIN REPLIES (Requirement 10: visible to everyone including owner) */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Customer Reviews & Official Admin Responses</h3>
              <p className="text-xs text-slate-400">All transparent reviews submitted across the DriveC Kochi ecosystem.</p>
            </div>
            <span className="text-xs text-slate-400">{reviews.length} Verified Reviews</span>
          </div>

          {reviews.length === 0 ? (
            <div className="bg-[#14171f] border border-[#262b36] rounded-3xl p-12 text-center text-xs text-slate-400 space-y-2">
              <p className="font-bold text-slate-300">No customer reviews recorded yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviews.map((r) => (
                <div key={r.id} className="bg-[#14171f] rounded-3xl p-5 border border-[#262b36] space-y-2 text-xs shadow-xs text-slate-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-100">{r.reviewerName}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">Trip #{r.bookingRef} • Target: {r.targetName}</span>
                    </div>
                    <span className="font-black text-amber-500 text-sm">★ {r.overallRating}.0</span>
                  </div>
                  <p className="text-slate-300 italic">"{r.comment}"</p>
                  
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

      {/* MODAL 1: ADD NEW RENTAL VEHICLE */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-[#14171f] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#262b36] space-y-4 max-h-[90vh] overflow-y-auto text-slate-100">
            <div className="flex justify-between items-start border-b border-[#262b36] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">DriveC Owner Fleet Onboarding</span>
                <h3 className="text-base font-bold text-slate-100">List Car for Self-Drive Rental</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-300">
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Brand *</label>
                  <select
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none bg-[#0d1017] text-slate-100 font-medium"
                  >
                    <option value="Hyundai">Hyundai</option>
                    <option value="Honda">Honda</option>
                    <option value="Maruti">Maruti Suzuki</option>
                    <option value="Toyota">Toyota</option>
                    <option value="Tata">Tata Motors</option>
                    <option value="Kia">Kia</option>
                    <option value="Mahindra">Mahindra</option>
                    <option value="BMW">BMW</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Model Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Creta SX / City ZX / Swift"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as VehicleCategory)}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none bg-[#0d1017] text-slate-100 font-medium"
                  >
                    <option value="hatchback">Hatchback</option>
                    <option value="sedan">Sedan</option>
                    <option value="suv">SUV / MUV</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Transmission *</label>
                  <select
                    value={transmission}
                    onChange={(e) => setTransmission(e.target.value as TransmissionType)}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none bg-[#0d1017] text-slate-100 font-medium"
                  >
                    <option value="manual">Manual</option>
                    <option value="automatic">Automatic</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Fuel Type *</label>
                  <select
                    value={fuel}
                    onChange={(e) => setFuel(e.target.value as FuelType)}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none bg-[#0d1017] text-slate-100 font-medium"
                  >
                    <option value="petrol">Petrol</option>
                    <option value="diesel">Diesel</option>
                    <option value="ev">Electric</option>
                    <option value="cng">CNG</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Kerala Registration (RC) *</label>
                  <input
                    type="text"
                    required
                    placeholder="KL-07-XX-XXXX"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Pickup / Depot Location in Kochi *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kakkanad Infopark / MG Road"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Daily Rental Tariff (₹) *</label>
                  <input
                    type="number"
                    min="800"
                    step="100"
                    required
                    value={dailyRate}
                    onChange={(e) => setDailyRate(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none font-bold text-emerald-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Refundable Deposit (₹) *</label>
                  <input
                    type="number"
                    min="1500"
                    step="500"
                    required
                    value={securityDeposit}
                    onChange={(e) => setSecurityDeposit(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none font-bold"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#0d1424] border border-blue-800/70 rounded-2xl text-[11px] text-cyan-300 space-y-1">
                <span className="font-bold block">Document Verification Requirement:</span>
                <p>All owner-listed vehicles are verified against Kerala MVD registration, comprehensive insurance, and commercial fitness certificates before being visible to customers.</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-[#262b36] text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-bold"
                >
                  Submit Vehicle Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DIGITAL HANDOVER CHECKLIST */}
      {activeHandoverBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#14171f] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#262b36] space-y-4 text-slate-100">
            <div className="flex justify-between items-start border-b border-[#262b36] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Digital Handover Protocol</span>
                <h3 className="text-base font-bold text-slate-100">Vehicle Handover: Ref #{activeHandoverBooking.refCode}</h3>
              </div>
              <button onClick={() => setActiveHandoverBooking(null)} className="text-slate-400 hover:text-slate-300">
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            <form onSubmit={handleConfirmHandover} className="space-y-4 text-xs">
              <div className="p-3 bg-[#0d1017] rounded-2xl border border-[#262b36] space-y-1">
                <p><strong>Customer:</strong> {activeHandoverBooking.passengerName || activeHandoverBooking.customerName}</p>
                <p><strong>Vehicle:</strong> {activeHandoverBooking.rentalVehicleModel}</p>
                <p><strong>Rental Period:</strong> {activeHandoverBooking.rentalDays || 1} Days</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Starting Odometer (Km) *</label>
                  <input
                    type="number"
                    required
                    value={handoverOdometer}
                    onChange={(e) => setHandoverOdometer(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Fuel Gauge (% Full) *</label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    required
                    value={handoverFuel}
                    onChange={(e) => setHandoverFuel(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block font-semibold text-slate-300">Vehicle Cleanliness & Exterior</label>
                <div className="flex gap-2">
                  {(['excellent', 'good', 'minor_scratches'] as const).map(cond => (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => setHandoverCondition(cond)}
                      className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold capitalize ${
                        handoverCondition === cond ? 'bg-[#002C6C] text-white border-[#002C6C]' : 'border-[#262b36]'
                      }`}
                    >
                      {cond.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-emerald-950/50 rounded-2xl text-[11px] text-emerald-200">
                ✓ Valid Driving Licence & Aadhaar Verified<br />
                ✓ Spare Tyre & Tool Kit Verified in Boot<br />
                ✓ Fastag & Pollution Certificate Active
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveHandoverBooking(null)}
                  className="w-1/3 py-2.5 rounded-xl border border-[#262b36] text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Confirm Handover & Release Car
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RETURN & DEPOSIT RELEASE */}
      {activeReturnBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#14171f] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#262b36] space-y-4 text-slate-100">
            <div className="flex justify-between items-start border-b border-[#262b36] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Vehicle Return Inspection</span>
                <h3 className="text-base font-bold text-slate-100">Return Check: #{activeReturnBooking.refCode}</h3>
              </div>
              <button onClick={() => setActiveReturnBooking(null)} className="text-slate-400 hover:text-slate-300">
                <span className="font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            <form onSubmit={handleConfirmReturn} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Ending Odometer (Km) *</label>
                  <input
                    type="number"
                    required
                    value={returnOdometer}
                    onChange={(e) => setReturnOdometer(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Return Fuel (% Full) *</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={returnFuel}
                    onChange={(e) => setReturnFuel(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Security Deposit Settlement *</label>
                <select
                  value={returnDepositAction}
                  onChange={(e) => setReturnDepositAction(e.target.value as any)}
                  className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none bg-[#0d1017] text-slate-100 font-medium"
                >
                  <option value="full_refund">Full Security Deposit Refund (₹{activeReturnBooking.fareBreakdown.securityDeposit || 3000})</option>
                  <option value="deduct_fuel">Deduct Fuel Deficiency (-₹500)</option>
                  <option value="deduct_damage">Hold for Minor Repair Discrepancy (-₹1500)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-1">
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
                  Complete Return & Close Rental
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
