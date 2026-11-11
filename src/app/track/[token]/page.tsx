"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import 'leaflet/dist/leaflet.css';

interface TripTrackingData {
  active: boolean;
  refCode: string;
  status: string;
  serviceType: string;
  vehicleCategory: string;
  pickupLocation: string;
  destinationLocation: string;
  scheduledDate: string;
  scheduledTime: string;
  passengerName?: string;
  bookingFor?: string;
  pickupCoords?: { lat: number; lng: number } | null;
  destinationCoords?: { lat: number; lng: number } | null;
  routeGeometry?: [number, number][];
  routeDistanceKm?: number;
  routeDurationMins?: number;
  driver: {
    name: string;
    phone?: string | null;
    vehicle: string;
    rating: number;
    trips: number;
  };
  liveLocation: {
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    updatedAt: string | null;
    isLiveGpsReceived: boolean;
  };
  lastUpdated: string;
  error?: string;
}

export default function TripShareTrackingPage() {
  const params = useParams();
  const token = params?.token as string;

  const [trip, setTrip] = useState<TripTrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState<number>(0);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const routeGlowRef = useRef<any>(null);
  const hasFittedBoundsRef = useRef<boolean>(false);

  // Fetch tracking data
  const fetchTrackingData = async (isInitial = false) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/track/${token}`);
      const data = await res.json();

      if (!res.ok || !data.active) {
        setErrorMsg(data.error || 'This trip sharing link has expired or is invalid.');
        setTrip(null);
      } else {
        setTrip(data);
        setErrorMsg(null);
        setLastRefreshedAt(new Date());
      }
    } catch (err: any) {
      if (isInitial) {
        setErrorMsg('Unable to connect to live tracking server. Please check your network.');
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  // Initial load and polling interval (every 4 seconds)
  useEffect(() => {
    fetchTrackingData(true);
    const interval = setInterval(() => {
      fetchTrackingData(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [token]);

  // Seconds since update timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (trip?.liveLocation?.updatedAt) {
        const diff = Math.floor((Date.now() - new Date(trip.liveLocation.updatedAt).getTime()) / 1000);
        setSecondsSinceUpdate(Math.max(0, diff));
      } else {
        const diff = Math.floor((Date.now() - lastRefreshedAt.getTime()) / 1000);
        setSecondsSinceUpdate(Math.max(0, diff));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [trip, lastRefreshedAt]);

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!trip || !mapContainerRef.current) return;

    let isMounted = true;

    // Dynamically import Leaflet on client
    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      const driverLat = trip.liveLocation.lat;
      const driverLng = trip.liveLocation.lng;

      // Custom SVG Icons
      const driverIcon = L.divIcon({
        className: 'custom-driver-icon',
        html: `
          <div style="background: #002C6C; color: #38bdf8; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.6); border: 2px solid #38bdf8;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/>
              <path d="M9 17h6"/>
              <circle cx="17" cy="17" r="2"/>
            </svg>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      // User's Custom Pickup Icon (Red Location Pin, compact fit, no background, anchored at bottom tip)
      const pickupIcon = L.icon({
        iconUrl: '/images/pickup-marker.png',
        iconSize: [28, 40],
        iconAnchor: [14, 40],
        popupAnchor: [0, -40],
        className: 'leaflet-marker-no-bg'
      });

      // User's Custom Drop-off Icon (Destination Flag on Post, compact fit, no background, anchored at base)
      const destIcon = L.icon({
        iconUrl: '/images/dropoff-marker.png',
        iconSize: [34, 35],
        iconAnchor: [14, 35],
        popupAnchor: [0, -35],
        className: 'leaflet-marker-no-bg'
      });

      // Create map instance if not exists
      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [driverLat, driverLng],
          zoom: 13,
          minZoom: 1,
          maxZoom: 19,
          bounceAtZoomLimits: false,
          zoomControl: false, // Positioned explicitly at topright so it is never obstructed
          scrollWheelZoom: true,
          touchZoom: true,
          doubleClickZoom: true,
          boxZoom: true,
          keyboard: true,
          dragging: true,
        });

        // Add standard Leaflet zoom control at topright
        L.control.zoom({ position: 'topright' }).addTo(map);

        // OpenStreetMap Free Tile Layer with proper attribution and full zoom-out capacity (minZoom: 1)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          minZoom: 1,
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors • DriveC Safe Mobility',
        }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // Update or create driver marker
      if (!driverMarkerRef.current) {
        driverMarkerRef.current = L.marker([driverLat, driverLng], { icon: driverIcon })
          .addTo(map)
          .bindPopup(`<b>${trip.driver.name}</b><br/>${trip.driver.vehicle}<br/><span style="color:#059669;font-weight:bold;">● Live Chauffeur En Route</span>`);
      } else {
        driverMarkerRef.current.setLatLng([driverLat, driverLng]);
      }

      // Pickup Marker
      if (trip.pickupCoords) {
        if (!pickupMarkerRef.current) {
          pickupMarkerRef.current = L.marker([trip.pickupCoords.lat, trip.pickupCoords.lng], { icon: pickupIcon })
            .addTo(map)
            .bindPopup(`<b>Pickup:</b> ${trip.pickupLocation}`);
        } else {
          pickupMarkerRef.current.setIcon(pickupIcon);
          pickupMarkerRef.current.setLatLng([trip.pickupCoords.lat, trip.pickupCoords.lng]);
        }
      }

      // Drop-off Marker
      if (trip.destinationCoords) {
        if (!destMarkerRef.current) {
          destMarkerRef.current = L.marker([trip.destinationCoords.lat, trip.destinationCoords.lng], { icon: destIcon })
            .addTo(map)
            .bindPopup(`<b>Drop-off:</b> ${trip.destinationLocation}`);
        } else {
          destMarkerRef.current.setIcon(destIcon);
          destMarkerRef.current.setLatLng([trip.destinationCoords.lat, trip.destinationCoords.lng]);
        }
      }

      // Verified Road Route Polyline using Free OpenStreetMap & OSRM Geometry
      if (trip.pickupCoords && trip.destinationCoords) {
        const routePoints: [number, number][] = (trip.routeGeometry && trip.routeGeometry.length > 0)
          ? trip.routeGeometry
          : [
              [trip.pickupCoords.lat, trip.pickupCoords.lng],
              [driverLat, driverLng],
              [trip.destinationCoords.lat, trip.destinationCoords.lng]
            ];

        // Background glowing casing for high route visibility on OpenStreetMap tiles
        if (!routeGlowRef.current) {
          routeGlowRef.current = L.polyline(routePoints, {
            color: '#38BDF8',
            weight: 8,
            opacity: 0.45,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);
        } else {
          routeGlowRef.current.setLatLngs(routePoints);
        }

        // Main Road Polyline
        if (!polylineRef.current) {
          polylineRef.current = L.polyline(routePoints, {
            color: '#002C6C',
            weight: 5,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);

          // Auto-frame map to show entire journey and driver on initial load
          if (!hasFittedBoundsRef.current) {
            try {
              const bounds = L.latLngBounds(routePoints);
              bounds.extend([driverLat, driverLng]);
              map.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
              hasFittedBoundsRef.current = true;
            } catch (e) {
              console.warn('Map fitBounds warning:', e);
            }
          }
        } else {
          polylineRef.current.setLatLngs(routePoints);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [trip]);

  // Clean up map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const getClickableUrl = (rawUrl: string) => {
    if (!rawUrl) return '';
    if (rawUrl.includes('localhost:')) {
      return rawUrl.replace('localhost:', '127.0.0.1:');
    }
    return rawUrl;
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (typeof window === 'undefined' || !text) return false;
    
    // 1. Try modern Clipboard API if supported and in secure context
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('navigator.clipboard.writeText failed, using fallback:', err);
      }
    }

    // 2. Resilient fallback for HTTP LAN IPs, non-secure contexts, or unsupported browsers
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

  const handleCopyLink = async () => {
    if (typeof window === 'undefined') return;
    const url = getClickableUrl(window.location.href);
    const success = await copyToClipboard(url);
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleFitRoute = () => {
    if (!mapInstanceRef.current || !trip) return;
    import('leaflet').then((L) => {
      const driverLat = trip.liveLocation.lat;
      const driverLng = trip.liveLocation.lng;
      const routePoints: [number, number][] = (trip.routeGeometry && trip.routeGeometry.length > 0)
        ? trip.routeGeometry
        : [
            ...(trip.pickupCoords ? [[trip.pickupCoords.lat, trip.pickupCoords.lng] as [number, number]] : []),
            [driverLat, driverLng],
            ...(trip.destinationCoords ? [[trip.destinationCoords.lat, trip.destinationCoords.lng] as [number, number]] : [])
          ];
      if (routePoints.length > 0) {
        const bounds = L.latLngBounds(routePoints);
        bounds.extend([driverLat, driverLng]);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    });
  };

  const handleShareWhatsApp = () => {
    if (!trip || typeof window === 'undefined') return;
    const url = getClickableUrl(window.location.href);
    const pilotVehicle = trip.driver.vehicle ? ` (${trip.driver.vehicle})` : '';
    const pilotName = trip.driver.name || 'Verified Chauffeur';
    const msg = `* Track my DriveC ride live in real-time!\n* Pickup: ${trip.pickupLocation}\n* Destination: ${trip.destinationLocation}\n* Pilot: ${pilotName}${pilotVehicle}\n\n* Free Live OpenStreetMap Route:\n${url}\n\nReal-time tracking • No app download or login required.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleShareTelegram = () => {
    if (!trip || typeof window === 'undefined') return;
    const url = getClickableUrl(window.location.href);
    const pilotVehicle = trip.driver.vehicle ? ` (${trip.driver.vehicle})` : '';
    const pilotName = trip.driver.name || 'Verified Chauffeur';
    const text = `* Track my DriveC ride live in real-time!\n* Pickup: ${trip.pickupLocation}\n* Destination: ${trip.destinationLocation}\n* Pilot: ${pilotName}${pilotVehicle}\n\n* Free Live OpenStreetMap Route:`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (!trip || typeof window === 'undefined') return;
    const url = getClickableUrl(window.location.href);
    const pilotVehicle = trip.driver.vehicle ? ` (${trip.driver.vehicle})` : '';
    const pilotName = trip.driver.name || 'Verified Chauffeur';
    const shareMessage = `* Track my DriveC ride live in real-time!\n* Pickup: ${trip.pickupLocation}\n* Destination: ${trip.destinationLocation}\n* Pilot: ${pilotName}${pilotVehicle}\n\n* Free Live OpenStreetMap Route:\n${url}\n\nReal-time tracking • No app download or login required.`;

    if (typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
      try {
        await (navigator as any).share({
          title: 'DriveC Live Trip Tracking',
          text: shareMessage,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.warn('navigator.share failed, falling back to clipboard copy:', err);
      }
    }
    // Fallback if navigator.share is unsupported or not in secure context
    await handleCopyLink();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <h2 className="text-xl font-bold tracking-tight">Connecting to DriveC Live Satellite...</h2>
          <p className="text-xs text-slate-400">Loading secure live trip tracking link</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !trip) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
                    <div>
            <h2 className="text-xl font-black text-white">Tracking Link Inactive</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              {errorMsg || 'This trip sharing link has expired or the ride has been completed. For privacy and passenger safety, live location is automatically decommissioned once a trip concludes.'}
            </p>
          </div>
          <div className="p-3 bg-slate-800/60 rounded-xl text-[11px] text-slate-300 border border-slate-700/50">
            DriveC Passenger Safety & Privacy Compliance • Kerala Road Transport Network
          </div>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center gap-1.5 animate-pulse">
            ONGOING RIDE • LIVE EN ROUTE
          </span>
        );
      case 'driver_arriving':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-400/40 flex items-center gap-1.5">
            DRIVER ARRIVING AT PICKUP
          </span>
        );
      case 'arrived':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-500/20 text-cyan-300 border border-blue-400/40 flex items-center gap-1.5">
            DRIVER ARRIVED AT PICKUP LOCATION
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-700 text-slate-200">
            {status.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-100">
      <style jsx global>{`
        .leaflet-marker-no-bg {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          outline: none !important;
        }
        .leaflet-popup-content-wrapper, .leaflet-popup-tip {
          background: #14171f !important;
          color: #f5f5f7 !important;
          border: 1px solid #262b36 !important;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5) !important;
        }
        .leaflet-popup-content {
          margin: 10px 14px !important;
          line-height: 1.5 !important;
          font-size: 12px !important;
          color: #e2e8f0 !important;
        }
        .leaflet-container a.leaflet-popup-close-button {
          color: #94a3b8 !important;
          padding: 6px !important;
        }
        .leaflet-container a.leaflet-popup-close-button:hover {
          color: #ffffff !important;
        }
        .leaflet-top.leaflet-right {
          margin-top: 4.5rem !important;
          margin-right: 0.75rem !important;
        }
        .leaflet-control-zoom {
          border-radius: 12px !important;
          overflow: hidden !important;
          border: 1px solid rgba(51, 65, 85, 0.8) !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4) !important;
        }
        .leaflet-control-zoom a {
          background-color: rgba(15, 23, 42, 0.95) !important;
          color: #f8fafc !important;
          border-bottom: 1px solid rgba(51, 65, 85, 0.8) !important;
          width: 32px !important;
          height: 32px !important;
          line-height: 32px !important;
          font-weight: bold !important;
          transition: background-color 0.15s ease !important;
        }
        .leaflet-control-zoom a:hover {
          background-color: #1e293b !important;
          color: #38bdf8 !important;
        }
      `}</style>
      {/* Top Navbar */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#002C6C] to-blue-600 flex items-center justify-center font-black text-white text-base shadow-md">
            DC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-wide text-white">DriveC Live Trip Sharing</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30">
                Public Live View
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Trip Ref: #{trip.refCode}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge(trip.status)}
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
            title="Share via WhatsApp"
          >
            <span>WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition-colors shadow-xs cursor-pointer"
            title="Copy Public Tracking Link"
          >
            <span>{copiedLink ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </header>

      {/* Main Grid: Map & Details */}
      <main className="flex-1 flex flex-col lg:flex-row relative">
        {/* Left / Top Map Container */}
        <div className="flex-1 min-h-[50vh] lg:min-h-full relative bg-slate-900">
          <div ref={mapContainerRef} className="w-full h-full min-h-[50vh] lg:min-h-[calc(100vh-61px)] z-0" />
          
          {/* Live GPS Floating Overlay */}
          <div className="absolute top-4 left-4 z-10 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-2xl p-3 shadow-xl max-w-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-white tracking-wide">OpenStreetMap Free Live GPS</span>
            </div>
            <p className="text-[10px] text-slate-400">
              {trip.liveLocation.isLiveGpsReceived 
                ? `Live device coordinates: ${trip.liveLocation.lat.toFixed(4)}, ${trip.liveLocation.lng.toFixed(4)}`
                : 'Transmitting live chauffeur road updates'}
            </p>
            <div className="text-[10px] text-emerald-400 font-mono pt-0.5">
              Updated: {secondsSinceUpdate === 0 ? 'Just now' : `${secondsSinceUpdate}s ago`}
            </div>
          </div>

          {/* Map Zoom & Route Controls (Top Right) */}
          <div className="absolute top-4 right-14 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-2xl p-1.5 shadow-xl">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                mapInstanceRef.current?.zoomIn();
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold flex items-center justify-center transition-colors cursor-pointer text-lg leading-none select-none shadow-xs"
              title="Zoom In (+)"
            >
              +
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                mapInstanceRef.current?.zoomOut();
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold flex items-center justify-center transition-colors cursor-pointer text-lg leading-none select-none shadow-xs"
              title="Zoom Out (−)"
            >
              −
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleFitRoute();
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              className="px-2.5 h-8 rounded-xl bg-[#002C6C] hover:bg-blue-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Fit Full Route and Live Driver"
            >
              <span className="hidden sm:inline">Fit Route</span>
            </button>
          </div>

          {/* Road Route Verification Badge on Map */}
          <div className="absolute bottom-6 left-4 z-10 bg-slate-900/90 backdrop-blur-md border border-blue-500/40 rounded-xl px-3 py-2 shadow-xl text-xs space-y-0.5 pointer-events-none">
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[11px]">
              <span>Real Road Route (Free OpenStreetMap & OSRM)</span>
            </div>
            <div className="text-[10px] text-slate-300">
              {trip.routeDistanceKm ? `${trip.routeDistanceKm} km total distance` : 'Verified road polyline'}
              {trip.routeDurationMins ? ` • ~${trip.routeDurationMins} min estimated` : ''}
            </div>
          </div>
        </div>

        {/* Right / Bottom Info Panel */}
        <aside className="w-full lg:w-96 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-5 space-y-5 overflow-y-auto z-10 shadow-2xl">
          {/* Driver Card */}
          <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-900 flex items-center justify-center font-bold text-lg text-white border-2 border-white/20 shadow-md">
                {trip.driver.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-black text-white text-base truncate">{trip.driver.name}</h3>
                  </div>
                <div className="flex items-center gap-2 text-xs text-slate-300 mt-0.5">
                  <span className="flex items-center gap-1 text-cyan-300 font-bold">
                    {trip.driver.rating.toFixed(1)}
                  </span>
                  <span>•</span>
                  <span>{trip.driver.trips} verified trips</span>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-700/50 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="font-semibold text-white">{trip.driver.vehicle}</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                {trip.vehicleCategory}
              </span>
            </div>
          </div>

          {/* Passenger Information */}
          <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/60 space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Travelling Passenger</span>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>{trip.passengerName}</span>
              {trip.bookingFor === 'someone_else' && (
                <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full">
                  Travel Guest
                </span>
              )}
            </div>
          </div>

          {/* Route Details */}
          <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Trip Route</span>
              {trip.routeDistanceKm ? (
                <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/70 border border-cyan-800/60 px-2 py-0.5 rounded-full">
                  {trip.routeDistanceKm} km • ~{trip.routeDurationMins || 20} min
                </span>
              ) : null}
            </div>
            <div className="space-y-3 relative pl-7 before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-600">
              {/* Pickup */}
              <div className="relative">
                <div className="absolute -left-[27px] top-0.5 w-5 h-5 flex items-center justify-center">
                  <img src="/images/pickup-marker.png" alt="Pickup" className="w-5 h-5 object-contain" />
                </div>
                <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span>Pickup</span>
                </div>
                <div className="text-xs font-semibold text-white">{trip.pickupLocation}</div>
              </div>

              {/* Drop-off */}
              <div className="relative">
                <div className="absolute -left-[27px] top-0.5 w-5 h-5 flex items-center justify-center">
                  <img src="/images/dropoff-marker.png" alt="Drop-off" className="w-5 h-5 object-contain" />
                </div>
                <div className="text-[10px] text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span>Drop-off</span>
                </div>
                <div className="text-xs font-semibold text-white">{trip.destinationLocation}</div>
              </div>
            </div>
          </div>

          {/* Share Live Route Section */}
          <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-xs">
              <span>Share Live Route with Family or Friends</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Anyone with this link can watch the ride live on their phone or computer. Completely free OpenStreetMap tracking, zero login required.
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {/* WhatsApp */}
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer transition-colors"
                title="Share via WhatsApp"
              >
                <span>WhatsApp</span>
              </button>
              {/* Telegram */}
              <button
                type="button"
                onClick={handleShareTelegram}
                className="py-2.5 px-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer transition-colors"
                title="Share via Telegram"
              >
                <span>Telegram</span>
              </button>
              {/* Copy Link */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="py-2.5 px-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer transition-colors"
                title="Copy Live Tracking Link"
              >
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Safety & Open Technology Notice */}
          <div className="p-4 bg-blue-950/40 border border-blue-800/40 rounded-2xl space-y-2 text-xs">
            <div className="flex items-center gap-2 text-blue-300 font-bold">
              <span>DriveC Public Safety Guarantee</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              This trip is actively governed under Kerala Road Transport compliance. OpenStreetMap and Project OSRM power this live view without proprietary or paid tracking lock-in.
            </p>
          </div>

          <div className="text-center pt-2">
            <p className="text-[10px] text-slate-500">
              Read-Only Safe Tracking Mode • No login required • Recipient cannot alter trip
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
