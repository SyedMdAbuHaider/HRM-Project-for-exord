import { Router } from 'express';
import { db } from '../db/pool.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'ok',
      service: 'exord-hrm-api',
      database: 'ok',
      timestamp: new Date().toISOString()
    });
  } catch {
    res.status(503).json({
      status: 'degraded',
      service: 'exord-hrm-api',
      database: 'unavailable',
      timestamp: new Date().toISOString()
    });
  }
});