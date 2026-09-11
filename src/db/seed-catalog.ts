import { db } from './index.ts';
import { roomTypes, rooms } from './schema.ts';

async function seedCatalog() {
  const existing = await db.select().from(roomTypes);
  if (existing.length > 0) {
    console.log('room_types already has data — skipping. Delete existing rows first if you want to reseed.');
    process.exit(0);
  }

  const catalog = [
    { slug: 'unit-premium',  name: 'The Ledge Suite', baseRate: '8500', capacity: 2, count: 6,  prefix: 'LS' },
    { slug: 'unit-standard', name: 'Deluxe King',     baseRate: '5200', capacity: 3, count: 12, prefix: 'DK' },
    { slug: 'unit-basic',    name: 'Studio Queen',    baseRate: '3400', capacity: 2, count: 18, prefix: 'SQ' },
  ];

  for (const item of catalog) {
    const [inserted] = await db.insert(roomTypes).values({
      slug: item.slug,
      name: item.name,
      baseRate: item.baseRate,
      capacity: item.capacity,
    }).returning();

    for (let i = 1; i <= item.count; i++) {
      await db.insert(rooms).values({
        roomNumber: `${item.prefix}-${String(i).padStart(2, '0')}`,
        roomTypeId: inserted.id,
        status: 'available',
      });
    }
    console.log(`Seeded ${item.count} rooms for ${item.name}`);
  }
  process.exit(0);
}
seedCatalog();
