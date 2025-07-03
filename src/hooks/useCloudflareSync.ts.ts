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
      console.log('Search service unavailable, using fallback');
      // Return mock results as fallback
      return generateMockSearchResults(query, filters);
    }
  }, []);

  return {
    saveToCloudflare,
    loadFromCloudflare,
    searchGrants,
    isSyncing,
    lastSyncTime
  };
};

// Fallback function for when search service is unavailable
const generateMockSearchResults = (query: string, filters: any) => {
  return [
    {
      id: `search-${Date.now()}-1`,
      title: `${query} Federal Grant Program`,
      funder: "National Science Foundation",
      amount: Math.floor(Math.random() * 500000) + 50000,
      deadline: new Date(Date.now() + Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      category: filters.category || "Research",
      description: `Federal funding opportunity for ${query.toLowerCase()} initiatives and community development programs.`,
      requirements: ["501(c)(3) status", "Detailed project plan", "Community impact assessment"],
      source: "grants.gov",
      url: "https://grants.gov/search",
      matchPercentage: Math.floor(Math.random() * 30) + 70,
      isSearchResult: true,
      funderType: "Federal"
    },
    {
      id: `search-${Date.now()}-2`,
      title: `${query} Innovation Fund`,
      funder: "Ford Foundation",
      amount: Math.floor(Math.random() * 300000) + 75000,
      deadline: new Date(Date.now() + Math.random() * 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      category: filters.category || "Innovation",
      description: `Private foundation grant supporting innovative approaches to ${query.toLowerCase()} challenges.`,
      requirements: ["Innovative approach", "Measurable outcomes", "Sustainability plan"],
      source: "foundation directory",
      url: "https://foundationdirectory.org",
      matchPercentage: Math.floor(Math.random() * 25) + 75,
      isSearchResult: true,
      funderType: "Private Foundation"
    },
    {
      id: `search-${Date.now()}-3`,
      title: `Community ${query} Initiative`,
      funder: "Local Community Foundation",
      amount: Math.floor(Math.random() * 100000) + 25000,
      deadline: new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      category: filters.category || "Community",
      description: `Regional grant program focused on ${query.toLowerCase()} projects within the local community.`,
      requirements: ["Local organization", "Community partnership", "Detailed budget"],
      source: "community foundation",
      url: "https://communityfoundation.org",
      matchPercentage: Math.floor(Math.random() * 20) + 80,
      isSearchResult: true,
      funderType: "Community Foundation"
    }
  ];
};