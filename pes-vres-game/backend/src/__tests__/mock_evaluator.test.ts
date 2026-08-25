import { describe, it, expect } from 'vitest';
import { MockEvaluator } from '../services/mock_evaluator';

describe('MockEvaluator', () => {
  const evaluator = new MockEvaluator();

  it('rejects an empty answer without touching any AI', async () => {
    const result = await evaluator.evaluate('Πες ένα ζώο που πετάει', '   ');
    expect(result.correct).toBe(false);
    expect(result.points).toBe(0);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('rejects an answer that just echoes the question', async () => {
    const result = await evaluator.evaluate('Πες ένα φρούτο', 'πες ένα φρούτο');
    expect(result.correct).toBe(false);
    expect(result.points).toBe(0);
  });

  it('accepts a plausible Greek answer with natural phrasing (article + filler word)', async () => {
    const result = await evaluator.evaluate('Πες ένα ελληνικό νησί', 'η Κρήτη νομίζω');
    expect(result.correct).toBe(true);
    expect(result.points).toBe(100);
    expect(result.answer).toBe('η Κρήτη νομίζω');
  });

  it('returns a structured result matching the required shape', async () => {
    const result = await evaluator.evaluate('Πες ένα χρώμα', 'κόκκινο');
    expect(result).toMatchObject({
      answer: 'κόκκινο',
      correct: expect.any(Boolean),
      confidence: expect.any(Number),
      points: expect.any(Number),
      reason: expect.any(String),
    });
  });
});
