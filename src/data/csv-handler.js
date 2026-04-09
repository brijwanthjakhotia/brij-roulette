/** CSV import/export for spin data. */

import { db } from '../db/schema.js';
import { getOrCreateDealer } from '../db/dealers.js';
import { bulkInsertSpins } from '../db/spins.js';

const BALL_SIZES = new Set(['small', 'medium', 'large']);
const SPIN_SPEEDS = new Set(['slow', 'medium', 'fast']);
const WHEEL_SPEEDS = new Set(['slow', 'medium', 'fast']);
const BALL_DIRS = new Set(['cw', 'ccw']);

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((h, j) => { row[h] = values[j] || ''; });
    rows.push(row);
  }

  return { headers, rows };
}

export function validateCSV(text) {
  const { headers, rows } = parseCSV(text);
  const errors = [];

  if (!headers.includes('dealer_name')) errors.push("Missing required column: 'dealer_name'");
  if (!headers.includes('result_number')) errors.push("Missing required column: 'result_number'");
  if (errors.length > 0) return { valid: false, errors, preview: rows.slice(0, 10) };

  let invalidNums = 0;
  for (let i = 0; i < rows.length; i++) {
    const num = parseInt(rows[i].result_number);
    if (isNaN(num) || num < 0 || num > 36) invalidNums++;
  }
  if (invalidNums > 0) errors.push(`${invalidNums} rows have result_number outside 0-36`);

  for (const [col, valid] of [['ball_size', BALL_SIZES], ['spin_speed', SPIN_SPEEDS], ['wheel_speed', WHEEL_SPEEDS], ['ball_direction', BALL_DIRS]]) {
    if (headers.includes(col)) {
      const bad = new Set();
      for (const row of rows) {
        const val = row[col];
        if (val && val !== '' && !valid.has(val)) bad.add(val);
      }
      if (bad.size > 0) errors.push(`Invalid values in '${col}': ${[...bad].slice(0, 5).join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors, preview: rows.slice(0, 10) };
}

export async function importCSV(text) {
  const { headers, rows } = parseCSV(text);
  let imported = 0, skipped = 0;
  const errors = [];
  const spinsToInsert = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const dealerName = row.dealer_name?.trim();
    if (!dealerName) { skipped++; errors.push(`Row ${i + 1}: empty dealer name`); continue; }

    const num = parseInt(row.result_number);
    if (isNaN(num) || num < 0 || num > 36) { skipped++; errors.push(`Row ${i + 1}: invalid number`); continue; }

    const dealerId = await getOrCreateDealer(dealerName);
    spinsToInsert.push({
      dealerId,
      resultNumber: num,
      ballSize: BALL_SIZES.has(row.ball_size) ? row.ball_size : null,
      spinSpeed: SPIN_SPEEDS.has(row.spin_speed) ? row.spin_speed : null,
      wheelSpeed: WHEEL_SPEEDS.has(row.wheel_speed) ? row.wheel_speed : null,
      ballDirection: BALL_DIRS.has(row.ball_direction) ? row.ball_direction : null,
      sessionTag: row.session_tag || '',
      notes: row.notes || '',
      recordedAt: row.recorded_at || new Date().toISOString(),
    });
  }

  if (spinsToInsert.length > 0) {
    await bulkInsertSpins(spinsToInsert);
    imported = spinsToInsert.length;
  }

  return { imported, skipped, errors };
}

export async function exportCSV(dealerId = null) {
  let spins;
  if (dealerId) {
    spins = await db.spins.where('dealerId').equals(dealerId).toArray();
  } else {
    spins = await db.spins.toArray();
  }

  const dealers = await db.dealers.toArray();
  const dealerMap = new Map(dealers.map(d => [d.id, d.name]));

  const headers = 'dealer_name,result_number,ball_size,spin_speed,wheel_speed,ball_direction,session_tag,notes,recorded_at';
  const rows = spins.map(s =>
    [dealerMap.get(s.dealerId) || '', s.resultNumber, s.ballSize || '', s.spinSpeed || '',
     s.wheelSpeed || '', s.ballDirection || '', s.sessionTag || '', s.notes || '', s.recordedAt || ''].join(',')
  );

  return [headers, ...rows].join('\n');
}
