import { Router, Request, Response } from 'express';
import { cacheManager } from '../services/cacheManager';
import { answerQuestion } from '../services/claudeService';
import { optimizeQuery, truncateMessages } from '../utils/queryOptimizer';
import { AskRequest, AskResponse } from '../types';

const router = Router();

/**
 * POST /ask
 * Answer a natural language question about member data
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { question }: AskRequest = req.body;

    // Validate request
    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Please provide a "question" field in the request body'
      });
    }

    if (question.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Question cannot be empty'
      });
    }

    if (question.length > 500) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Question is too long (max 500 characters)'
      });
    }

    console.log(`\n📝 Question: "${question}"`);

    // Get cached data
    const cacheData = await cacheManager.getData();

    // Optimize query - find relevant messages
    const relevantMessages = await optimizeQuery(
      question,
      cacheData.messagesByUser,
      cacheData.messages
    );

    // Truncate if necessary
    const messagesToSend = truncateMessages(relevantMessages);

    // Check if we have any relevant context
    if (messagesToSend.length === 0) {
      return res.json({
        answer: "The available data does not contain this information.",
        confidence: 'low',
        sources: 0,
        references: [],
        further_recommendation: undefined
      } as AskResponse);
    }

    // Get answer from Claude
    const { answer, confidence, references, recommendation } = await answerQuestion(question, messagesToSend);

    // Return response
    const response: AskResponse = {
      answer,
      confidence,
      sources: messagesToSend.length,
      references,
      further_recommendation: recommendation
    };

    console.log(`📤 Answer: "${answer}" (${messagesToSend.length} sources, ${confidence} confidence)\n`);

    return res.json(response);
  } catch (error) {
    console.error('Error processing question:', error);

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('CLAUDE_API_KEY')) {
        return res.status(503).json({
          error: 'Service unavailable',
          message: 'AI service is not configured'
        });
      }

      if (error.message.includes('Failed to fetch')) {
        return res.status(503).json({
          error: 'Service unavailable',
          message: 'Unable to fetch member data'
        });
      }
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing your question'
    });
  }
});

export default router;
