import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  Users, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  Minus, 
  Flame, 
  Target, 
  Coffee, 
  Compass, 
  Sparkles, 
  AlertCircle, 
  ArrowRight,
  Info,
  CalendarCheck,
  MapPin,
  Trash2,
  Moon,
  Printer
} from 'lucide-react';
import { Accommodation, AddOn, Booking } from '../types';
import { ACCOMMODATIONS, ADD_ONS } from '../data';

// Reservation statuses that occupy a room. Mirrors the server's availability query.
const HOLDS_A_ROOM = new Set(['confirmed', 'pending', 'paid_pending_review']);

// Helper to format date as YYYY-MM-DD
const formatDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Helper to check if date is in past
const isPastDate = (dateStr: string): boolean => {
  const todayStr = formatDateStr(new Date()); // Current actual local date
  return dateStr < todayStr;
};

// Helper to get list of dates between two dates
const getDatesInRange = (startStr: string, endStr: string): string[] => {
  const dates: string[] = [];
  const start = new Date(startStr);
  const end = new Date(endStr);
  const current = new Date(start);
  
  while (current < end) {
    dates.push(formatDateStr(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

// Map Icon name to Lucide Icon
const getAddOnIcon = (iconName: string) => {
  switch (iconName) {
    case 'Flame': return <Flame className="w-5 h-5 text-amber-500" />;
    case 'Target': return <Target className="w-5 h-5 text-emerald-500" />;
    case 'Coffee': return <Coffee className="w-5 h-5 text-gold-500" />;
    case 'Compass': return <Compass className="w-5 h-5 text-sky-500" />;
    default: return <Sparkles className="w-5 h-5 text-gold-500" />;
  }
};

interface BookingSystemProps {
  initialAccommodationId?: string;
  onBookingSuccess?: () => void;
  accommodations: Accommodation[];
  bookings: Booking[];
  onBookingsChange: (bookings: Booking[]) => void;
}

export default function BookingSystem({ 
  initialAccommodationId, 
  onBookingSuccess, 
  accommodations,
  bookings,
  onBookingsChange: setBookings
}: BookingSystemProps) {
  // --- STATE ---
  const [selectedAcc, setSelectedAcc] = useState<Accommodation>(
    accommodations.find(a => a.id === initialAccommodationId) || accommodations[0]
  );
  
  // Sync selectedAcc if accommodations prop changes
  useEffect(() => {
    const currentSelectedId = selectedAcc?.id || initialAccommodationId || 'unit-premium';
    const match = accommodations.find(a => a.id === currentSelectedId) || accommodations[0];
    if (match) {
      setSelectedAcc(match);
    }
  }, [accommodations, initialAccommodationId]);
  
  // Date states
  const [checkIn, setCheckIn] = useState<string>('');
  const [checkOut, setCheckOut] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Extras and guests
  const [guests, setGuests] = useState<number>(2);
  const [selectedAddOns, setSelectedAddOns] = useState<AddOn[]>([]);
  const [notes, setNotes] = useState<string>('');

  // Add-on Quantity State
  const [addOnQuantities, setAddOnQuantities] = useState<Record<string, number>>({});
  const [addOnsCatalog, setAddOnsCatalog] = useState<AddOn[]>([]);

  // Fetch dynamic add-ons on load
  useEffect(() => {
    fetch('/api/add-ons')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAddOnsCatalog(data.map((ao: any) => ({
            id: String(ao.id),
            name: ao.name,
            price: Number(ao.price),
            description: ao.description || '',
            icon: ao.id === 1 ? 'Flame' : ao.id === 2 ? 'Target' : ao.id === 3 ? 'Coffee' : 'Compass'
          })));
        } else {
          setAddOnsCatalog(ADD_ONS);
        }
      })
      .catch(err => {
        console.error('Failed to load add-ons, falling back:', err);
        setAddOnsCatalog(ADD_ONS);
      });
  }, []);

  // Contact details
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [bookingStep, setBookingStep] = useState<number>(1); // 1: Dates & Lodging, 2: Details, 3: Reservation Ticket
  const [newBookingResult, setNewBookingResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Custom interactive tab for user to view booking status
  const [activeSubTab, setActiveSubTab] = useState<'book' | 'manage'>('book');
  const [searchBookingRef, setSearchBookingRef] = useState<string>('');
  const [searchedBooking, setSearchedBooking] = useState<Booking | null>(null);
  const [searchError, setSearchError] = useState<string>('');

  // The calendar reads real occupancy straight from the `bookings` prop, which the
  // parent keeps in sync with the server's live availability. No local mock data.

  // Update selection if prop changes
  useEffect(() => {
    if (initialAccommodationId) {
      const match = accommodations.find(a => a.id === initialAccommodationId);
      if (match) setSelectedAcc(match);
    }
  }, [initialAccommodationId, accommodations]);

  // Adjust guests according to cabin capacity limits
  useEffect(() => {
    if (guests > selectedAcc.capacity) {
      setGuests(selectedAcc.capacity);
    }
  }, [selectedAcc, guests]);

  // --- OCCUPANCY & AVAILABILITY ENGINE ---
  // Calculates how many units of specific cabin type are reserved on a given date (YYYY-MM-DD)
  const getOccupancyOnDate = (accId: string, dateStr: string): number => {
    let count = 0;
    bookings.forEach(booking => {
      // Whitelist, not blacklist: only these statuses actually hold a room.
      // Blacklisting just 'cancelled' let 'rejected' (and checked_out, no_show)
      // keep blocking dates long after the reservation was dropped. Must stay in
      // step with the status filter on the server's /api/availability query.
      if (!HOLDS_A_ROOM.has(booking.status)) return;
      if (booking.accommodationId === accId) {
        // A booking occupies dates from Check-In up to (but not including) Check-Out
        if (dateStr >= booking.checkIn && dateStr < booking.checkOut) {
          count++;
        }
      }
    });
    return count;
  };

  // Check how many of the selected room category are available on a specific date
  const getAvailableInventoryOnDate = (accId: string, dateStr: string): { available: number; total: number; status: 'available'|'limited'|'booked' } => {
    const acc = accommodations.find(a => a.id === accId) || selectedAcc;
    const occupied = getOccupancyOnDate(acc.id, dateStr);
    const available = Math.max(0, acc.quantity - occupied);
    
    let status: 'available' | 'limited' | 'booked' = 'available';
    if (available === 0) {
      status = 'booked';
    } else if (available <= 2 || available <= acc.quantity * 0.3) {
      status = 'limited';
    }
    
    return { available, total: acc.quantity, status };
  };

  // Check if a range of dates is fully available for selected room
  const isRangeAvailable = (accId: string, startStr: string, endStr: string): boolean => {
    if (!startStr || !endStr) return false;
    const dates = getDatesInRange(startStr, endStr);
    return dates.every(d => {
      const { available } = getAvailableInventoryOnDate(accId, d);
      return available > 0;
    });
  };

  // --- CALENDAR GRID GENERATION (Custom Grid) ---
  const generateCurrentMonthDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // First day of current month
    const firstDay = new Date(year, month, 1);
    const firstDayIndex = firstDay.getDay(); // 0 is Sunday, etc.
    
    // Number of days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
    
    // Previous month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, prevMonthDays - i);
      days.push({
        dateStr: formatDateStr(prevDate),
        dayNum: prevMonthDays - i,
        isCurrentMonth: false
      });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const currDate = new Date(year, month, i);
      days.push({
        dateStr: formatDateStr(currDate),
        dayNum: i,
        isCurrentMonth: true
      });
    }
    
    // Next month padding to complete standard 6-week grid
    const totalSlots = 42;
    const nextDaysNeeded = totalSlots - days.length;
    for (let i = 1; i <= nextDaysNeeded; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        dateStr: formatDateStr(nextDate),
        dayNum: i,
        isCurrentMonth: false
      });
    }
    
    return days;
  };

  // Handle calendar day clicks (selection range mechanics)
  const handleDayClick = (dateStr: string) => {
    if (isPastDate(dateStr)) return; // No past dates
    
    const checkAvailabilityAndSet = (inDate: string, outDate: string) => {
      if (isRangeAvailable(selectedAcc.id, inDate, outDate)) {
        setCheckIn(inDate);
        setCheckOut(outDate);
      } else {
        // Reset and start range again if selected range crosses fully booked dates
        setCheckIn(dateStr);
        setCheckOut('');
        alert(`Note: The selected range contains fully booked dates for "${selectedAcc.name}". Please pick a different range or cabin.`);
      }
    };

    if (!checkIn || (checkIn && checkOut)) {
      // First click: start of range or reset
      setCheckIn(dateStr);
      setCheckOut('');
    } else {
      // Second click: end of range
      if (dateStr < checkIn) {
        // Clicked date is earlier than check-in; treat it as new check-in
        setCheckIn(dateStr);
      } else if (dateStr === checkIn) {
        // Clicked same date: do nothing or reset
        setCheckIn('');
      } else {
        checkAvailabilityAndSet(checkIn, dateStr);
      }
    }
  };

  // --- COMPUTATIONS FOR BILLING ---
  const nightsCount = checkIn && checkOut ? getDatesInRange(checkIn, checkOut).length : 0;
  const basePrice = selectedAcc.price * nightsCount;
  const addOnsPrice = selectedAddOns.reduce((total, addon) => {
    const qty = addOnQuantities[addon.id] || 1;
    return total + (addon.price * qty);
  }, 0);
  const subTotal = basePrice + addOnsPrice;
  const grandTotal = subTotal;

  // Toggle addons
  const handleToggleAddOn = (addon: AddOn) => {
    if (selectedAddOns.some(a => a.id === addon.id)) {
      setSelectedAddOns(selectedAddOns.filter(a => a.id !== addon.id));
      const updated = { ...addOnQuantities };
      delete updated[addon.id];
      setAddOnQuantities(updated);
    } else {
      setSelectedAddOns([...selectedAddOns, addon]);
      setAddOnQuantities({ ...addOnQuantities, [addon.id]: 1 });
    }
  };

  const handleUpdateAddOnQuantity = (addonId: string, delta: number) => {
    const current = addOnQuantities[addonId] || 1;
    const next = Math.max(1, current + delta);
    setAddOnQuantities({ ...addOnQuantities, [addonId]: next });
  };

  // --- FORM SUBMISSION (Create Reservation) ---
  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkIn || !checkOut) {
      alert('Please select check-in and check-out dates.');
      return;
    }
    if (!customerName || !customerEmail || !customerPhone) {
      alert('Please fill out all contact information fields.');
      return;
    }

    setIsSubmitting(true);

    fetch('/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerName,
        customerEmail,
        customerPhone,
        checkIn,
        checkOut,
        accommodationId: selectedAcc.id,
        guestsCount: guests,
        selectedAddOns: selectedAddOns.map(ao => ({ id: Number(ao.id) || 1, quantity: addOnQuantities[ao.id] || 1 })),
        notes,
      }),
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => {
          throw new Error(err.error || 'Failed to create booking.');
        });
      }
      return res.json();
    })
    .then((result: any) => {
      // Reservation is held as "pending". Show the ticket with payment instructions;
      // staff confirm it once the guest emails proof of payment.
      setNewBookingResult(result);
      setIsSubmitting(false);
      setBookingStep(3);
      // Bring the ticket itself into view (not the whole page) once it has rendered.
      setTimeout(() => {
        document.getElementById('booking_step_3_ticket')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
      if (onBookingSuccess) onBookingSuccess();
    })
    .catch(error => {
      console.error('Error creating booking:', error);
      alert(error.message || 'An error occurred while saving your booking.');
      setIsSubmitting(false);
    });
  };

  // Cancel a still-unpaid reservation from the "Manage Bookings" tab.
  const handleCancelBooking = (reference: string) => {
    if (!window.confirm('Cancel this reservation? An unpaid hold will be released immediately. For a reservation you have already paid, please contact us about a refund.')) {
      return;
    }
    fetch('/api/bookings/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference }),
    })
    .then(res => {
      if (!res.ok) throw new Error('Failed to cancel booking.');
      return res.json();
    })
    .then((d: any) => {
      if (d.status === 'cancelled') {
        setSearchedBooking(prev => prev ? ({ ...prev, status: 'cancelled' }) : prev);
        alert('Reservation released successfully.');
      } else {
        alert('This reservation is already paid/confirmed. Please contact us to process a cancellation and any refund.');
      }
    })
    .catch(err => {
      console.error('Error cancelling booking:', err);
      alert('Failed to cancel booking. Please try again.');
    });
  };

  // Booking details query handler — looks the reservation up on the server by reference code.
  const handleSearchBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchedBooking(null);
    setSearchError('');

    const raw = searchBookingRef.trim().toUpperCase();
    if (!raw) {
      setSearchError('Please provide a booking Reference ID.');
      return;
    }
    const reference = raw.startsWith('TL-') ? raw : `TL-${raw}`;

    fetch(`/api/bookings/lookup?reference=${encodeURIComponent(reference)}`)
      .then(res => {
        if (!res.ok) throw new Error('not found');
        return res.json();
      })
      .then((d: any) => {
        setSearchedBooking({
          id: d.reference,
          reference: d.reference,
          customerName: d.customerName,
          customerEmail: d.customerEmail,
          customerPhone: d.customerPhone,
          checkIn: d.checkIn,
          checkOut: d.checkOut,
          accommodationId: d.accommodationSlug,
          guestsCount: d.guestsCount,
          totalAmount: d.totalAmount,
          addOns: d.addOns || [],
          status: d.status,
          notes: d.notes,
          createdAt: d.createdAt || '',
          amountDue: d.amountDue,
          paymentStatus: d.paymentStatus,
        } as any);
      })
      .catch(() => {
        setSearchError('No reservation found under that reference number.');
      });
  };

  // Nav months
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  const prevMonth = () => {
    const today = new Date('2026-06-17');
    if (currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear()) {
      return; // Do not go before current month
    }
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  // Check day state styles (in-range, hovered, starting, past)
  const getDayClasses = (dateStr: string, isCurrentMonth: boolean) => {
    const isPast = isPastDate(dateStr);
    if (isPast) {
      return 'bg-neutral-900/10 text-neutral-400 font-light cursor-not-allowed line-through';
    }

    const { status } = getAvailableInventoryOnDate(selectedAcc.id, dateStr);
    const isSelectedStart = checkIn === dateStr;
    const isSelectedEnd = checkOut === dateStr;
    const isInSelectedRange = checkIn && checkOut && dateStr > checkIn && dateStr < checkOut;
    
    // Hover ranges feedback
    let isInHoverRange = false;
    if (checkIn && !checkOut && hoveredDate && dateStr > checkIn && dateStr <= hoveredDate) {
      isInHoverRange = true;
    }

    let itemClass = '';

    if (isSelectedStart || isSelectedEnd) {
      itemClass = 'bg-gold-500 text-ink font-bold scale-105 z-10 shadow-lg';
    } else if (isInSelectedRange) {
      itemClass = 'bg-gold-500/30 text-gold-200 border-y border-gold-500/20';
    } else if (isInHoverRange) {
      itemClass = 'bg-gold-500/20 text-gold-300 border-y border-dashed border-gold-500/20';
    } else if (!isCurrentMonth) {
      itemClass = 'text-neutral-500 hover:bg-pine-800/40';
    } else if (status === 'booked') {
      itemClass = 'bg-rose-500/10 text-rose-400 cursor-not-allowed border border-rose-500/20 relative before:content-[""] before:absolute before:w-1.5 before:h-1.5 before:bg-rose-500 before:rounded-full before:bottom-1 before:left-1/2 before:-translate-x-1/2';
    } else if (status === 'limited') {
      itemClass = 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 border border-amber-500/20 relative before:content-[""] before:absolute before:w-1.5 before:h-1.5 before:bg-amber-500 before:rounded-full before:bottom-1 before:left-1/2 before:-translate-x-1/2';
    } else {
      itemClass = 'hover:bg-pine-700/50 text-emerald-50 border border-neutral-800/15';
    }

    return itemClass;
  };

  return (
    <div className="w-full bg-pine-900 border border-pine-800 rounded-3xl overflow-hidden shadow-2xl relative" id="booking_portal_wrapper">
      {/* Tab Selectors */}
      <div className="flex border-b border-pine-800 bg-pine-950/80 backdrop-blur" id="tab_select_container">
        <button
          onClick={() => { setActiveSubTab('book'); setBookingStep(1); }}
          className={`flex-1 py-5 text-center font-display font-medium text-sm transition-all relative ${
            activeSubTab === 'book' ? 'text-gold-400 bg-pine-900' : 'text-neutral-400 hover:text-emerald-100'
          }`}
          id="btn_tab_book"
        >
          <span className="flex items-center justify-center gap-2">
            <CalendarIcon className="w-4 h-4" /> Secure A Spot
          </span>
          {activeSubTab === 'book' && (
            <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-400" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('manage')}
          className={`flex-1 py-5 text-center font-display font-medium text-sm transition-all relative ${
            activeSubTab === 'manage' ? 'text-gold-400 bg-pine-900' : 'text-neutral-400 hover:text-emerald-100'
          }`}
          id="btn_tab_manage"
        >
          <span className="flex items-center justify-center gap-2">
            <CalendarCheck className="w-4 h-4" /> Verify & Manage Reservation
          </span>
          {activeSubTab === 'manage' && (
            <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-400" />
          )}
        </button>
      </div>

      <div className="p-6 md:p-8" id="booking_tab_body">
        {/* --- PORTAL / BOOKING ENGINE TAB --- */}
        {activeSubTab === 'book' && (
          <div>
            {/* Step Indicators */}
            <div className="flex justify-center items-center gap-4 mb-8" id="step_indicator_bar">
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs border ${
                  bookingStep >= 1 ? 'bg-gold-500 text-ink border-gold-500' : 'border-neutral-700 text-neutral-400'
                }`}>1</span>
                <span className={`text-xs font-medium ${bookingStep >= 1 ? 'text-gold-400' : 'text-neutral-500'}`}>Dates &amp; Lodging</span>
              </div>
              <div className="w-8 h-[1px] bg-pine-800" />
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs border ${
                  bookingStep >= 2 ? 'bg-gold-500 text-ink border-gold-500' : 'border-neutral-700 text-neutral-400'
                }`}>2</span>
                <span className={`text-xs font-medium ${bookingStep >= 2 ? 'text-gold-400' : 'text-neutral-500'}`}>Guest Details</span>
              </div>
              <div className="w-8 h-[1px] bg-pine-800" />
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs border ${
                  bookingStep >= 3 ? 'bg-gold-500 text-ink border-gold-500' : 'border-neutral-700 text-neutral-400'
                }`}>3</span>
                <span className={`text-xs font-medium ${bookingStep >= 3 ? 'text-gold-400' : 'text-neutral-500'}`}>Reservation Ticket</span>
              </div>
            </div>

            {/* STEP 1: SELECT ACCOMMODATION & DATES */}
            {bookingStep === 1 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8"
                id="booking_step_1_layout"
              >
                {/* 1. Accommodations list Picker (Left Column) */}
                <div className="lg:col-span-4 space-y-4" id="cabin_picker_list">
                  <h3 className="font-display font-semibold text-lg text-cream-50 flex items-center gap-2">
                    <span>1. Choose Your Unit</span>
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {accommodations.map((acc) => {
                      const isSelected = selectedAcc.id === acc.id;
                      return (
                        <div
                          key={acc.id}
                          onClick={() => {
                            setSelectedAcc(acc);
                            // Verify checkin/out range is still completely clear for this new selection, if not reset
                            if (checkIn && checkOut && !isRangeAvailable(acc.id, checkIn, checkOut)) {
                              setCheckIn('');
                              setCheckOut('');
                            }
                          }}
                          className={`p-4 rounded-2xl border text-left cursor-pointer transition-all relative overflow-hidden group ${
                            isSelected 
                              ? 'bg-pine-850 border-gold-500 h-full shadow-md' 
                              : 'bg-pine-950/40 border-pine-800 hover:border-pine-600'
                          }`}
                          id={`cabin_card_${acc.id}`}
                        >
                          {acc.imageUrl && (
                            <div className="absolute right-0 top-0 h-1/2 w-1/3 opacity-30 group-hover:opacity-40 transition-opacity">
                              <img src={acc.imageUrl} alt="" className="w-full h-full object-cover rounded-bl-3xl" referrerPolicy="no-referrer" />
                            </div>
                          )}
                          
                          <div className="relative pr-12">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-gold-400 font-display">
                              {acc.type === 'premium' ? 'Premium' : acc.type === 'standard' ? 'Standard' : 'Basic'}
                            </span>
                            <h4 className="font-display font-medium text-sm text-cream-50 mt-1">{acc.name}</h4>
                            <p className="text-xs text-neutral-400 mt-2 line-clamp-2 max-w-[85%]">{acc.description}</p>
                            
                            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-pine-800/60">
                              <span className="text-xs font-display font-bold text-gold-300">
                                ₱{acc.price.toLocaleString()} <span className="font-light text-[10px] text-neutral-400">/ night</span>
                              </span>
                              <span className="text-[10px] flex items-center gap-1 text-neutral-400">
                                <Users className="w-3 h-3 text-gold-500/80" /> Max {acc.capacity} pax
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute right-4 bottom-4 w-5 h-5 rounded-full bg-gold-500 flex items-center justify-center text-ink shadow">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Visual Availability Calendar (Center Column) */}
                <div className="lg:col-span-5 flex flex-col" id="live_availability_calendar_node">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-semibold text-lg text-cream-50 flex items-center gap-2">
                      <span>2. Calendar Range</span>
                    </h3>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={prevMonth}
                        className="p-1.5 rounded-lg border border-pine-800 bg-pine-950/60 hover:bg-pine-800 text-neutral-300 transition-colors"
                        id="btn_prev_month"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-3 py-1 text-xs font-display font-semibold text-gold-400 bg-pine-950 rounded-lg min-w-[110px] text-center">
                        {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </span>
                      <button 
                        onClick={nextMonth}
                        className="p-1.5 rounded-lg border border-pine-800 bg-pine-950/60 hover:bg-pine-800 text-neutral-300 transition-colors"
                        id="btn_next_month"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Calendar Grid Container */}
                  <div className="bg-pine-950/60 border border-pine-800 rounded-2xl p-4 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Weekday Labels */}
                      <div className="grid grid-cols-7 gap-1 text-center mb-2">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                          <span key={d} className="text-[10px] uppercase font-bold text-neutral-500 font-display">{d}</span>
                        ))}
                      </div>

                      {/* Day Cells */}
                      <div className="grid grid-cols-7 gap-1 text-center">
                        {generateCurrentMonthDays().map((daySlot, idx) => {
                          const dateStr = daySlot.dateStr;
                          const cellClasses = getDayClasses(dateStr, daySlot.isCurrentMonth);
                          return (
                            <button
                              key={`${dateStr}-${idx}`}
                              onClick={() => handleDayClick(dateStr)}
                              onMouseEnter={() => setHoveredDate(dateStr)}
                              onMouseLeave={() => setHoveredDate(null)}
                              disabled={isPastDate(dateStr) || getAvailableInventoryOnDate(selectedAcc.id, dateStr).available === 0}
                              className={`aspect-square sm:aspect-auto sm:h-10 rounded-lg text-xs font-medium flex flex-col items-center justify-center transition-all ${cellClasses}`}
                              id={`calendar_day_${dateStr}`}
                            >
                              <span className="text-xs">{daySlot.dayNum}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Legendary Keys */}
                    <div className="mt-4 pt-4 border-t border-pine-800/60 flex items-center justify-around text-[10px] text-neutral-400" id="calendar_legends">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full border border-neutral-700 bg-transparent" />
                        <span>High Availability</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/40" />
                        <span>Limited Spots</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/30 border border-rose-500/40" />
                        <span>Sold Out</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Selected Range Summary & Go-To Next Step Panel (Right Column) */}
                <div className="lg:col-span-3 space-y-5" id="date_range_picker_panel">
                  <h3 className="font-display font-semibold text-lg text-cream-50">3. Selection Details</h3>
                  
                  <div className="bg-pine-950/80 rounded-2xl p-5 border border-pine-800 space-y-4">
                    {/* Accommodation showcase details */}
                    <div>
                      <span className="text-[10px] py-0.5 px-2 rounded-full font-bold bg-gold-500/10 text-gold-400 border border-gold-500/20 inline-block mb-1.5 font-display">
                        CONFIRMED SELECTION
                      </span>
                      <h4 className="font-display font-bold text-cream-50 text-sm leading-snug">{selectedAcc.name}</h4>
                      <div className="text-xs text-neutral-400 mt-1 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> Room Capacity is {selectedAcc.capacity} Adults
                      </div>
                    </div>

                    {/* Range Viewers */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-pine-800/60">
                      <div className="p-2.5 rounded-xl bg-pine-900 border border-pine-800 text-center">
                        <span className="text-[9px] uppercase font-semibold text-neutral-500 block">CHECK-IN</span>
                        <span className="text-xs font-display font-medium text-cream-100">{checkIn ? new Date(checkIn).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : '—'}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-pine-900 border border-pine-800 text-center">
                        <span className="text-[9px] uppercase font-semibold text-neutral-500 block">CHECK-OUT</span>
                        <span className="text-xs font-display font-medium text-cream-100">{checkOut ? new Date(checkOut).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : '—'}</span>
                      </div>
                    </div>

                    {checkIn && !checkOut && (
                      <div className="flex items-center gap-2 text-[11px] text-amber-300 bg-amber-500/10 p-2.5 border border-amber-500/20 rounded-xl leading-relaxed">
                        <Info className="w-4 h-4 shrink-0 stroke-[2.5]" />
                        <span>Select another date on the calendar to establish your departure checkout.</span>
                      </div>
                    )}

                    {/* Guests selection counter */}
                    {checkIn && checkOut && (
                      <div className="pt-3 border-t border-pine-800/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-neutral-300">Staying Guests</span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setGuests(m => Math.max(1, m - 1))}
                              className="w-7 h-7 rounded-lg border border-pine-800 bg-pine-900 flex items-center justify-center hover:bg-pine-800 text-cream-50"
                              id="btn_decrement_guests"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-sm font-display font-semibold text-cream-100 w-4 text-center">{guests}</span>
                            <button
                              type="button"
                              onClick={() => setGuests(m => Math.min(selectedAcc.capacity, m + 1))}
                              className="w-7 h-7 rounded-lg border border-pine-800 bg-pine-900 flex items-center justify-center hover:bg-pine-800 text-cream-50"
                              id="btn_increment_guests"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {guests === selectedAcc.capacity && (
                          <p className="text-[10px] text-right text-amber-400">Reached maximum allowed capacity threshold.</p>
                        )}
                      </div>
                    )}

                    {/* Price Quote Panel */}
                    {nightsCount > 0 && (
                      <div className="pt-3 border-t border-pine-800/60 space-y-2">
                        <div className="flex justify-between text-xs text-neutral-400 text-left">
                          <span>₱{selectedAcc.price.toLocaleString()} × {nightsCount} nights</span>
                          <span className="font-display font-medium text-cream-100">₱{basePrice.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs text-neutral-300 font-semibold pt-1 text-left">
                          <span>Base Subtotal</span>
                          <span className="text-gold-400">₱{basePrice.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    disabled={!checkIn || !checkOut}
                    onClick={() => setBookingStep(2)}
                    className={`w-full py-4 px-6 rounded-2xl flex items-center justify-center gap-2 font-display font-semibold text-sm transition-all shadow-md group ${
                      checkIn && checkOut
                        ? 'bg-gold-500 hover:bg-gold-400 text-ink cursor-pointer hover:shadow-gold-500/20 hover:scale-[1.01]'
                        : 'bg-pine-950 text-neutral-600 border border-pine-800 cursor-not-allowed'
                    }`}
                    id="btn_continue_to_step_2"
                  >
                    <span>Proceed to Extras</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: CHOOSE ADDONS & GUARANTEE RESERVATION */}
            {bookingStep === 2 && (
              <motion.form 
                onSubmit={handleCreateBooking}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8"
                id="booking_step_2_layout"
              >
                {/* AddOns Choice list (Left 7-columns) */}
                <div className="lg:col-span-7 space-y-6" id="addons_preference_picker">
                  <div>
                    <h3 className="font-display font-semibold text-lg text-cream-50 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-gold-400" /> Choose Highland Extras
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1">[Add-ons section intro — describe the optional extras you offer.]</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {addOnsCatalog.map((addon) => {
                      const isPicked = selectedAddOns.some(a => a.id === addon.id);
                      const qty = addOnQuantities[addon.id] || 1;
                      return (
                        <div
                          key={addon.id}
                          className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                            isPicked 
                              ? 'bg-pine-850 border-gold-500' 
                              : 'bg-pine-950/40 border-pine-800 hover:border-pine-700'
                          }`}
                          id={`addon_card_${addon.id}`}
                        >
                          <div className="space-y-2 cursor-pointer" onClick={() => handleToggleAddOn(addon)}>
                            <div className="flex items-center justify-between">
                              <span className="p-2 bg-pine-900 rounded-xl border border-pine-800 inline-block">
                                {getAddOnIcon(addon.icon)}
                              </span>
                              {isPicked && (
                                <span className="text-[9px] py-0.5 px-2 rounded-full font-bold bg-gold-500/10 text-gold-400 border border-gold-500/20">
                                  ADDED
                                </span>
                              )}
                            </div>
                            <h4 className="font-display font-bold text-sm text-cream-50 leading-snug">{addon.name}</h4>
                            <p className="text-[11px] text-neutral-400 leading-relaxed">{addon.description}</p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-pine-800/40 flex items-center justify-between">
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-xs text-neutral-400 mr-2">Qty:</span>
                              <button
                                type="button"
                                disabled={!isPicked}
                                onClick={() => handleUpdateAddOnQuantity(addon.id, -1)}
                                className={`w-6 h-6 rounded-lg flex items-center justify-center border text-xs font-bold transition-all ${
                                  isPicked 
                                    ? 'bg-pine-900 border-pine-750 hover:bg-pine-850 text-cream-50 cursor-pointer' 
                                    : 'bg-neutral-900/20 border-neutral-850 text-neutral-600 cursor-not-allowed'
                                }`}
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className={`text-xs font-bold w-4 text-center ${isPicked ? 'text-cream-100' : 'text-neutral-500'}`}>{qty}</span>
                              <button
                                type="button"
                                disabled={!isPicked}
                                onClick={() => handleUpdateAddOnQuantity(addon.id, 1)}
                                className={`w-6 h-6 rounded-lg flex items-center justify-center border text-xs font-bold transition-all ${
                                  isPicked 
                                    ? 'bg-pine-900 border-pine-750 hover:bg-pine-850 text-cream-50 cursor-pointer' 
                                    : 'bg-neutral-900/20 border-neutral-850 text-neutral-600 cursor-not-allowed'
                                }`}
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="font-display font-bold text-xs text-gold-300">₱{addon.price}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Customer reservation form */}
                  <div className="bg-pine-950/60 border border-pine-800 rounded-2xl p-6 space-y-4">
                    <h3 className="font-display font-semibold text-base text-cream-50">Reservation Contact details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5 font-display">Full Guest Name</label>
                        <input
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Juan Dela Cruz"
                          className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500 text-cream-50 px-4 py-3 rounded-xl text-xs outline-none transition-colors"
                          id="input_customer_name"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5 font-display">Contact Phone Number</label>
                        <input
                          type="tel"
                          required
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="0917XXXXXXX"
                          className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500 text-cream-50 px-4 py-3 rounded-xl text-xs outline-none transition-colors"
                          id="input_customer_phone"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5 font-display">Email Address</label>
                      <input
                        type="email"
                        required
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="juan@gmail.com"
                        className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500 text-cream-50 px-4 py-3 rounded-xl text-xs outline-none transition-colors"
                        id="input_customer_email"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5 font-display">Special Requirements & Meal notes (Optional)</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Tell us if you have dietary restrictions, demand heating blankets, or require pet spacing setups..."
                        className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500 text-cream-50 px-4 py-3 rounded-xl text-xs outline-none transition-colors resize-none"
                        id="input_customer_notes"
                      />
                    </div>
                  </div>
                </div>

                {/* billing Checkout Invoice Breakdown (Right 5-columns) */}
                <div className="lg:col-span-5" id="billing_invoice_pane">
                  <div className="bg-pine-950/80 border border-pine-800 rounded-2xl p-6 space-y-5 sticky top-6">
                    <h3 className="font-display font-semibold text-base text-cream-50 border-b border-pine-800 pb-3">
                      Reservation Details
                    </h3>

                    {/* Room summary */}
                    <div className="flex gap-4">
                      {selectedAcc.imageUrl ? (
                        <img src={selectedAcc.imageUrl} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0 border border-pine-800" referrerPolicy="no-referrer" />
                      ) : null}
                      <div className="min-w-0">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-gold-400/80 font-display block">Accommodation</span>
                        <h4 className="font-display font-bold text-sm text-cream-50 leading-snug mt-0.5">{selectedAcc.name}</h4>
                      </div>
                    </div>

                    {/* Stay facts */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-neutral-500 font-display flex items-center gap-1"><CalendarCheck className="w-3 h-3 text-gold-400" /> Check-in</span>
                        <span className="text-cream-100 font-medium">{checkIn || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-neutral-500 font-display flex items-center gap-1"><CalendarCheck className="w-3 h-3 text-gold-400" /> Check-out</span>
                        <span className="text-cream-100 font-medium">{checkOut || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-neutral-500 font-display flex items-center gap-1"><Moon className="w-3 h-3 text-gold-400" /> Nights</span>
                        <span className="text-cream-100 font-medium">{nightsCount} {nightsCount === 1 ? 'Night' : 'Nights'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-neutral-500 font-display flex items-center gap-1"><Users className="w-3 h-3 text-gold-400" /> Guests</span>
                        <span className="text-cream-100 font-medium">{guests} {guests === 1 ? 'Adult' : 'Adults'}</span>
                      </div>
                    </div>

                    {/* Itemised prices */}
                    <div className="space-y-3 pt-4 border-t border-pine-800">
                      <div className="flex justify-between text-xs text-left">
                        <span className="text-neutral-400">Base Rental Rate ({nightsCount} nights)</span>
                        <span className="font-display font-semibold text-neutral-200">₱{basePrice.toLocaleString()}</span>
                      </div>
                      
                      {selectedAddOns.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 font-display block">ADD-ONS SCHEDULE</span>
                          {selectedAddOns.map(addon => {
                            const qty = addOnQuantities[addon.id] || 1;
                            return (
                              <div key={addon.id} className="flex justify-between text-xs pl-2 border-l border-gold-500/20 text-left">
                                <span className="text-neutral-400">{addon.name} (×{qty})</span>
                                <span className="font-display text-neutral-300">₱{(addon.price * qty).toLocaleString()}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex justify-between text-xs pt-3 border-t border-pine-800 select-total-lines text-left">
                        <span className="text-neutral-300 font-medium">Total Reservation Cost</span>
                        <span className="font-display font-bold text-neutral-100">₱{grandTotal.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Amount to pay */}
                    <div className="bg-pine-900 p-4 rounded-xl border border-gold-500/20 flex justify-between items-center text-left">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-gold-400 block font-display">Amount to Pay</span>
                        <span className="text-[10px] text-neutral-500 block">Full payment via bank transfer or e-wallet</span>
                      </div>
                      <span className="font-display font-bold text-xl text-gold-400">₱{grandTotal.toLocaleString()}</span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start gap-2.5 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/15 leading-relaxed text-[11px] text-emerald-200 text-left">
                        <Info className="w-4 h-4 shrink-0 text-emerald-500" />
                        <span>On the next step you'll get a reservation ticket with the payment account details and QR codes. Your dates are held for you; the reservation is confirmed once staff verify your payment.</span>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setBookingStep(1)}
                          className="flex-1 py-3 px-4 rounded-xl border border-pine-800 bg-pine-900 hover:bg-pine-800 text-neutral-300 font-display font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Modify Dates
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex-3 py-3 px-6 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isSubmitting ? (
                            <>
                              <div className="w-4 h-4 border-2 border-pine-950 border-t-transparent rounded-full animate-spin" />
                              <span>Reserving your spot...</span>
                            </>
                          ) : (
                            <>
                              <span>Confirm Reservation &amp; Get Ticket</span>
                              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.form>
            )}

            {/* STEP 3: RESERVATION TICKET + PAYMENT INSTRUCTIONS */}
            {bookingStep === 3 && newBookingResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl mx-auto py-4"
                id="booking_step_3_ticket"
              >
                <div className="bg-paper-100 rounded-3xl overflow-hidden shadow-2xl border-4 border-[#c9a054]/30 text-ink relative">
                  <div className="absolute top-1/2 -left-3 w-6 h-6 rounded-full bg-ink -translate-y-1/2" />
                  <div className="absolute top-1/2 -right-3 w-6 h-6 rounded-full bg-ink -translate-y-1/2" />

                  {/* Header */}
                  <div className="bg-ink text-paper-50 p-6 flex justify-between items-center border-b border-[#c9a054]/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full border border-[#e0bb73] flex items-center justify-center bg-ink shrink-0">
                        <span className="font-display font-bold text-xs text-[#e0bb73]">VP</span>
                      </div>
                      <div>
                        <h4 className="font-display font-extrabold text-sm tracking-wide text-[#e0bb73]">THE LEDGE</h4>
                        <span className="text-[10px] text-ink-500 flex items-center gap-0.5 uppercase tracking-widest font-bold font-display"><MapPin className="w-3 h-3 text-[#8a6520]" /> [Location]</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] uppercase font-bold text-ink-500 block font-display">Reference Code</span>
                      <span className="font-display font-bold text-base text-[#e0bb73]">{newBookingResult.reference}</span>
                    </div>
                  </div>

                  {/* Status banner */}
                  <div className="p-6 text-center border-b border-ink/10 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-2 border border-amber-500/30">
                      <CalendarCheck className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <h3 className="font-serif font-bold text-xl text-ink">Reservation Held — Awaiting Payment</h3>
                    <p className="text-xs text-ink-700 max-w-md mx-auto">
                      Thanks, <span className="font-bold">{newBookingResult.customerName}</span>. Your dates are held. Send your payment using the details below, then email your proof of payment — your reservation is confirmed once we verify it.
                    </p>
                  </div>

                  {/* Receipt: guest + reservation */}
                  <div className="p-6 border-b border-dashed border-ink/20 bg-paper-50 space-y-5 text-left">
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-[#7a5a18] font-display block mb-1.5">Guest Details</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-ink-500 block font-display">Name</span>
                          <span className="font-semibold text-ink">{newBookingResult.customerName}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-ink-500 block font-display">Email</span>
                          <span className="font-semibold text-ink break-all">{newBookingResult.customerEmail}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-ink-500 block font-display">Phone</span>
                          <span className="font-semibold text-ink">{newBookingResult.customerPhone || '—'}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-[#7a5a18] font-display block mb-1.5">Reservation</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-ink-500 block font-display">Reference No.</span>
                          <span className="font-mono font-bold text-ink">{newBookingResult.reference}</span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-[9px] uppercase font-bold text-ink-500 block font-display">Booked Room</span>
                          <span className="font-semibold text-ink">{newBookingResult.accommodationName}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-ink-500 block font-display">Check-in</span>
                          <span className="font-semibold text-ink">{newBookingResult.checkIn}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-ink-500 block font-display">Check-out</span>
                          <span className="font-semibold text-ink">{newBookingResult.checkOut}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-ink-500 block font-display">Guests / Nights</span>
                          <span className="font-semibold text-ink">{newBookingResult.guestsCount} pax · {newBookingResult.nights} night/s</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Costs */}
                  <div className="p-6 space-y-3 border-b border-ink/10">
                    <div className="flex justify-between text-xs text-ink-700">
                      <span>Accommodation ({newBookingResult.nights} night/s)</span>
                      <span>₱{Number(
                        Number(newBookingResult.totalAmount) -
                        (Array.isArray(newBookingResult.addOns) ? newBookingResult.addOns.reduce((s: number, a: any) => s + a.price * a.quantity, 0) : 0)
                      ).toLocaleString()}</span>
                    </div>
                    {Array.isArray(newBookingResult.addOns) && newBookingResult.addOns.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-ink-500 block font-display">Add-ons</span>
                        {newBookingResult.addOns.map((a: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs text-ink-700">
                            <span>{a.name} ×{a.quantity}</span>
                            <span>₱{(a.price * a.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-ink/10">
                      <span className="text-sm font-bold text-ink">Total Amount</span>
                      <span className="font-display font-black text-xl text-emerald-800">₱{Number(newBookingResult.amountDue ?? newBookingResult.totalAmount).toLocaleString()}</span>
                    </div>
                    {newBookingResult.notes && (
                      <div className="p-3 bg-ink/5 rounded-xl border border-ink/10 text-[11px] text-ink-700 italic">
                        <span className="font-bold uppercase text-[9px] text-ink-500 block font-display not-italic">Your request:</span>
                        "{newBookingResult.notes}"
                      </div>
                    )}
                  </div>

                  {/* Email confirmation note */}
                  <div className="px-6 py-4 bg-emerald-500/5 border-b border-ink/10 flex items-start gap-2.5 text-[11px] text-emerald-900 leading-relaxed">
                    <Info className="w-4 h-4 shrink-0 text-emerald-600 mt-px" />
                    <span>A confirmation will be sent to <span className="font-semibold break-all">{newBookingResult.customerEmail}</span>. If you don't see it shortly, please check your spam / junk folder.</span>
                  </div>

                  {/* Payment instructions */}
                  {newBookingResult.paymentInstructions && (
                    <div className="p-6 space-y-4 bg-paper-50">
                      <h4 className="font-serif font-bold text-base text-ink">{newBookingResult.paymentInstructions.headline}</h4>

                      <div className="space-y-3">
                        {(newBookingResult.paymentInstructions.accounts || [])
                          .filter((acc: any) => acc.accountName || acc.accountNumber || acc.qrImageUrl)
                          .map((acc: any, i: number) => (
                          <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-ink/10 bg-white">
                            {acc.qrImageUrl ? (
                              <img src={acc.qrImageUrl} alt={`${acc.method} QR`} className="w-20 h-20 rounded-lg object-contain shrink-0 border border-ink/10" />
                            ) : null}
                            <div className="min-w-0">
                              <span className="font-display font-bold text-xs uppercase tracking-wide text-[#7a5a18] block">{acc.method}</span>
                              <span className="text-sm font-semibold text-ink block">{acc.accountName}</span>
                              <span className="text-sm font-mono text-ink-700 block break-all">{acc.accountNumber}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-900 leading-relaxed">
                        {newBookingResult.paymentInstructions.note}
                      </div>

                      <div className="text-xs text-ink">
                        <span className="font-bold">Send your proof of payment to: </span>
                        <a href={`mailto:${newBookingResult.paymentInstructions.proofEmail}?subject=Proof of payment ${newBookingResult.reference}`} className="font-mono text-emerald-800 underline break-all">
                          {newBookingResult.paymentInstructions.proofEmail}
                        </a>
                        <span className="block text-ink-500 mt-0.5">Include your reference code <span className="font-mono font-bold">{newBookingResult.reference}</span>.</span>
                      </div>
                    </div>
                  )}

                  <div className="bg-ink/5 px-6 py-4 flex items-center justify-between border-t border-ink/10">
                    <span className="text-[8px] font-mono text-ink-500 tracking-widest uppercase">TL-RESERVATION-HELD</span>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="py-2 px-3.5 rounded-xl bg-ink text-paper-50 hover:bg-ink font-display font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print / Save Ticket
                    </button>
                  </div>
                </div>

                <div className="text-center mt-6">
                  <button
                    onClick={() => {
                      setCheckIn('');
                      setCheckOut('');
                      setSelectedAddOns([]);
                      setNotes('');
                      setCustomerName('');
                      setCustomerPhone('');
                      setCustomerEmail('');
                      setAddOnQuantities({});
                      setNewBookingResult(null);
                      setBookingStep(1);
                    }}
                    className="py-3 px-6 rounded-2xl bg-ink-700 text-paper-50 hover:bg-ink-700 transition-colors text-xs font-display font-semibold cursor-pointer"
                  >
                    Book Another Stay
                  </button>
                </div>
              </motion.div>
            )}

          </div>
        )}

        {/* --- VERIFY & MANAGE EXISTING RESERVATIONS TAB --- */}
        {activeSubTab === 'manage' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-2xl mx-auto py-4 space-y-6"
            id="manage_tab_node"
          >
            <div className="space-y-2 text-center">
              <h3 className="font-display font-semibold text-xl text-cream-50">Highland Booking Audit Centre</h3>
              <p className="text-xs text-neutral-400">Search for your dates slot log, reschedule activities, or process cancellation packages safely.</p>
            </div>

            <form onSubmit={handleSearchBooking} className="flex gap-2 max-w-md mx-auto" id="manage_search_form">
              <input
                type="text"
                value={searchBookingRef}
                onChange={(e) => setSearchBookingRef(e.target.value)}
                placeholder="Ex: TL-8429, TL-1123..."
                className="flex-1 bg-pine-950 border border-pine-800 focus:border-gold-500 text-cream-50 px-4 py-3 rounded-xl text-xs outline-none transition-colors"
                id="search_booking_input"
              />
              <button
                type="submit"
                className="py-3 px-6 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-bold text-xs transition-colors"
                id="search_booking_button"
              >
                Search Record
              </button>
            </form>

            {searchError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl flex items-center justify-center gap-2 text-xs max-w-md mx-auto">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{searchError}</span>
              </div>
            )}

            {/* Display queried booking cards */}
            <AnimatePresence mode="wait">
              {searchedBooking && (
                <motion.div
                  key={searchedBooking.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-pine-950/80 rounded-2xl border border-pine-800 p-6 space-y-5 text-left"
                  id={`query_result_${searchedBooking.id}`}
                >
                  <div className="flex justify-between items-start border-b border-pine-800 pb-4">
                    <div>
                      <span className="text-[9px] uppercase font-semibold text-neutral-500 leading-none">RESERVATION REFEREE</span>
                      <h4 className="font-display font-bold text-cream-50 mt-1">{searchedBooking.customerName}</h4>
                      <p className="text-[10px] text-neutral-400 mt-1">{searchedBooking.customerEmail} | {searchedBooking.customerPhone}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-neutral-400 block font-display">STATUS CODE</span>
                      <span className={`text-[10px] font-bold py-1 px-2.5 rounded-full inline-block mt-1 ${
                        searchedBooking.status === 'confirmed'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : searchedBooking.status === 'pending'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      }`}>
                        {searchedBooking.status === 'pending' ? 'AWAITING PAYMENT' : searchedBooking.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 py-1 text-xs">
                    <div>
                      <span className="text-[10px] text-neutral-500 block">Accommodations type</span>
                      <span className="font-medium text-cream-200">{accommodations.find(a => a.id === searchedBooking.accommodationId)?.name || 'Default Site'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-500 block">Booked Range</span>
                      <span className="font-medium text-cream-200">{searchedBooking.checkIn} to {searchedBooking.checkOut}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-500 block">Total reservation cost</span>
                      <span className="font-display font-bold text-gold-400">₱{searchedBooking.totalAmount.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="py-2 text-xs border-t border-pine-800/60">
                    <span className="text-[10px] text-neutral-500 block">Payment</span>
                    <span className={`font-display font-semibold ${(searchedBooking as any).paymentStatus === 'completed' ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {(searchedBooking as any).paymentStatus === 'completed' ? 'Verified / received' : 'Awaiting payment verification'}
                    </span>
                  </div>

                  {searchedBooking.status === 'pending' && (
                    <div className="flex justify-end gap-3 pt-3 border-t border-pine-800/60" id="query_actions">
                      <button
                        type="button"
                        onClick={() => handleCancelBooking(searchedBooking.id)}
                        className="py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 font-display font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Release Unpaid Hold
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Guidance */}
            <div className="bg-pine-900/50 p-4 rounded-2xl border border-pine-800 max-w-md mx-auto text-center text-xs space-y-2 text-neutral-400">
              <span className="font-display font-bold text-gold-500 text-xs flex items-center justify-center gap-1">
                <Info className="w-3.5 h-3.5" /> Your Reference Code
              </span>
              <p className="leading-relaxed text-[11px]">
                Enter the <span className="font-mono bg-pine-950 px-1.5 py-0.5 rounded text-amber-300 font-bold">TL-XXXXXX</span> code from your reservation ticket to view its status and payment details.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
