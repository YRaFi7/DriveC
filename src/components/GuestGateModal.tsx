"use client";

import React from 'react';
import { Language } from '../types';
import { translations } from '../lib/translations';

interface GuestGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onOpenRegister: (mode: 'customerRegister' | 'driverRegister') => void;
  onOpenLogin: () => void;
  actionAttempted?: string;
}

export const GuestGateModal: React.FC<GuestGateModalProps> = ({
  isOpen,
  onClose,
  language,
  onOpenRegister,
  onOpenLogin,
  actionAttempted
}) => {
  if (!isOpen) return null;
  const t = translations[language];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-[#14171f] text-slate-100 rounded-3xl shadow-2xl border border-[#262b36] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Warning Banner */}
        <div className="bg-gradient-to-r from-[#002C6C] via-[#003882] to-[#004B93] px-6 py-5 text-white flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-cyan-200 bg-white/10 px-2 py-0.5 rounded border border-white/20">
              {language === 'en' ? 'Guest Access Notice' : 'ഗസ്റ്റ് അറിയിപ്പ്'}
            </span>
            <h3 className="text-xl font-bold tracking-tight text-white mt-1">
              {language === 'en' ? 'Register First' : 'ആദ്യം രജിസ്റ്റർ ചെയ്യുക'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors font-bold text-sm"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="bg-[#0d1017] border border-[#262b36] rounded-2xl p-4">
            <div className="text-xs text-cyan-400 leading-relaxed">
              <p className="font-semibold text-sm text-slate-100 mb-1">
                {language === 'en' 
                  ? 'Exploration allowed, actions require verification' 
                  : 'സൈറ്റ് കാണാൻ സാധിക്കും, ബുക്കിംഗിന് രജിസ്ട്രേഷൻ വേണം'}
              </p>
              <p className="text-slate-300">
                {actionAttempted ? (
                  <span>
                    {language === 'en' 
                      ? `You attempted to "${actionAttempted}". In accordance with Kerala transport safety compliance, you cannot perform this action as a guest.`
                      : `നിങ്ങൾ "${actionAttempted}" ചെയ്യാൻ ശ്രമിച്ചു. സുരക്ഷാ മുൻകരുതലുകളുടെ ഭാഗമായി ഗസ്റ്റുകൾക്ക് ഇത് സാധ്യമല്ല.`}
                  </span>
                ) : (
                  <span>
                    {t.guestWarningModal.message}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {language === 'en' ? 'Why manual registration is required:' : 'നേരിട്ടുള്ള രജിസ്ട്രേഷൻ നിർബന്ധമാക്കുന്നത് എന്തുകൊണ്ട്:'}
            </h4>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{language === 'en' ? 'No fake or random accounts: Every rider and driver is authenticated.' : 'വ്യാജ അക്കൗണ്ടുകൾ ഇല്ല: ഓരോ ഉപഭോക്താവും ഡ്രൈവറും പരിശോധിക്കപ്പെടുന്നു.'}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{language === 'en' ? 'Ride-Start OTP protection guarantees passenger and vehicle safety.' : 'റൈഡ്-സ്റ്റാർട്ട് OTP സുരക്ഷ ഉറപ്പുനൽകുന്നു.'}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{language === 'en' ? 'Zero fabricated reviews: Only verified completed journeys can be rated.' : 'യഥാർത്ഥ യാത്രകൾക്ക് മാത്രം റിവ്യൂ നൽകാനുള്ള സൗകര്യം.'}</span>
              </li>
            </ul>
          </div>

          {/* Action CTAs */}
          <div className="space-y-2.5 pt-2">
            <button
              onClick={() => {
                onClose();
                onOpenRegister('customerRegister');
              }}
              className="w-full py-3.5 px-4 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-bold text-sm shadow-md shadow-blue-950/20 transition-all flex items-center justify-center gap-2 group"
            >
              <span>{language === 'en' ? 'Register as Passenger' : 'യാത്രക്കാരനായി രജിസ്റ്റർ ചെയ്യുക'}</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenRegister('driverRegister');
              }}
              className="w-full py-3 px-4 rounded-xl bg-[#0d1017] hover:bg-[#1c202a] text-emerald-300 font-semibold text-xs border border-[#262b36] transition-colors flex items-center justify-center gap-2"
            >
              <span>{language === 'en' ? 'Register as Driver (Upload Documents)' : 'ഡ്രൈവറായി രജിസ്റ്റർ ചെയ്യുക (രേഖകൾ സഹിതം)'}</span>
            </button>

            <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-[#262b36]">
              <button
                onClick={() => {
                  onClose();
                  onOpenLogin();
                }}
                className="text-cyan-400 font-semibold hover:underline flex items-center gap-1"
              >
                <span>{t.guestWarningModal.loginBtn}</span>
              </button>

              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-200 font-medium"
              >
                {t.guestWarningModal.stayGuest}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
