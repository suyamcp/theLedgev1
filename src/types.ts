export type AccommodationType = 'standard' | 'basic' | 'premium';

export interface Accommodation {
  id: string;
  name: string;
  type: AccommodationType;
  description: string;
  capacity: number; // max guests
  price: number; // price per night
  features: string[];
  imageUrl: string;
  quantity: number; // total units of this type available
}

export interface Booking {
  id: string;
  reference?: string; // TL-XXXXXX code the guest quotes
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  accommodationId: string;
  guestsCount: number;
  totalAmount: number;
  addOns: { id: string; name: string; price: number }[];
  status: 'confirmed' | 'pending' | 'paid_pending_review' | 'checked_in' | 'checked_out' | 'cancelled' | 'rejected' | 'no_show';
  notes?: string;
  createdAt: string;
}

export interface AddOn {
  id: string;
  name: string;
  price: number;
  description: string;
  icon: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: 'booking' | 'stay' | 'amenities' | 'policies';
}

export interface Service {
  id: string;
  name: string;
  description: string;
  image: string;
  price: string;
  details: string[];
}
