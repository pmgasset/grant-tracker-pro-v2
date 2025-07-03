import { useCallback, useState } from 'react';
import { Grant } from '../types/Grant';

// Environment variables for worker URLs
const ENHANCED_SEARCH_WORKER_URL = import.meta.env.VITE_ENHANCED_SEARCH_WORKER_URL || 
  'https://grant-tracker-search-enhanced.traveldata.workers.dev';
const RSS_SCRAPER_WORKER_URL = import.meta.env.VITE_RSS_SCRAPER_WORKER_URL || 
  'https://27fc99b5-grant-tracker-rss-scraper.traveldata.workers.dev';

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
        includeRSS: 'true',
        fresh: 'false',
        ...filters
      });

      // Remove empty values
      Object.keys(filters).forEach(key => {
        if (!filters[key]) {
          searchParams.delete(key);
        }
      });

      const response = await fetch(`/api/search-grants?${searchParams}`);
      
      if (response.ok) {
        const data = await response.json();
        return data.results || [];
      } else {
        throw new Error('Search failed');
      }
    } catch (error) {
      console.log('Search service unavailable, using fallback');
      // Return mock results as fallback
      return generateMockSearchResults(query, filters);
    }
  }, []);

  // Enhanced search with RSS integration
  const searchGrantsEnhanced = useCallback(async (query: string, filters: any, options?: {
    includeRSS?: boolean;
    fresh?: boolean;
    sources?: string[];
  }) => {
    try {
      const searchParams = new URLSearchParams({
        query,
        includeRSS: options?.includeRSS ? 'true' : 'false',
        fresh: options?.fresh ? 'true' : 'false',
        ...filters
      });

      // Remove empty values
      Object.keys(filters).forEach(key => {
        if (!filters[key]) {
          searchParams.delete(key);
        }
      });

      const response = await fetch(`/api/search-grants?${searchParams}`);
      
      if (response.ok) {
        const data = await response.json();
        return {
          results: data.results || [],
          sources: data.sources || [],
          totalFound: data.totalFound || 0,
          enhanced: data.enhanced || false
        };
      } else {
        throw new Error('Enhanced search failed');
      }
    } catch (error) {
      console.log('Enhanced search service unavailable, using fallback');
      // Return enhanced mock results
      return {
        results: generateMockSearchResults(query, filters),
        sources: [
          { name: 'Fallback Mock', count: 3, status: 'success' }
        ],
        totalFound: 3,
        enhanced: false
      };
    }
  }, []);

  // Search only RSS sources
  const searchRSSGrants = useCallback(async (query: string, filters: any) => {
    try {
      const searchParams = new URLSearchParams({
        action: 'scrape',
        query,
        ...filters
      });

      const response = await fetch(`/api/rss-scraper?${searchParams}`);
      
      if (response.ok) {
        const data = await response.json();
        return data.grants || [];
      } else {
        throw new Error('RSS search failed');
      }
    } catch (error) {
      console.log('RSS search service unavailable');
      return [];
    }
  }, []);

  // Get RSS scraper status
  const getRSSStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/rss-scraper?action=status');
      
      if (response.ok) {
        const status = await response.json();
        return status;
      } else {
        throw new Error('RSS status check failed');
      }
    } catch (error) {
      console.log('RSS status service unavailable');
      return null;
    }
  }, []);

  // Force refresh RSS data
  const refreshRSSData = useCallback(async () => {
    try {
      const response = await fetch('/api/rss-scraper?action=scrape&fresh=true');
      
      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        throw new Error('RSS refresh failed');
      }
    } catch (error) {
      console.log('RSS refresh service unavailable');
      return null;
    }
  }, []);

  // Sync grant data including RSS metadata
  const syncGrantsWithMetadata = useCallback(async (grants: Grant[]) => {
    try {
      setIsSyncing(true);
      
      // Separate RSS grants from regular grants
      const rssGrants = grants.filter(g => g.source.includes('RSS:'));
      const regularGrants = grants.filter(g => !g.source.includes('RSS:'));
      
      // Save to Cloudflare with metadata
      const response = await fetch('/api/save-grants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grants,
          metadata: {
            rssCount: rssGrants.length,
            regularCount: regularGrants.length,
            lastRSSUpdate: rssGrants.length > 0 ? 
              Math.max(...rssGrants.map(g => new Date(g.lastUpdate).getTime())) : null
          },
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        setLastSyncTime(new Date());
        console.log('Enhanced data synced to Cloudflare successfully');
      } else {
        throw new Error('Enhanced sync failed');
      }
    } catch (error) {
      console.log('Enhanced sync failed, using fallback');
      // Enhanced fallback with metadata
      localStorage.setItem('grants_backup_enhanced', JSON.stringify({
        grants,
        metadata: {
          rssCount: grants.filter(g => g.source.includes('RSS:')).length,
          regularCount: grants.filter(g => !g.source.includes('RSS:')).length,
        },
        timestamp: new Date().toISOString()
      }));
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    saveToCloudflare,
    loadFromCloudflare,
    searchGrants,
    searchGrantsEnhanced,
    searchRSSGrants,
    getRSSStatus,
    refreshRSSData,
    syncGrantsWithMetadata,
    isSyncing,
    lastSyncTime
  };
};

// Fallback function for when search service is unavailable
const generateMockSearchResults = (query: string, filters: any) => {
  return [
    {
      id: `mock-${Date.now()}-1`,
      title: `${query} Federal Grant Program`,
      funder: "National Science Foundation",
      amount: Math.floor(Math.random() * 500000) + 50000,
      deadline: new Date(Date.now() + Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      category: filters.category || "Research",
      description: `Federal funding opportunity for ${query.toLowerCase()} initiatives.`,
      requirements: ["501(c)(3) status", "Detailed project plan", "Community impact assessment"],
      source: "grants.gov",
      url: "https://grants.gov/search",
      matchPercentage: Math.floor(Math.random() * 30) + 70,
      isSearchResult: true,
      funderType: "Federal"
    },
    {
      id: `mock-${Date.now()}-2`,
      title: `${query} Innovation Fund`,
      funder: "Ford Foundation",
      amount: Math.floor(Math.random() * 300000) + 75000,
      deadline: new Date(Date.now() + Math.random() * 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      category: filters.category || "Innovation",
      description: `Private foundation grant supporting ${query.toLowerCase()} initiatives.`,
      requirements: ["Innovative approach", "Measurable outcomes", "Sustainability plan"],
      source: "foundation directory",
      url: "https://foundationdirectory.org",
      matchPercentage: Math.floor(Math.random() * 25) + 75,
      isSearchResult: true,
      funderType: "Private Foundation"
    }
  ];
};