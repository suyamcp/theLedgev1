import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from './schema.ts';

const { Pool } = pg;

// Connect with SQL_ADMIN_USER to ensure we have DDL permissions
const pool = new Pool({
  host: process.env.SQL_HOST,
  user: process.env.SQL_ADMIN_USER || process.env.SQL_USER,
  password: process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD,
  database: process.env.SQL_DB_NAME,
  connectionTimeoutMillis: 15000,
});

const db = drizzle(pool, { schema });

async function run() {
  console.log('--- Starting Database Migration Script ---');

  try {
    // 1. Create new tables
    console.log('Creating "admin_sessions" table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "admin_sessions" (
        "token" varchar(64) PRIMARY KEY NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "expires_at" timestamp NOT NULL
      );
    `);

    console.log('Creating "site_content" table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "site_content" (
        "key" varchar(50) PRIMARY KEY NOT NULL,
        "value" text NOT NULL,
        "updated_at" timestamp DEFAULT now()
      );
    `);

    console.log('Creating "add_ons" table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "add_ons" (
        "id" serial PRIMARY KEY NOT NULL,
        "name" varchar(100) NOT NULL UNIQUE,
        "description" text,
        "price" numeric(10, 2) NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );
    `);

    console.log('Creating "booking_add_ons" table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "booking_add_ons" (
        "id" serial PRIMARY KEY NOT NULL,
        "booking_id" integer NOT NULL,
        "add_on_id" integer NOT NULL,
        "quantity" integer DEFAULT 1 NOT NULL,
        "actual_price" numeric(10, 2) NOT NULL
      );
    `);

    // 2. Modify "bookings" table to add "reference"
    console.log('Checking "reference" column in "bookings"...');
    const colsBookings = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'reference';
    `);

    if (colsBookings.rowCount === 0) {
      console.log('Adding "reference" column to "bookings"...');
      await db.execute(sql`ALTER TABLE "bookings" ADD COLUMN "reference" varchar(12);`);

      // Populate existing bookings with unique reference code
      const bookingsList = await db.execute(sql`SELECT id FROM "bookings";`);
      console.log('Populating references for ' + bookingsList.rowCount + ' existing bookings...');
      for (const row of bookingsList.rows as any[]) {
        const ref = 'TL-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        await db.execute(sql`UPDATE "bookings" SET "reference" = ${ref} WHERE id = ${row.id};`);
      }

      console.log('Setting "reference" as NOT NULL and UNIQUE...');
      await db.execute(sql`ALTER TABLE "bookings" ALTER COLUMN "reference" SET NOT NULL;`);
      await db.execute(sql`ALTER TABLE "bookings" ADD CONSTRAINT "bookings_reference_unique" UNIQUE ("reference");`);
    }

    // 3. Drop "total_amount" from "bookings"
    console.log('Dropping "total_amount" from "bookings" if exists...');
    await db.execute(sql`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "total_amount";`);

    // 4. Modify "booking_rooms" to add "guest_count"
    console.log('Checking "guest_count" in "booking_rooms"...');
    const colsBookingRooms = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'booking_rooms' AND column_name = 'guest_count';
    `);
    if (colsBookingRooms.rowCount === 0) {
      console.log('Adding "guest_count" to "booking_rooms"...');
      await db.execute(sql`ALTER TABLE "booking_rooms" ADD COLUMN "guest_count" integer DEFAULT 2 NOT NULL;`);
    }

    // 5. Update "payments" table default currency
    console.log('Setting "payments" default currency to PHP...');
    await db.execute(sql`ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'PHP';`);
    await db.execute(sql`UPDATE "payments" SET "currency" = 'PHP' WHERE "currency" = 'USD' OR "currency" IS NULL;`);

    // 6. Restructure foreign keys for delete restrict
    console.log('Configuring delete restrict for booking_rooms constraint...');
    // Drizzle defaults constraint names, let's clean them up
    await db.execute(sql`ALTER TABLE "booking_rooms" DROP CONSTRAINT IF EXISTS "booking_rooms_booking_id_bookings_id_fk";`);
    await db.execute(sql`ALTER TABLE "booking_rooms" DROP CONSTRAINT IF EXISTS "booking_rooms_booking_id_fkey";`);
    await db.execute(sql`
      ALTER TABLE "booking_rooms" 
      ADD CONSTRAINT "booking_rooms_booking_id_bookings_id_fk" 
      FOREIGN KEY ("booking_id") REFERENCES "bookings" ("id") ON DELETE restrict;
    `);

    console.log('Configuring delete restrict for payments constraint...');
    await db.execute(sql`ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_booking_id_bookings_id_fk";`);
    await db.execute(sql`ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_booking_id_fkey";`);
    await db.execute(sql`
      ALTER TABLE "payments" 
      ADD CONSTRAINT "payments_booking_id_bookings_id_fk" 
      FOREIGN KEY ("booking_id") REFERENCES "bookings" ("id") ON DELETE restrict;
    `);

    console.log('Configuring delete restrict for booking_add_ons constraints...');
    await db.execute(sql`ALTER TABLE "booking_add_ons" DROP CONSTRAINT IF EXISTS "booking_add_ons_booking_id_bookings_id_fk";`);
    await db.execute(sql`
      ALTER TABLE "booking_add_ons" 
      ADD CONSTRAINT "booking_add_ons_booking_id_bookings_id_fk" 
      FOREIGN KEY ("booking_id") REFERENCES "bookings" ("id") ON DELETE restrict;
    `);
    await db.execute(sql`ALTER TABLE "booking_add_ons" DROP CONSTRAINT IF EXISTS "booking_add_ons_add_on_id_add_ons_id_fk";`);
    await db.execute(sql`
      ALTER TABLE "booking_add_ons" 
      ADD CONSTRAINT "booking_add_ons_add_on_id_add_ons_id_fk" 
      FOREIGN KEY ("add_on_id") REFERENCES "add_ons" ("id") ON DELETE restrict;
    `);

    // 7. Add overlap exclusion constraint (Phase 4)
    console.log('Installing btree_gist extension and adding exclusion constraint...');
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS btree_gist;`);
    await db.execute(sql`ALTER TABLE "booking_rooms" DROP CONSTRAINT IF EXISTS "no_overlapping_bookings";`);
    await db.execute(sql`
      ALTER TABLE "booking_rooms" 
      ADD CONSTRAINT "no_overlapping_bookings" 
      EXCLUDE USING gist (room_id WITH =, daterange(check_in_date, check_out_date) WITH &&);
    `);

    // 8. Add status enum/check constraints (Phase 4)
    console.log('Adding check constraints for bookings & payments status...');
    await db.execute(sql`ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_status_check";`);
    await db.execute(sql`
      ALTER TABLE "bookings" 
      ADD CONSTRAINT "bookings_status_check" 
      CHECK (status IN ('pending', 'paid_pending_review', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'rejected', 'no_show'));
    `);

    await db.execute(sql`ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_status_check";`);
    await db.execute(sql`
      ALTER TABLE "payments" 
      ADD CONSTRAINT "payments_status_check" 
      CHECK (payment_status IN ('pending', 'completed', 'refunded', 'failed'));
    `);

    // 9. Seed some basic Add-ons if they do not exist
    console.log('Seeding default Add-ons if needed...');
    await db.execute(sql`
      INSERT INTO "add_ons" ("name", "description", "price")
      VALUES 
        ('[Add-on 1]', '[Describe this optional extra.]', 0.00),
        ('[Add-on 2]', '[Describe this optional extra.]', 0.00)
      ON CONFLICT ("name") DO NOTHING;
    `);

    console.log('✓ Migration script completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration script failed:', error);
    process.exit(1);
  }
}

run();
