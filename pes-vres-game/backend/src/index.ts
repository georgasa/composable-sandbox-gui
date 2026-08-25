import { createApp } from './app';
import { env } from './config/env';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

const app = createApp();

app.listen(env.port, () => {
  console.log(`Pes Vres backend listening on port ${env.port} (AI_MODE=${env.aiMode})`);
});
