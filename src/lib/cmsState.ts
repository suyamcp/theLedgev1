import { Accommodation, Service, FAQ } from '../types';

export interface HeroCMS {
  backgroundImage: string;
  tagline: string;
  title: string;
  description: string;
}

export interface AboutCMS {
  tagline: string;
  title: string;
  desc1: string;
  desc2: string;
  elevation: string;
  climate: string;
  latitude: string;
  longitude: string;
  quoteText: string;
  quoteAuthor: string;
  quoteMeta: string;
}

export interface CMSData {
  hero: HeroCMS;
  about: AboutCMS;
  accommodations: Accommodation[];
  services: Service[];
  faqs: FAQ[];
}

const IMG = 'https://images.unsplash.com';
const q = (id: string, w = 1200) => `${IMG}/${id}?auto=format&fit=crop&q=80&w=${w}`;

// 1. BLANK SLATE STRUCTURES — what "Reset to blank" in the Admin Panel restores.
export const BLANK_HERO: HeroCMS = {
  backgroundImage: '',
  tagline: '',
  title: '',
  description: '',
};

export const BLANK_ABOUT: AboutCMS = {
  tagline: '',
  title: '',
  desc1: '',
  desc2: '',
  elevation: '',
  climate: '',
  latitude: '',
  longitude: '',
  quoteText: '',
  quoteAuthor: '',
  quoteMeta: '',
};

export const BLANK_ACCOMMODATIONS: Accommodation[] = [
  {
    id: 'unit-premium',
    name: '',
    type: 'premium',
    description: '',
    capacity: 0,
    price: 0,
    features: [],
    imageUrl: '',
    quantity: 0
  },
  {
    id: 'unit-standard',
    name: '',
    type: 'standard',
    description: '',
    capacity: 0,
    price: 0,
    features: [],
    imageUrl: '',
    quantity: 0
  },
  {
    id: 'unit-basic',
    name: '',
    type: 'basic',
    description: '',
    capacity: 0,
    price: 0,
    features: [],
    imageUrl: '',
    quantity: 0
  }
];

export const BLANK_SERVICES: Service[] = [
  { id: 'service-dining', name: '', description: '', image: '', price: '', details: [] },
  { id: 'service-terrace', name: '', description: '', image: '', price: '', details: [] },
  { id: 'service-quiet', name: '', description: '', image: '', price: '', details: [] }
];

export const BLANK_FAQS: FAQ[] = [];

// 2. DEFAULT SEED DATA
// This is what the site ships with and what "Load defaults" restores. It is
// demo copy for a modern hotel — replace the wording, rates, and contact
// details with the real ones before going live.
export const DEFAULT_HERO: HeroCMS = {
  backgroundImage: q('photo-1631049307264-da0ec9d70304', 1800),
  tagline: 'ROOMS WITH A VIEW WORTH WAKING FOR',
  title: 'The Ledge',
  description: 'A small modern hotel built along the ridge, where every room opens to the valley. Quiet floors, considered design, and a terrace that does most of the talking.',
};

export const DEFAULT_ABOUT: AboutCMS = {
  tagline: 'OUR STORY',
  title: 'Built on the Edge, Designed for the Quiet',
  desc1: 'The Ledge began as a single house on the ridge and grew into a thirty-six room hotel that never lost the plot: the view comes first. Every room faces outward, every corridor ends in a window, and nothing was built taller than the treeline.',
  desc2: 'Inside, the palette stays deliberately quiet — soft grey stone, pale oak, linen, and light. We would rather you remember the morning fog burning off the valley than the wallpaper. Breakfast runs late, checkout is unhurried, and the terrace is yours all day.',
  elevation: '320 M ASL',
  climate: '21°C — 29°C',
  latitude: '14.5878° N',
  longitude: '121.1759° E',
  quoteText: 'We booked two nights and stayed four. The room was beautifully plain in the best way, the bed was excellent, and we ate every breakfast on the terrace watching the valley clear. Staff remembered our coffee order by day two.',
  quoteAuthor: 'Camille Reyes',
  quoteMeta: 'Manila, Philippines (Stayed March 2026)',
};

export const DEFAULT_ACCOMMODATIONS: Accommodation[] = [
  {
    id: 'unit-premium',
    name: 'The Ledge Suite',
    type: 'premium',
    description: 'Our corner suite on the top floor, with a private terrace running the full width of the room. Floor-to-ceiling glass on two sides, a freestanding tub facing the valley, and a king bed positioned so the view is the first thing you see.',
    capacity: 2,
    price: 8500,
    features: [
      'King bed with premium linen',
      'Private wraparound terrace',
      'Freestanding tub with valley view',
      'Espresso machine and stocked minibar',
      'Rain shower and heated floors',
      'Breakfast for two included',
      'Late checkout at 2 PM included',
    ],
    imageUrl: q('photo-1618773928121-c32242e63f39'),
    quantity: 6
  },
  {
    id: 'unit-standard',
    name: 'Deluxe King',
    type: 'standard',
    description: 'The room most of our guests book twice. A king bed, a wide window seat built into the ridge-facing wall, and a compact desk for the mornings you cannot avoid your inbox.',
    capacity: 3,
    price: 5200,
    features: [
      'King bed with premium linen',
      'Ridge-facing window seat',
      'Work desk and reading lamp',
      'Rain shower',
      'Espresso machine',
      'Smart TV and fast Wi-Fi',
      'Rollaway bed available',
    ],
    imageUrl: q('photo-1540518614846-7eded433c457'),
    quantity: 12
  },
  {
    id: 'unit-basic',
    name: 'Studio Queen',
    type: 'basic',
    description: 'A smaller, smartly arranged studio on the lower floors. Everything you actually need and nothing you do not, with the same linen, the same coffee, and the same terrace access as every other room.',
    capacity: 2,
    price: 3400,
    features: [
      'Queen bed with premium linen',
      'Compact kitchenette',
      'Walk-in shower',
      'Filter coffee and kettle',
      'Smart TV and fast Wi-Fi',
      'Full terrace and lounge access',
      'Garden or courtyard aspect',
    ],
    imageUrl: q('photo-1522708323590-d24dbb6b0267'),
    quantity: 18
  }
];

export const DEFAULT_SERVICES: Service[] = [
  {
    id: 'service-dining',
    name: 'Grayline Café & Bar',
    description: 'All-day kitchen off the lobby — proper coffee from six, a short seasonal menu at lunch and dinner, and a bar that stays open as long as anyone is still talking.',
    image: q('photo-1554118811-1e0d58224f24'),
    price: 'A la carte (from ₱180)',
    details: [
      'Breakfast 6:00 AM — 11:00 AM, served late by request',
      'Single-origin espresso and pour-over',
      'Short seasonal lunch and dinner menu',
      'Bar open until midnight, later on weekends',
    ]
  },
  {
    id: 'service-terrace',
    name: 'The Terrace',
    description: 'The reason the hotel is called what it is. A long stone deck cut into the ridge, with loungers, shade, and an uninterrupted line down the valley.',
    image: q('photo-1445019980597-93fa8acb246c'),
    price: 'Included in stay',
    details: [
      'Open to all guests, sunrise until 10 PM',
      'Loungers, day beds and shaded seating',
      'Table service from the café',
      'Best light about an hour after sunrise',
    ]
  },
  {
    id: 'service-quiet',
    name: 'The Quiet Floor',
    description: 'One floor given over entirely to doing very little: a small spa with two treatment rooms, a sauna, and a reading room where phone calls are politely not a thing.',
    image: q('photo-1540555700478-4be289fbecef'),
    price: 'Treatments from ₱1,800',
    details: [
      'Two treatment rooms, booked at reception',
      'Dry sauna and cold shower',
      'Reading room with no screens',
      'Yoga mats and weights on request',
    ]
  }
];

// The FAQ assistant answers from these entries, so keep them accurate.
export const DEFAULT_FAQS: FAQ[] = [
  {
    id: 'f1',
    question: 'Where are you located and how do we get there?',
    answer: 'We are on Ridgeview Drive, Antipolo, Rizal — roughly an hour from Ortigas by car outside of rush hour. Navigate to "The Ledge" on Waze or Google Maps. Guests arriving by plane usually take a car service from NAIA, about 90 minutes; we can arrange this in advance as a paid add-on.',
    category: 'booking'
  },
  {
    id: 'f2',
    question: 'What time is check-in and check-out?',
    answer: 'Check-in opens at 2:00 PM and check-out is 12:00 noon. Early check-in and late check-out are free when the hotel is not full — just ask at reception that morning. Guaranteed late checkout can be added to any booking for ₱900, and is already included with the Ledge Suite.',
    category: 'stay'
  },
  {
    id: 'f3',
    question: 'Is breakfast included?',
    answer: 'Breakfast is included with the Ledge Suite and can be added to any other room for ₱650 per person. It is served in Grayline Café from 6:00 to 11:00 AM, and most guests take it out to the terrace. If you are leaving before six, we will leave coffee and something to eat at reception the night before.',
    category: 'amenities'
  },
  {
    id: 'f4',
    question: 'What are your house policies?',
    answer: 'The property is non-smoking indoors, with a designated area off the terrace. Quiet hours run 10:00 PM to 7:00 AM, which we do actually enforce — it is most of the reason people come here. Well-behaved dogs are welcome in Studio Queen rooms for ₱500 per stay; please tell us in advance.',
    category: 'policies'
  },
  {
    id: 'f5',
    question: 'What is your cancellation and rescheduling policy?',
    answer: 'Cancel 7 or more days before check-in for a full refund, or 3 to 6 days before for 50%. Inside 72 hours the first night is non-refundable. You can move your dates once at no charge up to 48 hours before arrival, subject to availability — reply to your confirmation email with the reference code.',
    category: 'policies'
  },
  {
    id: 'f6',
    question: 'How do I pay, and when is my booking confirmed?',
    answer: 'Booking on this site holds the room and issues a reference code starting with TL-. Your reservation is confirmed once we verify payment, usually within a few hours and always within 24. Unverified holds are released after 48 hours, so please send your proof of payment promptly.',
    category: 'booking'
  }
];

const LOCAL_STORAGE_KEY = 'ledge_cms_data';
const INITIALIZED_KEY = 'ledge_cms_initialized';

const defaults = (): CMSData => ({
  hero: DEFAULT_HERO,
  about: DEFAULT_ABOUT,
  accommodations: DEFAULT_ACCOMMODATIONS,
  services: DEFAULT_SERVICES,
  faqs: DEFAULT_FAQS
});

// Load CMS data. A first-time visitor gets the populated default site rather
// than an empty shell; "Reset to blank" in the Admin Panel clears it on demand.
export function getCMSData(): CMSData {
  if (typeof window === 'undefined') return defaults();

  const isInitialized = localStorage.getItem(INITIALIZED_KEY);
  if (!isInitialized) {
    const initial = defaults();
    saveCMSData(initial);
    localStorage.setItem(INITIALIZED_KEY, 'true');
    return initial;
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading CMS data', e);
  }

  return defaults();
}

export function saveCMSData(data: CMSData) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  }
}

export function resetToBlankSlate(): CMSData {
  const blank: CMSData = {
    hero: BLANK_HERO,
    about: BLANK_ABOUT,
    accommodations: BLANK_ACCOMMODATIONS,
    services: BLANK_SERVICES,
    faqs: BLANK_FAQS
  };
  saveCMSData(blank);
  return blank;
}

export function seedDefaultData(): CMSData {
  const d = defaults();
  saveCMSData(d);
  return d;
}

// Starter gallery for the Admin Panel image picker. Every URL here was checked
// to resolve; swap them for your own photography when you have it.
export const HIGH_QUALITY_PRESET_IMAGES: { url: string; name: string }[] = [
  { url: q('photo-1631049307264-da0ec9d70304'), name: 'Modern room, valley light' },
  { url: q('photo-1618773928121-c32242e63f39'), name: 'Suite, warm grey' },
  { url: q('photo-1540518614846-7eded433c457'), name: 'Deluxe king' },
  { url: q('photo-1522708323590-d24dbb6b0267'), name: 'Studio, minimal' },
  { url: q('photo-1596394516093-501ba68a0ba6'), name: 'Open-air bed on the deck' },
  { url: q('photo-1445019980597-93fa8acb246c'), name: 'Terrace loungers' },
  { url: q('photo-1554118811-1e0d58224f24'), name: 'Café and bar' },
  { url: q('photo-1540555700478-4be289fbecef'), name: 'Spa detail' },
  { url: q('photo-1560448204-e02f11c3d0e2'), name: 'Lounge, bright' },
  { url: q('photo-1551882547-ff40c63fe5fa'), name: 'Pool at dusk' },
  { url: q('photo-1571896349842-33c89424de2d'), name: 'Poolside dining' },
  { url: q('photo-1566073771259-6a8506099945'), name: 'Deck and water' },
];
