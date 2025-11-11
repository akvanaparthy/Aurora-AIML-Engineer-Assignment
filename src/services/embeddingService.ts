import OpenAI from 'openai';
import { Message } from '../types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingResult {
  id: string;
  embedding: number[];
  metadata: {
    user_id: string;
    user_name: string;
    timestamp: string;
    message: string;
  };
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      encoding_format: 'float'
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

export async function generateMessageEmbedding(message: Message): Promise<EmbeddingResult> {
  const textToEmbed = `${message.user_name}: ${message.message}`;
  const embedding = await generateEmbedding(textToEmbed);

  return {
    id: message.id,
    embedding,
    metadata: {
      user_id: message.user_id,
      user_name: message.user_name,
      timestamp: message.timestamp,
      message: message.message
    }
  };
}

export async function generateBatchEmbeddings(
  messages: Message[],
  batchSize: number = 100
): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];

  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    console.log(`Generating embeddings for batch ${i / batchSize + 1}/${Math.ceil(messages.length / batchSize)}...`);

    const batchPromises = batch.map(msg => generateMessageEmbedding(msg));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    if (i + batchSize < messages.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

export { EMBEDDING_DIMENSIONS };
