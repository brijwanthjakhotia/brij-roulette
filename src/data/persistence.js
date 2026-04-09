/** Full database backup and restore as JSON. */

import { db } from '../db/schema.js';
import { clearAllData } from '../db/dealers.js';

export async function exportAll() {
  const dealers = await db.dealers.toArray();
  const spins = await db.spins.toArray();

  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    version: 1,
    dealers,
    spins,
  }, null, 2);
}

export async function importAll(jsonString) {
  const data = JSON.parse(jsonString);

  await clearAllData();

  if (data.dealers?.length) {
    await db.dealers.bulkAdd(data.dealers);
  }
  if (data.spins?.length) {
    await db.spins.bulkAdd(data.spins);
  }
}
