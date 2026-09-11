import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import crypto from "crypto";
// vite is imported lazily in dev mode only (see startServer) so the production
// bundle never needs it installed.
import { eq, and, or, lt, gt, sql } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import {
  bookings, guests, bookingRooms, rooms, adminSettings, payments,
  adminSessions, siteContent, addOns, bookingAddOns, roomTypes,
  visitors, visitEvents
} from './src/db/schema.ts';
import nodemailer from 'nodemailer';

// Running mode. The production bundle (dist/server.cjs) is compiled with
// NODE_ENV baked to "production"; as a fallback we also treat "being run from
// the dist/ folder" as production, so `node dist/server.cjs` is safe even if
// the host forgets to set NODE_ENV. `tsx server.ts` stays in dev mode.
const IS_PRODUCTION =
  process.env.NODE_ENV === 'production' ||
  (typeof __dirname !== 'undefined' && path.basename(__dirname) === 'dist');

// Make Express (and any dependency that reads NODE_ENV) agree with the mode we
// detected, so `npm start` is correct even when the host never set the var.
if (IS_PRODUCTION && process.env.NODE_ENV !== 'production') {
  process.env.NODE_ENV = 'production';
}

async function getRoomTypeBySlug(slug: string) {
  const [rt] = await db.select().from(roomTypes).where(eq(roomTypes.slug, slug)).limit(1);
  return rt;
}


// ==========================================================================
// ROOM INVENTORY
// The admin's "plots available" number in the Accommodations tab is the source
// of truth. This reconciles the physical `rooms` rows to match it, so the
// calendar can never advertise more units than the booking engine will accept.
// Units are only removed if they carry no bookings at all.
// ==========================================================================
async function reconcileRoomInventory(slug: string, desired: number) {
  const rt = await getRoomTypeBySlug(slug);
  if (!rt) return { slug, ok: false, reason: 'unknown room type' };

  const target = Math.max(0, Math.min(500, Math.floor(Number(desired) || 0)));
  const existing = await db.select().from(rooms).where(eq(rooms.roomTypeId, rt.id));
  const current = existing.length;
  if (target === current) return { slug, ok: true, current, target, added: 0, removed: 0 };

  // Prefix from the existing units (PU-, SU-, BU-), else initials of the slug.
  const prefix = existing[0]?.roomNumber?.includes('-')
    ? existing[0].roomNumber.split('-')[0]
    : slug.split('-').map(w => w[0]).join('').toUpperCase();

  if (target > current) {
    let maxN = 0;
    for (const r of existing) {
      const n = parseInt(String(r.roomNumber).split('-')[1] || '0', 10);
      if (!isNaN(n) && n > maxN) maxN = n;
    }
    const toAdd = [];
    for (let i = 1; i <= target - current; i++) {
      toAdd.push({ roomNumber: `${prefix}-${String(maxN + i).padStart(2, '0')}`, roomTypeId: rt.id, status: 'available' });
    }
    await db.insert(rooms).values(toAdd).onConflictDoNothing();
    return { slug, ok: true, current, target, added: toAdd.length, removed: 0 };
  }

  // Shrinking: only drop units that have never been booked, newest first.
  const booked = await db.selectDistinct({ roomId: bookingRooms.roomId }).from(bookingRooms);
  const bookedIds = new Set(booked.map(b => b.roomId));
  const removable = existing
    .filter(r => !bookedIds.has(r.id))
    .sort((a, b) => String(b.roomNumber).localeCompare(String(a.roomNumber)));

  const wanted = current - target;
  const victims = removable.slice(0, wanted);
  for (const v of victims) await db.delete(rooms).where(eq(rooms.id, v.id));

  return {
    slug, ok: true, current, target, added: 0, removed: victims.length,
    blocked: wanted - victims.length,   // units kept because they hold bookings
  };
}

// ==========================================
// MANUAL PAYMENT: instructions + email
// ==========================================

// Seeded into the database on first run, then edited from the Admin Panel.
// Fill in real account details before taking live bookings — accounts left blank
// are filtered out of the guest email and the reservation ticket.
const DEFAULT_PAYMENT_INSTRUCTIONS = {
  headline: 'Send your payment to confirm this reservation',
  accounts: [
    { method: '[Payment method 1]', accountName: 'The Ledge', accountNumber: '', qrImageUrl: '' },
    { method: '[Payment method 2]', accountName: 'The Ledge', accountNumber: '', qrImageUrl: '' },
    { method: '[Bank transfer]', accountName: 'The Ledge', accountNumber: '', qrImageUrl: '' },
  ],
  proofEmail: 'payments@theledge.example',
  note: 'Pay the full amount shown on your ticket using any option above, then email a clear screenshot or photo of your payment receipt (with your reference code) to the address above. Your reservation is confirmed once we verify your payment, usually within 24 hours. Unverified reservations may be released after 48 hours.',
};

async function getPaymentInstructions(): Promise<typeof DEFAULT_PAYMENT_INSTRUCTIONS> {
  try {
    const [row] = await db.select().from(siteContent).where(eq(siteContent.key, 'payment_instructions')).limit(1);
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      return { ...DEFAULT_PAYMENT_INSTRUCTIONS, ...parsed };
    }
  } catch (err) {
    console.error('Failed to read payment_instructions, using defaults:', err);
  }
  return DEFAULT_PAYMENT_INSTRUCTIONS;
}

async function seedPaymentInstructionsIfNeeded() {
  try {
    const [row] = await db.select().from(siteContent).where(eq(siteContent.key, 'payment_instructions')).limit(1);
    if (!row) {
      await db.insert(siteContent).values({
        key: 'payment_instructions',
        value: JSON.stringify(DEFAULT_PAYMENT_INSTRUCTIONS),
        updatedAt: new Date(),
      });
      console.log('✓ Seeded default payment instructions.');
    }
  } catch (err) {
    console.error('Failed to seed payment instructions:', err);
  }
}

// SMTP transport is optional. Without SMTP_HOST configured, emails are skipped (booking still succeeds).
function getMailer() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

const peso = (n: number) => `PHP ${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

function buildGuestEmail(ticket: any, instr: typeof DEFAULT_PAYMENT_INSTRUCTIONS) {
  const accountLines = instr.accounts
    .filter(a => a.accountName || a.accountNumber)
    .map(a => `  • ${a.method}: ${a.accountName} — ${a.accountNumber}`)
    .join('\n');
  const addOnLines = (ticket.addOns || []).length
    ? '\nAdd-ons:\n' + ticket.addOns.map((a: any) => `  • ${a.name} x${a.quantity} — ${peso(a.price * a.quantity)}`).join('\n')
    : '';

  const text = `Hi ${ticket.customerName},

Thank you for reserving with The Ledge. Your reservation is HELD but NOT YET CONFIRMED — it is confirmed once we verify your payment.

RESERVATION
  Reference:      ${ticket.reference}
  Accommodation:  ${ticket.accommodationName}
  Check-in:       ${ticket.checkIn}
  Check-out:      ${ticket.checkOut}
  Nights:         ${ticket.nights}
  Guests:         ${ticket.guestsCount}${addOnLines}
  AMOUNT DUE:     ${peso(ticket.amountDue)}

HOW TO PAY
${instr.headline}
${accountLines}

${instr.note}

Send your proof of payment to: ${instr.proofEmail}
Include your reference code ${ticket.reference} in the email.

— The Ledge`;

  return { subject: `The Ledge reservation ${ticket.reference} — payment instructions`, text };
}

async function sendConfirmationEmail(bookingId: number) {
  const mailer = getMailer();
  if (!mailer) {
    console.log(`[email skipped — SMTP not configured] would send confirmation for booking ${bookingId}`);
    return;
  }
  const [row] = await db.select({
    reference: bookings.reference,
    firstName: guests.firstName,
    lastName: guests.lastName,
    email: guests.email,
    roomTypeName: roomTypes.name,
    checkInDate: bookingRooms.checkInDate,
    checkOutDate: bookingRooms.checkOutDate,
    totalCost: bookingRooms.totalCost,
  })
    .from(bookings)
    .innerJoin(guests, eq(bookings.guestId, guests.id))
    .innerJoin(bookingRooms, eq(bookingRooms.bookingId, bookings.id))
    .innerJoin(rooms, eq(bookingRooms.roomId, rooms.id))
    .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!row) return;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@theledge.example';
  const name = `${row.firstName} ${row.lastName}`.trim();
  const text = `Hi ${name},

Good news — your payment has been verified and your The Ledge reservation is CONFIRMED.

  Reference:      ${row.reference}
  Accommodation:  ${row.roomTypeName}
  Check-in:       ${row.checkInDate}
  Check-out:      ${row.checkOutDate}

Please bring this reference code with you at check-in. See you soon!

— The Ledge`;

  await mailer.sendMail({ from, to: row.email, subject: `Your The Ledge reservation ${row.reference} is confirmed`, text });
}

async function sendReservationEmails(ticket: any, instr: typeof DEFAULT_PAYMENT_INSTRUCTIONS) {
  const mailer = getMailer();
  if (!mailer) {
    console.log(`[email skipped — SMTP not configured] would send payment instructions for ${ticket.reference} to ${ticket.customerEmail}`);
    return;
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@theledge.example';
  const guest = buildGuestEmail(ticket, instr);

  await mailer.sendMail({ from, to: ticket.customerEmail, subject: guest.subject, text: guest.text });

  // Staff heads-up so someone knows to watch for the proof of payment.
  if (instr.proofEmail) {
    await mailer.sendMail({
      from,
      to: instr.proofEmail,
      subject: `New pending reservation ${ticket.reference} — awaiting payment`,
      text: `New reservation held, awaiting payment verification.\n\nReference: ${ticket.reference}\nGuest: ${ticket.customerName} (${ticket.customerEmail}, ${ticket.customerPhone})\nAccommodation: ${ticket.accommodationName}\nDates: ${ticket.checkIn} to ${ticket.checkOut} (${ticket.nights} night/s)\nGuests: ${ticket.guestsCount}\nAmount due: ${peso(ticket.amountDue)}\n\nConfirm it in the admin panel once the proof of payment arrives.`,
    });
  }
}

async function getRoomTypeById(id: number) {
  const [rt] = await db.select().from(roomTypes).where(eq(roomTypes.id, id)).limit(1);
  return rt;
}

// ---------------------------------------------------------------------------
// LOGIN THROTTLE
// The admin panel is the only door to guest data and site content, and it sits
// on a public URL. bcrypt slows each guess but does not cap the rate, so we add
// a small in-memory lockout: 8 failed attempts from one IP within 15 minutes
// blocks that IP for 15 minutes. Resets on a successful login. In-memory is
// fine for a single-instance deployment; a multi-instance setup would move this
// to the database.
/** How long an admin login stays valid. */
const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;

const LOGIN_MAX_FAILS = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, { fails: number; first: number; blockedUntil: number }>();

function loginClientIp(req: express.Request): string {
  const fwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return fwd || req.socket.remoteAddress || 'unknown';
}

/** @returns seconds remaining if currently locked out, otherwise 0 */
function loginLockRemaining(ip: string): number {
  const rec = loginAttempts.get(ip);
  if (!rec) return 0;
  if (rec.blockedUntil && rec.blockedUntil > Date.now()) {
    return Math.ceil((rec.blockedUntil - Date.now()) / 1000);
  }
  return 0;
}

function recordLoginFailure(ip: string) {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || now - rec.first > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { fails: 1, first: now, blockedUntil: 0 });
    return;
  }
  rec.fails += 1;
  if (rec.fails >= LOGIN_MAX_FAILS) rec.blockedUntil = now + LOGIN_WINDOW_MS;
}

function clearLoginFailures(ip: string) {
  loginAttempts.delete(ip);
}

// Keep the throttle map from growing unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of loginAttempts) {
    if (rec.blockedUntil < now && now - rec.first > LOGIN_WINDOW_MS) loginAttempts.delete(ip);
  }
}, 30 * 60 * 1000).unref?.();

async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    const rows = await db.select().from(adminSessions)
      .where(and(eq(adminSessions.token, token), gt(adminSessions.expiresAt, new Date())))
      .limit(1);
    if (rows.length === 0) return res.status(401).json({ error: 'Session expired or invalid.' });
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(500).json({ error: 'Internal auth verification error.' });
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Sit behind the host's load balancer / TLS terminator, so req.protocol and
  // the client IP are read from X-Forwarded-* headers.
  app.set('trust proxy', 1);
  app.disable('x-powered-by'); // don't advertise the stack

  // Security headers. No external dependency — these are the few that matter for
  // a server-rendered SPA with a JSON API and no third-party embeds.
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
    if (IS_PRODUCTION) {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    next();
  });

  // Body limits: the admin image upload route needs room for a base64 photo, so
  // it gets its own large limit mounted only on that path. Everything else —
  // bookings, analytics, the chatbot — is capped tight to remove a trivial
  // memory-exhaustion vector.
  const UPLOAD_JSON_LIMIT = '12mb';
  app.use('/api/upload', express.json({ limit: UPLOAD_JSON_LIMIT }));
  app.use(express.json({ limit: '200kb' }));
  app.use(express.urlencoded({ limit: '200kb', extended: true }));

  // Liveness/readiness probe for the hosting platform. Confirms the process is
  // up and the database answers; never touches guest data.
  app.get(['/healthz', '/api/health'], async (_req, res) => {
    try {
      await db.execute(sql`SELECT 1`);
      res.json({ ok: true, ts: new Date().toISOString() });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  // --- DATABASE SELF-HEALING SEEDING FOR ROOMS, ROOM TYPES, AND DEFAULT ADMIN ---
  async function seedRoomTypesAndRooms() {
    try {
      const existingTypes = await db.select().from(roomTypes).limit(1);
      if (existingTypes.length === 0) {
        console.log('No room types found in database. Seeding room types...');
        await db.insert(roomTypes).values([
          { id: 1, slug: 'unit-premium',  name: 'Premium Unit',  baseRate: '0.00', capacity: 2 },
          { id: 2, slug: 'unit-standard', name: 'Standard Unit', baseRate: '0.00', capacity: 4 },
          { id: 3, slug: 'unit-basic',    name: 'Basic Unit',    baseRate: '0.00', capacity: 2 }
        ]);
        
        console.log('Seeding physical units (rooms)...');
        // One unit per type so the site boots with a valid catalog. Set the real
        // counts in the Admin Panel, or edit src/db/seed-catalog.ts before first run.
        const unitSeed = [
          { prefix: 'PU', roomTypeId: 1, count: 1 },
          { prefix: 'SU', roomTypeId: 2, count: 1 },
          { prefix: 'BU', roomTypeId: 3, count: 1 },
        ];
        const roomsToInsert: any[] = [];
        for (const u of unitSeed) {
          for (let i = 1; i <= u.count; i++) {
            roomsToInsert.push({ roomNumber: `${u.prefix}-${String(i).padStart(2, '0')}`, roomTypeId: u.roomTypeId, status: 'available' });
          }
        }
        await db.insert(rooms).values(roomsToInsert);
        console.log('✓ Seeding room types and physical units completed successfully!');
      } else {
        console.log('Room types already exist. Skipping seed.');
      }
    } catch (err) {
      console.error('Failed to seed room types/rooms on startup:', err);
    }
  }

  // Bootstraps the admin account the first time the app runs against an empty database.
  // Credentials come from the environment, never from source control. If no initial
  // password is provided we mint a random one and print it once, so this app ships
  // with no publicly-known default login.
  async function seedDefaultAdminIfNeeded() {
    try {
      const hashRecord = await db.select().from(adminSettings).where(eq(adminSettings.key, 'admin_password_hash')).limit(1);
      if (hashRecord.length > 0) return;

      const email = process.env.ADMIN_EMAIL || 'admin@theledge.local';
      const provided = process.env.ADMIN_INITIAL_PASSWORD;
      const password = provided || crypto.randomBytes(12).toString('base64url');
      const hash = await bcrypt.hash(password, 12);

      await db.insert(adminSettings).values([
        { key: 'admin_username', value: email },
        { key: 'admin_password_hash', value: hash }
      ]);

      console.log('✓ Admin account created.');
      console.log(`   Username: ${email}`);
      if (provided) {
        console.log('   Password: taken from ADMIN_INITIAL_PASSWORD in your environment.');
      } else {
        console.log(`   TEMPORARY PASSWORD (shown once, not stored in plain text): ${password}`);
        console.log('   Log in and change it under Admin → Settings → Admin Password Management.');
      }
    } catch (err) {
      console.error('Failed to seed default admin on startup:', err);
    }
  }

  // Self-healing creation of the analytics tables (so no manual migration step is needed).
  async function ensureAnalyticsTables() {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "visitors" (
          "visitor_id" varchar(64) PRIMARY KEY NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "last_seen_at" timestamp DEFAULT now() NOT NULL,
          "page_views" integer DEFAULT 1 NOT NULL
        );
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "visit_events" (
          "id" serial PRIMARY KEY NOT NULL,
          "visitor_id" varchar(64) NOT NULL,
          "path" varchar(300),
          "is_new_visitor" integer DEFAULT 0 NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL
        );
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_visit_events_created" ON "visit_events" ("created_at");`);
    } catch (err) {
      console.error('Failed to ensure analytics tables:', err);
    }
  }

  await seedRoomTypesAndRooms();
  await seedDefaultAdminIfNeeded();
  await seedPaymentInstructionsIfNeeded();
  await ensureAnalyticsTables();


  // ==========================================================================
  // SCHEDULED MAINTENANCE
  // ==========================================================================

  // How long an unpaid reservation may hold its dates. Editable in Admin -> Settings.
  async function getPendingHoldHours(): Promise<number> {
    try {
      const [row] = await db.select().from(adminSettings).where(eq(adminSettings.key, 'pending_hold_hours')).limit(1);
      const n = Number(row?.value);
      if (Number.isFinite(n) && n >= 1 && n <= 720) return n;
    } catch { /* fall through */ }
    return 48;
  }

  // Frees rooms held by reservations that were never paid for. This is what
  // finally enforces the "released after 48 hours" line on the payment ticket.
  async function releaseExpiredHolds() {
    try {
      const hours = await getPendingHoldHours();
      const { rows } = await db.execute(sql`
        UPDATE bookings SET status = 'cancelled', updated_at = now(),
               cancellation_reason = 'Auto-released: payment not received within the hold window'
        WHERE status = 'pending'
          AND booking_date < now() - (${String(hours)} || ' hours')::interval
        RETURNING reference
      `) as any;
      if (rows?.length) {
        console.log(`Released ${rows.length} unpaid reservation(s) after ${hours}h:`, rows.map((r: any) => r.reference).join(', '));
      }
    } catch (err) {
      console.error('Failed to release expired holds:', err);
    }
  }

  // Privacy retention: after 12 months, strip the personal details from guests
  // whose bookings are ALL cancelled/rejected. The booking rows themselves stay,
  // so cancellation stats and the dispute trail survive - only the PII goes.
  async function anonymiseOldCancellations() {
    try {
      const { rows } = await db.execute(sql`
        UPDATE guests g
        SET first_name = 'Removed', last_name = 'Guest',
            email = 'anon+' || g.id || '@removed.invalid',
            phone_number = '', address = '', updated_at = now()
        WHERE g.email NOT LIKE '%@removed.invalid'
          AND EXISTS (SELECT 1 FROM bookings b WHERE b.guest_id = g.id)
          AND NOT EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.guest_id = g.id
              AND (b.status NOT IN ('cancelled','rejected')
                   OR b.updated_at > now() - interval '12 months')
          )
        RETURNING g.id
      `) as any;
      if (rows?.length) console.log(`Anonymised ${rows.length} guest record(s) older than 12 months.`);
    } catch (err) {
      console.error('Failed to anonymise old cancellations:', err);
    }
  }

  // Expired admin sessions are dead weight and a lingering credential surface;
  // clear them out on the same cadence as the other housekeeping.
  async function purgeExpiredSessions() {
    try {
      await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
    } catch (err) {
      console.error('Failed to purge expired admin sessions:', err);
    }
  }

  async function runMaintenance() {
    await releaseExpiredHolds();
    await anonymiseOldCancellations();
    await purgeExpiredSessions();
  }
  await runMaintenance();
  setInterval(runMaintenance, 15 * 60 * 1000); // every 15 minutes

  // ==========================================
  // API ROUTES
  // ==========================================

  // Get all bookings from database (Admin Only)
  app.get('/api/bookings', requireAdmin, async (req, res) => {
    try {
      const dbBookings = await db.select({
        bookingId: bookings.id,
        reference: bookings.reference,
        status: bookings.status,
        specialRequests: bookings.specialRequests,
        bookingDate: bookings.bookingDate,
        guestId: guests.id,
        firstName: guests.firstName,
        lastName: guests.lastName,
        email: guests.email,
        phone: guests.phoneNumber,
        address: guests.address,
        roomId: rooms.id,
        roomNumber: rooms.roomNumber,
        roomTypeId: rooms.roomTypeId,
        roomTypeSlug: roomTypes.slug,
        roomTypeCapacity: roomTypes.capacity,
        checkInDate: bookingRooms.checkInDate,
        checkOutDate: bookingRooms.checkOutDate,
        actualPricePerNight: bookingRooms.actualPricePerNight,
        totalNights: bookingRooms.totalNights,
        totalCost: bookingRooms.totalCost,
      })
      .from(bookings)
      .innerJoin(guests, eq(bookings.guestId, guests.id))
      .innerJoin(bookingRooms, eq(bookingRooms.bookingId, bookings.id))
      .innerJoin(rooms, eq(bookingRooms.roomId, rooms.id))
      .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id));

      // Fetch booking add-ons
      const dbAddOns = await db.select({
        bookingId: bookingAddOns.bookingId,
        addOnId: addOns.id,
        name: addOns.name,
        quantity: bookingAddOns.quantity,
        actualPrice: bookingAddOns.actualPrice,
      })
      .from(bookingAddOns)
      .innerJoin(addOns, eq(bookingAddOns.addOnId, addOns.id));

      const addOnsMap: Record<number, any[]> = {};
      dbAddOns.forEach(ao => {
        if (!addOnsMap[ao.bookingId]) {
          addOnsMap[ao.bookingId] = [];
        }
        addOnsMap[ao.bookingId].push({
          id: String(ao.addOnId),
          name: ao.name,
          quantity: ao.quantity,
          price: Number(ao.actualPrice),
        });
      });

      const mapped = dbBookings.map(b => {
        const listAo = addOnsMap[b.bookingId] || [];
        const addOnsTotal = listAo.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const baseRoomTotal = b.totalCost ? Number(b.totalCost) : 0;
        return {
          id: String(b.bookingId),
          reference: b.reference,
          customerName: `${b.firstName} ${b.lastName}`.trim(),
          customerEmail: b.email,
          customerPhone: b.phone || '',
          checkIn: b.checkInDate,
          checkOut: b.checkOutDate,
          accommodationId: b.roomTypeSlug,
          guestsCount: b.roomTypeCapacity,
          totalAmount: baseRoomTotal + addOnsTotal,
          addOns: listAo,
          status: b.status as any,
          notes: b.specialRequests || undefined,
          createdAt: b.bookingDate ? b.bookingDate.toISOString() : new Date().toISOString(),
        };
      });

      res.json(mapped);
    } catch (error) {
      console.error('Failed to get bookings:', error);
      res.status(500).json({ error: 'Failed to retrieve bookings.' });
    }
  });

  // Public availability endpoint (No PII)
  app.get('/api/availability', async (req, res) => {
    try {
      const rows = await db.select({
        roomTypeSlug: roomTypes.slug, // NEW — join added
        roomId: bookingRooms.roomId,
        checkIn: bookingRooms.checkInDate,
        checkOut: bookingRooms.checkOutDate,
        status: bookings.status,
      })
      .from(bookingRooms)
      .innerJoin(bookings, eq(bookingRooms.bookingId, bookings.id))
      .innerJoin(rooms, eq(bookingRooms.roomId, rooms.id))
      .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id)) // NEW
      .where(or(
        eq(bookings.status, 'confirmed'),
        eq(bookings.status, 'pending'),
        eq(bookings.status, 'paid_pending_review'),
      ));

      res.json(rows);
    } catch (error) {
      console.error('Failed to get availability:', error);
      res.status(500).json({ error: 'Failed to load availability.' });
    }
  });

  // ==========================================
  // ANONYMOUS VISITOR TRACKING (consent-gated on the client)
  // ==========================================

  const VISITOR_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

  // Called by the site on each page load ONLY after the visitor accepts analytics cookies.
  app.post('/api/track', async (req, res) => {
    try {
      let visitorId: string | null =
        typeof req.body?.visitorId === 'string' && VISITOR_ID_RE.test(req.body.visitorId)
          ? req.body.visitorId
          : null;
      const path = String(req.body?.path || '/').slice(0, 300);

      let isNew = false;

      if (visitorId) {
        const existing = await db.select({ id: visitors.visitorId }).from(visitors).where(eq(visitors.visitorId, visitorId)).limit(1);
        if (existing.length === 0) {
          isNew = true;
          await db.insert(visitors).values({ visitorId, pageViews: 1 }).onConflictDoNothing();
        } else {
          await db.update(visitors)
            .set({ lastSeenAt: new Date(), pageViews: sql`${visitors.pageViews} + 1` })
            .where(eq(visitors.visitorId, visitorId));
        }
      } else {
        // No usable id from the browser — mint one server-side and hand it back to be stored.
        visitorId = crypto.randomBytes(16).toString('hex');
        isNew = true;
        await db.insert(visitors).values({ visitorId, pageViews: 1 }).onConflictDoNothing();
      }

      await db.insert(visitEvents).values({ visitorId, path, isNewVisitor: isNew ? 1 : 0 });

      res.json({ visitorId, isNew });
    } catch (error) {
      console.error('Visitor tracking failed:', error);
      res.status(200).json({ ok: false }); // never break the page over analytics
    }
  });

  // Visitor analytics for the admin dashboard.
  app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
    try {
      const q = async (text: any) => (await db.execute(text) as any).rows;

      const [totals] = await q(sql`
        SELECT
          (SELECT count(*) FROM visitors) AS total_unique,
          (SELECT count(*) FROM visitors WHERE (created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date) AS unique_today,
          (SELECT count(*) FROM visitors WHERE created_at >= now() - interval '7 days') AS unique_7d,
          (SELECT count(*) FROM visitors WHERE created_at >= now() - interval '30 days') AS unique_30d,
          (SELECT count(*) FROM visit_events) AS pageviews_total,
          (SELECT count(*) FROM visit_events WHERE (created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date) AS pageviews_today,
          (SELECT count(*) FROM visit_events WHERE created_at >= now() - interval '7 days') AS pageviews_7d
      `);

      const daily = await q(sql`
        SELECT to_char((created_at AT TIME ZONE 'Asia/Manila')::date, 'YYYY-MM-DD') AS day,
               count(*) FILTER (WHERE is_new_visitor = 1) AS new_visitors,
               count(*) AS page_views
        FROM visit_events
        WHERE created_at >= now() - interval '14 days'
        GROUP BY 1
        ORDER BY 1
      `);

      const recent = await q(sql`
        SELECT visitor_id, to_char(created_at, 'YYYY-MM-DD HH24:MI') AS first_seen,
               to_char(last_seen_at, 'YYYY-MM-DD HH24:MI') AS last_seen, page_views
        FROM visitors
        ORDER BY last_seen_at DESC
        LIMIT 15
      `);

      res.json({
        totalUnique: Number(totals.total_unique || 0),
        uniqueToday: Number(totals.unique_today || 0),
        unique7d: Number(totals.unique_7d || 0),
        unique30d: Number(totals.unique_30d || 0),
        pageViewsTotal: Number(totals.pageviews_total || 0),
        pageViewsToday: Number(totals.pageviews_today || 0),
        pageViews7d: Number(totals.pageviews_7d || 0),
        daily: daily.map((d: any) => ({ day: d.day, newVisitors: Number(d.new_visitors), pageViews: Number(d.page_views) })),
        recentVisitors: recent.map((r: any) => ({
          visitorId: r.visitor_id,
          firstSeen: r.first_seen,
          lastSeen: r.last_seen,
          pageViews: Number(r.page_views),
        })),
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
      res.status(500).json({ error: 'Failed to load visitor analytics.' });
    }
  });

  // Public booking lookup by reference — powers the "manage booking" search.
  // The reference code acts as the shared secret (same trust model as the cancel endpoint).
  app.get('/api/bookings/lookup', async (req, res) => {
    const reference = String(req.query.reference || '').trim().toUpperCase();
    if (!reference) {
      return res.status(400).json({ error: 'A booking reference is required.' });
    }
    try {
      const rows = await db.select({
        reference: bookings.reference,
        status: bookings.status,
        specialRequests: bookings.specialRequests,
        bookingDate: bookings.bookingDate,
        firstName: guests.firstName,
        lastName: guests.lastName,
        email: guests.email,
        phone: guests.phoneNumber,
        roomTypeName: roomTypes.name,
        roomTypeSlug: roomTypes.slug,
        checkInDate: bookingRooms.checkInDate,
        checkOutDate: bookingRooms.checkOutDate,
        guestCount: bookingRooms.guestCount,
        totalCost: bookingRooms.totalCost,
      })
      .from(bookings)
      .innerJoin(guests, eq(bookings.guestId, guests.id))
      .innerJoin(bookingRooms, eq(bookingRooms.bookingId, bookings.id))
      .innerJoin(rooms, eq(bookingRooms.roomId, rooms.id))
      .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
      .where(eq(bookings.reference, reference))
      .limit(1);

      if (rows.length === 0) {
        return res.status(404).json({ error: 'No reservation found for that reference.' });
      }
      const b = rows[0];

      const aoRows = await db.select({
        name: addOns.name,
        quantity: bookingAddOns.quantity,
        actualPrice: bookingAddOns.actualPrice,
      })
      .from(bookingAddOns)
      .innerJoin(bookings, eq(bookingAddOns.bookingId, bookings.id))
      .innerJoin(addOns, eq(bookingAddOns.addOnId, addOns.id))
      .where(eq(bookings.reference, reference));

      const payRows = await db.select({ paymentStatus: payments.paymentStatus })
        .from(payments)
        .innerJoin(bookings, eq(payments.bookingId, bookings.id))
        .where(eq(bookings.reference, reference))
        .limit(1);

      const addOnsTotal = aoRows.reduce((sum, x) => sum + Number(x.actualPrice) * x.quantity, 0);
      const grandTotal = Number(b.totalCost) + addOnsTotal;

      res.json({
        reference: b.reference,
        status: b.status,
        paymentStatus: payRows[0]?.paymentStatus || 'pending',
        customerName: `${b.firstName} ${b.lastName}`.trim(),
        customerEmail: b.email,
        customerPhone: b.phone || '',
        accommodationName: b.roomTypeName,
        accommodationSlug: b.roomTypeSlug,
        checkIn: b.checkInDate,
        checkOut: b.checkOutDate,
        guestsCount: b.guestCount,
        addOns: aoRows.map(x => ({ name: x.name, quantity: x.quantity, price: Number(x.actualPrice) })),
        totalAmount: grandTotal,
        amountDue: grandTotal,
        notes: b.specialRequests || undefined,
        createdAt: b.bookingDate ? b.bookingDate.toISOString() : null,
        paymentInstructions: await getPaymentInstructions(),
      });
    } catch (error) {
      console.error('Failed to look up booking:', error);
      res.status(500).json({ error: 'Failed to look up reservation.' });
    }
  });

  // Release a still-unpaid reservation (guest changed their mind before paying).
  app.post('/api/bookings/release', async (req, res) => {
    const reference = String(req.body?.reference || '').trim().toUpperCase();
    if (!reference) {
      return res.status(400).json({ error: 'A booking reference is required.' });
    }
    try {
      const rows = await db.select().from(bookings).where(eq(bookings.reference, reference)).limit(1);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Reservation not found.' });
      }
      // Only release reservations that never got paid — never touch a confirmed booking.
      if (rows[0].status === 'pending') {
        await db.update(bookings)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(eq(bookings.id, rows[0].id));
      }
      res.json({ success: true, status: rows[0].status === 'pending' ? 'cancelled' : rows[0].status });
    } catch (error) {
      console.error('Failed to release booking:', error);
      res.status(500).json({ error: 'Failed to release reservation.' });
    }
  });

  // Public CMS site content endpoint
  app.get('/api/content', async (req, res) => {
    try {
      const rows = await db.select().from(siteContent);
      const contentMap: Record<string, any> = {};
      rows.forEach(r => {
        try {
          contentMap[r.key] = JSON.parse(r.value);
        } catch (e) {
          contentMap[r.key] = r.value;
        }
      });
      res.json(contentMap);
    } catch (error) {
      console.error('Failed to get site content:', error);
      res.status(500).json({ error: 'Failed to retrieve site content.' });
    }
  });

  // Update CMS site content (Admin Only)
  app.post('/api/content', requireAdmin, async (req, res) => {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Key and value are required.' });
    }
    try {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      await db.insert(siteContent)
        .values({ key, value: valueStr, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: siteContent.key,
          set: { value: valueStr, updatedAt: new Date() }
        });

      // Saving accommodations also re-points real inventory at the admin's numbers.
      let inventory: any[] = [];
      if (key === 'accommodations' && Array.isArray(value)) {
        for (const acc of value) {
          if (acc?.id && acc.quantity !== undefined && acc.quantity !== null) {
            inventory.push(await reconcileRoomInventory(String(acc.id), acc.quantity));
          }
        }

        // Some units may be un-removable because they still carry bookings. Write the
        // number we actually achieved back to the CMS so the calendar can never
        // advertise a figure the booking engine disagrees with, in either direction.
        let corrected = false;
        const adjusted = value.map((acc: any) => {
          const r = inventory.find(i => i.slug === String(acc?.id));
          if (r?.ok) {
            const actual = r.current + (r.added || 0) - (r.removed || 0);
            if (Number(acc.quantity) !== actual) { corrected = true; return { ...acc, quantity: actual }; }
          }
          return acc;
        });
        if (corrected) {
          await db.update(siteContent)
            .set({ value: JSON.stringify(adjusted), updatedAt: new Date() })
            .where(eq(siteContent.key, 'accommodations'));
        }

        const changed = inventory.filter(i => i.added || i.removed || i.blocked);
        if (changed.length) console.log('Room inventory reconciled:', JSON.stringify(changed));
      }

      res.json({ success: true, inventory });
    } catch (error) {
      console.error('Failed to save site content:', error);
      res.status(500).json({ error: 'Failed to save site content.' });
    }
  });

  // Update booking status (Admin Only)
  app.patch('/api/bookings/:id/status', requireAdmin, async (req, res) => {
    const bookingId = Number(req.params.id);
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status parameter is required.' });
    }
    try {
      await db.update(bookings)
        .set({ status, updatedAt: new Date() })
        .where(eq(bookings.id, bookingId));
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to update booking status:', error);
      res.status(500).json({ error: 'Failed to update booking status.' });
    }
  });

  // Public add-ons catalog endpoint
  app.get('/api/add-ons', async (req, res) => {
    try {
      const rows = await db.select().from(addOns);
      res.json(rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        price: Number(r.price),
      })));
    } catch (error) {
      console.error('Failed to get add-ons catalog:', error);
      res.status(500).json({ error: 'Failed to load add-ons.' });
    }
  });

  // ==========================================
  // FAQ HELP BOT — rule-based, reads the live site content each request (no external AI).
  // Update a price/room/service in the admin panel and the bot's answers change automatically.
  // ==========================================

  async function loadSiteKnowledge() {
    const contentRows = await db.select().from(siteContent);
    const c: Record<string, any> = {};
    for (const r of contentRows) {
      try { c[r.key] = JSON.parse(r.value); } catch { c[r.key] = r.value; }
    }
    const rts = await db.select().from(roomTypes);
    const catalog = await db.select().from(addOns);
    const pay = await getPaymentInstructions();
    return { c, rts, catalog, pay };
  }

  const BOT_STOPWORDS = new Set(
    'a an the is are am was were be been do does did i you we they it he she to of for in on at and or my our your how what when where which who whats can could would should will want know about me please tell give there their has have had with as this that these those'.split(' ')
  );
  // Fold common phrasings so "wi-fi", "internet", "dog" etc. all match the right FAQ.
  const botNorm = (s: string) =>
    s.toLowerCase()
      .replace(/wi[\s-]?fi/g, 'wifi')
      .replace(/\b(internet|connection|starlink)\b/g, 'wifi')
      .replace(/\b(dogs?|cats?|puppy|puppies|kitten|animals?|fur\s?bab(y|ies))\b/g, 'pet')
      .replace(/\b(climate|weather|temperature|chilly|freezing|forecast)\b/g, 'cold');
  const botTokens = (s: string) =>
    botNorm(s).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w && !BOT_STOPWORDS.has(w));
  // `q` is space-padded & single-spaced. Single-word keywords match whole words only
  // (so "eat" doesn't fire on "w-eat-her"); multi-word keywords match as a phrase.
  const qHas = (q: string, words: string[]) =>
    words.some(w => (w.includes(' ') ? q.includes(w) : q.includes(` ${w} `)));
  const bp = (n: any) => `₱${Number(n || 0).toLocaleString()}`;

  function answerRooms(k: any, q: string): string | null {
    if (!qHas(q, ['price', 'prices', 'cost', 'costs', 'rate', 'rates', 'how much', 'room', 'rooms', 'accommodation', 'accommodations', 'stay', 'night', 'nightly', 'per night', 'sleep', 'sleeps', 'capacity', 'pax', 'guest', 'guests', 'cheapest', 'budget', 'expensive', 'lodging'])) return null;

    const rts: any[] = k.rts || [];
    // Prefer the prices/details the admin edits in the Accommodations tab (siteContent);
    // fall back to the room_types table if the CMS hasn't been filled in.
    const cmsAcc: any[] = Array.isArray(k.c.accommodations)
      ? k.c.accommodations.filter((a: any) => a?.name && Number(a.price) > 0)
      : [];
    let rooms: any[] = cmsAcc.length
      ? cmsAcc.map((a: any) => ({
          name: a.name,
          price: Number(a.price),
          capacity: Number(a.capacity) || Number(rts.find(r => r.slug === a.id)?.capacity) || 0,
          features: Array.isArray(a.features) ? a.features : [],
        }))
      : rts.map(r => ({ name: r.name, price: Number(r.baseRate), capacity: Number(r.capacity), features: [] as string[] }));
    if (!rooms.length) return null;

    let list = rooms;
    if (q.includes('cabin') || q.includes('loft') || q.includes('glass')) list = rooms.filter(r => /cabin/i.test(r.name));
    else if (q.includes('glamp') || q.includes('dome') || q.includes('suite')) list = rooms.filter(r => /glamp/i.test(r.name));
    else if (q.includes('pitch') || q.includes('own tent') || q.includes('campground')) list = rooms.filter(r => /pitch|adventure/i.test(r.name));
    if (!list.length) list = rooms;

    const fmt = (r: any) => {
      const feat = r.features.length ? ` Includes: ${r.features.slice(0, 4).join(', ')}.` : '';
      const cap = r.capacity ? `, good for up to ${r.capacity} guest${r.capacity === 1 ? '' : 's'}` : '';
      return `• ${r.name} — ${bp(r.price)} per night${cap}.${feat}`;
    };

    if (qHas(q, ['cheap', 'cheapest', 'budget', 'lowest', 'affordable', 'least expensive']) && rooms.length > 1) {
      const min = [...rooms].sort((a, b) => a.price - b.price)[0];
      return `Our most affordable option is the ${min.name} at ${bp(min.price)} per night. All options:\n${rooms.map(fmt).join('\n')}\n\nRates are per night — the total depends on how many nights you stay.`;
    }
    const head = list.length === 1 ? 'Here are the details:' : 'Here are our accommodations and current rates:';
    return `${head}\n${list.map(fmt).join('\n')}\n\nRates are per night — the total depends on how many nights you stay.`;
  }

  function answerAddOns(k: any, q: string): string | null {
    if (!qHas(q, ['add-on', 'addon', 'add on', 'add-ons', 'addons', 'extras'])) return null;
    const cat: any[] = k.catalog || [];
    if (!cat.length) return `Any available add-ons will show up during booking, or you can ask our staff.`;
    return `Add-ons you can include with your booking:\n${cat.map(a => `• ${a.name} — ${bp(a.price)}${a.description ? `: ${a.description}` : ''}`).join('\n')}`;
  }

  function answerServices(k: any, q: string): string | null {
    if (!qHas(q, ['activity', 'activities', 'things to do', 'what to do', 'do there', 'service', 'services', 'food', 'eat', 'dining', 'amenities', 'offered', 'offer'])) return null;
    const services: any[] = Array.isArray(k.c.services) ? k.c.services.filter((s: any) => s?.name) : [];
    if (!services.length) return null;
    return `Here's what The Ledge offers:\n${services.map((s: any) => `• ${s.name}${s.price ? ` (${s.price})` : ''} — ${s.description || ''}`.trim()).join('\n')}`;
  }

  function answerPayment(k: any, q: string): string | null {
    if (!qHas(q, ['pay', 'payment', 'payments', 'gcash', 'maya', 'paymaya', 'bank', 'transfer', 'deposit', 'downpayment', 'down payment', 'reserve', 'book', 'booking', 'how to book', 'confirm', 'confirmed', 'proof', 'receipt', 'mode of payment'])) return null;
    const pay = k.pay;
    const accts = (pay.accounts || []).filter((a: any) => a.method || a.accountNumber);
    const acctLines = accts.length
      ? accts.map((a: any) => `   • ${a.method}: ${a.accountName || ''}${a.accountNumber ? ' — ' + a.accountNumber : ''}`).join('\n')
      : '   • Payment account details appear on your reservation ticket.';
    return `Here's how booking and payment work:\n` +
      `1. Choose your dates and room on this site and fill in your details.\n` +
      `2. You'll get a reservation ticket showing the amount to pay (the full amount).\n` +
      `3. Send payment via any of these:\n${acctLines}\n` +
      `4. Email your proof of payment to ${pay.proofEmail} with your reference code.\n` +
      `Your reservation is confirmed once our staff verify the payment (usually within 24 hours).`;
  }

  function answerLocation(k: any, q: string): string | null {
    if (!qHas(q, ['where', 'location', 'located', 'address', 'direction', 'directions', 'get to', 'getting there', 'how to get', 'commute', 'far', 'map', 'near'])) return null;
    const a = k.c.about || {};
    const faqs: any[] = Array.isArray(k.c.faqs) ? k.c.faqs : [];
    const dirFaq = faqs.find((f: any) => /get to|reach|directions?|how do we get|where are you/i.test(f.question || ''));
    const bits: string[] = [];
    if (dirFaq?.answer) {
      bits.push(dirFaq.answer);
    } else if (a.desc1) {
      bits.push(a.desc1);
    }
    if (a.elevation && !bits.join(' ').includes(a.elevation)) bits.push(`Elevation: ${a.elevation}.`);
    if (a.latitude || a.longitude) bits.push(`Coordinates: ${[a.latitude, a.longitude].filter(Boolean).join(', ')}.`);
    if (!bits.length) return null;
    return bits.join(' ');
  }

  function answerAbout(k: any, q: string): string | null {
    if (!qHas(q, ['what is the ledge', 'about the ledge', 'tell me', 'who are you', 'what are you'])) return null;
    const h = k.c.hero || {}; const a = k.c.about || {};
    return h.description || a.desc1 || null;
  }

  function answerFromFaqs(k: any, q: string): string | null {
    const faqs: any[] = Array.isArray(k.c.faqs) ? k.c.faqs : [];
    if (!faqs.length) return null;
    const qt = [...new Set(botTokens(q))];
    if (!qt.length) return null;
    let best: any = null; let bestScore = 0;
    for (const f of faqs) {
      const qWords = new Set(botTokens(f.question || ''));
      const aWords = new Set(botTokens(f.answer || ''));
      let score = 0;
      for (const t of qt) {
        if (qWords.has(t)) score += 2;
        else if (aWords.has(t)) score += 1;
      }
      if (score > bestScore) { bestScore = score; best = f; }
    }
    // 1-2 word questions ("wifi?", "pets?") only need one solid hit; longer ones need more.
    const threshold = qt.length <= 2 ? 2 : 3;
    return best && bestScore >= threshold ? String(best.answer) : null;
  }

  function botReply(k: any, message: string): string {
    const lower = message.toLowerCase();
    const q = ' ' + lower.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';

    if (/^\s*(hi|hello|hey|yo|good (morning|afternoon|evening)|kumusta|kamusta)\b/.test(lower)) {
      return "Hi! I can help with room rates, what's included, activities, how to book and pay, and directions. What would you like to know?";
    }
    if (qHas(q, ['thank', 'thanks', 'salamat'])) return "You're welcome! Anything else about The Ledge?";

    const blocks: string[] = [];
    for (const fn of [answerRooms, answerAddOns, answerServices, answerPayment, answerLocation, answerAbout]) {
      const r = fn(k, q);
      if (r) blocks.push(r);
    }
    if (blocks.length) return blocks.slice(0, 3).join('\n\n');

    const faq = answerFromFaqs(k, q);
    if (faq) return faq;

    return "I'm not sure about that one. I can help with:\n• Room options and current rates\n• What's included and activities offered\n• How to book and pay\n• Where we are and how to get here\n\nTry rewording your question, or contact The Ledge directly for anything else.";
  }

  app.post('/api/faq-chat', async (req, res) => {
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Message is required.' });
    if (message.length > 500) return res.status(400).json({ error: 'Message is too long.' });
    try {
      const knowledge = await loadSiteKnowledge();
      res.json({ reply: botReply(knowledge, message) });
    } catch (error) {
      console.error('FAQ bot failed:', error);
      res.json({ reply: "Sorry, I'm having trouble right now. Please try again shortly, or contact The Ledge directly." });
    }
  });

  // ==========================================
  // IMAGE GALLERY AND CLOUD STORAGE UPLOADS
  // ==========================================

  // Get all custom uploaded images stored in SQL settings index
  app.get('/api/uploaded-images', async (req, res) => {
    try {
      const record = await db.select().from(adminSettings).where(eq(adminSettings.key, 'custom_gallery_images')).limit(1);
      const images = record[0]?.value ? JSON.parse(record[0].value) : [];
      res.json(images);
    } catch (error) {
      console.error('Failed to get uploaded images:', error);
      res.json([]);
    }
  });

  // Upload an image for the gallery / CMS (Admin Only).
  //
  // The image is stored as a data URI in the database rather than on disk or in
  // a third-party bucket. Container filesystems are ephemeral (every redeploy
  // would wipe uploaded photos), and this site only carries a handful of
  // admin-managed images, so a few hundred KB per row in Postgres is the
  // simplest thing that survives a restart with no extra service or credential.
  // If the gallery ever grows large, move this to Supabase Storage.
  const ALLOWED_UPLOAD_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
  const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB decoded

  app.post('/api/upload', requireAdmin, async (req, res) => {
    const { name, mimeType, base64 } = req.body || {};
    if (!name || !base64 || typeof base64 !== 'string') {
      return res.status(400).json({ error: 'Missing name or base64 file data.' });
    }

    try {
      let cleanBase64 = base64;
      let detectedMime = (mimeType || 'image/jpeg').toLowerCase();
      if (base64.includes(';base64,')) {
        const [mimePart, data] = base64.split(';base64,');
        cleanBase64 = data;
        if (mimePart.startsWith('data:')) detectedMime = mimePart.substring(5).toLowerCase();
      }

      if (!ALLOWED_UPLOAD_MIME.has(detectedMime)) {
        return res.status(415).json({ error: 'Unsupported image type. Use JPEG, PNG, WebP, GIF or AVIF.' });
      }

      const buffer = Buffer.from(cleanBase64, 'base64');
      if (buffer.length === 0) {
        return res.status(400).json({ error: 'The uploaded file is empty or not valid base64.' });
      }
      if (buffer.length > MAX_UPLOAD_BYTES) {
        return res.status(413).json({
          error: `Image is ${(buffer.length / 1048576).toFixed(1)} MB. Please upload a web-optimised image under 8 MB.`,
        });
      }

      const dataUri = `data:${detectedMime};base64,${buffer.toString('base64')}`;

      const record = await db.select().from(adminSettings).where(eq(adminSettings.key, 'custom_gallery_images')).limit(1);
      const existingImages = record[0]?.value ? JSON.parse(record[0].value) : [];
      existingImages.push({ url: dataUri, name: String(name).slice(0, 120) });

      await db.insert(adminSettings)
        .values({ key: 'custom_gallery_images', value: JSON.stringify(existingImages) })
        .onConflictDoUpdate({
          target: adminSettings.key,
          set: { value: JSON.stringify(existingImages) },
        });

      res.json({ success: true, url: dataUri, name });
    } catch (error: any) {
      console.error('Image upload controller failed:', error);
      res.status(500).json({ error: error.message || 'An error occurred during file upload.' });
    }
  });

  // Create booking with real availability check, automated room assignment, server-side pricing, and transaction row locks
  app.post('/api/bookings', async (req, res) => {
    const {
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      checkIn,
      checkOut,
      accommodationId,
      guestsCount,
      selectedAddOns = [], // array of { id: number, quantity: number }
      notes
    } = req.body;

    if (!customerName || !customerEmail || !checkIn || !checkOut || !accommodationId) {
      return res.status(400).json({ error: 'Missing required booking parameters.' });
    }

    try {
      const rtObj = await getRoomTypeBySlug(accommodationId);
      if (!rtObj) {
        return res.status(400).json({ error: 'Invalid accommodation selection.' });
      }
      const roomTypeId = rtObj.id;
      // Always exactly 6 chars from an unambiguous alphabet (no 0/O/1/I/L).
      // `bookings.reference` is UNIQUE; retry a few times before giving up so a
      // rare collision never surfaces as a 500 to the guest.
      const makeReference = () => {
        const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += alphabet[crypto.randomInt(alphabet.length)];
        return 'TL-' + code;
      };
      let reference = makeReference();
      for (let attempt = 0; attempt < 5; attempt++) {
        const clash = await db.select({ id: bookings.id }).from(bookings)
          .where(eq(bookings.reference, reference)).limit(1);
        if (clash.length === 0) break;
        reference = makeReference();
      }

      // Begin Transaction for atomic reservation & row-lock protection
      const result = await db.transaction(async (tx) => {
        // 1. Row lock rooms of this type to block concurrent transactions
        await tx.execute(sql`SELECT id FROM "rooms" WHERE "room_type_id" = ${roomTypeId} FOR UPDATE;`);

        // 2. Query available rooms of this type
        const roomsOfType = await tx.select().from(rooms).where(eq(rooms.roomTypeId, roomTypeId));

        // 3. Check overlaps
        const overlapping = await tx.select({
          roomId: bookingRooms.roomId,
        })
        .from(bookingRooms)
        .innerJoin(bookings, eq(bookingRooms.bookingId, bookings.id))
        .where(
          and(
            lt(bookingRooms.checkInDate, checkOut),
            gt(bookingRooms.checkOutDate, checkIn),
            or(
              eq(bookings.status, 'confirmed'),
              eq(bookings.status, 'pending'),
              eq(bookings.status, 'paid_pending_review')
            )
          )
        );

        const bookedIds = overlapping.map(o => o.roomId);
        const available = roomsOfType.filter(r => !bookedIds.includes(r.id));

        if (available.length === 0) {
          throw new Error('CONCURRENCY_CONFLICT');
        }

        const assignedRoom = available[0];

        // 4. Fetch the direct room rate from DB
        const rt = await tx.select().from(roomTypes).where(eq(roomTypes.id, roomTypeId)).limit(1);
        if (rt.length === 0) {
          throw new Error('INVALID_ROOM_TYPE');
        }
        const rate = Number(rt[0].baseRate);

        // 5. Calculate nights
        const diffTime = Math.abs(new Date(checkOut).getTime() - new Date(checkIn).getTime());
        const totalNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
        const roomCost = rate * totalNights;

        // 6. Compute Add-ons server-side
        let addOnsTotal = 0;
        const addOnsList: any[] = [];
        for (const reqAo of selectedAddOns) {
          const aoId = Number(reqAo.id);
          if (isNaN(aoId)) continue;
          const ao = await tx.select().from(addOns).where(eq(addOns.id, aoId)).limit(1);
          if (ao.length > 0) {
            const price = Number(ao[0].price);
            addOnsTotal += price * reqAo.quantity;
            addOnsList.push({
              id: ao[0].id,
              name: ao[0].name,
              quantity: reqAo.quantity,
              actualPrice: price,
            });
          }
        }

        const grandTotal = roomCost + addOnsTotal;

        // 7. Register or resolve guest
        const nameParts = customerName.trim().split(' ');
        const firstName = nameParts[0] || 'Guest';
        const lastName = nameParts.slice(1).join(' ') || 'Surname';

        let guestRecord = await tx.select().from(guests).where(eq(guests.email, customerEmail)).limit(1);
        let guestId: number;

        if (guestRecord.length === 0) {
          const newGuest = await tx.insert(guests).values({
            firstName,
            lastName,
            email: customerEmail,
            phoneNumber: customerPhone || '',
            address: customerAddress || '',
          }).returning();
          guestId = newGuest[0].id;
        } else {
          guestId = guestRecord[0].id;
          // Optionally update guest info
          await tx.update(guests).set({
            phoneNumber: customerPhone || guestRecord[0].phoneNumber,
            address: customerAddress || guestRecord[0].address,
            updatedAt: new Date(),
          }).where(eq(guests.id, guestId));
        }

        // 8. Create booking — held as 'pending' until staff verify the guest's payment proof, then confirm.
        const initialBookingStatus = 'pending';
        const newBooking = await tx.insert(bookings).values({
          reference,
          guestId,
          status: initialBookingStatus,
          specialRequests: notes || '',
        }).returning();

        const bookingId = newBooking[0].id;

        // 9. Create booking-room connection
        await tx.insert(bookingRooms).values({
          bookingId,
          roomId: assignedRoom.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          guestCount: guestsCount || 1,
          actualPricePerNight: String(rate),
          totalNights,
          totalCost: String(roomCost),
        });

        // 10. Save Snapshot prices for Booking Add-ons
        for (const aoItem of addOnsList) {
          await tx.insert(bookingAddOns).values({
            bookingId,
            addOnId: aoItem.id,
            quantity: aoItem.quantity,
            actualPrice: String(aoItem.actualPrice),
          });
        }

        // 11. Create Payments record — full amount, paid manually via bank/e-wallet transfer, verified by staff.
        await tx.insert(payments).values({
          bookingId,
          amount: String(grandTotal),
          currency: 'PHP',
          paymentMethod: 'manual_transfer',
          paymentStatus: 'pending',
        });

        return {
          bookingId,
          reference,
          grandTotal,
          roomName: rt[0].name,
          totalNights,
          addOnsList,
          status: initialBookingStatus,
        };
      });

      // Reservation is committed and holding the slot. Build the ticket + payment instructions,
      // email the guest the payment details, and notify staff. Email failures never block the booking.
      const instructions = await getPaymentInstructions();
      const addOnsForClient = result.addOnsList.map((a: any) => ({
        name: a.name,
        quantity: a.quantity,
        price: a.actualPrice,
      }));

      const ticket = {
        id: String(result.bookingId),
        reference: result.reference,
        status: result.status,
        customerName,
        customerEmail,
        customerPhone: customerPhone || '',
        accommodationName: result.roomName,
        accommodationSlug: accommodationId,
        checkIn,
        checkOut,
        nights: result.totalNights,
        guestsCount: guestsCount || 1,
        addOns: addOnsForClient,
        totalAmount: result.grandTotal,
        amountDue: result.grandTotal,
        notes: notes || undefined,
        paymentInstructions: instructions,
      };

      sendReservationEmails(ticket, instructions).catch(err =>
        console.error('Reservation email dispatch failed (booking still saved):', err)
      );

      return res.json(ticket);

    } catch (error: any) {
      if (error.message === 'CONCURRENCY_CONFLICT') {
        return res.status(409).json({ error: 'No available plots of this type for the selected dates.' });
      }
      if (error.message === 'INVALID_ROOM_TYPE') {
        return res.status(400).json({ error: 'Invalid accommodation selection.' });
      }
      console.error('Failed to create booking:', error);
      res.status(500).json({ error: 'An error occurred while saving your booking.' });
    }
  });

  // Mark a booking's payment as verified/received (Admin only) — used after checking the guest's proof of payment.
  app.post('/api/bookings/:id/mark-paid', requireAdmin, async (req, res) => {
    const bookingId = Number(req.params.id);
    try {
      await db.update(bookings)
        .set({ status: 'confirmed', updatedAt: new Date() })
        .where(eq(bookings.id, bookingId));
      await db.update(payments)
        .set({ paymentStatus: 'completed', updatedAt: new Date() })
        .where(eq(payments.bookingId, bookingId));
      res.json({ success: true });

      // Best-effort "your reservation is confirmed" email to the guest.
      sendConfirmationEmail(bookingId).catch(err =>
        console.error('Confirmation email failed (booking still confirmed):', err)
      );
    } catch (error) {
      console.error('Failed to mark booking as paid:', error);
      res.status(500).json({ error: 'Failed to update payment status.' });
    }
  });

  // Cancel booking (Accessible by Admin OR Customer with valid Reference code)
  app.post('/api/bookings/:id/cancel', async (req, res) => {
    const bookingId = Number(req.params.id);
    const { reference } = req.body;
    
    try {
      let isAuthorized = false;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const validSession = await db.select().from(adminSessions)
          .where(and(eq(adminSessions.token, token), gt(adminSessions.expiresAt, new Date())))
          .limit(1);
        if (validSession.length > 0) {
          isAuthorized = true;
        }
      }
      
      if (!isAuthorized) {
        if (!reference) {
          return res.status(401).json({ error: 'Unauthorized. Reference code is required for customer cancellation.' });
        }
        const b = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
        if (b.length === 0 || b[0].reference !== reference) {
          return res.status(403).json({ error: 'Forbidden. Invalid reference code.' });
        }
        isAuthorized = true;
      }
      
      await db.update(bookings)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(bookings.id, bookingId));
        
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to cancel booking:', error);
      res.status(500).json({ error: 'Failed to cancel booking.' });
    }
  });

  // PERMANENTLY delete a booking and everything hanging off it (Admin Only).
  // Guarded: only already-cancelled/rejected records can be purged, so a live
  // reservation can never be destroyed by a stray call.
  app.delete('/api/bookings/:id', requireAdmin, async (req, res) => {
    const bookingId = Number(req.params.id);
    if (!Number.isInteger(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking id.' });
    }
    try {
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found.' });
      }
      if (booking.status !== 'cancelled' && booking.status !== 'rejected') {
        return res.status(409).json({
          error: 'Cancel this reservation first — only cancelled or removed bookings can be permanently deleted.'
        });
      }

      const guestId = booking.guestId;

      // Children first: every FK to bookings is onDelete: restrict.
      await db.delete(bookingAddOns).where(eq(bookingAddOns.bookingId, bookingId));
      await db.delete(payments).where(eq(payments.bookingId, bookingId));
      await db.delete(bookingRooms).where(eq(bookingRooms.bookingId, bookingId));
      await db.delete(bookings).where(eq(bookings.id, bookingId));

      // Drop the guest record too if this was their only booking.
      const remaining = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.guestId, guestId)).limit(1);
      if (remaining.length === 0) {
        await db.delete(guests).where(eq(guests.id, guestId));
      }

      console.log('Permanently deleted booking', booking.reference, '(id', bookingId + ')');
      res.json({ success: true, reference: booking.reference });
    } catch (error) {
      console.error('Failed to permanently delete booking:', error);
      res.status(500).json({ error: 'Failed to delete booking.' });
    }
  });

  // Operational settings (Admin Only) - currently the unpaid-hold window.
  app.get('/api/admin/ops-settings', requireAdmin, async (req, res) => {
    try {
      res.json({ pendingHoldHours: await getPendingHoldHours() });
    } catch (error) {
      console.error('Failed to read ops settings:', error);
      res.status(500).json({ error: 'Failed to read settings.' });
    }
  });

  app.post('/api/admin/ops-settings', requireAdmin, async (req, res) => {
    const hours = Number(req.body?.pendingHoldHours);
    if (!Number.isFinite(hours) || hours < 1 || hours > 720) {
      return res.status(400).json({ error: 'Hold window must be between 1 and 720 hours.' });
    }
    try {
      await db.insert(adminSettings)
        .values({ key: 'pending_hold_hours', value: String(Math.floor(hours)) })
        .onConflictDoUpdate({ target: adminSettings.key, set: { value: String(Math.floor(hours)) } });
      await releaseExpiredHolds(); // apply the new window immediately
      res.json({ success: true, pendingHoldHours: Math.floor(hours) });
    } catch (error) {
      console.error('Failed to save ops settings:', error);
      res.status(500).json({ error: 'Failed to save settings.' });
    }
  });

  // Admin Verification Login Endpoint (Secure with hashed passwords and sessions)
  app.post('/api/admin/login', async (req, res) => {
    const ip = loginClientIp(req);
    const lockedFor = loginLockRemaining(ip);
    if (lockedFor > 0) {
      res.setHeader('Retry-After', String(lockedFor));
      return res.status(429).json({
        error: `Too many failed attempts. Try again in ${Math.ceil(lockedFor / 60)} minute(s).`,
      });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
      const userRecord = await db.select().from(adminSettings).where(eq(adminSettings.key, 'admin_username')).limit(1);
      const hashRecord = await db.select().from(adminSettings).where(eq(adminSettings.key, 'admin_password_hash')).limit(1);

      const dbUser = userRecord[0]?.value;
      const dbHash = hashRecord[0]?.value;

      if (!dbUser || !dbHash) {
        return res.status(401).json({ error: 'Admin credentials not configured.' });
      }

      if (username === dbUser && await bcrypt.compare(password, dbHash)) {
        clearLoginFailures(ip);
        const token = crypto.randomBytes(32).toString('hex');
        // 8 hours covers a full working day without a mid-task logout. Expired
        // rows are swept by runMaintenance(); a password change kills all sessions.
        await db.insert(adminSessions).values({ token, expiresAt: new Date(Date.now() + ADMIN_SESSION_MS) });
        return res.json({ success: true, token });
      } else {
        recordLoginFailure(ip);
        return res.status(401).json({ error: 'Invalid username or password.' });
      }
    } catch (error) {
      console.error('Admin login failed:', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  });

  // Change Admin Password Settings (Secure with requireAdmin & bcrypt)
  app.post('/api/admin/change-password', requireAdmin, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required.' });
    }

    try {
      const hash = await bcrypt.hash(newPassword, 12);
      await db.insert(adminSettings)
        .values({ key: 'admin_password_hash', value: hash })
        .onConflictDoUpdate({
          target: adminSettings.key,
          set: { value: hash },
        });

      // Clear all sessions to force re-authentication
      await db.delete(adminSessions);

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to change admin password:', error);
      res.status(500).json({ error: 'Failed to update password.' });
    }
  });

  // ==========================================
  // VITE DEVELOPMENT MIDDLEWARE OR STATIC PROD
  // ==========================================
  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In the compiled bundle __dirname is the dist/ folder; the built client
    // assets sit right beside server.cjs.
    const distPath = typeof __dirname !== 'undefined' && path.basename(__dirname) === 'dist'
      ? __dirname
      : path.join(process.cwd(), 'dist');
    const indexHtml = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexHtml)) {
      console.error(`\n  ✗ Production build not found at ${indexHtml}\n    Run "npm run build" before "npm start".\n`);
      process.exit(1);
    }
    app.use(express.static(distPath, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => res.sendFile(indexHtml));
  }

  app.listen(PORT, "0.0.0.0", () => {
    // Bind on 0.0.0.0 (all interfaces) but print localhost — 0.0.0.0 is not a browsable address.
    console.log(`
  ✓ The Ledge site ready  (${IS_PRODUCTION ? 'production' : 'development'})  ->  http://localhost:${PORT}
`);
  });
}

startServer();
