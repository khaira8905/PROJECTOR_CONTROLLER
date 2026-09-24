import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config } from './config';
import { apiRouter } from './routes';
import { apiNotFound, errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiRouter);
  app.use('/api', apiNotFound);

  // In production the server also hosts the built React app (single port, easy for Electron later).
  if (fs.existsSync(path.join(config.clientDistDir, 'index.html'))) {
    app.use(express.static(config.clientDistDir, { index: false }));
    app.get(/^\/(?!api\/|socket\.io\/).*/, (_req, res) => {
      res.sendFile(path.join(config.clientDistDir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
