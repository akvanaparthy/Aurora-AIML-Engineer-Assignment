import { Message } from '../types';
import { findUserName, extractKeywords, filterRelevantMessages } from './dataProcessor';
import { semanticSearch, isVectorStoreReady } from '../services/vectorStore';

const MAX_MESSAGES_TO_CLAUDE = 50;
const MAX_MESSAGES_PER_USER = 30;

const ENABLE_SEMANTIC_SEARCH = process.env.ENABLE_SEMANTIC_SEARCH === 'true';

/**
 * Optimize the query by finding relevant messages and reducing context size
 */
export async function optimizeQuery(
  question: string,
  messagesByUser: Map<string, Message[]>,
  allMessages: Message[]
): Promise<Message[]> {
  // Step 1: Check if the question mentions a specific user
  const userName = extractUserNameFromQuestion(question, messagesByUser);

  if (userName) {
    console.log(`   Detected user in question: ${userName}`);
    return optimizeForUser(question, userName, messagesByUser, allMessages);
  }

  // Step 2: No specific user - use semantic or keyword-based filtering
  if (ENABLE_SEMANTIC_SEARCH && isVectorStoreReady()) {
    console.log(`   Using semantic search for query`);
    return optimizeWithSemanticSearch(question);
  } else {
    console.log(`   No specific user detected, filtering by keywords`);
    return optimizeGeneral(question, allMessages);
  }
}

/**
 * Extract user name from question
 */
function extractUserNameFromQuestion(
  question: string,
  messagesByUser: Map<string, Message[]>
): string | null {
  // Common name patterns in questions
  const patterns = [
    /(?:who is|about|does|has|have|is|are|'s)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:is|has|does|have)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)'s\s+/i
  ];

  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match && match[1]) {
      const potentialName = match[1];
      const foundName = findUserName(potentialName, messagesByUser);
      if (foundName) {
        return foundName;
      }
    }
  }

  // Try each word as a potential name
  const words = question.split(/\s+/);
  for (const word of words) {
    if (word.length > 2 && /^[A-Z][a-z]+$/.test(word)) {
      const foundName = findUserName(word, messagesByUser);
      if (foundName) {
        return foundName;
      }
    }
  }

  return null;
}

/**
 * Optimize query using semantic search
 */
async function optimizeWithSemanticSearch(question: string): Promise<Message[]> {
  const topK = parseInt(process.env.SEMANTIC_SEARCH_TOP_K || '20', 10);
  const results = await semanticSearch(question, topK);
  return results.slice(0, MAX_MESSAGES_TO_CLAUDE);
}

/**
 * Optimize query for a specific user
 */
async function optimizeForUser(
  question: string,
  userName: string,
  messagesByUser: Map<string, Message[]>,
  allMessages: Message[]
): Promise<Message[]> {
  const userMessages = messagesByUser.get(userName) || [];

  if (userMessages.length === 0) {
    return [];
  }

  if (ENABLE_SEMANTIC_SEARCH && isVectorStoreReady()) {
    const topK = parseInt(process.env.SEMANTIC_SEARCH_TOP_K || '20', 10);
    const semanticResults = await semanticSearch(question, topK, {
      user_name: userName
    });

    const limited = semanticResults.slice(0, MAX_MESSAGES_PER_USER);
    console.log(`   Found ${limited.length} relevant messages for ${userName} using semantic search`);
    return limited;
  }

  const keywords = extractKeywords(question);

  const relevantMessages = filterRelevantMessages(
    userMessages,
    keywords,
    MAX_MESSAGES_PER_USER
  );

  console.log(`   Found ${relevantMessages.length} relevant messages for ${userName}`);
  return relevantMessages;
}

/**
 * Optimize query for general questions (no specific user)
 */
function optimizeGeneral(question: string, allMessages: Message[]): Message[] {
  // Extract keywords from question
  const keywords = extractKeywords(question);

  // Filter all messages by relevance
  const relevantMessages = filterRelevantMessages(
    allMessages,
    keywords,
    MAX_MESSAGES_TO_CLAUDE
  );

  console.log(`   Found ${relevantMessages.length} relevant messages across all users`);
  return relevantMessages;
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokens(messages: Message[]): number {
  const totalChars = messages.reduce(
    (sum, msg) => sum + msg.message.length + msg.user_name.length,
    0
  );

  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(totalChars / 4);
}

/**
 * Truncate messages if they exceed token limit
 */
export function truncateMessages(
  messages: Message[],
  maxTokens: number = 6000
): Message[] {
  let currentTokens = 0;
  const truncated: Message[] = [];

  for (const message of messages) {
    const messageTokens = Math.ceil((message.message.length + message.user_name.length) / 4);

    if (currentTokens + messageTokens > maxTokens) {
      break;
    }

    truncated.push(message);
    currentTokens += messageTokens;
  }

  if (truncated.length < messages.length) {
    console.log(`   Truncated messages from ${messages.length} to ${truncated.length} to fit token limit`);
  }

  return truncated;
}
