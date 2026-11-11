"use client";

import React, { useState, useEffect } from 'react';
import { Language } from '../types';

interface HeroSectionProps {
  language: Language;
  isGuest?: boolean;
  onOpenGuestWarning?: (actionName?: string) => void;
  onNavigateSection?: (sectionId: string) => void;
}

interface HeroImageSlide {
  id: string;
  image: string;
  titleEn: string;
  titleMl: string;
  filterClass: string;
  tag: string;
}

const HERO_IMAGE_SLIDES: HeroImageSlide[] = [
  {
    id: 'driver-wheel',
    image: '/hero-driver-wheel.jpg',
    titleEn: 'Professional Driver behind the wheel at dusk',
    titleMl: 'പ്രൊഫഷണൽ ഡ്രൈവർ സർവീസ്',
    // Rich contrast, vivid twilight sunset bokeh, deep cabin details
    filterClass: 'contrast-[1.14] saturate-[1.25] brightness-[1.03]',
    tag: 'Executive Driver'
  },
  {
    id: 'ghat-road',
    image: '/hero-ghat-road.jpg',
    titleEn: 'Serpentine mountain ghat pass through lush Kerala forests',
    titleMl: 'മൂന്നാർ ഹൈറേഞ്ച് ടൂർ യാത്രകൾ',
    // Vivid emerald mountain greens, crisp road contrast, deep forest textures
    filterClass: 'contrast-[1.16] saturate-[1.32] brightness-[1.04]',
    tag: 'Munnar Ghat Pass'
  },
  {
    id: 'kochi-culture',
    image: '/hero-kochi-culture.jpg',
    titleEn: 'Authentic Ernakulam street scene with KL-43 rickshaw',
    titleMl: 'കൊച്ചിയുടെ പാരമ്പര്യവും നഗര യാത്രകളും',
    // Vibrant festive reds, vivid auto-rickshaw yellows, deep foliage
    filterClass: 'contrast-[1.12] saturate-[1.28] brightness-[1.04]',
    tag: 'Authentic Kochi'
  }
];

export const HeroSection: React.FC<HeroSectionProps> = ({
  language
}) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-cycle the visual hero images every 5.5 seconds
  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % HERO_IMAGE_SLIDES.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const handleSelectSlide = (idx: number) => {
    setActiveSlide(idx);
    setIsAutoPlaying(false);
  };

  return (
    <div className="w-full">
      {/* ========================================================================= */}
      {/* PURE PHOTOGRAPHIC HERO BACKGROUND CAROUSEL */}
      {/* ========================================================================= */}
      <section 
        className="relative h-[85vh] sm:h-[90vh] lg:h-[94vh] w-full overflow-hidden bg-slate-950 flex flex-col justify-between"
        onMouseEnter={() => setIsAutoPlaying(false)}
        onMouseLeave={() => setIsAutoPlaying(true)}
      >
        {/* Full-Bleed Images with Enhanced Color Tones & Smooth Cross-Fade */}
        <div className="absolute inset-0 w-full h-full">
          {HERO_IMAGE_SLIDES.map((slide, idx) => {
            const isActive = activeSlide === idx;
            return (
              <div
                key={slide.id}
                className={`absolute inset-0 w-full h-full transition-all duration-1000 ease-in-out ${
                  isActive 
                    ? 'opacity-100 scale-100' 
                    : 'opacity-0 scale-105 pointer-events-none'
                }`}
              >
                <img
                  src={slide.image}
                  alt={language === 'en' ? slide.titleEn : slide.titleMl}
                  className={`w-full h-full object-cover object-center ${slide.filterClass}`}
                />
              </div>
            );
          })}

          {/* Subtle Top & Bottom Gradient Vignettes for Header Contrast and Smooth Transition into Services */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-transparent to-[#090a0f] pointer-events-none"></div>
          {/* Subtle ambient film grain/glow */}
          <div className="absolute inset-0 bg-cyan-950/15 mix-blend-color pointer-events-none"></div>
        </div>

        {/* Carousel Slide Indicators & Navigation Controls */}
        <div className="relative z-20 mt-auto pb-6 sm:pb-8 flex items-center justify-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
            {HERO_IMAGE_SLIDES.map((slide, idx) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => handleSelectSlide(idx)}
                aria-label={`Slide ${idx + 1}`}
                className={`transition-all rounded-full ${
                  activeSlide === idx 
                    ? 'w-6 h-1.5 bg-cyan-400' 
                    : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
