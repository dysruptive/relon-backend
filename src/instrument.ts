// Suppress third-party warnings that cannot be fixed in our code:
//   DEP0190 — NestJS CLI v10 uses shell:true with args in abstract.runner.js
//   localstorage-file — pdfmake triggers Node v25's Web Storage globals at load time
const _originalEmit = process.emit.bind(process) as typeof process.emit;
(process as NodeJS.Process).emit = function (event, ...args) {
  if (event === 'warning') {
    const w = args[0] as Error & { code?: string };
    if (w?.code === 'DEP0190') return false;
    if (w?.message?.includes('--localstorage-file')) return false;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (_originalEmit as any)(event, ...args);
} as typeof process.emit;

import * as Sentry from '@sentry/nestjs';

// Must be imported before any other code to ensure Sentry is initialized first
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  environment: process.env.NODE_ENV || 'development',
  // Only enable if DSN is configured — graceful no-op in dev without DSN
  enabled: !!process.env.SENTRY_DSN,
  // Don't send PII by default
  sendDefaultPii: false,
});
