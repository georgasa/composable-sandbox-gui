import { AiEvaluator, EvaluatorConfigError } from './ai_evaluator';
import { MockEvaluator } from './mock_evaluator';
import { OpenAiEvaluator } from './openai_evaluator';
import { env, AiMode } from '../config/env';

let cachedMock: AiEvaluator | undefined;
let cachedReal: AiEvaluator | undefined;

/**
 * Resolves which evaluator serves a request. `modeOverride` lets a client
 * (e.g. the mobile app's dev "AI MODE" switch) ask for mock or real per
 * request; when omitted the server's AI_MODE env var decides.
 */
export function getEvaluator(modeOverride?: AiMode): AiEvaluator {
  const mode = modeOverride ?? env.aiMode;

  if (mode === 'real') {
    if (!env.openaiApiKey) {
      throw new EvaluatorConfigError('Το Real AI mode δεν είναι διαθέσιμο: λείπει το OPENAI_API_KEY στο backend.');
    }
    if (!cachedReal) cachedReal = new OpenAiEvaluator();
    return cachedReal;
  }

  if (!cachedMock) cachedMock = new MockEvaluator();
  return cachedMock;
}
