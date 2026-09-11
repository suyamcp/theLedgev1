import { Accommodation, AddOn } from './types';

// ---------------------------------------------------------------------------
// FALLBACK CONTENT
//
// These arrays are the booking form's fallback when the API is unreachable.
// Live content comes from the Admin Panel (src/lib/cmsState.ts) and the
// database catalog (src/db/seed-catalog.ts). Keep the three `id` values in
// sync with the slugs in seed-catalog.ts, or the form will not resolve a unit,
// and keep the rates here in step with the ones in cmsState.ts.
// ---------------------------------------------------------------------------

const IMG = 'https://images.unsplash.com';
const q = (id: string, w = 1200) => `${IMG}/${id}?auto=format&fit=crop&q=80&w=${w}`;

export const ACCOMMODATIONS: Accommodation[] = [
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

// Optional extras offered during booking. `icon` is any lucide-react icon name.
export const ADD_ONS: AddOn[] = [
  {
    id: 'airport-transfer',
    name: 'Airport Transfer (one way)',
    price: 1200,
    description: 'Private car from NAIA or Clark, meeting you at arrivals. Roughly 90 minutes from NAIA depending on traffic.',
    icon: 'Car'
  },
  {
    id: 'breakfast',
    name: 'Breakfast for Two',
    price: 650,
    description: 'Full breakfast in Grayline Café, 6:00 to 11:00 AM. Already included with the Ledge Suite.',
    icon: 'Coffee'
  },
  {
    id: 'late-checkout',
    name: 'Guaranteed Late Checkout',
    price: 900,
    description: 'Keep your room until 3:00 PM, confirmed at booking rather than subject to availability.',
    icon: 'Clock'
  },
  {
    id: 'terrace-dinner',
    name: 'Private Terrace Dinner',
    price: 2500,
    description: 'A reserved table at the far end of the terrace, set for two, with a three-course seasonal menu at sunset.',
    icon: 'UtensilsCrossed'
  }
];
