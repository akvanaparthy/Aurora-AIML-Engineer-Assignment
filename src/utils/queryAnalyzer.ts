import { Message } from '../types';

// Load configuration from environment variables
const SPECIFIC_QUERY_TOP_K = parseInt(process.env.SPECIFIC_QUERY_TOP_K || '50', 10);
const SPECIFIC_QUERY_THRESHOLD = parseFloat(process.env.SPECIFIC_QUERY_THRESHOLD || '0.7');
const BROAD_QUERY_TOP_K = parseInt(process.env.BROAD_QUERY_TOP_K || '120', 10);
const BROAD_QUERY_THRESHOLD = parseFloat(process.env.BROAD_QUERY_THRESHOLD || '0.5');

// TEMPORARY: No limits test mode
const NO_LIMITS_TEST = process.env.NO_LIMITS_TEST === 'true';

/**
 * Query type determination
 */
export interface QueryAnalysis {
  type: 'specific' | 'broad';
  topK: number;
  similarityThreshold: number;
  strategy: 'precision' | 'recall';
  entities: {
    userNames: string[];
    dates: string[];
    locations: string[];
    specificItems: string[];
  };
}

/**
 * Analyze query to determine search strategy
 */
export function analyzeQuery(
  question: string,
  messagesByUser: Map<string, Message[]>
): QueryAnalysis {
  const entities = extractEntities(question, messagesByUser);

  // Check if query is specific (mentions names, dates, locations, or specific items)
  const hasUserName = entities.userNames.length > 0;
  const hasDate = entities.dates.length > 0;
  const hasLocation = entities.locations.length > 0;
  const hasSpecificItem = entities.specificItems.length > 0;

  const isSpecific = hasUserName || hasDate || hasLocation || hasSpecificItem;

  // TEMPORARY: Override for no-limits test mode
  if (NO_LIMITS_TEST) {
    console.log(`   🚨 NO LIMITS TEST MODE ACTIVE`);
    return {
      type: isSpecific ? 'specific' : 'broad',
      topK: 10000, // Effectively unlimited
      similarityThreshold: 0.0, // No filtering
      strategy: isSpecific ? 'precision' : 'recall',
      entities
    };
  }

  if (isSpecific) {
    // Specific query - precision-focused
    return {
      type: 'specific',
      topK: SPECIFIC_QUERY_TOP_K,
      similarityThreshold: SPECIFIC_QUERY_THRESHOLD,
      strategy: 'precision',
      entities
    };
  } else {
    // Broad query - recall-focused
    return {
      type: 'broad',
      topK: BROAD_QUERY_TOP_K,
      similarityThreshold: BROAD_QUERY_THRESHOLD,
      strategy: 'recall',
      entities
    };
  }
}

/**
 * Extract entities from the question
 */
function extractEntities(
  question: string,
  messagesByUser: Map<string, Message[]>
): QueryAnalysis['entities'] {
  return {
    userNames: extractUserNames(question, messagesByUser),
    dates: extractDates(question),
    locations: extractLocations(question),
    specificItems: extractSpecificItems(question)
  };
}

/**
 * Extract user names from the question
 */
function extractUserNames(
  question: string,
  messagesByUser: Map<string, Message[]>
): string[] {
  const foundNames: string[] = [];

  // Common name patterns in questions
  const patterns = [
    /(?:who is|about|does|has|have|is|are|'s)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:is|has|does|have)/gi,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)'s\s+/gi
  ];

  for (const pattern of patterns) {
    const matches = question.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        const potentialName = match[1];
        // Check if this name exists in our user database
        const userNames = Array.from(messagesByUser.keys());
        const found = userNames.find(name =>
          name.toLowerCase() === potentialName.toLowerCase() ||
          name.toLowerCase().includes(potentialName.toLowerCase()) ||
          potentialName.toLowerCase().includes(name.toLowerCase())
        );
        if (found && !foundNames.includes(found)) {
          foundNames.push(found);
        }
      }
    }
  }

  // Also try each capitalized word
  const words = question.split(/\s+/);
  for (const word of words) {
    if (word.length > 2 && /^[A-Z][a-z]+$/.test(word)) {
      const userNames = Array.from(messagesByUser.keys());
      const found = userNames.find(name =>
        name.toLowerCase() === word.toLowerCase() ||
        name.toLowerCase().includes(word.toLowerCase())
      );
      if (found && !foundNames.includes(found)) {
        foundNames.push(found);
      }
    }
  }

  return foundNames;
}

/**
 * Extract date-related entities from the question
 */
function extractDates(question: string): string[] {
  const dates: string[] = [];

  // Specific dates
  const datePatterns = [
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,  // 12/25/2023, 12-25-23
    /\b\d{4}-\d{2}-\d{2}\b/g,               // 2023-12-25
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?\b/gi,  // December 25, 2023
    /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:,?\s+\d{4})?\b/gi   // 25 December 2023
  ];

  for (const pattern of datePatterns) {
    const matches = question.matchAll(pattern);
    for (const match of matches) {
      dates.push(match[0]);
    }
  }

  // Relative dates
  const relativeDatePatterns = [
    /\b(?:last|next|this)\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    /\b(?:yesterday|today|tomorrow)\b/gi,
    /\b\d+\s+(?:days?|weeks?|months?|years?)\s+ago\b/gi
  ];

  for (const pattern of relativeDatePatterns) {
    const matches = question.matchAll(pattern);
    for (const match of matches) {
      dates.push(match[0]);
    }
  }

  return dates;
}

/**
 * Extract location entities from the question
 */
function extractLocations(question: string): string[] {
  const locations: string[] = [];

  // Common location indicators
  const locationPatterns = [
    /\b(?:in|at|to|from|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:trip|travel|visit|journey|vacation)\b/gi
  ];

  // Known cities/countries (expand this list as needed)
  const knownLocations = [
    'London', 'Paris', 'Tokyo', 'New York', 'Dubai', 'Singapore', 'Sydney',
    'Rome', 'Barcelona', 'Amsterdam', 'Berlin', 'Madrid', 'Vienna',
    'Prague', 'Istanbul', 'Bangkok', 'Hong Kong', 'Seoul', 'Mumbai',
    'Delhi', 'Shanghai', 'Beijing', 'Los Angeles', 'San Francisco',
    'Miami', 'Chicago', 'Boston', 'Seattle', 'Austin', 'Las Vegas',
    'Mexico City', 'Rio de Janeiro', 'Buenos Aires', 'Toronto',
    'Vancouver', 'Montreal', 'Cairo', 'Johannesburg', 'Cape Town',
    'Nairobi', 'Marrakech', 'Athens', 'Lisbon', 'Copenhagen',
    'Stockholm', 'Oslo', 'Helsinki', 'Zurich', 'Geneva', 'Brussels',
    'Dublin', 'Edinburgh', 'Venice', 'Florence', 'Milan', 'Naples',
    'Santorini', 'Mykonos', 'Bali', 'Phuket', 'Maldives', 'Seychelles',
    'Mauritius', 'Hawaii', 'Cancun', 'Cabo', 'Aspen', 'Vail',
    'Switzerland', 'France', 'Italy', 'Spain', 'Greece', 'Portugal',
    'England', 'UK', 'USA', 'Japan', 'China', 'India', 'Thailand',
    'Australia', 'Germany', 'Austria', 'Netherlands', 'Belgium'
  ];

  for (const pattern of locationPatterns) {
    const matches = question.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        const location = match[1];
        // Check if it's a known location
        const found = knownLocations.find(loc =>
          loc.toLowerCase() === location.toLowerCase()
        );
        if (found && !locations.includes(found)) {
          locations.push(found);
        }
      }
    }
  }

  // Also check each word against known locations
  const words = question.split(/\s+/);
  for (const word of words) {
    const found = knownLocations.find(loc =>
      loc.toLowerCase() === word.toLowerCase()
    );
    if (found && !locations.includes(found)) {
      locations.push(found);
    }
  }

  return locations;
}

/**
 * Extract specific items mentioned in the question
 */
function extractSpecificItems(question: string): string[] {
  const items: string[] = [];

  // Specific item patterns
  const itemIndicators = [
    /\bhow many\s+([a-z]+s?)\b/gi,           // "how many cars"
    /\bwhich\s+([a-z]+s?)\b/gi,              // "which restaurant"
    /\bwhat\s+([a-z]+s?)\b/gi,               // "what hotel"
    /\bfavorite\s+([a-z]+s?)\b/gi,           // "favorite restaurant"
    /\bpreferred\s+([a-z]+s?)\b/gi,          // "preferred airline"
    /\b([a-z]+)\s+preferences?\b/gi          // "dining preferences"
  ];

  for (const pattern of itemIndicators) {
    const matches = question.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length > 2) {
        items.push(match[1]);
      }
    }
  }

  // Specific item categories
  const itemCategories = [
    'car', 'cars', 'vehicle', 'vehicles',
    'restaurant', 'restaurants', 'dining',
    'hotel', 'hotels', 'accommodation',
    'flight', 'flights', 'airline', 'airlines',
    'wine', 'wines', 'champagne',
    'art', 'artwork', 'painting', 'paintings',
    'property', 'properties', 'house', 'houses',
    'yacht', 'yachts', 'boat', 'boats',
    'watch', 'watches', 'jewelry',
    'fashion', 'clothing', 'designer'
  ];

  const questionLower = question.toLowerCase();
  for (const category of itemCategories) {
    if (questionLower.includes(category) && !items.includes(category)) {
      items.push(category);
    }
  }

  return items;
}

/**
 * Check if query mentions multiple users (for diversity sampling)
 */
export function isMultiUserQuery(question: string): boolean {
  const pluralIndicators = [
    /\bmembers?\b/i,
    /\busers?\b/i,
    /\bpeople\b/i,
    /\beveryone\b/i,
    /\banyone\b/i,
    /\bwho all\b/i,
    /\ball of\b/i
  ];

  return pluralIndicators.some(pattern => pattern.test(question));
}
