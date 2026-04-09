/** European roulette wheel layout, sector definitions, and position utilities. */

export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30,
  8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
  28, 12, 35, 3, 26
];

export const TOTAL_POCKETS = WHEEL_ORDER.length; // 37

export const NUMBER_TO_POSITION = new Map(WHEEL_ORDER.map((n, i) => [n, i]));
export const POSITION_TO_NUMBER = new Map(WHEEL_ORDER.map((n, i) => [i, n]));
export const NUMBER_TO_ANGLE = new Map(WHEEL_ORDER.map((n, i) => [n, (i / TOTAL_POCKETS) * 360]));

export const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
export const BLACK_NUMBERS = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);

export function numberColor(n) {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

export const SECTORS = {
  A: WHEEL_ORDER.slice(0, 6),
  B: WHEEL_ORDER.slice(6, 12),
  C: WHEEL_ORDER.slice(12, 18),
  D: WHEEL_ORDER.slice(18, 24),
  E: WHEEL_ORDER.slice(24, 30),
  F: WHEEL_ORDER.slice(30, 37),
};

export const NUMBER_TO_SECTOR = new Map();
for (const [name, nums] of Object.entries(SECTORS)) {
  for (const n of nums) NUMBER_TO_SECTOR.set(n, name);
}

export function getSector(number) {
  return NUMBER_TO_SECTOR.get(number);
}

export function getNeighbors(number, count = 2) {
  const pos = NUMBER_TO_POSITION.get(number);
  const neighbors = [];
  for (let offset = -count; offset <= count; offset++) {
    if (offset === 0) continue;
    const neighborPos = ((pos + offset) % TOTAL_POCKETS + TOTAL_POCKETS) % TOTAL_POCKETS;
    neighbors.push(POSITION_TO_NUMBER.get(neighborPos));
  }
  return neighbors;
}

export function wheelDistance(a, b) {
  const posA = NUMBER_TO_POSITION.get(a);
  const posB = NUMBER_TO_POSITION.get(b);
  const diff = Math.abs(posA - posB);
  return Math.min(diff, TOTAL_POCKETS - diff);
}

export const BALL_SIZES = ['small', 'medium', 'large'];
export const SPIN_SPEEDS = ['slow', 'medium', 'fast'];
export const WHEEL_SPEEDS = ['slow', 'medium', 'fast'];
export const BALL_DIRECTIONS = ['cw', 'ccw'];
