/**
 * Single place that turns an AI verdict into points, so both evaluators
 * (mock and real) and any future one share identical scoring rules.
 */
export function computePoints(correct: boolean, confidence: number): number {
  if (!correct) return 0;
  if (confidence >= 0.9) return 100;
  if (confidence >= 0.75) return 75;
  if (confidence >= 0.6) return 50;
  return 0;
}
