/** Prediction engine — Laplace + Gaussian kernel smoothing on physical wheel. */

import { WHEEL_ORDER, NUMBER_TO_POSITION, SECTORS, TOTAL_POCKETS } from './wheel.js';
import { chiSquaredTest, confidenceLevel } from './statistics.js';

function laplaceSmooth(counts, alpha = 0.5) {
  const smoothed = new Float64Array(counts.length);
  let sum = 0;
  for (let i = 0; i < counts.length; i++) {
    smoothed[i] = counts[i] + alpha;
    sum += smoothed[i];
  }
  for (let i = 0; i < smoothed.length; i++) smoothed[i] /= sum;
  return smoothed;
}

function gaussianKernelSmooth(probs, sigma = 2.0) {
  const n = probs.length;
  const smoothed = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dist = Math.min(Math.abs(i - j), n - Math.abs(i - j));
      const weight = Math.exp(-(dist * dist) / (2 * sigma * sigma));
      smoothed[i] += probs[j] * weight;
    }
  }

  const sum = smoothed.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) smoothed[i] /= sum;
  return smoothed;
}

export function predict(spins, topN = 5, kernelSigma = 2.0, alpha = 0.5) {
  const sampleSize = spins.length;

  if (sampleSize === 0) {
    return { rankedNumbers: [], sectorRankings: [], confidence: 'low', sampleSize: 0, pValue: 1 };
  }

  // Count hits per wheel position
  const counts = new Float64Array(TOTAL_POCKETS);
  for (const spin of spins) {
    const pos = NUMBER_TO_POSITION.get(spin.resultNumber);
    if (pos !== undefined) counts[pos]++;
  }

  // Laplace smoothing → Gaussian kernel smoothing
  let probs = laplaceSmooth(counts, alpha);
  probs = gaussianKernelSmooth(probs, kernelSigma);

  // Chi-squared and confidence
  const chi2 = chiSquaredTest(spins);
  const confidence = confidenceLevel(sampleSize, chi2.pValue);

  // Rank numbers
  const fairProb = 1 / TOTAL_POCKETS;
  const ranked = [];
  for (let pos = 0; pos < TOTAL_POCKETS; pos++) {
    const num = WHEEL_ORDER[pos];
    const prob = probs[pos];
    const advantage = ((prob - fairProb) / fairProb * 100);
    ranked.push([num, prob, Math.round(advantage * 10) / 10]);
  }
  ranked.sort((a, b) => b[1] - a[1]);

  // Rank sectors
  const sectorRankings = [];
  for (const [name, numbers] of Object.entries(SECTORS)) {
    const sectorProb = numbers.reduce((sum, n) => sum + probs[NUMBER_TO_POSITION.get(n)], 0);
    sectorRankings.push([name, Math.round(sectorProb * 10000) / 10000]);
  }
  sectorRankings.sort((a, b) => b[1] - a[1]);

  return {
    rankedNumbers: ranked.slice(0, topN),
    sectorRankings,
    confidence,
    sampleSize,
    pValue: chi2.pValue,
  };
}
