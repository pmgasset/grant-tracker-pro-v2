// src/hooks/useRSSFeed.ts
import { useState, useCallback } from 'react';

interface RSSGrant {
  id: string;
  title: string;
  funder: string;
  amount: number;
  deadline: string;
  category: string;
  description: string;
  requirements: string[];
  source: string;
  url: string;
  matchPercentage: number;
  funderType: string;
  pubDate: string;
}

interface RSSFeedData {
  results: RSSGrant[];
  totalFound: number;
  timestamp: string;
  sources?: Array<{
    name: string;
    count: number;
  }>;
}

interface RSSStatus {
  rssFeeds: number;
  websites: number;
  lastRun: string;
  cacheStatus: string;
  uptime: string;
  feeds: Array<{
    name: string;
    url: string;
    category: string;
    status: string;
    lastUpdate: string;
  }>;
}

export const useRSSFeed = () => {
  const [feedData, setFeedData] = useState<RSSFeedData | null>(null);
  const [status, setStatus] = useState<RSSStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchRSSFeeds = useCallback(async (query: string, category?: string, limit?: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        action: 'search',
        query: query || '',
        ...(category && { category }),
        ...(limit && { limit: limit.toString() })
      });
      
      const response = await fetch(`/api/rss-scraper?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message || 'RSS search failed');
      }
      
      setFeedData(data);
      return data;
    } catch (err) {
      console.error('RSS search error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to search RSS feeds';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const getRSSStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/rss-scraper?action=status');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setStatus(data);
      return data;
    } catch (err) {
      console.error('RSS status error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to get RSS status';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const scrapeFeeds = useCallback(async (query?: string, category?: string, fresh?: boolean) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        action: 'scrape',
        ...(query && { query }),
        ...(category && { category }),
        ...(fresh && { fresh: 'true' })
      });
      
      const response = await fetch(`/api/rss-scraper?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setFeedData(data);
      return data;
    } catch (err) {
      console.error('RSS scrape error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to scrape RSS feeds';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    feedData,
    status,
    loading,
    error,
    searchRSSFeeds,
    getRSSStatus,
    scrapeFeeds,
    clearError: () => setError(null)
  };
};
