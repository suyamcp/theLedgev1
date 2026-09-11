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

// 1. BLANK SLATE STRUCTURES (Initial state on first run, as requested)
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
  {
    id: 'camping-cafe',
    name: '',
    description: '',
    image: '',
    price: '',
    details: []
  },
  {
    id: 'outdoor-adventure',
    name: '',
    description: '',
    image: '',
    price: '',
    details: []
  },
  {
    id: 'amenities-convenience',
    name: '',
    description: '',
    image: '',
    price: '',
    details: []
  }
];

export const BLANK_FAQS: FAQ[] = [];

// 2. DEFAULT SEED DATA (the "Load defaults" button in the Admin Panel)
// Replace every placeholder below with The Ledge's real content. Anything left
// in [BRACKETS] is a prompt for you, not copy meant to ship.
export const DEFAULT_HERO: HeroCMS = {
  backgroundImage: '',
  tagline: '[SHORT TAGLINE ABOVE THE TITLE]',
  title: 'The Ledge',
  description: '[HERO DESCRIPTION — one or two sentences on what The Ledge offers.]',
};

export const DEFAULT_ABOUT: AboutCMS = {
  tagline: '[ABOUT SECTION TAGLINE]',
  title: '[ABOUT SECTION HEADLINE]',
  desc1: '[ABOUT PARAGRAPH 1 — where you are and who you are for.]',
  desc2: '[ABOUT PARAGRAPH 2 — what a guest actually experiences.]',
  elevation: '',
  climate: '',
  latitude: '',
  longitude: '',
  quoteText: '[GUEST TESTIMONIAL — use a real quote once you have one.]',
  quoteAuthor: '[Guest Name]',
  quoteMeta: '[City, Country (Stayed Month Year)]',
};

export const DEFAULT_ACCOMMODATIONS: Accommodation[] = [
  {
    id: 'unit-premium',
    name: 'Premium Unit',
    type: 'premium',
    description: '[DESCRIPTION PLACEHOLDER] Describe your top-tier unit here.',
    capacity: 2,
    price: 0,
    features: ['[Feature 1]', '[Feature 2]', '[Feature 3]'],
    imageUrl: '',
    quantity: 1
  },
  {
    id: 'unit-standard',
    name: 'Standard Unit',
    type: 'standard',
    description: '[DESCRIPTION PLACEHOLDER] Describe your mid-tier unit here.',
    capacity: 4,
    price: 0,
    features: ['[Feature 1]', '[Feature 2]', '[Feature 3]'],
    imageUrl: '',
    quantity: 1
  },
  {
    id: 'unit-basic',
    name: 'Basic Unit',
    type: 'basic',
    description: '[DESCRIPTION PLACEHOLDER] Describe your entry-level unit here.',
    capacity: 2,
    price: 0,
    features: ['[Feature 1]', '[Feature 2]', '[Feature 3]'],
    imageUrl: '',
    quantity: 1
  }
];

export const DEFAULT_SERVICES: Service[] = [
  {
    id: 'service-1',
    name: '[Service 1 Name]',
    description: '[One line on what this service is.]',
    image: '',
    price: '[Price or "Included"]',
    details: ['[Detail 1]', '[Detail 2]', '[Detail 3]']
  },
  {
    id: 'service-2',
    name: '[Service 2 Name]',
    description: '[One line on what this service is.]',
    image: '',
    price: '[Price or "Included"]',
    details: ['[Detail 1]', '[Detail 2]', '[Detail 3]']
  },
  {
    id: 'service-3',
    name: '[Service 3 Name]',
    description: '[One line on what this service is.]',
    image: '',
    price: '[Price or "Included"]',
    details: ['[Detail 1]', '[Detail 2]', '[Detail 3]']
  }
];

// The FAQ chat assistant answers from these entries, so keep them accurate.
export const DEFAULT_FAQS: FAQ[] = [
  {
    id: 'f1',
    question: 'Where are you located and how do we get there?',
    answer: '[Your full address plus directions by car and public transport.]',
    category: 'booking'
  },
  {
    id: 'f2',
    question: 'What should we expect during our stay?',
    answer: '[Conditions, what to bring, what is provided.]',
    category: 'stay'
  },
  {
    id: 'f3',
    question: 'What are your house policies?',
    answer: '[Pets, quiet hours, smoking, guest limits.]',
    category: 'policies'
  },
  {
    id: 'f4',
    question: 'What is your cancellation and rescheduling policy?',
    answer: '[Refund windows and rescheduling rules.]',
    category: 'policies'
  }
];

const LOCAL_STORAGE_KEY = 'ledge_cms_data';
const INITIALIZED_KEY = 'ledge_cms_initialized';

// Load CMS Data. Defaults to Blank Slate if not initialized.
export function getCMSData(): CMSData {
  if (typeof window === 'undefined') {
    return {
      hero: BLANK_HERO,
      about: BLANK_ABOUT,
      accommodations: BLANK_ACCOMMODATIONS,
      services: BLANK_SERVICES,
      faqs: BLANK_FAQS
    };
  }

  const isInitialized = localStorage.getItem(INITIALIZED_KEY);
  if (!isInitialized) {
    // Return blank state on first load!
    const initialBlankData: CMSData = {
      hero: BLANK_HERO,
      about: BLANK_ABOUT,
      accommodations: BLANK_ACCOMMODATIONS,
      services: BLANK_SERVICES,
      faqs: BLANK_FAQS
    };
    saveCMSData(initialBlankData);
    localStorage.setItem(INITIALIZED_KEY, 'true');
    return initialBlankData;
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading CMS data', e);
  }

  // Fallback
  return {
    hero: BLANK_HERO,
    about: BLANK_ABOUT,
    accommodations: BLANK_ACCOMMODATIONS,
    services: BLANK_SERVICES,
    faqs: BLANK_FAQS
  };
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
  const defaults: CMSData = {
    hero: DEFAULT_HERO,
    about: DEFAULT_ABOUT,
    accommodations: DEFAULT_ACCOMMODATIONS,
    services: DEFAULT_SERVICES,
    faqs: DEFAULT_FAQS
  };
  saveCMSData(defaults);
  return defaults;
}

// Optional starter gallery shown in the Admin Panel image picker. Add your own
// hosted image URLs here, or upload images through the Admin Panel instead.
export const HIGH_QUALITY_PRESET_IMAGES: { url: string; name: string }[] = [];
