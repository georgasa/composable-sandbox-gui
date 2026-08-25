import 'dotenv/config';

export type AiMode = 'mock' | 'real';

export interface EnvConfig {
  port: number;
  aiMode: AiMode;
  openaiApiKey: string | undefined;
  openaiModel: string;
  openaiTimeoutMs: number;
}

function parseAiMode(value: string | undefined): AiMode {
  return value === 'real' ? 'real' : 'mock';
}

export const env: EnvConfig = {
  port: Number(process.env.PORT ?? 3000),
  aiMode: parseAiMode(process.env.AI_MODE),
  openaiApiKey: process.env.OPENAI_API_KEY || undefined,
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  openaiTimeoutMs: Number(process.env.OPENAI_TIMEOUT_MS ?? 8000),
};
