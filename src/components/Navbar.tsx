"use client";

import React, { useState, useEffect, useRef } from 'react';
import { translations } from '../lib/translations';
import { Language, UserRole } from '../types';

interface NavbarProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  currentUser: {
    id: string;
    role: UserRole;
    name: string;
    phone: string;
  };
  onOpenGuestWarning: () => void;
  onOpenAuth: (mode: 'login' | 'customerRegister' | 'driverRegister' | 'adminRegister') => void;
  onSignOut: () => void;
  onNavigateSection: (sectionId: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenDrivingHistory?: () => void;
}

// Self-contained 2-second redirect popup for guest actions
function GuestRedirectPopup({ onClose, onOpenAuth }: { onClose: () => void; onOpenAuth: (mode: 'customerRegister') => void }) {
  const [countdown, setCountdown] = useState(2);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          onOpenAuth('customerRegister');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onClose, onOpenAuth]);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose}></div>

      {/* Popup */}
      <div className="relative z-10 bg-[#14171f] rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center space-y-4 border border-[#262b36] animate-in fade-in zoom-in duration-200">
        <div>
          <h3 className="font-black text-slate-100 text-lg">Register or Sign In First</h3>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">
            Create a free DriveC account to book professional drivers and self-drive rentals across Kochi.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm font-bold text-cyan-400">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-500 flex items-center justify-center font-black text-base text-white">
            {countdown}
          </div>
          <span className="text-slate-300">Redirecting to registration…</span>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => { onClose(); onOpenAuth('customerRegister'); }}
            className="flex-1 py-3 rounded-xl bg-[#002C6C] hover:bg-[#001f4d] text-white font-black text-xs transition-colors"
          >
            Register Now
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-xl bg-[#1c202a] hover:bg-[#252b38] text-slate-300 font-bold text-xs transition-colors border border-[#262b36]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export const Navbar: React.FC<NavbarProps> = ({
  language,
  onLanguageChange,
  currentUser,
  onOpenGuestWarning,
  onOpenAuth,
  onSignOut,
  onNavigateSection,
  activeTab,
  setActiveTab,
  onOpenDrivingHistory
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showGuestPopup, setShowGuestPopup] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const t = translations[language];

  const isGuest    = currentUser.role === 'guest';
  const isCustomer = currentUser.role === 'customer';
  const isDriver   = currentUser.role === 'driver';
  const isAdmin    = currentUser.role === 'admin';

  // Show nav links only to Guest and Customer (on explore tab)
  const showPublicLinks = isGuest || isCustomer;

  // Track scroll to blend/unblend navbar over hero
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // When guest clicks any protected nav action → show popup
  const handleGuestAction = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowGuestPopup(true);
  };

  // Nav link handler — redirects guest to popup instead of action
  const handleNavClick = (sectionId: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('drivec_collapse_cards'));
    }
    if (isGuest) {
      setShowGuestPopup(true);
    } else {
      setActiveTab('explore');
      onNavigateSection(sectionId);
    }
    setMobileMenuOpen(false);
  };

  // Dedicated FAQ navigation handler — smoothly scrolls and focuses FAQ's for both Guest and Customer
  const handleFaqClick = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('drivec_collapse_cards'));
    }
    setMobileMenuOpen(false);

    const scrollToAndFocusFaq = () => {
      const faqEl = document.getElementById('aeo-faqs') || document.getElementById('faqs');
      if (faqEl) {
        faqEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (typeof faqEl.focus === 'function') {
          faqEl.focus({ preventScroll: true });
        }
        // Visual focus ring pulse to direct user's attention
        faqEl.classList.add('ring-2', 'ring-[#002C6C]', 'ring-offset-4', 'ring-offset-[#090a0f]');
        setTimeout(() => {
          faqEl.classList.remove('ring-2', 'ring-[#002C6C]', 'ring-offset-4', 'ring-offset-[#090a0f]');
        }, 2200);
      } else {
        onNavigateSection('aeo-faqs');
      }
    };

    if (activeTab !== 'explore') {
      setActiveTab('explore');
      setTimeout(scrollToAndFocusFaq, 150);
    } else {
      scrollToAndFocusFaq();
    }
  };

  // Requirement 5: Driving / Riding History navbar handler
  const handleRidingHistoryClick = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('drivec_collapse_cards'));
    }
    if (isGuest) {
      setShowGuestPopup(true);
    } else if (onOpenDrivingHistory) {
      onOpenDrivingHistory();
    } else if (isDriver) {
      setActiveTab('driver');
    } else if (isAdmin) {
      setActiveTab('admin');
    } else {
      setActiveTab('user');
    }
    setMobileMenuOpen(false);
  };

  // In Guests and Customers Hero page, blend the navbar to the background image
  const isHeroPage = activeTab === 'explore' && (currentUser.role === 'guest' || currentUser.role === 'customer');
  const isBlending = isHeroPage && !scrolled;

  const navBg = isBlending
    ? 'bg-transparent border-b border-white/10 backdrop-blur-none shadow-none'
    : 'bg-[#090a0f]/95 backdrop-blur-md border-b border-[#262b36] shadow-md';

  const linkColor = isBlending
    ? 'text-white/90 hover:text-white hover:bg-white/10'
    : 'text-slate-300 hover:text-white hover:bg-[#14171f]';

  const brandColor = 'text-white';
  const brandSubColor = isBlending ? 'text-white/70' : 'text-slate-400';
  const dividerColor = isBlending ? 'bg-white/20' : 'bg-[#262b36]';

  // Role badge for signed-in users
  const roleBadgeMap: Record<string, { label: string; color: string; tab: string }> = {
    driver: { label: 'Driver', color: 'bg-blue-600', tab: 'driver' },
    admin:  { label: 'Admin',  color: 'bg-rose-600', tab: 'admin' },
    customer: { label: 'Customer', color: 'bg-[#002C6C]', tab: 'user' },
    guest: { label: 'Guest', color: 'bg-slate-500', tab: 'explore' },
  };
  const roleBadge = roleBadgeMap[currentUser.role] ?? { label: '', color: '', tab: 'explore' };

  return (
    <>
      {/* Guest Redirect Popup */}
      {showGuestPopup && (
        <GuestRedirectPopup
          onClose={() => setShowGuestPopup(false)}
          onOpenAuth={(mode) => { onOpenAuth(mode); setShowGuestPopup(false); }}
        />
      )}

      <header className={`fixed top-0 left-0 right-0 z-40 w-full transition-all duration-500 ${navBg}`}>

        {/* Top Emergency Bar — shown on solid nav (not blended into hero) */}
        {!isBlending && (
          <div className="bg-[#050608] text-slate-300 text-[10px] sm:text-[11px] py-1 pl-3 sm:pl-6 lg:pl-8 pr-2 sm:pr-3 lg:pr-4 flex justify-between items-center border-b border-[#262b36]">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="hidden sm:inline text-slate-400">24x7 DriveC Kochi Operations & SOS:</span>
              <span className="font-semibold text-slate-100 tracking-wider">+91 484 290 8000</span>
              <span className="hidden md:inline text-cyan-400 ml-2">• Zero Surge Kerala Pricing</span>
            </div>
            <div className="flex items-center bg-[#14171f] rounded-full p-0.5 border border-[#262b36]">
              <button
                onClick={() => onLanguageChange('en')}
                className={`px-2 py-0.5 text-[10px] rounded-full transition-all font-bold ${
                  language === 'en' ? 'bg-[#002C6C] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >EN</button>
              <button
                onClick={() => onLanguageChange('ml')}
                className={`px-2 py-0.5 text-[10px] rounded-full transition-all font-bold ${
                  language === 'ml' ? 'bg-[#002C6C] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >മലയാളം</button>
            </div>
          </div>
        )}

        {/* Main Nav Row */}
        <div className="w-full pl-3 sm:pl-6 lg:pl-8 pr-2 sm:pr-3 lg:pr-4">
          <div className="flex items-center justify-between h-14 sm:h-15 py-1.5 sm:py-2">

            {/* Brand Mark — Requirement 2: drivers routed to driver portal, not explore */}
            <div
              className="flex items-center gap-2.5 cursor-pointer shrink-0 mr-auto"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('drivec_collapse_cards'));
                }
                if (isDriver) {
                  setActiveTab('driver');
                } else if (isAdmin) {
                  setActiveTab('admin');
                } else {
                  setActiveTab('explore');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
            >
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shadow-md border ${
                !isBlending
                  ? 'bg-gradient-to-tr from-[#002C6C] via-[#004B93] to-cyan-500 border-white/20 text-white'
                  : 'bg-white/15 border-white/25 text-white backdrop-blur-md'
              }`}>
                <span className="font-black text-lg tracking-tighter">D</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-1.5">
                  <span className={`font-black tracking-tight text-xl sm:text-2xl transition-colors ${brandColor}`}>DriveC</span>
                  <span className={`text-[9px] sm:text-[10px] font-black uppercase px-1.5 rounded border ${
                    !isBlending ? 'text-cyan-400 bg-[#0d1424] border-blue-800/70' : 'text-cyan-300 bg-white/10 border-white/20'
                  }`}>Kochi</span>
                </div>
                <span className={`text-[9px] sm:text-[10px] -mt-0.5 hidden sm:block transition-colors whitespace-nowrap ${brandSubColor}`}>
                  Driver Duty & Self-Drive Rentals
                </span>
              </div>
            </div>

            {/* Desktop Right-Side Content — Pushed completely to the Right */}
            <div className="hidden lg:flex items-center justify-end gap-1.5 ml-auto">

              {/* ─── PUBLIC NAV LINKS (Guest + Customer only) ─── */}
              {showPublicLinks && (
                <>
                  <nav className="flex items-center gap-0.5">
                    <button
                      onClick={() => handleNavClick('booking-engine')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${linkColor}`}
                    >
                      Book a Driver
                    </button>
                    <button
                      onClick={() => handleNavClick('booking-engine')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${linkColor}`}
                    >
                      Self-Drive Rental
                    </button>
                    <button
                      onClick={() => handleNavClick('services')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${linkColor}`}
                    >
                      Services
                    </button>
                    <button
                      onClick={() => handleNavClick('areas')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${linkColor}`}
                    >
                      Kochi Service Hubs
                    </button>
                    <button
                      onClick={() => handleNavClick('reviews')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${linkColor}`}
                    >
                      Verified Reviews
                    </button>
                    <button
                      onClick={handleFaqClick}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${linkColor}`}
                      title="Frequently Asked Questions"
                    >
                      FAQ's
                    </button>
                  </nav>

                  <div className={`h-5 w-px mx-1 ${dividerColor}`}></div>
                </>
              )}

              {/* ─── DRIVING / RIDING HISTORY (Requirement 5) ─── */}
              <button
                onClick={handleRidingHistoryClick}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                  (activeTab === 'user' || activeTab === 'driver' || activeTab === 'admin')
                    ? (!isBlending ? 'bg-[#1c202a] text-[#002C6C]' : 'bg-white/20 text-white')
                    : linkColor
                }`}
                title={isDriver || isAdmin ? "View driving history" : "View completed ride history"}
              >
                <span>{isDriver || isAdmin ? 'Driving History' : 'Riding History'}</span>
              </button>

              {/* ─── DRIVER TERMINAL LINK (Drivers only) ─── */}
              {isDriver && (
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('drivec_collapse_cards'));
                    setActiveTab('driver');
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                    activeTab === 'driver' 
                      ? 'bg-[#002C6C] text-white shadow-xs'
                      : linkColor
                  }`}
                >
                  Driver Terminal
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('drivec_collapse_cards'));
                    setActiveTab('admin');
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                    activeTab === 'admin'
                      ? 'bg-rose-800 text-white shadow-xs'
                      : linkColor
                  }`}
                >
                  Admin Console
                </button>
              )}

              {/* Language switcher (ghost mode, only when transparent / on hero) */}
              {isBlending && (
                <>
                  <div className={`h-5 w-px mx-1 ${dividerColor}`}></div>
                  <div className="flex items-center bg-[#0d1017] rounded-full p-0.5 border border-[#262b36]">
                    <button onClick={() => onLanguageChange('en')} className={`px-2 py-0.5 text-[11px] rounded-full transition-all font-medium ${language === 'en' ? 'bg-[#002C6C] text-white font-bold' : 'text-slate-400 hover:text-white'}`}>EN</button>
                    <button onClick={() => onLanguageChange('ml')} className={`px-2 py-0.5 text-[11px] rounded-full transition-all font-medium ${language === 'ml' ? 'bg-[#002C6C] text-white font-bold' : 'text-slate-400 hover:text-white'}`}>മ</button>
                  </div>
                </>
              )}

              <div className={`h-5 w-px mx-1 ${dividerColor}`}></div>

              {/* ─── AUTH / PROFILE ─── */}
              {isGuest ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenAuth('login')}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all border ${
                      !isBlending
                        ? 'text-slate-200 border-[#262b36] bg-[#14171f] hover:bg-[#1c202a]'
                        : 'text-white border-white/30 hover:bg-white/10'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => onOpenAuth('customerRegister')}
                    className="px-3.5 py-1.5 rounded-full text-[11px] font-black whitespace-nowrap bg-[#002C6C] hover:bg-[#001f4d] text-white shadow-md transition-all flex items-center gap-1"
                  >
                    Register Free
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  {/* User avatar + name */}
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('drivec_collapse_cards'));
                      setActiveTab(roleBadge.tab);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full whitespace-nowrap transition-all ${
                      !isBlending ? 'bg-[#14171f] hover:bg-[#1c202a] border border-[#262b36]' : 'bg-white/10 hover:bg-white/20 border border-white/20'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full ${roleBadge.color} text-white flex items-center justify-center text-[9px] font-black uppercase`}>
                      {currentUser.name.charAt(0) || 'U'}
                    </div>
                    <span className={`text-[11px] font-bold truncate max-w-[85px] ${!isBlending ? 'text-slate-200' : 'text-white'}`}>
                      {currentUser.name}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white ${roleBadge.color}`}>
                      {roleBadge.label}
                    </span>
                  </button>

                  <button
                    onClick={onSignOut}
                    className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
                      !isBlending ? 'text-red-400 hover:bg-red-950/40' : 'text-red-300 hover:bg-white/10'
                    }`}
                    title="Sign Out"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* ─── Mobile Trigger ─── */}
            <div className="lg:hidden flex items-center gap-2 ml-auto">
              {isGuest ? (
                <button
                  onClick={() => onOpenAuth('login')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border ${
                    scrolled ? 'bg-[#14171f] text-slate-200 border-[#262b36]' : 'bg-white/10 text-white border-white/20'
                  }`}
                >
                  Sign In
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('drivec_collapse_cards'));
                    setActiveTab(roleBadge.tab);
                  }}
                  className={`w-7 h-7 rounded-full ${roleBadge.color} text-white flex items-center justify-center text-[11px] font-black uppercase`}
                >
                  {currentUser.name.charAt(0) || 'U'}
                </button>
              )}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`px-2.5 py-1.5 rounded-xl text-sm font-bold transition-colors ${scrolled ? 'text-slate-300 hover:bg-[#14171f]' : 'text-white hover:bg-white/10'}`}
                aria-label="Toggle Menu"
              >
                {mobileMenuOpen ? '✕' : '☰'}
              </button>
            </div>

          </div>
        </div>

        {/* ─── Mobile Drawer ─── */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0e1017] border-t border-[#262b36] p-4 space-y-2 shadow-2xl">
            
            {/* Guest/Customer public links */}
            {showPublicLinks && (
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-slate-400 px-2 pb-1">Explore DriveC</p>
                {[
                  { label: 'Book a Driver', section: 'booking-engine', isFaq: false },
                  { label: 'Self-Drive Rental', section: 'booking-engine', isFaq: false },
                  { label: 'Services', section: 'services', isFaq: false },
                  { label: 'Kochi Service Hubs', section: 'areas', isFaq: false },
                  { label: 'Verified Reviews', section: 'reviews', isFaq: false },
                  { label: "FAQ's", section: 'aeo-faqs', isFaq: true },
                ].map(({ label, section, isFaq }) => (
                  <button
                    key={label}
                    onClick={() => { 
                      if (isFaq) {
                        handleFaqClick();
                      } else {
                        handleNavClick(section); 
                      }
                      setMobileMenuOpen(false); 
                    }}
                    className="w-full px-3 py-2 rounded-xl text-[11px] font-bold text-slate-300 hover:bg-[#14171f] hover:text-white text-left transition-colors"
                  >
                    {label}
                  </button>
                ))}

                {/* Requirement 5: Driving / Riding history in mobile drawer */}
                <button
                  onClick={() => { handleRidingHistoryClick(); setMobileMenuOpen(false); }}
                  className="w-full px-3 py-2 rounded-xl text-[11px] font-bold text-cyan-300 bg-[#14171f] hover:bg-[#1c202a] text-left border border-[#262b36] transition-colors"
                >
                  <span>{isDriver || isAdmin ? 'Driving History' : 'Riding History'}</span>
                </button>
              </div>
            )}

            {/* Role-specific portal */}
            {!isGuest && !isCustomer && (
              <div className="pt-2 border-t border-[#262b36] space-y-1">
                <p className="text-[10px] font-black uppercase text-slate-400 px-2 pb-1">Your Portal</p>
                {isDriver && (
                  <button onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('drivec_collapse_cards')); setActiveTab('driver'); setMobileMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold text-blue-300 bg-[#14171f] hover:bg-[#1c202a] text-left border border-[#262b36]">
                    Driver Portal
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('drivec_collapse_cards')); setActiveTab('admin'); setMobileMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold text-rose-300 bg-[#14171f] hover:bg-[#1c202a] text-left border border-[#262b36]">
                    Admin Console
                  </button>
                )}
              </div>
            )}

            {/* Language + Auth */}
            <div className="pt-2 border-t border-[#262b36] flex items-center justify-between">
              <div className="flex items-center bg-[#14171f] rounded-full p-0.5 border border-[#262b36]">
                <button onClick={() => onLanguageChange('en')} className={`px-2.5 py-0.5 text-[11px] rounded-full font-bold ${language === 'en' ? 'bg-[#002C6C] text-white' : 'text-slate-400'}`}>EN</button>
                <button onClick={() => onLanguageChange('ml')} className={`px-2.5 py-0.5 text-[11px] rounded-full font-bold ${language === 'ml' ? 'bg-[#002C6C] text-white' : 'text-slate-400'}`}>മ</button>
              </div>
              {isGuest ? (
                <button onClick={() => { onOpenAuth('customerRegister'); setMobileMenuOpen(false); }} className="px-3.5 py-1.5 rounded-full text-[11px] font-black bg-[#002C6C] text-white">
                  Register Free
                </button>
              ) : (
                <button onClick={() => { onSignOut(); setMobileMenuOpen(false); }} className="flex items-center gap-1.5 text-[11px] font-bold text-red-400">
                  Sign Out
                </button>
              )}
            </div>
          </div>
        )}

      </header>

      {/* Spacer so content doesn't hide behind fixed navbar when scrolled */}
      <div className="h-0" id="navbar-spacer"></div>
    </>
  );
};
