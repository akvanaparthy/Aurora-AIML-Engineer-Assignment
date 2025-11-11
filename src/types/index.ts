// API Response Types
export interface Message {
  id: string;
  user_id: string;
  user_name: string;
  timestamp: string;
  message: string;
}

export interface MessagesResponse {
  total: number;
  items: Message[];
}

// Cache Types
export interface CacheData {
  messages: Message[];
  messagesByUser: Map<string, Message[]>;
  lastUpdated: Date;
  stats: DataStats;
}

export interface DataStats {
  totalMessages: number;
  uniqueUsers: number;
  dateRange: {
    earliest: string;
    latest: string;
  };
  userMessageCounts: Record<string, number>;
}

// API Request/Response Types
export interface AskRequest {
  question: string;
}

export interface AskResponse {
  answer: string;
  confidence?: 'high' | 'medium' | 'low';
  sources?: number;
  references?: MessageReference[];
  further_recommendation?: string;
}

export interface MessageReference {
  user: string;
  date: string;
  excerpt: string;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  cache: {
    loaded: boolean;
    messageCount: number;
    lastUpdated: string | null;
  };
  api: {
    connected: boolean;
  };
  timestamp: string;
}

export interface StatsResponse {
  totalMessages: number;
  uniqueUsers: number;
  dateRange: {
    earliest: string;
    latest: string;
  };
  topMembers: Array<{
    name: string;
    messageCount: number;
  }>;
  cacheStatus: {
    lastUpdated: string;
    nextRefresh: string;
  };
}

// Claude API Types
export interface ClaudeContext {
  relevantMessages: Message[];
  userFilter?: string;
}
