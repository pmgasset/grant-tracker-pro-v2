// src/hooks/useCloudflareSync.ts
import { useCallback, useState } from 'react';
import { Grant } from '../types/Grant';

export const useCloudflareSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const saveToCloudflare = useCallback(async (grants: Grant[]) => {
    try {
      setIsSyncing(true);
      
      // Try to save to Cloudflare Workers/KV
      const response = await fetch('/api/save-grants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grants,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        setLastSyncTime(new Date());
        console.log('Data synced to Cloudflare successfully');
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      console.log('Offline mode - data saved locally');
      // Save to localStorage as fallback
      localStorage.setItem('grants_backup', JSON.stringify({
        grants,
        timestamp: new Date().toISOString()
      }));
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const loadFromCloudflare = useCallback(async (): Promise<Grant[]> => {
    try {
      const response = await fetch('/api/load-grants');
      
      if (response.ok) {
        const data = await response.json();
        setLastSyncTime(new Date(data.timestamp));
        return data.grants || [];
      } else {
        throw new Error('Load failed');
      }
    } catch (error) {
      console.log('Loading from local backup');
      // Fallback to localStorage
      const backup = localStorage.getItem('grants_backup');
      if (backup) {
        const data = JSON.parse(backup);
        return data.grants || [];
      }
      return [];
    }
  }, []);

  const searchGrants = useCallback(async (query: string, filters: any) => {
    try {
      const searchParams = new URLSearchParams({
        query,
        ...filters
      });

      const response = await fetch(`/api/search-grants?${searchParams}`);
      
      if (response.ok) {
        const data = await response.json();
        return data.results || [];
      } else {
        throw new Error('Search failed');
      }
    } catch (error) {
      console.log('Search service unavailable');
      // Return empty results with error message instead of mock data
      return {
        error: true,
        message: 'Grant search service is currently unavailable. Please try again later or add grants manually.',
        results: []
      };
    }
  }, []);

  const searchRSSFeeds = useCallback(async (query: string, filters: any) => {
    try {
      const searchParams = new URLSearchParams({
        query,
        source: 'rss',
        ...filters
      });

      const response = await fetch(`/api/search-rss-grants?${searchParams}`);
      
      if (response.ok) {
        const data = await response.json();
        return data.results || [];
      } else {
        throw new Error('RSS search failed');
      }
    } catch (error) {
      console.log('RSS feed search service unavailable');
      return {
        error: true,
        message: 'RSS feed monitoring is currently unavailable. Please check your network connection.',
        results: []
      };
    }
  }, []);

  return {
    saveToCloudflare,
    loadFromCloudflare,
    searchGrants,
    searchRSSFeeds,
    isSyncing,
    lastSyncTime
  };
};