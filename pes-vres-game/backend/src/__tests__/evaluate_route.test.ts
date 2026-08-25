import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

let app: Express;

beforeAll(async () => {
  process.env.AI_MODE = 'mock';
  delete process.env.OPENAI_API_KEY;
  const mod = await import('../app');
  app = mod.createApp();
});

describe('POST /api/evaluate', () => {
  it('rejects a request missing the question field', async () => {
    const res = await request(app).post('/api/evaluate').send({ answer: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns 0 points for an empty answer without ever calling the AI', async () => {
    const res = await request(app)
      .post('/api/evaluate')
      .send({ question: 'Πες ένα φρούτο', answer: '   ' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ correct: false, points: 0 });
  });

  it('evaluates natural Greek phrasing (article + filler word) via the mock evaluator', async () => {
    const res = await request(app)
      .post('/api/evaluate')
      .send({ question: 'Πες ένα ελληνικό νησί', answer: 'η Κρήτη νομίζω' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ correct: true, points: 100 });
    expect(res.body.reason).toEqual(expect.any(String));
  });

  it('honors an explicit per-request mode override', async () => {
    const res = await request(app)
      .post('/api/evaluate')
      .send({ question: 'Πες ένα ζώο που πετάει', answer: 'νυχτερίδα', mode: 'mock' });
    expect(res.status).toBe(200);
    expect(res.body.correct).toBe(true);
  });

  it('fails gracefully (structured 400, no crash) when real mode is requested without an API key', async () => {
    const res = await request(app)
      .post('/api/evaluate')
      .send({ question: 'Πες ένα χρώμα', answer: 'μπλε', mode: 'real' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });
});

describe('GET /api/questions', () => {
  it('returns the 20 static Greek questions', async () => {
    const res = await request(app).get('/api/questions');
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(20);
    expect(res.body.questions[0]).toMatchObject({ id: expect.any(String), text: expect.any(String) });
  });
});

describe('GET /api/health', () => {
  it('reports ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
