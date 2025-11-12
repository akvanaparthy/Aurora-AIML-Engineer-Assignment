import { Message } from '../types';
import { findUserName, extractKeywords, filterRelevantMessages } from './dataProcessor';
import { semanticSearch, isVectorStoreReady } from '../services/vectorStore';
import { analyzeQuery, isMultiUserQuery, QueryAnalysis } from './queryAnalyzer';

// Removed hard message count limits - now controlled by token limits for better flexibility
const MAX_MESSAGES_PER_USER = 100; // Generous limit, actual constraint is token-based

const ENABLE_SEMANTIC_SEARCH = process.env.ENABLE_SEMANTIC_SEARCH === 'true';
const MAX_CONTEXT_TOKENS = parseInt(process.env.MAX_CONTEXT_TOKENS || '20000', 10);

// TEMPORARY: No limits test mode
const NO_LIMITS_TEST = process.env.NO_LIMITS_TEST === 'true';

/**
 * Optimize the query by finding relevant messages and reducing context size
 * Uses adaptive search strategy based on query type
 */
export async function optimizeQuery(
  question: string,
  messagesByUser: Map<string, Message[]>,
  allMessages: Message[]
): Promise<Message[]> {
  // Analyze query to determine search strategy
  const analysis = analyzeQuery(question, messagesByUser);

  console.log(`   📊 Query Analysis: ${analysis.type} query (${analysis.strategy})`);
  console.log(`   🔍 Search params: topK=${analysis.topK}, threshold=${analysis.similarityThreshold}`);

  if (analysis.entities.userNames.length > 0) {
    console.log(`   👤 Detected users: ${analysis.entities.userNames.join(', ')}`);
  }
  if (analysis.entities.dates.length > 0) {
    console.log(`   📅 Detected dates: ${analysis.entities.dates.join(', ')}`);
  }
  if (analysis.entities.locations.length > 0) {
    console.log(`   📍 Detected locations: ${analysis.entities.locations.join(', ')}`);
  }
  if (analysis.entities.specificItems.length > 0) {
    console.log(`   🏷️  Detected items: ${analysis.entities.specificItems.join(', ')}`);
  }

  // Step 1: Check if the question mentions a specific user
  if (analysis.entities.userNames.length > 0) {
    const userName = analysis.entities.userNames[0]; // Use first detected user
    return optimizeForUser(question, userName, messagesByUser, allMessages, analysis);
  }

  // Step 2: Use adaptive semantic or keyword-based filtering
  if (ENABLE_SEMANTIC_SEARCH && isVectorStoreReady()) {
    console.log(`   Using adaptive semantic search`);
    return optimizeWithAdaptiveSemanticSearch(question, analysis, allMessages);
  } else {
    console.log(`   No specific user detected, filtering by keywords`);
    return optimizeGeneral(question, allMessages, analysis);
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
 * Optimize query using adaptive semantic search
 */
async function optimizeWithAdaptiveSemanticSearch(
  question: string,
  analysis: QueryAnalysis,
  allMessages: Message[]
): Promise<Message[]> {
  const results = await semanticSearch(question, analysis.topK);

  // For broad queries, apply diversity sampling
  if (analysis.type === 'broad' && isMultiUserQuery(question)) {
    console.log(`   🌐 Applying diversity sampling for multi-user query`);
    return diversifySampling(results, allMessages);
  }

  // No hard limit - token truncation will handle this
  return results;
}

/**
 * Optimize query for a specific user
 */
async function optimizeForUser(
  question: string,
  userName: string,
  messagesByUser: Map<string, Message[]>,
  allMessages: Message[],
  analysis: QueryAnalysis
): Promise<Message[]> {
  const userMessages = messagesByUser.get(userName) || [];

  if (userMessages.length === 0) {
    return [];
  }

  if (ENABLE_SEMANTIC_SEARCH && isVectorStoreReady()) {
    // Use adaptive topK based on query type
    const semanticResults = await semanticSearch(question, analysis.topK, {
      user_name: userName
    });

    const limited = semanticResults.slice(0, MAX_MESSAGES_PER_USER);
    console.log(`   Found ${limited.length} relevant messages for ${userName} using adaptive semantic search`);
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
function optimizeGeneral(
  question: string,
  allMessages: Message[],
  analysis: QueryAnalysis
): Message[] {
  // Extract keywords from question
  const keywords = extractKeywords(question);

  // Adjust max messages based on query type
  const maxMessages = analysis.type === 'broad' ? 150 : 100;

  // Filter all messages by relevance
  const relevantMessages = filterRelevantMessages(
    allMessages,
    keywords,
    maxMessages
  );

  // For broad queries, apply diversity sampling
  if (analysis.type === 'broad' && isMultiUserQuery(question)) {
    console.log(`   🌐 Applying diversity sampling for multi-user query`);
    return diversifySampling(relevantMessages, allMessages);
  }

  console.log(`   Found ${relevantMessages.length} relevant messages across all users`);
  return relevantMessages;
}

/**
 * Apply diversity sampling to ensure results span multiple users
 * This is useful for broad queries that benefit from multiple perspectives
 */
function diversifySampling(messages: Message[], allMessages: Message[]): Message[] {
  if (messages.length === 0) {
    return messages;
  }

  // Group messages by user
  const messagesByUser = new Map<string, Message[]>();
  for (const msg of messages) {
    const userMsgs = messagesByUser.get(msg.user_name) || [];
    userMsgs.push(msg);
    messagesByUser.set(msg.user_name, userMsgs);
  }

  console.log(`   📊 Diversity sampling: ${messagesByUser.size} unique users in results`);

  // If we already have good diversity (5+ users), return as is
  if (messagesByUser.size >= 5) {
    return messages;
  }

  // Otherwise, ensure at least a few messages from different users
  const diverseMessages: Message[] = [];
  const usersIncluded = new Set<string>();
  const targetUsers = Math.max(messagesByUser.size, 5);
  const messagesPerUser = Math.max(10, Math.floor(100 / targetUsers)); // Aim for ~100 messages distributed

  // First pass: Add top messages from each user
  for (const [userName, userMessages] of messagesByUser) {
    const count = Math.min(messagesPerUser, userMessages.length);
    diverseMessages.push(...userMessages.slice(0, count));
    usersIncluded.add(userName);
  }

  // Second pass: Fill with additional relevant messages
  const additionalMessages = messages
    .filter(msg => !diverseMessages.some(dm => dm.id === msg.id))
    .slice(0, 50); // Add up to 50 more for good measure
  diverseMessages.push(...additionalMessages);

  console.log(`   ✅ Diversity sampling complete: ${diverseMessages.length} messages from ${usersIncluded.size} users`);
  return diverseMessages;
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
 * Now uses configurable MAX_CONTEXT_TOKENS (default: 20,000)
 */
export function truncateMessages(
  messages: Message[],
  maxTokens: number = MAX_CONTEXT_TOKENS
): Message[] {
  // TEMPORARY: Skip truncation if in no-limits test mode
  if (NO_LIMITS_TEST) {
    const totalTokens = estimateTokens(messages);
    console.log(`   🚨 NO LIMITS TEST MODE: Using ALL ${messages.length} messages (${totalTokens} tokens, NO TRUNCATION)`);
    return messages;
  }

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
    console.log(`   ⚠️  Truncated messages from ${messages.length} to ${truncated.length} to fit ${maxTokens} token limit (${currentTokens} tokens used)`);
  } else {
    console.log(`   ✅ Using all ${messages.length} messages (${currentTokens} tokens, within ${maxTokens} limit)`);
  }

  return truncated;
}
