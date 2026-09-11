import { db } from './index.ts';
import { roomTypes, rooms } from './schema.ts';

async function seedCatalog() {
  const existing = await db.select().from(roomTypes);
  if (existing.length > 0) {
    console.log('room_types already has data — skipping. Delete existing rows first if you want to reseed.');
    process.exit(0);
  }

  const catalog = [
    { slug: 'unit-premium',  name: 'Premium Unit',  baseRate: '0', capacity: 2, count: 1, prefix: 'PU' },
    { slug: 'unit-standard', name: 'Standard Unit', baseRate: '0', capacity: 4, count: 1, prefix: 'SU' },
    { slug: 'unit-basic',    name: 'Basic Unit',    baseRate: '0', capacity: 2, count: 1, prefix: 'BU' },
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
