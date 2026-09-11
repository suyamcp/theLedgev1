import bcrypt from 'bcryptjs';
import { db } from './index.ts';
import { adminSettings } from './schema.ts';

async function seedAdmin() {
  const username = process.argv[2];
  const password = process.argv[3];
  if (!username || !password) {
    console.error('Usage: tsx src/db/seed-admin.ts <username> <password>');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  await db.insert(adminSettings).values({ key: 'admin_username', value: username })
    .onConflictDoUpdate({ target: adminSettings.key, set: { value: username } });
  await db.insert(adminSettings).values({ key: 'admin_password_hash', value: hash })
    .onConflictDoUpdate({ target: adminSettings.key, set: { value: hash } });
  console.log('Admin credentials set.');
  process.exit(0);
}
seedAdmin();
