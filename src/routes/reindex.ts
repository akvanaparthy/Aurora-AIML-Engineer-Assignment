import { Router, Request, Response } from 'express';
import { cacheManager } from '../services/cacheManager';
import { upsertMessages, getIndexStats, isVectorStoreReady } from '../services/vectorStore';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    if (!isVectorStoreReady()) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Vector store is not initialized. Check PINECONE_API_KEY and OPENAI_API_KEY configuration.'
      });
    }

    console.log('\n🔄 Starting reindex operation...');
    const startTime = Date.now();

    const cacheData = await cacheManager.getData();
    const messages = cacheData.messages;

    if (messages.length === 0) {
      return res.status(400).json({
        error: 'No data',
        message: 'No messages available to index'
      });
    }

    await upsertMessages(messages);

    const stats = await getIndexStats();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Reindex complete in ${duration}s\n`);

    return res.json({
      success: true,
      messagesIndexed: messages.length,
      duration: `${duration}s`,
      indexStats: stats
    });
  } catch (error) {
    console.error('Error during reindex:', error);

    if (error instanceof Error) {
      if (error.message.includes('OPENAI_API_KEY')) {
        return res.status(503).json({
          error: 'Service unavailable',
          message: 'OpenAI API is not configured'
        });
      }

      if (error.message.includes('Pinecone')) {
        return res.status(503).json({
          error: 'Service unavailable',
          message: 'Vector store is not properly configured'
        });
      }
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during reindexing'
    });
  }
});

router.get('/stats', async (req: Request, res: Response) => {
  try {
    if (!isVectorStoreReady()) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Vector store is not initialized'
      });
    }

    const stats = await getIndexStats();

    return res.json({
      vectorStore: 'pinecone',
      ready: true,
      stats
    });
  } catch (error) {
    console.error('Error getting index stats:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve index statistics'
    });
  }
});

export default router;
