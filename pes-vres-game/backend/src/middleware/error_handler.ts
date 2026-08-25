import { ErrorRequestHandler } from 'express';

/** Last-resort handler: never let an unexpected error crash the process or leak a stack trace. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Εσωτερικό σφάλμα διακομιστή.' });
};
