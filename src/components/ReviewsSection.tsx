"use client";

import React, { useState } from 'react';
import { Language, UserRole, Review, Booking } from '../types';
import { translations } from '../lib/translations';

interface ReviewsSectionProps {
  language: Language;
  reviews: Review[];
  completedBookings: Booking[];
  currentUser: {
    id: string;
    role: UserRole;
    name: string;
    phone: string;
  };
  onOpenGuestWarning: (actionName?: string) => void;
  onSubmitReview: (review: Review) => void;
}

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({
  language,
  reviews,
  completedBookings,
  currentUser,
  onOpenGuestWarning,
  onSubmitReview
}) => {
  const t = translations[language];
  const isGuest = currentUser.role === 'guest';

  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Requirement 1: Eligible bookings are ONLY customer's completed bookings that have not already been reviewed
  const eligibleBookings = completedBookings.filter(b => {
    const isCompleted = b.status === 'completed';
    const isThisCustomer = !currentUser.id || b.customerId === currentUser.id || (Boolean(currentUser.phone) && b.customerPhone === currentUser.phone);
    const alreadyReviewed = reviews.some(r => r.bookingId === b.id || (r.bookingRef && r.bookingRef === b.refCode));
    return isCompleted && isThisCustomer && !alreadyReviewed;
  });

  const [selectedBookingId, setSelectedBookingId] = useState(eligibleBookings[0]?.id || '');
  const [punctuality, setPunctuality] = useState(5);
  const [cleanliness, setCleanliness] = useState(5);
  const [comfort, setComfort] = useState(5);
  const [overall, setOverall] = useState(5);
  const [comment, setComment] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Selected booking object for driver details
  const targetBooking = eligibleBookings.find(b => b.id === selectedBookingId) || eligibleBookings[0];

  // Calculate strict real metrics from manually entered reviews only
  const totalCount = reviews.length;
  const avgOverall = totalCount > 0 
    ? (reviews.reduce((acc, r) => acc + r.overallRating, 0) / totalCount).toFixed(1)
    : '0.0';
  const avgPunctuality = totalCount > 0 
    ? (reviews.reduce((acc, r) => acc + r.punctualityRating, 0) / totalCount).toFixed(1)
    : '0.0';
  const avgCleanliness = totalCount > 0 
    ? (reviews.reduce((acc, r) => acc + r.cleanlinessRating, 0) / totalCount).toFixed(1)
    : '0.0';
  const avgComfort = totalCount > 0 
    ? (reviews.reduce((acc, r) => acc + r.comfortRating, 0) / totalCount).toFixed(1)
    : '0.0';

  const handleOpenReviewModal = () => {
    if (isGuest) {
      onOpenGuestWarning(language === 'en' ? 'Submit verified ride review' : 'യാത്രാ റിവ്യൂ നൽകുക');
      return;
    }
    if (eligibleBookings.length === 0) {
      const hasAnyCompleted = completedBookings.some(b => 
        b.status === 'completed' && (!currentUser.id || b.customerId === currentUser.id || (Boolean(currentUser.phone) && b.customerPhone === currentUser.phone))
      );
      if (hasAnyCompleted) {
        setErrorMsg('You have already submitted reviews for all your completed trips. Each completed trip can only be reviewed once.');
      } else {
        setErrorMsg('You can only submit a verified review after your trip is marked Completed. Please book and complete a ride first!');
      }
      setIsModalOpen(true);
      return;
    }
    setSelectedBookingId(eligibleBookings[0].id);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingId && !targetBooking) {
      setErrorMsg('Please select a driver from your completed rides to review.');
      return;
    }
    const finalBooking = targetBooking || eligibleBookings.find(b => b.id === selectedBookingId);
    if (!finalBooking) {
      setErrorMsg('Selected booking not found.');
      return;
    }
    if (finalBooking.status !== 'completed') {
      setErrorMsg('Reviews are only permitted for completed trips.');
      return;
    }
    if (reviews.some(r => r.bookingId === finalBooking.id || (r.bookingRef && r.bookingRef === finalBooking.refCode))) {
      setErrorMsg('A review has already been submitted for this booking.');
      return;
    }

    const newRev: Review = {
      id: 'rev-' + Date.now(),
      bookingId: finalBooking.id,
      bookingRef: finalBooking.refCode,
      reviewerId: currentUser.id,
      reviewerName: currentUser.name,
      reviewerRole: 'customer',
      targetId: finalBooking.driverId || 'drv-general',
      targetName: finalBooking.driverName || 'DriveC Driver',
      targetRole: 'driver',
      punctualityRating: punctuality,
      cleanlinessRating: cleanliness,
      comfortRating: comfort,
      overallRating: overall,
      comment: comment.trim() || 'Exceptional driver service adhering to DriveC standards.',
      createdAt: new Date().toISOString(),
      verifiedTrip: true
    };

    onSubmitReview(newRev);
    setIsModalOpen(false);
    setComment('');
  };

  return (
    <section id="reviews-section" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
        <div>
          <span className="text-[11px] font-black uppercase tracking-widest text-cyan-300 bg-cyan-950/60 px-3 py-1 rounded-full border border-cyan-800/80">
            TRANSPARENCY GUARANTEE
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#f5f5f7] mt-2">
            {t.reviews.title}
          </h2>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            {t.reviews.subtitle}
          </p>
        </div>

        <button
          onClick={handleOpenReviewModal}
          className="px-5 py-3 rounded-2xl bg-[#002C6C] hover:bg-[#001f4d] text-white text-xs font-bold shadow-md shadow-blue-950/20 transition-all flex items-center gap-2 shrink-0 self-start md:self-auto"
        >
          <span>{t.reviews.writeReview}</span>
        </button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#14171f] p-5 rounded-3xl border border-[#262b36] shadow-xs flex flex-col justify-between text-slate-100">
          <span className="text-xs font-semibold text-slate-400">{t.reviews.overall}</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-cyan-400">{avgOverall}</span>
            <span className="text-xs text-slate-400">/ 5.0</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Based on {totalCount} authentic reviews</span>
        </div>

        <div className="bg-[#14171f] p-5 rounded-3xl border border-[#262b36] shadow-xs flex flex-col justify-between text-slate-100">
          <span className="text-xs font-semibold text-slate-400">{t.reviews.punctuality}</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-emerald-400">{avgPunctuality}</span>
            <span className="text-xs text-slate-400">/ 5.0</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Flight & train sync precision</span>
        </div>

        <div className="bg-[#14171f] p-5 rounded-3xl border border-[#262b36] shadow-xs flex flex-col justify-between text-slate-100">
          <span className="text-xs font-semibold text-slate-400">{t.reviews.cleanliness}</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-cyan-400">{avgCleanliness}</span>
            <span className="text-xs text-slate-400">/ 5.0</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Sanitized interior standard</span>
        </div>

        <div className="bg-[#14171f] p-5 rounded-3xl border border-[#262b36] shadow-xs flex flex-col justify-between text-slate-100">
          <span className="text-xs font-semibold text-slate-400">{t.reviews.comfort}</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-indigo-300">{avgComfort}</span>
            <span className="text-xs text-slate-400">/ 5.0</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Air-conditioning & smooth transit</span>
        </div>
      </div>

      {/* Reviews List or Empty State */}
      {reviews.length === 0 ? (
        <div className="bg-[#14171f] border border-[#262b36] rounded-3xl p-12 text-center max-w-2xl mx-auto space-y-3 text-slate-200">
          <h4 className="font-bold text-slate-100 text-base">
            No Fabricated Reviews
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            {t.reviews.emptyState}
          </p>
          <div className="pt-2">
            <button
              onClick={handleOpenReviewModal}
              className="text-xs font-bold text-cyan-400 hover:underline"
            >
              Have a completed Kerala ride? Click here to rate your driver.
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((r) => (
            <div key={r.id} className="bg-[#14171f] rounded-3xl p-6 border border-[#262b36] shadow-xs space-y-4 text-slate-100">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-100 text-sm">{r.reviewerName}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80">
                      Verified Trip
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">Trip #{r.bookingRef}</span>
                </div>
                <div className="flex items-center gap-1 text-cyan-300 font-black text-sm bg-[#002C6C]/40 px-2.5 py-1 rounded-lg border border-cyan-800/60">
                  <span>{r.overallRating}.0 / 5</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed italic">
                "{r.comment}"
              </p>

              <div className="border-t border-[#262b36] pt-3 grid grid-cols-3 gap-1 text-[10px] text-slate-400">
                <div>
                  <span>Punctuality: </span>
                  <strong className="text-slate-200">{r.punctualityRating}/5</strong>
                </div>
                <div>
                  <span>Hygiene: </span>
                  <strong className="text-slate-200">{r.cleanlinessRating}/5</strong>
                </div>
                <div>
                  <span>Comfort: </span>
                  <strong className="text-slate-200">{r.comfortRating}/5</strong>
                </div>
              </div>

              {/* Requirement 10: Official Admin Reply visible to everyone */}
              {r.adminReply && (
                <div className="p-3 bg-[#0d1017] border border-[#262b36] rounded-2xl text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-cyan-300 text-[11px]">
                    <span>DriveC Official Admin Response</span>
                    {r.adminRepliedAt && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        • {new Date(r.adminRepliedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-300 leading-relaxed italic">{r.adminReply}</p>
                </div>
              )}

              <div className="text-[10px] text-slate-400 flex justify-between pt-1 border-t border-[#262b36]">
                <span>Driver: {r.targetName}</span>
                <span>{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Submission Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="w-full max-w-lg bg-[#14171f] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#262b36] space-y-5 text-slate-100">
            <div className="flex justify-between items-center border-b border-[#262b36] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Post-Journey Assessment</span>
                <h3 className="text-lg font-bold text-slate-100">{t.reviews.writeReview}</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {errorMsg ? (
              <div className="space-y-4 py-2">
                <div className="p-4 bg-[#0d1017] border border-[#262b36] rounded-2xl flex gap-3 text-xs text-slate-200">
                  <div>
                    <p className="font-bold text-slate-100">Review Eligibility Locked</p>
                    <p className="mt-1 text-slate-400">{errorMsg}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-[#002C6C] hover:bg-[#001f4d] text-white font-semibold text-xs"
                >
                  Understood
                </button>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
                {/* Requirement 1: Dropdown containing drivers customer has actually booked */}
                <div>
                  <label className="block font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                    <span>Select Booked Driver to Review *</span>
                    <span className="text-[10px] text-cyan-300 font-semibold bg-[#0d1424] px-2 py-0.5 rounded border border-blue-800/70">
                      Verified Completed Rides ({eligibleBookings.length})
                    </span>
                  </label>
                  <select
                    value={selectedBookingId}
                    onChange={(e) => setSelectedBookingId(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#262b36] rounded-xl outline-none bg-[#0d1017] font-semibold text-slate-100 text-xs focus:ring-2 focus:ring-cyan-500"
                  >
                    {eligibleBookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.driverName || 'Designated Driver'} — Trip #{b.refCode} ({b.pickupLocation} ➔ {b.destinationLocation})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Drivers from your completed Kerala rides. Each completed booking can only be reviewed once.
                  </p>
                </div>

                {/* Selected Driver & Trip Overview */}
                {targetBooking && (
                  <div className="p-3 bg-[#0d1424] border border-blue-800/70 rounded-xl text-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider block">Assigned Driver</span>
                      <strong className="text-slate-100 font-black text-sm">{targetBooking.driverName || 'DriveC Driver'}</strong>
                      <span className="text-[11px] text-slate-400 block">Trip #{targetBooking.refCode} • Date: {targetBooking.scheduledDate}</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-950/70 text-emerald-300 text-[10px] font-bold border border-emerald-700/80">
                      Ride Completed ✓
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 bg-[#0d1017] p-4 rounded-2xl border border-[#262b36]">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Punctuality (1-5)</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={punctuality}
                      onChange={(e) => setPunctuality(parseInt(e.target.value) || 5)}
                      className="w-full px-3 py-1.5 border border-[#262b36] rounded-lg font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Cleanliness (1-5)</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={cleanliness}
                      onChange={(e) => setCleanliness(parseInt(e.target.value) || 5)}
                      className="w-full px-3 py-1.5 border border-[#262b36] rounded-lg font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Vehicle Comfort (1-5)</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={comfort}
                      onChange={(e) => setComfort(parseInt(e.target.value) || 5)}
                      className="w-full px-3 py-1.5 border border-[#262b36] rounded-lg font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Overall Service (1-5)</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={overall}
                      onChange={(e) => setOverall(parseInt(e.target.value) || 5)}
                      className="w-full px-3 py-1.5 border border-[#262b36] rounded-lg font-bold text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Authentic Feedback Comments *</label>
                  <textarea
                    rows={3}
                    required
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Describe vehicle condition, driver courtesy, route navigation, and punctuality..."
                    className="w-full px-3 py-2 border border-[#262b36] rounded-xl outline-none"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-[#002C6C] hover:bg-[#004B93] text-white font-bold shadow-md"
                >
                  Post Authentic Review
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </section>
  );
};
