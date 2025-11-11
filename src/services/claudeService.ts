import Anthropic from '@anthropic-ai/sdk';
import { Message } from '../types';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const MODEL = 'claude-3-5-haiku-20241022'; // Claude 3.5 Haiku (fast and cost-effective)
const MAX_TOKENS = 1024;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: CLAUDE_API_KEY || 'dummy-key-for-testing'
});

/**
 * Parse structured response with ANSWER and RECOMMENDATION sections
 */
function parseStructuredResponse(text: string): { answer: string; recommendation?: string } {
  const answerMatch = text.match(/ANSWER:\s*([\s\S]*?)(?=RECOMMENDATION:|$)/i);
  const recommendationMatch = text.match(/RECOMMENDATION:\s*([\s\S]*?)$/i);

  let answer = answerMatch ? answerMatch[1].trim() : text.trim();
  let recommendation = recommendationMatch ? recommendationMatch[1].trim() : undefined;

  if (!answer && !recommendation) {
    answer = text.trim();
  }

  return {
    answer,
    recommendation: recommendation && recommendation.length > 0 ? recommendation : undefined
  };
}

/**
 * Answer a question using Claude based on relevant messages
 */
export async function answerQuestion(
  question: string,
  relevantMessages: Message[]
): Promise<{ answer: string; confidence: 'high' | 'medium' | 'low'; references: Array<{ user: string; date: string; excerpt: string }>; recommendation?: string }> {
  if (!CLAUDE_API_KEY) {
    throw new Error('CLAUDE_API_KEY is not configured');
  }

  try {
    // Build the context from messages
    const context = buildContext(relevantMessages);

    // Create the system prompt
    const systemPrompt = getSystemPrompt();

    // Create the user prompt with context
    const userPrompt = buildUserPrompt(question, context);

    console.log(`🤖 Sending question to Claude (${relevantMessages.length} messages in context)`);

    // Call Claude API
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.3, // Lower temperature for more consistent answers
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    // Extract answer from response
    const responseText = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // Parse structured response
    const { answer: answerText, recommendation } = parseStructuredResponse(responseText);

    // Determine confidence based on context and response
    const confidence = determineConfidence(
      answerText,
      relevantMessages.length,
      response.stop_reason
    );

    console.log(`✅ Claude response received (confidence: ${confidence})`);

    // Build references from the messages used
    const references = relevantMessages.slice(0, 5).map(msg => ({
      user: msg.user_name,
      date: new Date(msg.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      excerpt: msg.message.substring(0, 150) + (msg.message.length > 150 ? '...' : '')
    }));

    return {
      answer: cleanAnswer(answerText),
      confidence,
      references,
      recommendation: recommendation ? cleanAnswer(recommendation) : undefined
    };
  } catch (error) {
    console.error('❌ Claude API error:', error);
    throw new Error(`Failed to get answer from Claude: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Build system prompt that defines Claude's role and behavior
 */
function getSystemPrompt(): string {
  return `You are an AI assistant analyzing member data from a luxury concierge service. Your role is to provide factual answers and proactive recommendations based on the messages.

Guidelines for Answer:
1. Answer ONLY based on the information in the messages
2. Be specific with details (dates, numbers, locations, names)
3. If information is not available, state: "The available data does not contain this information"
4. Keep answers concise (1-2 sentences maximum)
5. Write in third person, reporting facts objectively
6. Do NOT include reference phrases like "as mentioned in", "according to the message"
7. Do NOT cite dates or sources in the answer - just state the facts

Guidelines for Recommendation:
1. Based on patterns in the member's messages, provide ONE actionable recommendation
2. Consider preferences, frequent requests, upcoming events, or potential needs
3. Keep it concise (1 sentence)
4. Make it specific and relevant to the member's context
5. If no meaningful recommendation can be made, omit this section

Output format (use exactly these markers):
ANSWER:
[Your direct factual answer here]

RECOMMENDATION:
[Your proactive recommendation here, or omit this section if not applicable]

Example:
ANSWER:
Layla is planning a five-night stay at Claridge's in London starting on a Monday in November 2025, with a chauffeur-driven Bentley.

RECOMMENDATION:
Consider arranging afternoon tea reservations at Claridge's and pre-booking theater tickets for West End shows during her London stay.`;
}

/**
 * Build context from relevant messages
 */
function buildContext(messages: Message[]): string {
  if (messages.length === 0) {
    return 'No relevant messages found.';
  }

  // Group messages by user for better organization
  const messagesByUser: Record<string, string[]> = {};

  for (const msg of messages) {
    if (!messagesByUser[msg.user_name]) {
      messagesByUser[msg.user_name] = [];
    }

    const date = new Date(msg.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    messagesByUser[msg.user_name].push(`[${date}] ${msg.message}`);
  }

  // Build context string
  let context = '';
  for (const [userName, userMessages] of Object.entries(messagesByUser)) {
    context += `\n${userName}:\n`;
    context += userMessages.slice(0, 20).join('\n') + '\n'; // Limit messages per user
  }

  return context;
}

/**
 * Build the user prompt with question and context
 */
function buildUserPrompt(question: string, context: string): string {
  return `Question: ${question}

Member Messages:
${context}

Please answer the question based on the messages above. If the information is not available, say so clearly.`;
}

/**
 * Determine confidence level based on various factors
 */
function determineConfidence(
  answer: string,
  messageCount: number,
  stopReason: string | null
): 'high' | 'medium' | 'low' {
  const answerLower = answer.toLowerCase();

  // Low confidence indicators
  if (
    answerLower.includes("don't have") ||
    answerLower.includes("not found") ||
    answerLower.includes("unable to find") ||
    answerLower.includes("not mentioned") ||
    answerLower.includes("no information") ||
    messageCount === 0
  ) {
    return 'low';
  }

  // Medium confidence indicators
  if (
    answerLower.includes('might') ||
    answerLower.includes('possibly') ||
    answerLower.includes('seems') ||
    answerLower.includes('appears') ||
    messageCount < 3
  ) {
    return 'medium';
  }

  // High confidence - specific information with good context
  if (messageCount >= 3 && stopReason === 'end_turn') {
    return 'high';
  }

  return 'medium';
}

/**
 * Clean up the answer text
 */
function cleanAnswer(answer: string): string {
  return answer
    .trim()
    .replace(/^["']|["']$/g, '') // Remove surrounding quotes
    .replace(/\n{3,}/g, '\n\n'); // Replace multiple newlines
}

/**
 * Test Claude API connection
 */
export async function testClaudeConnection(): Promise<boolean> {
  if (!CLAUDE_API_KEY) {
    return false;
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: 'Say "ok" if you can hear me.'
        }
      ]
    });

    return response.content.length > 0;
  } catch (error) {
    console.error('Claude connection test failed:', error);
    return false;
  }
}
