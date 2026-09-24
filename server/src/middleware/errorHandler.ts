import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { HttpError } from '../lib/errors';
import { logger } from '../lib/logger';
import { config } from '../config';

export const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'API route not found.' });
};

/** Converts any thrown error into a friendly JSON response. Never leaks stack traces. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const field = issue?.path.join('.');
    res.status(400).json({ error: field ? `Invalid ${field}: ${issue.message}` : 'Invalid request.', code: 'VALIDATION' });
    return;
  }
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File is too large. Maximum size is ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB.`
        : err.code === 'LIMIT_FILE_COUNT'
          ? `Too many files. Upload at most ${config.maxFilesPerUpload} at a time.`
          : 'Unable to upload file.';
    res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: message, code: err.code });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON body.' });
    return;
  }
  logger.error(`${req.method} ${req.originalUrl} failed:`, err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
};
