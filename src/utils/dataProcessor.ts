import { Message, DataStats } from '../types';

/**
 * Process messages and organize them by user
 */
export function processMessages(messages: Message[]): Map<string, Message[]> {
  const messagesByUser = new Map<string, Message[]>();

  for (const message of messages) {
    const userName = message.user_name;

    if (!messagesByUser.has(userName)) {
      messagesByUser.set(userName, []);
    }

    messagesByUser.get(userName)!.push(message);
  }

  // Sort messages by timestamp within each user
  for (const [userName, userMessages] of messagesByUser.entries()) {
    userMessages.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  return messagesByUser;
}

/**
 * Calculate statistics about the dataset
 */
export function calculateStats(messages: Message[]): DataStats {
  const uniqueUsers = new Set<string>();
  const userMessageCounts: Record<string, number> = {};
  let earliest = messages[0]?.timestamp;
  let latest = messages[0]?.timestamp;

  for (const message of messages) {
    uniqueUsers.add(message.user_name);

    userMessageCounts[message.user_name] = (userMessageCounts[message.user_name] || 0) + 1;

    if (message.timestamp < earliest) earliest = message.timestamp;
    if (message.timestamp > latest) latest = message.timestamp;
  }

  return {
    totalMessages: messages.length,
    uniqueUsers: uniqueUsers.size,
    dateRange: {
      earliest,
      latest
    },
    userMessageCounts
  };
}

/**
 * Find user by name (handles variations and partial matches)
 */
export function findUserName(query: string, messagesByUser: Map<string, Message[]>): string | null {
  const normalizedQuery = query.toLowerCase().trim();

  // Exact match (case-insensitive)
  for (const userName of messagesByUser.keys()) {
    if (userName.toLowerCase() === normalizedQuery) {
      return userName;
    }
  }

  // Partial match - first name or last name
  for (const userName of messagesByUser.keys()) {
    const nameParts = userName.toLowerCase().split(' ');
    if (nameParts.some(part => part === normalizedQuery || normalizedQuery.includes(part))) {
      return userName;
    }
  }

  // Fuzzy match - check if any part of the query matches
  for (const userName of messagesByUser.keys()) {
    if (userName.toLowerCase().includes(normalizedQuery)) {
      return userName;
    }
  }

  return null;
}

/**
 * Extract keywords from a question for filtering messages
 */
export function extractKeywords(question: string): string[] {
  // Remove common stop words
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'what', 'when', 'where', 'who', 'why',
    'how', 'which', 'to', 'from', 'in', 'on', 'at', 'for', 'with', 'about'
  ]);

  const words = question
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  return [...new Set(words)]; // Remove duplicates
}

/**
 * Filter messages based on relevance to the question
 */
export function filterRelevantMessages(
  messages: Message[],
  keywords: string[],
  maxMessages: number = 50
): Message[] {
  if (keywords.length === 0) {
    // If no keywords, return most recent messages
    return messages
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, maxMessages);
  }

  // Score each message based on keyword matches
  const scoredMessages = messages.map(message => {
    const messageLower = message.message.toLowerCase();
    let score = 0;

    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = messageLower.match(regex);
      if (matches) {
        score += matches.length;
      }
    }

    return { message, score };
  });

  // Sort by score (descending) and then by timestamp (descending)
  return scoredMessages
    .filter(item => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return new Date(b.message.timestamp).getTime() - new Date(a.message.timestamp).getTime();
    })
    .slice(0, maxMessages)
    .map(item => item.message);
}
