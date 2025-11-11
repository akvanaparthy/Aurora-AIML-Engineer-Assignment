// Load environment variables FIRST - before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import askRouter from './routes/ask';
import healthRouter from './routes/health';
import statsRouter from './routes/stats';
import reindexRouter from './routes/reindex';
import { initializePinecone } from './services/vectorStore';

const app: Express = express();
const port = process.env.PORT || 3000;

initializePinecone().catch(err => {
  console.error('Failed to initialize Pinecone:', err);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/ask', askRouter);
app.use('/health', healthRouter);
app.use('/stats', statsRouter);
app.use('/reindex', reindexRouter);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Member Q&A System',
    version: '2.0.0',
    description: 'AI-powered question-answering system with semantic search',
    features: [
      'Semantic search with vector embeddings',
      'Multi-agent architecture',
      'Intelligent query optimization',
      'Proactive recommendations'
    ],
    endpoints: {
      ask: 'POST /ask - Ask questions about member data',
      health: 'GET /health - Health check',
      stats: 'GET /stats - Dataset statistics',
      reindex: 'POST /reindex - Reindex messages to vector store',
      reindexStats: 'GET /reindex/stats - Get vector store statistics'
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`\n🚀 Server running on port ${port}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`\n📍 Available endpoints:`);
    console.log(`   POST http://localhost:${port}/ask`);
    console.log(`   GET  http://localhost:${port}/health`);
    console.log(`   GET  http://localhost:${port}/stats`);
    console.log(`   POST http://localhost:${port}/reindex`);
    console.log(`   GET  http://localhost:${port}/reindex/stats\n`);
  });
}

export default app;

