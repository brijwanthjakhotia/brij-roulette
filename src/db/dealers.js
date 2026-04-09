import { db } from './schema.js';

export async function addDealer(name, notes = '') {
  const now = new Date().toISOString();
  return db.dealers.add({
    name: name.trim(),
    notes: notes.trim(),
    createdAt: now,
    updatedAt: now,
  });
}

export async function getDealers() {
  const dealers = await db.dealers.orderBy('name').toArray();
  // Attach spin counts
  for (const dealer of dealers) {
    dealer.spinCount = await db.spins.where('dealerId').equals(dealer.id).count();
  }
  return dealers;
}

export async function getDealer(id) {
  return db.dealers.get(id);
}

export async function updateDealer(id, name, notes = '') {
  return db.dealers.update(id, {
    name: name.trim(),
    notes: notes.trim(),
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteDealer(id) {
  await db.spins.where('dealerId').equals(id).delete();
  await db.dealers.delete(id);
}

export async function getOrCreateDealer(name) {
  const trimmed = name.trim();
  const existing = await db.dealers.where('name').equals(trimmed).first();
  if (existing) return existing.id;
  return addDealer(trimmed);
}

export async function getTotalStats() {
  const dealerCount = await db.dealers.count();
  const spinCount = await db.spins.count();
  return { dealerCount, spinCount };
}

export async function clearAllData() {
  await db.spins.clear();
  await db.dealers.clear();
  await db.syncMeta.clear();
}
