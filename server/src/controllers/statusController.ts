import type { Request, Response } from 'express';
import { config } from '../config';
import { cloudStatus } from '../services/cloudSync';
import { conversionStatus } from '../services/processingService';

/** Health of the pieces the operator depends on: cloud storage and PowerPoint conversion. */
export async function getStatus(_req: Request, res: Response) {
  res.json({
    server: { ok: true, time: Date.now() },
    storage: await cloudStatus(),
    conversion: conversionStatus(),
    auth: { provider: config.auth.provider },
  });
}
