import axios from 'axios';
import { Message, MessagesResponse } from '../types';

const API_BASE_URL = process.env.MESSAGES_API_URL || 'https://november7-730026606190.europe-west1.run.app';
const BATCH_SIZE = 1000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

/**
 * Fetch all messages from the API with pagination
 */
export async function fetchAllMessages(): Promise<Message[]> {
  const allMessages: Message[] = [];
  let skip = 0;
  let hasMore = true;

  console.log('📥 Starting to fetch messages from API...');

  while (hasMore) {
    try {
      const response = await fetchWithRetry(skip, BATCH_SIZE);

      if (!response.items || response.items.length === 0) {
        hasMore = false;
        break;
      }

      allMessages.push(...response.items);
      skip += response.items.length;

      console.log(`   Fetched ${allMessages.length} / ${response.total} messages`);

      // Check if we've fetched all messages
      if (skip >= response.total) {
        hasMore = false;
      }
    } catch (error) {
      console.error(`❌ Failed to fetch messages at skip=${skip}:`, error);
      throw new Error(`Failed to fetch messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log(`✅ Successfully fetched ${allMessages.length} messages`);
  return allMessages;
}

/**
 * Fetch a single batch of messages with retry logic
 */
async function fetchWithRetry(skip: number, limit: number, retries = MAX_RETRIES): Promise<MessagesResponse> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get<MessagesResponse>(`${API_BASE_URL}/messages/`, {
        params: { skip, limit },
        timeout: 10000 // 10 second timeout
      });

      return response.data;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }

      console.warn(`   Retry ${attempt}/${retries} after error...`);
      await sleep(RETRY_DELAY * attempt); // Exponential backoff
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * Test API connectivity
 */
export async function testApiConnection(): Promise<boolean> {
  try {
    const response = await axios.get(`${API_BASE_URL}/messages/`, {
      params: { skip: 0, limit: 1 },
      timeout: 5000
    });

    return response.status === 200;
  } catch (error) {
    console.error('API connection test failed:', error);
    return false;
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
