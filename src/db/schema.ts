import { pgTable, serial, varchar, text, timestamp, integer, numeric, date, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. GUESTS TABLE
export const guests = pgTable('guests', {
  id: serial('id').primaryKey(),
  firstName: varchar('first_name', { length: 50 }).notNull(),
  lastName: varchar('last_name', { length: 50 }).notNull(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  phoneNumber: varchar('phone_number', { length: 20 }),
  address: text('address'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 2. ROOM TYPES TABLE
export const roomTypes = pgTable('room_types', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 50 }).notNull().unique(), // NEW
  name: varchar('name', { length: 50 }).notNull().unique(),
  description: text('description'),
  baseRate: numeric('base_rate', { precision: 10, scale: 2 }).notNull(),
  capacity: integer('capacity').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 3. ROOMS TABLE
export const rooms = pgTable('rooms', {
  id: serial('id').primaryKey(),
  roomNumber: varchar('room_number', { length: 10 }).notNull().unique(),
  roomTypeId: integer('room_type_id').references(() => roomTypes.id, { onDelete: 'restrict' }).notNull(),
  floor: integer('floor'),
  status: varchar('status', { length: 20 }).default('available').notNull(), // available, occupied, under_maintenance
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 4. BOOKINGS TABLE
export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  reference: varchar('reference', { length: 12 }).notNull().unique(), // NEW
  guestId: integer('guest_id').references(() => guests.id, { onDelete: 'restrict' }).notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, confirmed, paid_pending_review, checked_in, checked_out, cancelled, rejected, no_show
  specialRequests: text('special_requests'),
  cancellationReason: text('cancellation_reason'),
  bookingDate: timestamp('booking_date').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 5. BOOKING ROOMS TABLE
export const bookingRooms = pgTable('booking_rooms', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'restrict' }).notNull(), // CHANGED from cascade
  roomId: integer('room_id').references(() => rooms.id, { onDelete: 'restrict' }).notNull(),
  checkInDate: date('check_in_date').notNull(),
  checkOutDate: date('check_out_date').notNull(),
  guestCount: integer('guest_count').notNull(), // NEW
  actualPricePerNight: numeric('actual_price_per_night', { precision: 10, scale: 2 }).notNull(),
  totalNights: integer('total_nights').notNull(),
  totalCost: numeric('total_cost', { precision: 10, scale: 2 }).notNull(),
}, (table) => {
  return {
    idxRoomDateRange: index('idx_room_date_range').on(table.roomId, table.checkInDate, table.checkOutDate),
    idxBookingId: index('idx_booking_id').on(table.bookingId),
  };
});

// 6. PAYMENTS TABLE
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'restrict' }).notNull(), // CHANGED from cascade
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('PHP').notNull(), // CHANGED from USD
  paymentMethod: varchar('payment_method', { length: 30 }).notNull(),
  paymentStatus: varchar('payment_status', { length: 20 }).default('pending').notNull(),
  transactionId: varchar('transaction_id', { length: 100 }).unique(),
  transactionDate: timestamp('transaction_date').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 7. ADMIN SETTINGS TABLE (For username, password, and change configurations)
export const adminSettings = pgTable('admin_settings', {
  key: varchar('key', { length: 50 }).primaryKey(),
  value: text('value').notNull(),
});

// 8. ADMIN SESSIONS TABLE
export const adminSessions = pgTable('admin_sessions', {
  token: varchar('token', { length: 64 }).primaryKey(),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
});

// 9. SITE CONTENT TABLE
export const siteContent = pgTable('site_content', {
  key: varchar('key', { length: 50 }).primaryKey(), // 'hero', 'about', 'accommodations', 'services', 'faqs'
  value: text('value').notNull(), // JSON-stringified
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 10. ADD-ONS CATALOG TABLE
export const addOns = pgTable('add_ons', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 11. BOOKING ADD-ONS TABLE
export const bookingAddOns = pgTable('booking_add_ons', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'restrict' }).notNull(),
  addOnId: integer('add_on_id').references(() => addOns.id, { onDelete: 'restrict' }).notNull(),
  quantity: integer('quantity').default(1).notNull(),
  actualPrice: numeric('actual_price', { precision: 10, scale: 2 }).notNull(),
});

// 12. SITE VISITORS TABLE (anonymous unique-visitor tracking, consent-gated)
export const visitors = pgTable('visitors', {
  visitorId: varchar('visitor_id', { length: 64 }).primaryKey(), // random anonymous id stored in a cookie
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  pageViews: integer('page_views').default(1).notNull(),
});

// 13. VISIT EVENTS TABLE (one row per tracked page view)
export const visitEvents = pgTable('visit_events', {
  id: serial('id').primaryKey(),
  visitorId: varchar('visitor_id', { length: 64 }).notNull(),
  path: varchar('path', { length: 300 }),
  isNewVisitor: integer('is_new_visitor').default(0).notNull(), // 1 = first-ever visit for this id
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    idxVisitCreated: index('idx_visit_events_created').on(table.createdAt),
  };
});

// ==========================================
// RELATIONSHIPS DEFINITIONS (for Drizzle ORM)
// ==========================================
export const guestsRelations = relations(guests, ({ many }) => ({
  bookings: many(bookings),
}));

export const roomTypesRelations = relations(roomTypes, ({ many }) => ({
  rooms: many(rooms),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  roomType: one(roomTypes, {
    fields: [rooms.roomTypeId],
    references: [roomTypes.id],
  }),
  bookingRooms: many(bookingRooms),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  guest: one(guests, {
    fields: [bookings.guestId],
    references: [guests.id],
  }),
  bookingRooms: many(bookingRooms),
  payments: many(payments),
  bookingAddOns: many(bookingAddOns),
}));

export const bookingRoomsRelations = relations(bookingRooms, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingRooms.bookingId],
    references: [bookings.id],
  }),
  room: one(rooms, {
    fields: [bookingRooms.roomId],
    references: [rooms.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.id],
  }),
}));

export const addOnsRelations = relations(addOns, ({ many }) => ({
  bookingAddOns: many(bookingAddOns),
}));

export const bookingAddOnsRelations = relations(bookingAddOns, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingAddOns.bookingId],
    references: [bookings.id],
  }),
  addOn: one(addOns, {
    fields: [bookingAddOns.addOnId],
    references: [addOns.id],
  }),
}));
