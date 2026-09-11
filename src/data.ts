import { Accommodation, AddOn } from './types';

// ---------------------------------------------------------------------------
// TEMPLATE PLACEHOLDER CONTENT
//
// These arrays are only a fallback. Real content is managed at runtime through
// the Admin Panel (see src/lib/cmsState.ts) and the database catalog
// (see src/db/seed-catalog.ts). Replace the copy below with The Ledge's real
// units and extras, and keep the three `id` values in sync with the slugs in
// seed-catalog.ts, or the booking form will not resolve a unit.
// ---------------------------------------------------------------------------

export const ACCOMMODATIONS: Accommodation[] = [
  {
    id: 'unit-premium',
    name: 'Premium Unit',
    type: 'premium',
    description: '[DESCRIPTION PLACEHOLDER] Describe your top-tier unit here — what makes it worth the highest rate.',
    capacity: 2,
    price: 0,
    features: [
      '[Feature 1]',
      '[Feature 2]',
      '[Feature 3]',
    ],
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
    features: [
      '[Feature 1]',
      '[Feature 2]',
      '[Feature 3]',
    ],
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
    features: [
      '[Feature 1]',
      '[Feature 2]',
      '[Feature 3]',
    ],
    imageUrl: '',
    quantity: 1
  }
];

// Optional extras offered during booking. `icon` is any lucide-react icon name.
export const ADD_ONS: AddOn[] = [
  {
    id: 'add-on-1',
    name: '[Add-on 1]',
    price: 0,
    description: '[Describe this optional extra.]',
    icon: 'Star'
  },
  {
    id: 'add-on-2',
    name: '[Add-on 2]',
    price: 0,
    description: '[Describe this optional extra.]',
    icon: 'Gift'
  }
];
