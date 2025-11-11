import { Pinecone } from '@pinecone-database/pinecone';
import { Message } from '../types';
import { generateEmbedding, generateBatchEmbeddings, EMBEDDING_DIMENSIONS } from './embeddingService';

let pinecone: Pinecone | null = null;
let indexName: string;

export async function initializePinecone(): Promise<void> {
  if (!process.env.PINECONE_API_KEY) {
    console.warn('⚠️  PINECONE_API_KEY not configured - semantic search disabled');
    return;
  }

  try {
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });

    indexName = process.env.PINECONE_INDEX || 'member-messages';

    const existingIndexes = await pinecone.listIndexes();
    const indexExists = existingIndexes.indexes?.some(idx => idx.name === indexName);

    if (!indexExists) {
      console.log(`📦 Creating Pinecone index: ${indexName}...`);
      await pinecone.createIndex({
        name: indexName,
        dimension: EMBEDDING_DIMENSIONS,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('✅ Pinecone index created successfully');
    } else {
      console.log(`✅ Connected to existing Pinecone index: ${indexName}`);
    }
  } catch (error) {
    console.error('❌ Failed to initialize Pinecone:', error);
    pinecone = null;
  }
}

export async function upsertMessages(messages: Message[]): Promise<void> {
  if (!pinecone) {
    throw new Error('Pinecone is not initialized');
  }

  console.log(`🔄 Generating embeddings for ${messages.length} messages...`);
  const embeddings = await generateBatchEmbeddings(messages);

  const index = pinecone.index(indexName);
  const batchSize = 100;

  for (let i = 0; i < embeddings.length; i += batchSize) {
    const batch = embeddings.slice(i, i + batchSize);

    const vectors = batch.map(emb => ({
      id: emb.id,
      values: emb.embedding,
      metadata: {
        user_id: emb.metadata.user_id,
        user_name: emb.metadata.user_name,
        timestamp: emb.metadata.timestamp,
        message: emb.metadata.message
      }
    }));

    await index.upsert(vectors);
    console.log(`📤 Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(embeddings.length / batchSize)}`);
  }

  console.log(`✅ Successfully indexed ${messages.length} messages`);
}

export async function semanticSearch(
  query: string,
  topK: number = 20,
  filter?: Record<string, any>
): Promise<Message[]> {
  if (!pinecone) {
    console.warn('⚠️  Pinecone not initialized - falling back to keyword search');
    return [];
  }

  try {
    const queryEmbedding = await generateEmbedding(query);
    const index = pinecone.index(indexName);

    const searchResults = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter
    });

    const messages: Message[] = searchResults.matches.map(match => ({
      id: match.id,
      user_id: match.metadata?.user_id as string,
      user_name: match.metadata?.user_name as string,
      timestamp: match.metadata?.timestamp as string,
      message: match.metadata?.message as string
    }));

    console.log(`🔍 Semantic search found ${messages.length} results (scores: ${searchResults.matches.map(m => m.score?.toFixed(3)).join(', ')})`);

    return messages;
  } catch (error) {
    console.error('Error performing semantic search:', error);
    return [];
  }
}

export async function getIndexStats(): Promise<any> {
  if (!pinecone) {
    return { error: 'Pinecone not initialized' };
  }

  try {
    const index = pinecone.index(indexName);
    const stats = await index.describeIndexStats();
    return stats;
  } catch (error) {
    console.error('Error getting index stats:', error);
    return { error: String(error) };
  }
}

export function isVectorStoreReady(): boolean {
  return pinecone !== null;
}
