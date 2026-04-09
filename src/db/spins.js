import { db } from './schema.js';

export async function addSpin(dealerId, resultNumber, opts = {}) {
  return db.spins.add({
    dealerId,
    resultNumber,
    ballSize: opts.ballSize || null,
    spinSpeed: opts.spinSpeed || null,
    wheelSpeed: opts.wheelSpeed || null,
    ballDirection: opts.ballDirection || null,
    sessionTag: opts.sessionTag || '',
    notes: opts.notes || '',
    recordedAt: new Date().toISOString(),
  });
}

export async function getSpins(dealerId, filters = {}) {
  let collection = db.spins.where('dealerId').equals(dealerId);
  let results = await collection.toArray();

  // Apply filters
  for (const [key, val] of Object.entries(filters)) {
    if (val && val !== 'All') {
      results = results.filter(s => s[key] === val);
    }
  }

  return results;
}

export async function getSpinCount(dealerId, filters = {}) {
  const spins = await getSpins(dealerId, filters);
  return spins.length;
}

export async function getRecentSpins(dealerId, limit = 20) {
  const all = await db.spins.where('dealerId').equals(dealerId).reverse().sortBy('recordedAt');
  return all.slice(0, limit);
}

export async function deleteSpin(id) {
  return db.spins.delete(id);
}

export async function deleteAllSpins(dealerId) {
  return db.spins.where('dealerId').equals(dealerId).delete();
}

export async function bulkInsertSpins(spinsArray) {
  return db.spins.bulkAdd(spinsArray);
}
