import { CacheData, Message } from '../types';
import { fetchAllMessages } from './dataFetcher';
import { processMessages, calculateStats } from '../utils/dataProcessor';

const CACHE_TTL_HOURS = parseInt(process.env.CACHE_TTL_HOURS || '1', 10);
const CACHE_TTL_MS = CACHE_TTL_HOURS * 60 * 60 * 1000;

class CacheManager {
  private cache: CacheData | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  /**
   * Get cached data, refresh if expired or not loaded
   */
  async getData(): Promise<CacheData> {
    // If cache doesn't exist or is expired, refresh it
    if (!this.cache || this.isCacheExpired()) {
      await this.refreshCache();
    }

    if (!this.cache) {
      throw new Error('Failed to load cache data');
    }

    return this.cache;
  }

  /**
   * Check if cache is expired
   */
  private isCacheExpired(): boolean {
    if (!this.cache) return true;

    const now = Date.now();
    const cacheAge = now - this.cache.lastUpdated.getTime();
    return cacheAge > CACHE_TTL_MS;
  }

  /**
   * Get time until next cache refresh
   */
  getNextRefreshTime(): Date | null {
    if (!this.cache) return null;

    return new Date(this.cache.lastUpdated.getTime() + CACHE_TTL_MS);
  }

  /**
   * Force cache refresh
   */
  async refreshCache(): Promise<void> {
    // If already refreshing, wait for that operation
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this._performRefresh();

    try {
      await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual cache refresh
   */
  private async _performRefresh(): Promise<void> {
    console.log('🔄 Refreshing cache...');
    const startTime = Date.now();

    try {
      // Fetch all messages
      const messages = await fetchAllMessages();

      // Process messages
      const messagesByUser = processMessages(messages);
      const stats = calculateStats(messages);

      // Update cache
      this.cache = {
        messages,
        messagesByUser,
        lastUpdated: new Date(),
        stats
      };

      const duration = Date.now() - startTime;
      console.log(`✅ Cache refreshed successfully in ${duration}ms`);
      console.log(`   Next refresh: ${this.getNextRefreshTime()?.toISOString()}`);
    } catch (error) {
      console.error('❌ Cache refresh failed:', error);
      throw error;
    }
  }

  /**
   * Get cache status
   */
  getCacheStatus() {
    return {
      loaded: this.cache !== null,
      messageCount: this.cache?.messages.length || 0,
      lastUpdated: this.cache?.lastUpdated.toISOString() || null,
      nextRefresh: this.getNextRefreshTime()?.toISOString() || null,
      isExpired: this.isCacheExpired(),
      isRefreshing: this.isRefreshing
    };
  }

  /**
   * Clear cache (mainly for testing)
   */
  clearCache(): void {
    this.cache = null;
    console.log('🗑️  Cache cleared');
  }
}

// Singleton instance
export const cacheManager = new CacheManager();
