// src/hooks/useCloudflareSync.ts - Updated with proper error handling
import { useCallback, useState } from 'react';
import { Grant } from '../types/Grant';

export const useCloudflareSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const saveToCloudflare = useCallback(async (grants: Grant[]) => {
    try {
      setIsSyncing(true);
      setLastError(null);
      
      const response = await fetch('/api/save-grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grants,
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.message);
      }

      if (response.ok) {
        setLastSyncTime(new Date());
        console.log('Data synced successfully');
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastError(errorMessage);
      console.log('Offline mode - data saved locally');
      
      // Save to localStorage as fallback
      try {
        localStorage.setItem('grants_backup', JSON.stringify({
          grants,
          timestamp: new Date().toISOString()
        }));
      } catch (storageError) {
        console.error('Failed to save to localStorage:', storageError);
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const loadFromCloudflare = useCallback(async (): Promise<Grant[]> => {
    try {
      setLastError(null);
      
      const response = await fetch('/api/load-grants');
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message);
      }

      if (response.ok) {
        if (data.timestamp) {
          setLastSyncTime(new Date(data.timestamp));
        }
        return data.grants || [];
      } else {
        throw new Error('Load failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastError(errorMessage);
      console.log('Loading from local backup');
      
      // Fallback to localStorage
      try {
        const backup = localStorage.getItem('grants_backup');
        if (backup) {
          const data = JSON.parse(backup);
          return data.grants || [];
        }
      } catch (storageError) {
        console.error('Failed to load from localStorage:', storageError);
      }
      
      return [];
    }
  }, []);

  const searchGrants = useCallback(async (query: string, filters: any) => {
    try {
      setLastError(null);
      
      const searchParams = new URLSearchParams({
        query,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value && value !== '')
        )
      });

      const response = await fetch(`/api/search-grants?${searchParams}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message);
      }

      if (response.ok) {
        return data.results || [];
      } else {
        throw new Error('Search failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Search service unavailable';
      setLastError(errorMessage);
      
      throw {
        error: true,
        message: errorMessage,
        results: []
      };
    }
  }, []);

  const searchRSSFeeds = useCallback(async (query: string, filters: any) => {
    try {
      setLastError(null);
      
      const searchParams = new URLSearchParams({
        query,
        action: 'search',
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value && value !== '')
        )
      });

      const response = await fetch(`/api/rss-scraper?${searchParams}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message);
      }

      if (response.ok) {
        return data.results || [];
      } else {
        throw new Error('RSS search failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'RSS service unavailable';
      setLastError(errorMessage);
      
      throw {
        error: true,
        message: errorMessage,
        results: []
      };
    }
  }, []);

  // Clear errors
  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  // Check if service is available
  const checkServiceHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/load-grants');
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  return {
    saveToCloudflare,
    loadFromCloudflare,
    searchGrants,
    searchRSSFeeds,
    checkServiceHealth,
    clearError,
    isSyncing,
    lastSyncTime,
    lastError
  };
};
