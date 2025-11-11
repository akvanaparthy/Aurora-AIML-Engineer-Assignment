import { Router, Request, Response } from 'express';
import { cacheManager } from '../services/cacheManager';
import { StatsResponse } from '../types';

const router = Router();

/**
 * GET /stats
 * Get dataset statistics
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const cacheData = await cacheManager.getData();
    const cacheStatus = cacheManager.getCacheStatus();
    const nextRefresh = cacheManager.getNextRefreshTime();

    // Get top members by message count
    const topMembers = Object.entries(cacheData.stats.userMessageCounts)
      .map(([name, count]) => ({ name, messageCount: count }))
      .sort((a, b) => b.messageCount - a.messageCount);

    const stats: StatsResponse = {
      totalMessages: cacheData.stats.totalMessages,
      uniqueUsers: cacheData.stats.uniqueUsers,
      dateRange: cacheData.stats.dateRange,
      topMembers,
      cacheStatus: {
        lastUpdated: cacheStatus.lastUpdated || 'Never',
        nextRefresh: nextRefresh?.toISOString() || 'Unknown'
      }
    };

    return res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Unable to fetch statistics'
    });
  }
});

export default router;
