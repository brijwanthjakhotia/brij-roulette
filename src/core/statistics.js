/** Statistical analysis for dealer signature detection.
 *  Chi-squared implemented from scratch (replaces scipy). */

import { WHEEL_ORDER, NUMBER_TO_POSITION, SECTORS, TOTAL_POCKETS } from './wheel.js';

// === Chi-squared math (replacing scipy.stats.chisquare) ===

function lnGamma(z) {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function regularizedGammaP(a, x, maxIter = 200, epsilon = 1e-12) {
  if (x === 0) return 0;
  if (x < 0) return 0;

  // Use series expansion for small x, continued fraction for large x
  if (x < a + 1) {
    // Series expansion
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n < maxIter; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < epsilon * Math.abs(sum)) break;
    }
    return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * sum;
  } else {
    // Continued fraction (Lentz's method) for upper gamma, then P = 1 - Q
    let f = x - a + 1;
    let c = 1e30;
    let d = 1 / f;
    let h = d;
    for (let n = 1; n < maxIter; n++) {
      const an = n * (a - n);
      const bn = x - a + 1 + 2 * n;
      d = bn + an * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = bn + an / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < epsilon) break;
    }
    const q = Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
    return 1 - q;
  }
}

function chiSquaredPValue(chi2, df) {
  if (chi2 <= 0) return 1;
  return 1 - regularizedGammaP(df / 2, chi2 / 2);
}

// === Statistics functions ===

function countResults(spins) {
  const counts = new Map();
  for (const spin of spins) {
    const n = spin.resultNumber;
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  return counts;
}

export function frequencyDistribution(spins) {
  const total = spins.length;
  if (total === 0) return [];

  const expected = total / TOTAL_POCKETS;
  const counts = countResults(spins);

  return WHEEL_ORDER.map(num => {
    const count = counts.get(num) || 0;
    const dev = expected > 0 ? ((count - expected) / expected * 100) : 0;
    return {
      number: num,
      count,
      expected: Math.round(expected * 100) / 100,
      deviationPct: Math.round(dev * 10) / 10,
      wheelPosition: NUMBER_TO_POSITION.get(num),
      probability: total > 0 ? count / total : 0,
    };
  });
}

export function chiSquaredTest(spins) {
  const total = spins.length;
  if (total === 0) {
    return { chi2: 0, pValue: 1, df: 36, isSignificant: false, sampleSize: 0, minExpected: 0 };
  }

  const expected = total / TOTAL_POCKETS;
  const counts = countResults(spins);

  let chi2 = 0;
  for (let num = 0; num < TOTAL_POCKETS; num++) {
    const observed = counts.get(num) || 0;
    chi2 += (observed - expected) ** 2 / expected;
  }

  const df = TOTAL_POCKETS - 1;
  const pValue = chiSquaredPValue(chi2, df);

  return {
    chi2: Math.round(chi2 * 1000) / 1000,
    pValue: Math.round(pValue * 1000000) / 1000000,
    df,
    isSignificant: pValue < 0.05,
    sampleSize: total,
    minExpected: Math.round(expected * 100) / 100,
  };
}

export function sectorFrequencies(spins) {
  const total = spins.length;
  if (total === 0) return [];

  const counts = countResults(spins);

  return Object.entries(SECTORS).map(([name, numbers]) => {
    const sectorCount = numbers.reduce((sum, n) => sum + (counts.get(n) || 0), 0);
    const expected = total * numbers.length / TOTAL_POCKETS;
    const dev = expected > 0 ? ((sectorCount - expected) / expected * 100) : 0;
    return {
      sector: name,
      numbers,
      count: sectorCount,
      expected: Math.round(expected * 100) / 100,
      deviationPct: Math.round(dev * 10) / 10,
      probability: total > 0 ? sectorCount / total : 0,
    };
  });
}

export function sectorChiSquared(spins) {
  const total = spins.length;
  if (total === 0) {
    return { chi2: 0, pValue: 1, df: 5, isSignificant: false, sampleSize: 0 };
  }

  const counts = countResults(spins);
  let chi2 = 0;

  for (const [, numbers] of Object.entries(SECTORS)) {
    const observed = numbers.reduce((sum, n) => sum + (counts.get(n) || 0), 0);
    const expected = total * numbers.length / TOTAL_POCKETS;
    chi2 += (observed - expected) ** 2 / expected;
  }

  const df = Object.keys(SECTORS).length - 1;
  const pValue = chiSquaredPValue(chi2, df);

  return {
    chi2: Math.round(chi2 * 1000) / 1000,
    pValue: Math.round(pValue * 1000000) / 1000000,
    df,
    isSignificant: pValue < 0.05,
    sampleSize: total,
  };
}

export function conditionalAnalysis(spins, conditionField) {
  const result = {};
  const valid = spins.filter(s => s[conditionField] != null && s[conditionField] !== '');

  const groups = new Map();
  for (const spin of valid) {
    const val = spin[conditionField];
    if (!groups.has(val)) groups.set(val, []);
    groups.get(val).push(spin);
  }

  for (const [val, subset] of [...groups.entries()].sort()) {
    result[val] = frequencyDistribution(subset);
  }

  return result;
}

export function confidenceLevel(sampleSize, pValue) {
  if (sampleSize < 50) return 'low';
  if (sampleSize < 150 || pValue > 0.05) return 'medium';
  return 'high';
}
