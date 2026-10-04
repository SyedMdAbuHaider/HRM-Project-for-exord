import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { meRouter } from './routes/me.js';
import { attendanceRouter } from './routes/attendance.js';
import { employeesRouter } from './routes/employees.js';
import { hrmRouter } from './routes/hrm.js';
import { dataRouter } from './routes/data.js';
import { filesRouter } from './routes/files.js';
import { systemSettingsRouter } from './routes/systemSettings.js';
import { requireAuth } from './auth/middleware.js';
import probeRouter from './routes/probe.js';
import { emailRouter } from './routes/email.js';

export const app = express();
app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use('/api/v1/files', filesRouter);

if (config.corsOrigins.length) {
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('CORS origin denied'));
    },
    credentials: true,
  }));
}

app.get('/api/v1', (_req, res) => {
  res.json({
    service: 'Exord HRM API',
    version: 'v1',
    status: 'online'
  });
});

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/me', meRouter);
app.use('/api/v1/attendance', attendanceRouter);
app.use('/api/v1/employees', employeesRouter);
app.use('/api/v1/hrm', hrmRouter);
app.use('/api/v1/data', dataRouter);
app.use('/api/v1/system-settings', systemSettingsRouter);
app.use('/api/v1/probe', requireAuth, probeRouter);
app.use('/api/v1/email', emailRouter);

app.use((err, _req, res, _next) => {
  console.error('[api]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(err.code ? { code: err.code } : {}),
    ...(err.details ? { details: err.details } : {})
  });
});