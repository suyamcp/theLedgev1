/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  MapPin, 
  ArrowDown, 
  Flame, 
  ShieldCheck, 
  Wifi, 
  Compass, 
  Coffee, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  CalendarDays,
  Sliders,
  Eye,
  Settings,
  Image as ImageIcon,
  Check,
  X,
  Lock
} from 'lucide-react';
import Navigation from './components/Navigation';
import BookingSystem from './components/BookingSystem';
import AboutSection from './components/AboutSection';
import ServicesSection from './components/ServicesSection';
import FAQsSection from './components/FAQsSection';
import AdminPanel from './components/AdminPanel';
import CookieConsent from './components/CookieConsent';
import { getCMSData, CMSData, saveCMSData } from './lib/cmsState';
import { Booking } from './types';

export default function App() {
  const [activeSection, setActiveSection] = useState<string>('');
  const [preselectedRoomId, setPreselectedRoomId] = useState<string>('unit-premium');
  const [showNotification, setShowNotification] = useState<boolean>(false);
  const [notificationMsg, setNotificationMsg] = useState<string>('');

  // --- NEW TWO-SYSTEM STATES ---
  const [showAdmin, setShowAdmin] = useState<boolean>(false);
  const [cmsData, setCmsData] = useState<CMSData>(getCMSData());
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Load CMS data from server
  useEffect(() => {
    fetch('/api/content')
      .then(res => res.json())
      .then(dbContent => {
        const local = getCMSData();
        const merged: CMSData = {
          hero: dbContent.hero || local.hero,
          about: dbContent.about || local.about,
          accommodations: (dbContent.accommodations && dbContent.accommodations.length > 0) ? dbContent.accommodations : local.accommodations,
          services: (dbContent.services && dbContent.services.length > 0) ? dbContent.services : local.services,
          faqs: dbContent.faqs || local.faqs
        };
        setCmsData(merged);
        saveCMSData(merged);
      })
      .catch(err => {
        console.error('Failed to load CMS content from server, using local fallback:', err);
      });
  }, []);

  // Load bookings from the server. Admins (with a session token) get full records;
  // everyone else gets the no-PII availability feed used to draw the calendar.
  const refreshBookings = useCallback(() => {
    const token = sessionStorage.getItem('ledge_admin_token');
    if (token) {
      fetch('/api/bookings', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => {
          // A stale token used to fail silently and leave the panel looking empty.
          // Drop it and tell the admin panel to ask for a fresh login instead.
          if (res.status === 401) {
            sessionStorage.removeItem('ledge_admin_token');
            window.dispatchEvent(new Event('vp-admin-session-expired'));
            throw new Error('Admin session expired');
          }
          if (!res.ok) throw new Error('Failed to load bookings');
          return res.json();
        })
        .then(data => { if (Array.isArray(data)) setBookings(data); })
        .catch(err => console.error('Error loading admin bookings:', err));
    } else {
      fetch('/api/availability')
        .then(res => res.json())
        .then(data => {
          if (!Array.isArray(data)) return;
          setBookings(data.map((row: any, index: number) => ({
            id: `avail-${index}`,
            customerName: '',
            customerEmail: '',
            customerPhone: '',
            checkIn: row.checkIn,
            checkOut: row.checkOut,
            accommodationId: row.roomTypeSlug,
            guestsCount: 0,
            totalAmount: 0,
            addOns: [],
            status: row.status,
            createdAt: '',
          })));
        })
        .catch(err => console.error('Error loading public availability:', err));
    }
  }, []);

  useEffect(() => {
    // Drop any stale demo bookings a previous build cached in the browser.
    try { localStorage.removeItem('ledge_bookings'); } catch { /* noop */ }
    refreshBookings();
  }, [showAdmin, refreshBookings]);

  // Sync scroll position to highlight navigation
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['about', 'rates', 'services', 'faqs', 'booking_portal_section'];
      const scrollPosition = window.scrollY + 120;

      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleBookRoom = (roomId: string) => {
    setPreselectedRoomId(roomId);
    
    // Smooth scroll down to booking section
    const target = document.getElementById('booking_portal_section');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
    
    const selectedAcc = cmsData.accommodations.find(a => a.id === roomId);
    const roomName = selectedAcc?.name || 'Your selected plot';
    triggerCustomToast(`Pre-selected "${roomName}". Calendar updated!`);
  };

  const triggerCustomToast = (msg: string) => {
    setNotificationMsg(msg);
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
    }, 4500);
  };

  const handleScrollToBooking = () => {
    const target = document.getElementById('booking_portal_section');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleUpdateBookings = (newBookings: Booking[]) => {
    setBookings(newBookings);
  };

  return (
    <div className="min-h-screen bg-pine-950 text-cream-50 font-sans selection:bg-gold-500 selection:text-ink antialiased overflow-x-hidden">

      <CookieConsent />

      {/* Toast Notification HUD */}
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-28 left-1/2 -translate-x-1/2 z-[110] px-5 py-3 rounded-xl bg-gold-500 text-ink font-display font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-2xl shadow-gold-500/20 border border-gold-300"
            id="toast_notification_hud"
          >
            <Sparkles className="w-4 h-4 text-ink" />
            <span>{notificationMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==============================================
          1. ADMIN CONTROL SYSTEM PANEL
          ============================================== */}
      {showAdmin ? (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 min-h-[85vh] animate-fadeIn">
          <AdminPanel
            currentData={cmsData}
            onDataChange={(newData) => setCmsData(newData)}
            bookings={bookings}
            onBookingsChange={handleUpdateBookings}
            onRefreshBookings={refreshBookings}
            onClose={() => setShowAdmin(false)}
          />
        </main>
      ) : (
        /* ==============================================
            2. CUSTOMER FRONT-FACING PUBLIC SYSTEM
            ============================================== */
        <div className="animate-fadeIn">
          
          {/* Main navigation header */}
          <Navigation 
            onBookNowClick={handleScrollToBooking} 
            activeSection={activeSection} 
            onAdminClick={() => {
              setShowAdmin(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />

          {/* --- HERO PORTRAIT SECTION --- */}
          <header className="relative min-h-[90vh] flex flex-col justify-between items-center text-center overflow-hidden" id="hero_billboard">
            {/* Underlay backdrop (dynamic URL, default solid if empty) */}
            <div className="absolute inset-0 z-0 bg-pine-950">
              {cmsData.hero.backgroundImage ? (
                <img 
                  src={cmsData.hero.backgroundImage} 
                  alt="The Ledge Atmospheric Backdrop" 
                  className="w-full h-full object-cover brightness-[0.35]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pine-950 via-pine-900 to-pine-950 flex items-center justify-center border-b border-pine-850 p-6">
                  {/* Elegant solid pattern fallback displaying a subtle structural wireframe layout */}
                  <div className="border border-dashed border-pine-800 rounded-3xl p-8 max-w-lg text-center text-neutral-500 space-y-2 opacity-50">
                    <ImageIcon className="w-8 h-8 mx-auto text-neutral-600 animate-pulse" />
                    <span className="font-display font-black text-xs uppercase tracking-widest text-neutral-500 block">Cover Image Placeholder</span>
                    <p className="text-[10px] text-neutral-600">This area will display your big backdrop image. Upload custom image links inside the Admin Control Panel.</p>
                  </div>
                </div>
              )}
              {/* Foggy / Vignette overlay */}
              <div className="img-fade absolute inset-0 bg-gradient-to-b from-pine-950/60 via-transparent to-pine-950" />
              <div className="img-fade absolute inset-r-0 h-1/4 bg-gradient-to-t from-transparent to-pine-950/90" />
            </div>

            {/* Floating geographical coordinates */}
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 flex justify-between sm:justify-end z-10" id="hero_upper_credits">
              <div className="text-left sm:text-right">
                <span className="text-[10px] uppercase font-black tracking-widest text-[#e0bb73]/90 block font-display">
                  [EST. YEAR — LOCATION]
                </span>
                <span className="text-[8px] tracking-[0.15em] text-paper-50/60 block font-mono mt-0.5">
                  16.3792° N, 120.5755° E
                </span>
              </div>
            </div>

            {/* Core display message with the pulsing pill BOOK NOW button */}
            <div className="max-w-4xl mx-auto px-4 z-10 py-16 sm:py-24 flex flex-col items-center justify-center space-y-8 animate-fadeIn" id="hero_title_cta_group">
              
              <div className="space-y-4">
                {/* Elegant subheader tagline */}
                <span className="text-xs uppercase font-extrabold tracking-[0.3em] text-gold-500 block font-display bg-gold-500/5 py-1.5 px-4 rounded-full border border-gold-500/10 backdrop-blur w-fit mx-auto">
                  {cmsData.hero.tagline || "[BRAND TAGLINE PLACEHOLDER]"}
                </span>
                
                <h1 className="font-serif font-black text-4xl sm:text-6xl text-paper-50 leading-tight tracking-tight pt-2 drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
                  {cmsData.hero.title || "[SITE TITLE PLACEHOLDER]"}
                </h1>
                
                <p className="text-sm sm:text-base text-paper-50/85 max-w-2xl mx-auto leading-relaxed font-light min-h-[30px] drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)]">
                  {cmsData.hero.description || "[This is a placeholder for your introduction paragraph. To customize this text, click \"Open Admin Panel\" in the system toggle bar at the top of your screen.]"}
                </p>
              </div>

              {/* PULSING PILL BOOK NOW BUTTON */}
              <button
                onClick={handleScrollToBooking}
                className="neon-btn-glow py-4 px-10 rounded-full bg-black/85 backdrop-blur-sm border-2 border-[#2f7d4e] hover:border-gold-500 hover:bg-gold-500 text-paper-50 hover:text-ink font-display font-extrabold text-sm tracking-[0.2em] transition-all hover:scale-105 active:scale-95 shadow-2xl relative group cursor-pointer"
                id="hero_pill_book_now_btn"
              >
                <span className="relative z-10 flex items-center gap-3">
                  BOOK NOW <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
            </div>

            {/* Ambient indicator bar at footer */}
            <div className="z-10 pb-8 flex flex-col items-center gap-1.5 cursor-pointer animate-bounce text-paper-50/70 hover:text-[#e0bb73]" onClick={handleScrollToBooking} id="arrow_indicator">
              <span className="text-[9px] uppercase font-bold tracking-widest font-display">Discover Experience</span>
              <ArrowDown className="w-4 h-4" />
            </div>
          </header>

          {/* --- ACCOMMODATIONS & RATES SECTION ('Rates' link) --- */}
          <section id="rates" className="py-24 bg-pine-950 text-cream-50 border-t border-pine-900/60 scroll-mt-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              <div className="text-left max-w-3xl mb-16 space-y-4">
                <span className="text-xs uppercase font-extrabold tracking-widest text-gold-400 font-display block">
                  ACCOMMODATION SCHEMES
                </span>
                <h2 className="font-serif font-black text-3xl sm:text-4xl text-cream-100 leading-tight">
                  Rates & Options
                </h2>
                <p className="text-sm text-neutral-400 leading-relaxed max-w-2xl">
                  [RATES SECTION INTRO — one or two lines describing the range of stays you offer.]
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8" id="rates_showcase_grid">
                {cmsData.accommodations.map((room) => {
                  const hasDetails = room.name || room.description || room.imageUrl;
                  
                  return (
                    <div 
                      key={room.id}
                      className="bg-pine-900/30 border border-pine-850 hover:border-gold-500/30 rounded-3xl overflow-hidden transition-all flex flex-col justify-between group"
                      id={`room_card_${room.id}`}
                    >
                      <div>
                        {/* Aspect ratio frame for room image */}
                        <div className="aspect-[4/3] w-full overflow-hidden relative border-b border-pine-850">
                          {room.imageUrl ? (
                            <img 
                              src={room.imageUrl} 
                              alt={room.name || 'Room option'} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full border border-dashed border-pine-800 flex flex-col items-center justify-center bg-pine-950/40 text-neutral-500 text-xs gap-1.5 p-4 text-center">
                              <ImageIcon className="w-6 h-6 text-neutral-600 animate-pulse" />
                              <span className="font-display font-black text-[10px] tracking-widest uppercase text-neutral-500">Accommodation Image Placeholder</span>
                              <span className="text-[9px] text-neutral-600">Configure cover in Admin Panel</span>
                            </div>
                          )}
                          <div className="img-fade absolute inset-0 bg-gradient-to-t from-pine-950 via-pine-950/20 to-transparent" />
                          
                          {/* Float tags */}
                          <span className="absolute top-4 right-4 py-1 px-2.5 rounded-lg bg-pine-950/95 backdrop-blur border border-pine-800 text-[9px] font-bold text-gold-400 tracking-wider uppercase font-display">
                            {room.type === 'premium' ? 'Premium' : room.type === 'standard' ? 'Standard' : 'Basic'}
                          </span>
                        </div>

                        {/* Body Specs */}
                        <div className="p-6 space-y-4 text-left">
                          <div className="space-y-1.5">
                            <h3 className="font-display font-bold text-base text-cream-100 group-hover:text-gold-400 transition-colors">
                              {room.name || "[Accommodation Title Placeholder]"}
                            </h3>
                            <div className="flex items-center gap-3 text-[10px] text-neutral-400">
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-gold-500" /> Max {room.capacity || '--'} Pax
                              </span>
                              <span className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
                              <span>{room.quantity || '0'} plots available</span>
                            </div>
                          </div>

                          <p className="text-xs text-neutral-400 leading-relaxed min-h-[54px]">
                            {room.description || "[This is a placeholder for your stay descriptions. Detail bedding configurations, viewing terraces, heating facilities, and breakfast details inside the Admin Panel.]"}
                          </p>

                          {/* Features checklist */}
                          <div className="space-y-1.5 pt-2 border-t border-pine-850/40">
                            <span className="text-[9px] uppercase font-bold tracking-widest text-neutral-500 font-display block">AMENITIES INDEX</span>
                            <div className="grid grid-cols-1 gap-1">
                              {room.features && room.features.length > 0 ? (
                                room.features.slice(0, 4).map((f, fIdx) => (
                                  <div key={fIdx} className="flex items-center gap-2 text-[10.5px] text-neutral-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-gold-500/80 shrink-0" />
                                    <span className="truncate">{f}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-[10px] text-neutral-600 italic">No amenities specified. Configure features in Admin.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card footer details & button trigger layout */}
                      <div className="p-6 border-t border-pine-850/40 flex items-center justify-between gap-4">
                        <div className="text-left">
                          <span className="text-[9px] uppercase font-bold text-neutral-500 block font-display">RATE SCHEDULE</span>
                          <span className="font-display font-bold text-base text-gold-400">
                            {room.price ? `₱${room.price.toLocaleString()}` : "₱ --"} <span className="text-[10px] text-neutral-400 font-light">/ night</span>
                          </span>
                        </div>

                        <button
                          onClick={() => handleBookRoom(room.id)}
                          className="py-2.5 px-4 rounded-xl bg-gold-400/15 hover:bg-gold-500 border border-gold-400/20 text-gold-300 hover:text-ink font-display font-bold text-xs transition-all tracking-wider flex items-center gap-1 cursor-pointer select-none"
                          id={`btn_book_room_${room.id}`}
                        >
                          <span>Rent This</span>
                          <ChevronRight className="w-3 h-3 stroke-[2.5]" />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>
          </section>

          {/* --- ABOUT STORY SECTION --- */}
          <AboutSection data={cmsData.about} />

          {/* --- SERVICES AMENITIES SECTION --- */}
          <ServicesSection services={cmsData.services} />

          {/* --- FULL BOOKING ENGINE HUD --- */}
          <section id="booking_portal_section" className="py-24 bg-pine-900 border-t border-b border-pine-850 scroll-mt-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
                <span className="text-xs uppercase font-extrabold tracking-widest text-gold-400 font-display flex items-center justify-center gap-2">
                  <CalendarDays className="w-4 h-4 animate-pulse" /> CAMP SLOTS GUARANTEE
                </span>
                <h2 className="font-serif font-black text-3xl sm:text-4xl text-cream-100">
                  Live Availability Calendar
                </h2>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  [BOOKING SECTION INTRO.] Our booking engine locks dates instantly upon ticket generation.
                </p>
              </div>

              {/* Master interactive live booking widget */}
              <BookingSystem
                initialAccommodationId={preselectedRoomId}
                accommodations={cmsData.accommodations}
                bookings={bookings}
                onBookingsChange={handleUpdateBookings}
                onBookingSuccess={() => { triggerCustomToast('Reservation created — check your ticket below.'); refreshBookings(); }}
              />

            </div>
          </section>

          {/* --- FAQS SECTION --- */}
          <FAQsSection faqs={cmsData.faqs} />

          {/* --- SITE FOOTER --- */}
          <footer className="bg-pine-950 border-t border-pine-900/40 text-neutral-400 py-16 text-xs" id="website_footer_node">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-left pb-12 border-b border-pine-900/60" id="footer_links_grid">
                
                {/* Col 1: Brand details */}
                <div className="space-y-4 md:col-span-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-paper-50 border border-gold-500 overflow-hidden flex items-center justify-center p-0.5">
                      <svg className="w-full h-full text-ink" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="#faf9f2" />
                        <path d="M30 75 L50 40 L70 75 Z" fill="#062c15" />
                        <circle cx="50" cy="30" r="5" fill="#c9a054" />
                      </svg>
                    </div>
                    <span className="font-display font-extrabold text-cream-100 text-xs tracking-wider uppercase">THE LEDGE</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    [FOOTER BLURB — one or two lines describing The Ledge.]
                  </p>
                </div>

                {/* Col 2: Contacts */}
                <div className="space-y-3">
                  <h4 className="font-display font-bold text-xs text-cream-100 uppercase tracking-wider">Contact</h4>
                  <ul className="space-y-2 text-[11px]">
                    <li>Phone: [Your phone number]</li>
                    <li>Email: reservations@theledge.example</li>
                    <li>Location: [Your address]</li>
                  </ul>
                </div>

                {/* Col 3: Fast navigation */}
                <div className="space-y-3">
                  <h4 className="font-display font-bold text-xs text-cream-100 uppercase tracking-wider font-display">Fast Navigation</h4>
                  <ul className="space-y-1.5 text-[11px]">
                    <li><a href="#about" className="hover:text-gold-400">About</a></li>
                    <li><a href="#rates" className="hover:text-gold-400">Rates</a></li>
                    <li><a href="#services" className="hover:text-gold-400">Services</a></li>
                    <li><a href="#faqs" className="hover:text-gold-400">FAQs</a></li>
                  </ul>
                </div>

                {/* Col 4: Coordinate badges */}
                <div className="space-y-3">
                  <h4 className="font-display font-bold text-xs text-cream-100 uppercase tracking-wider font-display">Operational Hours</h4>
                  <ul className="space-y-1.5 text-[11px] text-neutral-500">
                    <li><span className="text-neutral-300 font-semibold">Reception:</span> [Hours]</li>
                    <li><span className="text-neutral-300 font-semibold">[Facility]:</span> [Hours]</li>
                    <li><span className="text-neutral-300 font-semibold">[Facility]:</span> [Hours]</li>
                  </ul>
                </div>

              </div>

              <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-neutral-600 font-display font-semibold" id="footer_trademark_bar">
                <span>© 2026 THE LEDGE ALL RIGHTS RESERVED.</span>
                <div className="flex flex-wrap items-center gap-4">
                  <a href="#faqs" className="hover:text-neutral-400 uppercase">Privacy Policy</a>
                  <span>•</span>
                  <a href="#faqs" className="hover:text-neutral-400 uppercase">Term of Service</a>
                  <span>•</span>
                  <button
                    onClick={() => window.dispatchEvent(new Event('open-cookie-settings'))}
                    className="hover:text-neutral-400 uppercase tracking-wider cursor-pointer"
                  >
                    Cookie Settings
                  </button>
                  <span>•</span>
                  <button
                    onClick={() => {
                      setShowAdmin(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-gold-400 uppercase tracking-wider font-semibold cursor-pointer flex items-center gap-1 text-neutral-600 hover:text-neutral-400"
                  >
                    <Lock className="w-3 h-3 text-gold-500" />
                    <span>Admin Panel</span>
                  </button>
                  <span>•</span>
                  <span className="text-neutral-500 font-mono">APP-VERSION: 1.1.0-STABLE</span>
                </div>
              </div>
            </div>
          </footer>

        </div>
      )}

    </div>
  );
}
