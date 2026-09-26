import fs from 'node:fs/promises';
import type { Request, Response } from 'express';
import { config } from '../config';
import { isLocalRequest } from '../lib/network';
import { cloudStatus } from '../services/cloudSync';
import { conversionStatus } from '../services/processingService';

/** Health of the pieces the operator depends on: cloud storage and PowerPoint conversion. */
export async function getStatus(req: Request, res: Response) {
  res.json({
    server: { ok: true, time: Date.now() },
    storage: await cloudStatus(),
    conversion: conversionStatus(),
    auth: { provider: config.auth.provider },
    // "Open in PowerPoint" launches the app on the server's screen: only offered to a browser on that machine.
    openExternally: config.allowExternalOpen && isLocalRequest(req),
    disk: await diskSpace(),
  });
}

/** Free space on the drive that holds the uploads, for the operator's storage meter. */
async function diskSpace(): Promise<{ free: number; total: number } | null> {
  try {
    const s = await fs.statfs(config.uploadsDir);
    return { free: s.bavail * s.bsize, total: s.blocks * s.bsize };
  } catch {
    return null;
  }
}
