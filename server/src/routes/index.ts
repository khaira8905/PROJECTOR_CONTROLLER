import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config';
import { displayNameFrom, getFileType, tmpUploadDir } from '../services/mediaStorage';
import * as events from '../controllers/eventsController';
import * as media from '../controllers/mediaController';
import * as queue from '../controllers/queueController';
import * as schedule from '../controllers/scheduleController';
import * as control from '../controllers/controlController';
import * as auth from '../controllers/authController';
import * as screens from '../controllers/screensController';
import * as status from '../controllers/statusController';
import { requireAuth } from '../middleware/requireAuth';

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = tmpUploadDir();
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    // Random temp names: the client-supplied name never touches the filesystem here.
    filename: (_req, _file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.upload`),
  }),
  limits: { fileSize: config.maxUploadBytes, files: config.maxFilesPerUpload, fields: 10 },
  fileFilter: (req, file, cb) => {
    // Browsers send "latin1"-decoded names; restore UTF-8 filenames.
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    if (!getFileType(file.originalname)) {
      const list = ((req as any).rejectedFiles ??= []);
      list.push({ name: displayNameFrom(file.originalname), error: `File type not supported (${path.extname(file.originalname) || 'no extension'}).` });
      return cb(null, false);
    }
    cb(null, true);
  },
});

export const apiRouter = Router();

apiRouter.use(requireAuth);

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, time: Date.now() });
});

apiRouter.get('/auth/status', auth.status);
apiRouter.post('/auth/setup', auth.setup);
apiRouter.post('/auth/login', auth.login);
apiRouter.post('/auth/logout', auth.logout);
apiRouter.post('/auth/change-password', auth.changePassword);

apiRouter.get('/status', status.getStatus);

apiRouter.get('/events', events.listEvents);
apiRouter.post('/events', events.createEvent);
apiRouter.get('/events/:id', events.getEvent);
apiRouter.put('/events/:id', events.updateEvent);
apiRouter.delete('/events/:id', events.deleteEvent);

apiRouter.get('/events/:id/media', media.listMedia);
apiRouter.post('/events/:id/media', upload.array('files', config.maxFilesPerUpload), media.uploadMedia);
apiRouter.patch('/media/:mediaId', media.renameMedia);
apiRouter.delete('/media/:mediaId', media.deleteMedia);
apiRouter.get('/media/:mediaId/file', media.serveMediaFile);
apiRouter.get('/media/:mediaId/render', media.serveRenderedFile);
apiRouter.post('/media/:mediaId/convert', media.reconvertMedia);
apiRouter.post('/media/:mediaId/open', media.openMediaExternally);

apiRouter.get('/events/:id/queue', queue.getQueue);
apiRouter.post('/events/:id/queue', queue.addToQueue);
apiRouter.put('/events/:id/queue', queue.reorderQueue);
apiRouter.patch('/queue/:itemId', queue.updateQueueItem);
apiRouter.delete('/queue/:itemId', queue.deleteQueueItem);

apiRouter.get('/events/:id/schedule', schedule.getSchedule);
apiRouter.post('/events/:id/schedule', schedule.addScheduleItem);
apiRouter.patch('/schedule/:itemId', schedule.updateScheduleItem);
apiRouter.delete('/schedule/:itemId', schedule.deleteScheduleItem);

apiRouter.get('/events/:id/screens', screens.listScreens);
apiRouter.post('/events/:id/screens', screens.createScreen);
apiRouter.patch('/screens/:screenId', screens.updateScreen);
apiRouter.delete('/screens/:screenId', screens.deleteScreen);

apiRouter.get('/events/:id/state', control.getState);
apiRouter.post('/events/:id/control', control.control);
