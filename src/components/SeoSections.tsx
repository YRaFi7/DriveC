"use client";

import React, { useState } from 'react';
import { Language } from '../types';
import { KERALA_SERVICE_AREAS } from '../lib/translations';

interface SeoSectionsProps {
  language: Language;
}

export const SeoSections: React.FC<SeoSectionsProps> = ({ language }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = language === 'en' ? [
    {
      q: "How does DriveC's professional driver booking for your own car work?",
      a: "Our qualified drivers are vetted to pilot your personal vehicle across Kochi or Kerala highways. You declare your vehicle category (Hatchback, Sedan, SUV, Premium) and transmission (Manual/Automatic), and our dispatch engine matches an eligible, approved driver."
    },
    {
      q: "What is DriveC's Self-Drive car rental service in Kochi?",
      a: "DriveC allows customers to rent verified owner-listed vehicles in Kochi for daily or weekly periods. Every vehicle comes with clear photos, insurance, Fastag, and a digital handover checklist recording fuel and odometer readings."
    },
    {
      q: "What is the Ride-Start OTP and why is it mandatory?",
      a: "The Ride-Start OTP is a dynamic 4-digit security code generated when a trip is dispatched. To prevent misboarding and ensure you enter the authentic verified vehicle, your driver cannot start duty without entering this code in person."
    },
    {
      q: "What is DriveC's platform commission and driver earnings structure?",
      a: "DriveC uses a transparent fixed platform fee and driver earnings structure per completed ride, with driver earnings credited directly into their in-app wallet."
    },
    {
      q: "Can I set Favourite Drivers on DriveC?",
      a: "Yes! Passengers can mark their preferred verified drivers as favourites with a single click, allowing easy re-booking for future airport transfers and city duty."
    },
    {
      q: "How do cancellations and refunds work?",
      a: "Passengers have a free 20-second cancellation window before driver arrival. After that, standard cancellation terms apply and refunds are credited back to the original payment method with transparent audit logs."
    }
  ] : [
    {
      q: "DriveC-ൽ സ്വന്തം കാറിനായി ഡ്രൈവറെ എങ്ങനെ ബുക്ക് ചെയ്യാം?",
      a: "നിങ്ങളുടെ കാർ മോഡലും ട്രാൻസ്മിഷനും (മാനുവൽ/ഓട്ടോമാറ്റിക്) തിരഞ്ഞെടുക്കുക. തുടർന്ന് കൊച്ചിയിലെ യോഗ്യരായ ഡ്രൈവർമാരിൽ നിന്ന് ഒരാളെ തിരഞ്ഞെടുത്ത് ബുക്ക് ചെയ്യാം."
    },
    {
      q: "DriveC-ന്റെ സെൽഫ് ഡ്രൈവ് കാർ വാടക സേവനം എങ്ങനെ പ്രവർത്തിക്കുന്നു?",
      a: "അംഗീകൃത വാഹന ഉടമസ്ഥരുടെ കാറുകൾ കുറഞ്ഞ നിരക്കിലും റീഫണ്ടബിൾ സെക്യൂരിറ്റി ഡെപ്പോസിറ്റിലും സെൽഫ് ഡ്രൈവിനായി ദിവസേനയോ ആഴ്ചയിലോ വാടകയ്‌ക്കെടുക്കാം."
    },
    {
      q: "റൈഡ്-സ്റ്റാർട്ട് OTP എന്തിനാണ് നിർബന്ധമാക്കിയിട്ടുള്ളത്?",
      a: "യാത്രക്കാരുടെയും വാഹനങ്ങളുടെയും പൂർണ്ണ സുരക്ഷയ്ക്കായി 4 അക്ക സുരക്ഷിത കോഡ് നൽകുന്നു. കാറിൽ നേരിട്ടെത്തി യാത്രക്കാരൻ ഈ കോഡ് നൽകാതെ ഡ്രൈവർക്ക് ട്രിപ്പ് ആരംഭിക്കാൻ കഴിയില്ല."
    },
    {
      q: "ഡ്രൈവർമാരുടെ വരുമാനവും കമ്മീഷനും എങ്ങനെയാണ്?",
      a: "DriveC-ൽ സുതാര്യമായ പ്ലാറ്റ്‌ഫോം ഫീസും ഡ്രൈവർ വേതനവുമാണ് നിശ്ചയിച്ചിരിക്കുന്നത്. പണം ഡ്രൈവറുടെ വാലറ്റിലേക്ക് നേരിട്ടെത്തുന്നു."
    },
    {
      q: "പ്രിയപ്പെട്ട ഡ്രൈവർമാരെ (Favourites) സേവ് ചെയ്യാൻ കഴിയുമോ?",
      a: "അതെ, നിങ്ങൾക്ക് ഇഷ്ടപ്പെട്ട ഡ്രൈവർമാരെ ഹാർട്ട് ഐക്കൺ ക്ലിക്ക് ചെയ്ത് ഫേവറിറ്റായി സൂക്ഷിക്കാനും ഭാവി യാത്രകളിൽ വീണ്ടും തിരഞ്ഞെടുക്കാനും കഴിയും."
    },
    {
      q: "ക്യാൻസലേഷൻ പോളിസി എങ്ങനെയാണ്?",
      a: "ഡ്രൈവർ എത്തുന്നതിന് മുൻപായി 20 സെക്കൻഡ് സൗജന്യ ക്യാൻസലേഷൻ വിൻഡോ ലഭ്യമാണ്. ഫീസ് ഇല്ലാതെ റദ്ദാക്കാം."
    }
  ];

  // Accurate JSON-LD structured data strictly according to schema.org
  const jsonLdData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "name": "DriveC Kochi",
        "url": "https://www.drivec.in",
        "logo": "https://www.drivec.in/logo.png",
        "contactPoint": {
          "@type": "ContactPoint",
          "telephone": "+91-484-290-8000",
          "contactType": "customer service",
          "areaServed": "IN-KL",
          "availableLanguage": ["English", "Malayalam"]
        }
      },
      {
        "@type": "FAQPage",
        "mainEntity": faqs.map(f => ({
          "@type": "Question",
          "name": f.q,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": f.a
          }
        }))
      }
    ]
  };

  return (
    <div className="w-full space-y-16">
      
      {/* Inject accurate JSON-LD schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
      />

      {/* Kerala Service Area Hubs Section */}
      <section id="kerala-areas" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="text-[11px] font-black uppercase tracking-widest text-cyan-300 bg-cyan-950/60 px-3 py-1 rounded-full border border-cyan-800/80">
            LOCAL KERALA COVERAGE
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#f5f5f7] mt-2">
            {language === 'en' ? 'Verified Kerala Operational Hubs' : 'കേരളത്തിലെ പ്രവർത്തന കേന്ദ്രങ്ങൾ'}
          </h2>
          <p className="text-sm text-slate-300 mt-1">
            {language === 'en'
              ? 'Real driver availability and depot networks with 24/7 dispatch across major corridors.'
              : 'കേരളത്തിലെ പ്രധാന നഗരങ്ങളിലും വിമാനത്താവളങ്ങളിലും 24 മണിക്കൂറും ലഭ്യമായ സാരഥികൾ.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {KERALA_SERVICE_AREAS.map((area) => (
            <div 
              key={area.id} 
              className="bg-[#14171f] rounded-3xl p-6 border border-[#262b36] shadow-md hover:border-slate-700 hover:bg-[#181c26] transition-all flex flex-col justify-between space-y-4 text-slate-100"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/80">
                      {area.zone}
                    </span>
                    <h3 className="font-bold text-slate-100 text-base mt-1.5">
                      {language === 'en' ? area.name : area.nameMl}
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/80">
                    Active
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {language === 'en' ? area.descriptionEn : area.descriptionMl}
                </p>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-400 block">
                    {language === 'en' ? 'Frequent Transit Corridors:' : 'പ്രധാന റൂട്ടുകൾ:'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {area.popularDestinations.map((dest, i) => (
                      <span key={i} className="text-[10px] bg-[#0d1017] text-slate-300 px-2.5 py-0.5 rounded-md border border-[#262b36]">
                        {dest}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-[#262b36] pt-3 flex justify-between items-center text-[11px] text-slate-400">
                <span>Depot: <strong className="text-slate-200">{area.hub}</strong></span>
                <span className="text-cyan-400 font-semibold">{area.activeFleetCount} Vehicles</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Answer Engine Optimization (AEO) FAQ Section */}
      <section 
        id="aeo-faqs" 
        tabIndex={-1} 
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 scroll-mt-24 sm:scroll-mt-28 outline-none focus:outline-none rounded-3xl transition-all duration-300"
      >
        <div className="text-center mb-10">
          <span className="text-[11px] font-black uppercase tracking-widest text-cyan-300 bg-cyan-950/60 px-3 py-1 rounded-full border border-cyan-800/80">
            TRANSPARENT ANSWERS
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#f5f5f7] mt-2">
            {language === 'en' ? 'Frequently Asked Questions' : 'പതിവായി ചോദിക്കുന്ന ചോദ്യങ്ങൾ'}
          </h2>
          <p className="text-sm text-slate-300 mt-1">
            {language === 'en'
              ? 'Clear, concise answers directly addressing fares, safety verification, and Kerala transport operations.'
              : 'നിരക്കുകൾ, സുരക്ഷ, ഡ്രൈവർ പരിശോധന എന്നിവയെക്കുറിച്ചുള്ള വ്യക്തമായ ഉത്തരങ്ങൾ.'}
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div 
                key={idx} 
                className="bg-[#14171f] rounded-2xl border border-[#262b36] overflow-hidden shadow-sm hover:border-slate-700 transition-all text-slate-100"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex justify-between items-center gap-4 hover:bg-[#181c26] transition-colors"
                >
                  <span className="font-bold text-slate-100 text-xs sm:text-sm">
                    {faq.q}
                  </span>
                  <div className="w-6 h-6 rounded-full bg-[#0d1017] text-slate-300 border border-[#262b36] shrink-0 flex items-center justify-center font-bold text-xs">
                    {isOpen ? '−' : '+'}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-slate-300 leading-relaxed border-t border-[#262b36] pt-3 bg-[#0d1017]/60">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
};
