import { Router, Request, Response } from 'express';
import { cacheManager } from '../services/cacheManager';
import { testApiConnection } from '../services/dataFetcher';
import { HealthResponse } from '../types';

const router = Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const cacheStatus = cacheManager.getCacheStatus();

    // Test API connectivity
    const apiConnected = await testApiConnection();

    const health: HealthResponse = {
      status: cacheStatus.loaded && apiConnected ? 'healthy' : 'unhealthy',
      cache: {
        loaded: cacheStatus.loaded,
        messageCount: cacheStatus.messageCount,
        lastUpdated: cacheStatus.lastUpdated
      },
      api: {
        connected: apiConnected
      },
      timestamp: new Date().toISOString()
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;
    return res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check error:', error);

    return res.status(503).json({
      status: 'unhealthy',
      cache: {
        loaded: false,
        messageCount: 0,
        lastUpdated: null
      },
      api: {
        connected: false
      },
      timestamp: new Date().toISOString()
    } as HealthResponse);
  }
});

export default router;
