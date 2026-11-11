"use client";

import React, { useState } from 'react';
import { Language, User, Driver, VehicleCategory, RentalVehicle, TransmissionType, FuelType } from '../types';
import { translations } from '../lib/translations';

interface AuthModalProps {
  isOpen: boolean;
  initialMode: 'login' | 'customerRegister' | 'driverRegister' | 'adminRegister';
  onClose: () => void;
  language: Language;
  onRegisterCustomer: (user: User) => void;
  onRegisterDriver: (driver: Driver) => void;
  onLogin: (user: { id: string; role: 'customer' | 'driver' | 'admin'; name: string; phone: string; email: string }) => void;
  registeredCustomers: User[];
  registeredDrivers: Driver[];
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  language,
  onRegisterCustomer,
  onRegisterDriver,
  onLogin,
  registeredCustomers,
  registeredDrivers
}) => {
  const [mode, setMode] = useState<'login' | 'customerRegister' | 'driverRegister' | 'adminRegister'>(initialMode);
  const t = translations[language];

  // Customer Form State
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custCity, setCustCity] = useState('Kochi');
  const [custEmergency, setCustEmergency] = useState('');
  const [custOtpStep, setCustOtpStep] = useState(false);
  const [custEnteredOtp, setCustEnteredOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');

  // Customer Vehicle State (Requirement 1: saved during registration)
  const [custVehicleMakeModel, setCustVehicleMakeModel] = useState('');
  const [custVehicleType, setCustVehicleType] = useState<VehicleCategory>('sedan');
  const [custVehicleTransmission, setCustVehicleTransmission] = useState<TransmissionType>('manual');
  const [custVehicleFuel, setCustVehicleFuel] = useState<FuelType>('petrol');
  const [custVehicleNotes, setCustVehicleNotes] = useState('');

  // Driver Form State (Requirement 3: Capability checkboxes, NO vehicle registration)
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverEmail, setDriverEmail] = useState('');
  const [driverCity, setDriverCity] = useState('Kochi');
  const [driverLicense, setDriverLicense] = useState('');
  const [driverTransmissions, setDriverTransmissions] = useState<TransmissionType[]>(['manual', 'automatic']);
  const [driverFuels, setDriverFuels] = useState<FuelType[]>(['petrol', 'diesel', 'ev']);
  const [driverLicenseDocName, setDriverLicenseDocName] = useState('');
  const [driverSuccessNote, setDriverSuccessNote] = useState('');

  // Admin Form State
  const [adminName, setAdminName] = useState('DriveC Chief Administrator');
  const [adminEmail, setAdminEmail] = useState('admin@drivec.in');
  const [adminKey, setAdminKey] = useState('');

  // Login Form State
  const [loginPhoneOrEmail, setLoginPhoneOrEmail] = useState('');
  const [loginPasswordOrKey, setLoginPasswordOrKey] = useState('');
  const [loginRole, setLoginRole] = useState<'customer' | 'driver' | 'admin'>('customer');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Handle Customer Registration Submission
  const handleStartCustomerOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!custName || !custPhone || !custEmail) {
      setErrorMsg('Please fill in your name, phone, and email.');
      return;
    }
    if (!custVehicleMakeModel.trim()) {
      setErrorMsg('Please enter your vehicle make and model (e.g. Honda City / Hyundai Creta).');
      return;
    }
    // Generate a 4-digit verification OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(otp);
    setCustOtpStep(true);
  };

  const handleVerifyCustomerOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (custEnteredOtp !== generatedOtp && custEnteredOtp !== '1234') {
      setErrorMsg('Invalid OTP. Please check the code sent to your phone or use 1234.');
      return;
    }

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: custName,
          phone: custPhone,
          email: custEmail,
          city: custCity,
          password: custEnteredOtp || '1234',
          emergencyContact: custEmergency || '+91 94470 00000',
          vehicle: {
            makeModel: custVehicleMakeModel.trim(),
            vehicleType: custVehicleType,
            transmission: custVehicleTransmission,
            fuelType: custVehicleFuel,
            notes: custVehicleNotes.trim() || undefined,
          }
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error && data.error.includes('already registered')) {
          setErrorMsg('This phone number or email is already registered. Please log in.');
          return;
        }
        setErrorMsg(data.error || 'Registration failed');
        return;
      }
      onRegisterCustomer({
        id: data.id,
        role: 'customer',
        name: data.name,
        phone: data.phone,
        email: data.email,
        city: data.city,
        emergencyContact: data.emergencyContact,
        vehicles: data.vehicles || [
          {
            id: 'v-' + Date.now(),
            customerId: data.id,
            makeModel: custVehicleMakeModel.trim(),
            vehicleType: custVehicleType,
            transmission: custVehicleTransmission,
            fuelType: custVehicleFuel,
            notes: custVehicleNotes.trim() || undefined,
            isDefault: true,
          }
        ],
        createdAt: data.createdAt,
      });
      onClose();
    } catch {
      // Fallback
      const newId = 'cust-' + Date.now();
      const newUser: User = {
        id: newId,
        role: 'customer',
        name: custName,
        phone: custPhone,
        email: custEmail,
        city: custCity,
        emergencyContact: custEmergency || '+91 94470 00000',
        vehicles: [
          {
            id: 'veh-' + Date.now(),
            customerId: newId,
            makeModel: custVehicleMakeModel.trim() || 'Honda City',
            vehicleType: custVehicleType,
            transmission: custVehicleTransmission,
            fuelType: custVehicleFuel,
            notes: custVehicleNotes.trim() || undefined,
            isDefault: true,
          }
        ],
        createdAt: new Date().toISOString()
      };
      onRegisterCustomer(newUser);
      onClose();
    }
  };

  // Handle Driver Registration Submission (Requirement 3)
  const handleDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!driverName || !driverPhone || !driverLicense) {
      setErrorMsg('Please enter your legal name, phone number, and commercial license number.');
      return;
    }
    if (driverTransmissions.length === 0) {
      setErrorMsg('Please select at least one transmission capability (Automatic or Manual).');
      return;
    }
    if (driverFuels.length === 0) {
      setErrorMsg('Please select at least one fuel/power capability (Petrol, Diesel, or Electric).');
      return;
    }

    try {
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: driverName,
          phone: driverPhone,
          email: driverEmail || `${driverPhone.replace(/\D/g, '')}@drivec.in`,
          city: driverCity,
          password: driverPhone,
          licenseNumber: driverLicense,
          transmissionCapabilities: driverTransmissions,
          fuelCapabilities: driverFuels,
          licenseDocName: driverLicenseDocName || 'Kerala_Commercial_License.pdf',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to submit driver application.');
        return;
      }
      onRegisterDriver(data);
      setDriverSuccessNote('Driver application submitted successfully! In compliance with Kerala transport regulations, your application has been sent to the Admin site and placed on the Pending List. You will only be allowed to sign in once the Administrator reviews and approves your credentials.');
    } catch {
      const newDriver: Driver = {
        id: 'drv-' + Date.now(),
        name: driverName,
        phone: driverPhone,
        email: driverEmail || `${driverPhone}@drivec.in`,
        city: driverCity,
        licenseNumber: driverLicense,
        transmissionCapabilities: driverTransmissions,
        fuelCapabilities: driverFuels,
        approvalStatus: 'pending',
        isOnline: false,
        documents: [
          {
            id: 'doc-1',
            type: 'driving_license',
            filename: driverLicenseDocName || 'Kerala_Commercial_License.pdf',
            uploadedAt: new Date().toISOString(),
            status: 'pending'
          }
        ],
        totalTrips: 0,
        totalEarnings: 0,
        pendingPayout: 0,
        ratingAverage: 0,
        ratingCount: 0,
        createdAt: new Date().toISOString()
      };

      onRegisterDriver(newDriver);
      setDriverSuccessNote('Driver application submitted successfully! In compliance with Kerala transport regulations, your application has been sent to the Admin site and placed on the Pending List. You will only be allowed to sign in once the Administrator reviews and approves your credentials.');
    }
  };

  // Handle Admin Manual Setup (Enforcing Single Sole Administrator)
  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!adminName || !adminEmail) {
      setErrorMsg('Please enter administrator credentials.');
      return;
    }
    if (adminKey !== 'admin2026') {
      setErrorMsg('Incorrect Admin Master Key. Authorized master key is "admin2026".');
      return;
    }

    // Sole Administrator account
    onLogin({
      id: 'admin-master',
      role: 'admin',
      name: adminName,
      phone: '+91 484 290 8000',
      email: adminEmail
    });
    onClose();
  };

  // Handle Login for Registered Accounts
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      const payloadPassword = 
        loginRole === 'driver' && loginPasswordOrKey === 'admin2026' 
          ? '1234' 
          : (loginPasswordOrKey || '1234');

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: loginRole,
          phone: loginPhoneOrEmail.trim(),
          password: payloadPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Login failed. Please check your credentials.');
        return;
      }
      onLogin({
        id: data.id,
        role: data.role,
        name: data.name,
        phone: data.phone,
        email: data.email,
      });
      onClose();
      return;
    } catch {
      // Fallback to local check if offline
    }

    if (loginRole === 'admin') {
      const trimmedId = loginPhoneOrEmail.trim().toLowerCase();
      if (trimmedId !== 'admin' && trimmedId !== 'admin@drivec.in' && trimmedId !== 'admin@kerago.in') {
        setErrorMsg('Sole administrator ID is "admin" or "admin@drivec.in".');
        return;
      }
      if (loginPasswordOrKey !== 'admin2026' && loginPasswordOrKey !== 'admin') {
        setErrorMsg('Incorrect Admin Master Key. Authorized master key is "admin2026".');
        return;
      }
      onLogin({
        id: 'admin-master',
        role: 'admin',
        name: 'DriveC Chief Administrator',
        phone: '+91 484 290 8000',
        email: 'admin@drivec.in'
      });
      onClose();
      return;
    }

    if (loginRole === 'customer') {
      const found = registeredCustomers.find(c => c.phone.includes(loginPhoneOrEmail) || c.email.toLowerCase() === loginPhoneOrEmail.toLowerCase());
      if (found) {
        onLogin({
          id: found.id,
          role: 'customer',
          name: found.name,
          phone: found.phone,
          email: found.email
        });
        onClose();
        return;
      }
      setErrorMsg('No registered passenger found with this phone/email. Please register manually first.');
      return;
    }

    if (loginRole === 'driver') {
      const trimmedInput = loginPhoneOrEmail.trim().toLowerCase();
      const found = registeredDrivers.find(d => 
        d.phone.replace(/\s+/g, '').includes(trimmedInput.replace(/\s+/g, '')) || 
        d.email.toLowerCase() === trimmedInput
      );

      if (found) {
        if (found.approvalStatus === 'pending') {
          setErrorMsg('Sign-in Blocked (Approval Pending): Your documents are in the Administrator Pending List. Only Admin-approved drivers can sign in. Please wait for Admin verification.');
          return;
        }
        if (found.approvalStatus === 'rejected') {
          setErrorMsg('Sign-in Blocked (Application Rejected): Your driver verification was declined by the Administrator. Please contact operations.');
          return;
        }

        // Only Admin approved drivers can sign in
        onLogin({
          id: found.id,
          role: 'driver',
          name: found.name,
          phone: found.phone,
          email: found.email
        });
        onClose();
        return;
      }
      setErrorMsg('No driver application found with this phone or email. Please register as a driver first.');
      return;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-[#14171f] text-slate-100 rounded-3xl shadow-2xl border border-[#262b36] overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Tabs */}
        <div className="bg-[#002C6C] p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                {language === 'en' ? 'Manual Authentication' : 'നേരിട്ടുള്ള രജിസ്ട്രേഷൻ'}
              </span>
              <h3 className="text-xl font-bold tracking-tight text-white">
                {mode === 'customerRegister' && (language === 'en' ? 'Passenger Registration' : 'യാത്രക്കാരുടെ രജിസ്ട്രേഷൻ')}
                {mode === 'driverRegister' && (language === 'en' ? 'Driver Onboarding & KYC' : 'ഡ്രൈവർ അപേക്ഷ & പരിശോധന')}
                {mode === 'adminRegister' && (language === 'en' ? 'Admin Authorization' : 'അഡ്മിൻ രജിസ്ട്രേഷൻ')}
                {mode === 'login' && (language === 'en' ? 'Sign In to Portal' : 'പോർട്ടലിലേക്ക് ലോഗിൻ ചെയ്യുക')}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <span className="font-bold text-sm">✕</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[#1c202a] p-1 border-b border-[#262b36] text-xs font-semibold text-slate-300">
          <button
            onClick={() => { setMode('customerRegister'); setErrorMsg(''); setDriverSuccessNote(''); }}
            className={`flex-1 py-2 rounded-lg transition-all ${mode === 'customerRegister' ? 'bg-[#002C6C] text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
          >
            Passenger
          </button>
          <button
            onClick={() => { setMode('driverRegister'); setErrorMsg(''); setDriverSuccessNote(''); }}
            className={`flex-1 py-2 rounded-lg transition-all ${mode === 'driverRegister' ? 'bg-[#002C6C] text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
          >
            Driver KYC
          </button>
          <button
            onClick={() => { setMode('adminRegister'); setErrorMsg(''); setDriverSuccessNote(''); }}
            className={`flex-1 py-2 rounded-lg transition-all ${mode === 'adminRegister' ? 'bg-[#002C6C] text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
          >
            Admin Setup
          </button>
          <button
            onClick={() => { setMode('login'); setErrorMsg(''); setDriverSuccessNote(''); }}
            className={`flex-1 py-2 rounded-lg transition-all ${mode === 'login' ? 'bg-[#002C6C] text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
          >
            Sign In
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto space-y-4">
          
          {errorMsg && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <span>{errorMsg}</span>
            </div>
          )}

          {/* CUSTOMER REGISTRATION */}
          {mode === 'customerRegister' && (
            <div>
              {!custOtpStep ? (
                <form onSubmit={handleStartCustomerOtp} className="space-y-4 text-xs">
                  <div className="bg-[#0d1424] border border-blue-800/70 rounded-xl p-3 text-cyan-300 leading-relaxed">
                    <p className="font-semibold text-cyan-300">Safety First Policy</p>
                    <p>Enter your genuine details. A real-time OTP is simulated to authenticate your Kerala mobile number before rides can be booked.</p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">{t.auth.fullName} *</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rahul Varma / Anjali Menon"
                        value={custName}
                        onChange={(e) => setCustName(e.target.value)}
                        className="w-full px-3 py-2 border border-[#262b36] rounded-xl text-xs focus:ring-2 focus:ring-[#002C6C] outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">{t.auth.phone} *</label>
                      <div className="relative">
                        <input
                          type="tel"
                          required
                          placeholder="+91 98460 12345"
                          value={custPhone}
                          onChange={(e) => setCustPhone(e.target.value)}
                          className="w-full px-3 py-2 border border-[#262b36] rounded-xl text-xs focus:ring-2 focus:ring-[#002C6C] outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">{t.auth.email} *</label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          placeholder="rahul@example.com"
                          value={custEmail}
                          onChange={(e) => setCustEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-[#262b36] rounded-xl text-xs focus:ring-2 focus:ring-[#002C6C] outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">{t.auth.city} *</label>
                      <select
                        value={custCity}
                        onChange={(e) => setCustCity(e.target.value)}
                        className="w-full px-3 py-2 border border-[#262b36] rounded-xl text-xs outline-none bg-[#0d1017] text-slate-100 focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="Kochi">Kochi / Ernakulam</option>
                        <option value="Thiruvananthapuram">Thiruvananthapuram</option>
                        <option value="Kozhikode">Kozhikode</option>
                        <option value="Thrissur">Thrissur</option>
                        <option value="Munnar">Munnar / Idukki</option>
                        <option value="Kannur">Kannur</option>
                        <option value="Kottayam">Kottayam</option>
                        <option value="Alappuzha">Alappuzha</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">{t.auth.emergency}</label>
                      <input
                        type="tel"
                        placeholder="Family contact for trip sharing"
                        value={custEmergency}
                        onChange={(e) => setCustEmergency(e.target.value)}
                        className="w-full px-3 py-2 border border-[#262b36] rounded-xl text-xs focus:ring-2 focus:ring-[#002C6C] outline-none"
                      />
                    </div>
                  </div>

                  {/* Your Vehicle Details (Requirement 1: Customers provide their own vehicles) */}
                  <div className="p-3.5 bg-[#0d1017] border border-[#262b36] rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100 flex items-center gap-1.5 text-xs">
                        <span>Your Vehicle Details</span>
                      </span>
                      <span className="text-[10px] text-cyan-300 bg-[#0d1424] px-2 py-0.5 rounded-full font-semibold border border-blue-800/70">
                        Professional Driver Service
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      DriveC drivers operate your personal vehicle. Enter your vehicle details once so you don't need to re-enter them during bookings.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">Make & Model *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Honda City / Hyundai Creta"
                          value={custVehicleMakeModel}
                          onChange={(e) => setCustVehicleMakeModel(e.target.value)}
                          className="w-full px-3 py-2 border border-[#262b36] rounded-xl text-xs outline-none bg-[#0d1017] text-slate-100 focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">Vehicle Type *</label>
                        <select
                          value={custVehicleType}
                          onChange={(e) => setCustVehicleType(e.target.value as VehicleCategory)}
                          className="w-full px-3 py-2 border border-[#262b36] rounded-xl text-xs outline-none bg-[#0d1017] text-slate-100 focus:ring-2 focus:ring-cyan-500"
                        >
                          <option value="sedan">Sedan (City, Ciaz, Verna)</option>
                          <option value="suv">SUV / MUV (Creta, Seltos, Innova)</option>
                          <option value="hatchback">Hatchback (Swift, Baleno, i20)</option>
                          <option value="premium">Luxury / Premium (BMW, Crysta, Fortuner)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">Transmission *</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setCustVehicleTransmission('manual')}
                            className={`flex-1 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                              custVehicleTransmission === 'manual' ? 'bg-[#002C6C] text-white border-cyan-500' : 'bg-[#0d1017] text-slate-300 border-[#262b36]'
                            }`}
                          >
                            Manual
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustVehicleTransmission('automatic')}
                            className={`flex-1 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                              custVehicleTransmission === 'automatic' ? 'bg-[#002C6C] text-white border-cyan-500' : 'bg-[#0d1017] text-slate-300 border-[#262b36]'
                            }`}
                          >
                            Automatic
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">Fuel / Power Type *</label>
                        <select
                          value={custVehicleFuel}
                          onChange={(e) => setCustVehicleFuel(e.target.value as FuelType)}
                          className="w-full px-3 py-2 border border-[#262b36] rounded-xl text-xs outline-none bg-[#0d1017] text-slate-100 focus:ring-2 focus:ring-cyan-500"
                        >
                          <option value="petrol">Petrol</option>
                          <option value="diesel">Diesel</option>
                          <option value="ev">Electric (EV)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Vehicle Notes (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Has sunroof, child lock on left door, dashcam installed"
                        value={custVehicleNotes}
                        onChange={(e) => setCustVehicleNotes(e.target.value)}
                        className="w-full px-3 py-1.5 border border-[#262b36] rounded-xl text-xs outline-none bg-[#0d1017] text-slate-100 focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span>Proceed to Phone OTP Verification</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyCustomerOtp} className="space-y-4 text-xs">
                  <div className="bg-emerald-950/50 border border-emerald-700/80 rounded-xl p-3 text-emerald-200">
                    <p className="font-semibold text-emerald-200">Verification Code Dispatched</p>
                    <p>
                      Simulated OTP sent to <strong className="text-emerald-200">{custPhone}</strong>: Code is <strong className="bg-[#0d1017] px-2 py-0.5 rounded border border-emerald-700/80 text-sm tracking-widest text-cyan-400">{generatedOtp}</strong> (or use 1234).
                    </p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Enter 4-Digit OTP Code</label>
                    <input
                      type="text"
                      maxLength={4}
                      autoFocus
                      required
                      placeholder="e.g. 8492"
                      value={custEnteredOtp}
                      onChange={(e) => setCustEnteredOtp(e.target.value)}
                      className="w-full text-center tracking-widest text-lg font-black py-2.5 border-2 border-cyan-600 rounded-xl outline-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCustOtpStep(false)}
                      className="w-1/3 py-2.5 rounded-xl border border-[#262b36] text-slate-300 font-semibold"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="w-2/3 py-2.5 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-bold shadow-md"
                    >
                      Verify & Activate Account
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* DRIVER ONBOARDING (Requirement 3: Drivers do not register vehicles) */}
          {mode === 'driverRegister' && (
            <div>
              {driverSuccessNote ? (
                <div className="space-y-4 text-center py-4">
                  <h4 className="text-sm font-bold text-slate-100">Application Submitted</h4>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
                    {driverSuccessNote}
                  </p>
                  <div className="p-3 bg-[#0d1424] border border-blue-800/70 rounded-xl text-xs text-cyan-400 text-left">
                    <strong>Admin Verification Step:</strong> You can switch to the Admin tab with key <code>admin</code> to inspect and verify this driver's commercial driving license.
                  </div>
                  <button
                    onClick={() => setDriverSuccessNote('')}
                    className="px-4 py-2 rounded-xl bg-[#002C6C] hover:bg-[#001f4d] text-white text-xs font-semibold"
                  >
                    Submit Another Application
                  </button>
                </div>
              ) : (
                <form onSubmit={handleDriverSubmit} className="space-y-3.5 text-xs">
                  <div className="bg-emerald-950/50 border border-emerald-700/80 rounded-xl p-3 text-emerald-200 leading-relaxed">
                    <p className="font-semibold text-emerald-200">Professional Driver Onboarding</p>
                    <p>DriveC drivers provide professional chauffeur services for customer-owned vehicles. Drivers do not register or supply a vehicle.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">{t.auth.fullName} *</label>
                      <input
                        type="text"
                        required
                        placeholder="Driver Legal Name"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">{t.auth.phone} *</label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 94471 22334"
                        value={driverPhone}
                        onChange={(e) => setDriverPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">{t.auth.license} *</label>
                      <input
                        type="text"
                        required
                        placeholder="KL-07-20180004921"
                        value={driverLicense}
                        onChange={(e) => setDriverLicense(e.target.value)}
                        className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Operating City / Base *</label>
                      <select
                        value={driverCity}
                        onChange={(e) => setDriverCity(e.target.value)}
                        className="w-full px-3 py-2 border border-[#262b36] rounded-xl text-xs outline-none bg-[#0d1017] text-slate-100 focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="Kochi">Kochi / Ernakulam</option>
                        <option value="Thiruvananthapuram">Thiruvananthapuram</option>
                        <option value="Kozhikode">Kozhikode</option>
                        <option value="Thrissur">Thrissur</option>
                      </select>
                    </div>
                  </div>

                  {/* Certified Driving Capabilities (Requirement 3: Checkboxes) */}
                  <div className="p-3.5 bg-emerald-950/50 border border-emerald-700/80 rounded-2xl space-y-3">
                    <div>
                      <span className="font-bold text-slate-100 block text-xs">Certified Driving Capabilities *</span>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Select all transmission systems and fuel/power types you are certified and capable of driving.
                      </p>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-200 mb-1 text-[11px]">Transmission Capabilities * (At least 1 required)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          driverTransmissions.includes('automatic') ? 'bg-[#002C6C]/40 border-cyan-500 ring-1 ring-cyan-500 shadow-xs text-white' : 'bg-[#0d1017] border-[#262b36] text-slate-300'
                        }`}>
                          <input
                            type="checkbox"
                            checked={driverTransmissions.includes('automatic')}
                            onChange={(e) => {
                              if (e.target.checked) setDriverTransmissions([...driverTransmissions, 'automatic']);
                              else setDriverTransmissions(driverTransmissions.filter(t => t !== 'automatic'));
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="font-bold text-slate-200 text-xs">Automatic</span>
                        </label>

                        <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          driverTransmissions.includes('manual') ? 'bg-[#002C6C]/40 border-cyan-500 ring-1 ring-cyan-500 shadow-xs text-white' : 'bg-[#0d1017] border-[#262b36] text-slate-300'
                        }`}>
                          <input
                            type="checkbox"
                            checked={driverTransmissions.includes('manual')}
                            onChange={(e) => {
                              if (e.target.checked) setDriverTransmissions([...driverTransmissions, 'manual']);
                              else setDriverTransmissions(driverTransmissions.filter(t => t !== 'manual'));
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="font-bold text-slate-200 text-xs">Manual</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-200 mb-1 text-[11px]">Fuel / Power Type Capabilities * (At least 1 required)</label>
                      <div className="grid grid-cols-3 gap-2">
                        <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          driverFuels.includes('petrol') ? 'bg-[#002C6C]/40 border-cyan-500 ring-1 ring-cyan-500 shadow-xs text-white' : 'bg-[#0d1017] border-[#262b36] text-slate-300'
                        }`}>
                          <input
                            type="checkbox"
                            checked={driverFuels.includes('petrol')}
                            onChange={(e) => {
                              if (e.target.checked) setDriverFuels([...driverFuels, 'petrol']);
                              else setDriverFuels(driverFuels.filter(f => f !== 'petrol'));
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="font-bold text-slate-200 text-xs">Petrol</span>
                        </label>

                        <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          driverFuels.includes('diesel') ? 'bg-[#002C6C]/40 border-cyan-500 ring-1 ring-cyan-500 shadow-xs text-white' : 'bg-[#0d1017] border-[#262b36] text-slate-300'
                        }`}>
                          <input
                            type="checkbox"
                            checked={driverFuels.includes('diesel')}
                            onChange={(e) => {
                              if (e.target.checked) setDriverFuels([...driverFuels, 'diesel']);
                              else setDriverFuels(driverFuels.filter(f => f !== 'diesel'));
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="font-bold text-slate-200 text-xs">Diesel</span>
                        </label>

                        <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          driverFuels.includes('ev') ? 'bg-[#002C6C]/40 border-cyan-500 ring-1 ring-cyan-500 shadow-xs text-white' : 'bg-[#0d1017] border-[#262b36] text-slate-300'
                        }`}>
                          <input
                            type="checkbox"
                            checked={driverFuels.includes('ev')}
                            onChange={(e) => {
                              if (e.target.checked) setDriverFuels([...driverFuels, 'ev']);
                              else setDriverFuels(driverFuels.filter(f => f !== 'ev'));
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="font-bold text-slate-200 text-xs">Electric (EV)</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Document Uploads */}
                  <div className="border border-dashed border-[#262b36] rounded-xl p-3 bg-[#0d1017] space-y-2">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      Document Attachments (KYC Verification)
                    </span>
                    <div className="text-[11px]">
                      <label className="flex items-center justify-between p-2.5 rounded-lg bg-[#0d1017] border border-[#262b36] cursor-pointer hover:border-cyan-500 text-slate-200">
                        <span className="truncate">{driverLicenseDocName || "Attach Commercial Driving License (PDF/JPG) *"}</span>
                        <input 
                          type="file" 
                          className="hidden" 
                          onChange={(e) => setDriverLicenseDocName(e.target.files?.[0]?.name || "Kerala_Commercial_License.pdf")} 
                        />
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span>Submit Driver Application</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ADMIN SETUP */}
          {mode === 'adminRegister' && (
            <form onSubmit={handleAdminSubmit} className="space-y-4 text-xs">
              <div className="bg-indigo-950/50 border border-indigo-800/70 rounded-xl p-3 text-indigo-300 leading-relaxed">
                <p className="font-bold text-indigo-300">Sole Platform Administrator</p>
                <p>KeraGo enforces a single centralized administrator system for statewide Kerala operations, KYC compliance, fare adjustments, and audit integrity.</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Administrator Name *</label>
                <input
                  type="text"
                  required
                  placeholder="KeraGo Chief Administrator"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Official KeraGo Admin Email *</label>
                <input
                  type="email"
                  required
                  placeholder="admin@kerago.in"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Administrative Master Key *</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="Enter master key (admin2026)"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs shadow-md transition-all"
              >
                Authorize Single Admin & Access Command Center
              </button>
            </form>
          )}

          {/* SIGN IN */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">Select Role to Sign In As</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setLoginRole('customer'); setLoginPasswordOrKey(''); setErrorMsg(''); }}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                      loginRole === 'customer'
                        ? 'border-[#002C6C] bg-[#0d1424] text-cyan-400'
                        : 'border-[#262b36] text-slate-300 hover:bg-[#1c202a]'
                    }`}
                  >
                    Passenger
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLoginRole('driver'); setLoginPasswordOrKey('1234'); setErrorMsg(''); }}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                      loginRole === 'driver'
                        ? 'border-emerald-600 bg-emerald-950/50 text-emerald-300'
                        : 'border-[#262b36] text-slate-300 hover:bg-[#1c202a]'
                    }`}
                  >
                    Driver
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLoginRole('admin'); setLoginPasswordOrKey('admin2026'); setErrorMsg(''); }}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                      loginRole === 'admin'
                        ? 'border-indigo-600 bg-indigo-950/50 text-indigo-300'
                        : 'border-[#262b36] text-slate-300 hover:bg-[#1c202a]'
                    }`}
                  >
                    Administrator
                  </button>
                </div>
              </div>

              {loginRole === 'admin' ? (
                <>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Sole Admin ID / Email
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="admin or admin@kerago.in"
                      value={loginPhoneOrEmail}
                      onChange={(e) => setLoginPhoneOrEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Admin Master Key *
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        placeholder="Enter master key (admin2026)"
                        value={loginPasswordOrKey}
                        onChange={(e) => setLoginPasswordOrKey(e.target.value)}
                        className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-indigo-950/50 border border-indigo-800/70 rounded-xl space-y-2 text-[11px] text-indigo-300">
                    <span className="font-bold block">Sole Administrator Credentials:</span>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span>ID: <code className="bg-[#0d1017] px-1.5 py-0.5 rounded border border-indigo-800/70 font-mono font-bold">admin</code></span>
                        <span>Key: <code className="bg-[#0d1017] px-1.5 py-0.5 rounded border border-indigo-800/70 font-mono font-bold">admin2026</code></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setLoginPhoneOrEmail('admin');
                          setLoginPasswordOrKey('admin2026');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-semibold transition-colors"
                      >
                        Auto-fill Credentials
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      {loginRole === 'driver' ? 'Driver Mobile Number, Name, or Email' : 'Registered Mobile Number or Email'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={loginRole === 'driver' ? 'Enter driver phone (e.g. 7418529637) or name' : 'Enter your registered phone / email'}
                      value={loginPhoneOrEmail}
                      onChange={(e) => setLoginPhoneOrEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none"
                    />
                  </div>

                  {loginRole === 'driver' && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-semibold text-slate-300">Driver Password or Verification OTP</label>
                        <span className="text-[10px] text-emerald-300 font-bold bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-700/80">Default OTP: 1234</span>
                      </div>
                      <input
                        type="password"
                        placeholder="Enter password or default OTP (1234)"
                        value={loginPasswordOrKey}
                        onChange={(e) => setLoginPasswordOrKey(e.target.value)}
                        className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none font-mono"
                      />
                    </div>
                  )}

                  {/* Show currently registered accounts helper */}
                  <div className="p-3 bg-[#0d1017] border border-[#262b36] rounded-xl space-y-1.5 text-[11px] text-slate-300">
                    <span className="font-bold text-slate-200">Manually Registered Accounts in Database:</span>
                    {loginRole === 'customer' && (
                      registeredCustomers.length > 0 ? (
                        <div className="space-y-1">
                          {registeredCustomers.map(c => (
                            <div 
                              key={c.id} 
                              onClick={() => setLoginPhoneOrEmail(c.phone)} 
                              className="cursor-pointer text-cyan-400 hover:underline flex justify-between"
                            >
                              <span>{c.name} ({c.phone})</span>
                              <span className="text-[10px] text-slate-400">Click to fill</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-amber-300">No passengers registered yet. Register a passenger above.</p>
                      )
                    )}

                    {loginRole === 'driver' && (
                      registeredDrivers.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold border-b border-[#262b36] pb-1">
                            <span>Driver Database Status</span>
                            <span>Sign-in Eligibility</span>
                          </div>
                          {registeredDrivers.map(d => (
                            <div 
                              key={d.id} 
                              onClick={() => {
                                setLoginPhoneOrEmail(d.phone);
                                setLoginPasswordOrKey('1234');
                                if (d.approvalStatus !== 'approved') {
                                  setErrorMsg(`Driver "${d.name}" is currently ${d.approvalStatus.toUpperCase()}. Only Admin-approved drivers can sign in.`);
                                } else {
                                  setErrorMsg('');
                                }
                              }} 
                              className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                d.approvalStatus === 'approved'
                                  ? 'bg-emerald-950/50 border-emerald-700/80 text-emerald-200 hover:bg-emerald-950/70'
                                  : 'bg-[#0d1424] border-blue-800/70 text-cyan-400 hover:bg-[#152238]'
                              }`}
                            >
                              <div>
                                <span className="font-bold block text-xs">{d.name}</span>
                                <span className="text-[10px] text-slate-300">{d.phone} • {d.vehicleModel}</span>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                d.approvalStatus === 'approved'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : d.approvalStatus === 'pending'
                                  ? 'bg-[#002C6C] text-white font-black animate-pulse'
                                  : 'bg-red-500 text-white'
                              }`}>
                                {d.approvalStatus === 'approved' ? '✓ Approved (Can Sign In)' : '⏳ Pending Admin Approval'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-amber-300">No drivers registered yet. Submit a driver application above.</p>
                      )
                    )}
                  </div>
                </>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-md transition-all"
              >
                Sign In to Platform
              </button>
            </form>
          )}

        </div>

        <div className="p-3.5 bg-[#0d1017] border-t border-[#262b36] text-center text-[10px] text-slate-400">
          {t.auth.manualNotice}
        </div>
      </div>
    </div>
  );
};
