import Dexie from 'dexie';

export const db = new Dexie('RouletteTracker');

db.version(1).stores({
  dealers: '++id, name, createdAt, updatedAt',
  spins: '++id, dealerId, resultNumber, ballSize, spinSpeed, wheelSpeed, ballDirection, recordedAt',
  syncMeta: 'key',
});
