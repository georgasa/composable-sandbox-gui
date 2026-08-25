import { describe, it, expect } from 'vitest';
import { computePoints } from '../services/scoring';

describe('computePoints', () => {
  it('always gives 0 points when the AI says the answer is incorrect', () => {
    expect(computePoints(false, 0.99)).toBe(0);
  });

  it('applies confidence tiers when correct', () => {
    expect(computePoints(true, 0.95)).toBe(100);
    expect(computePoints(true, 0.8)).toBe(75);
    expect(computePoints(true, 0.65)).toBe(50);
    expect(computePoints(true, 0.4)).toBe(0);
  });
});
