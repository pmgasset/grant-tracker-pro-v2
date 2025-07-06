// src/hooks/useRSSSettings.ts - Updated to handle errors properly
import { useState, useEffect, useCallback } from 'react';

export interface RSSSettings {
  enabled: boolean;
  websiteScrapingEnabled: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  feedCount: number;
  websiteCount: number;
  lastUpdate: string | null;
  categories: string[];
  excludedSources: string[];
  minGrantAmount: number;
  maxGrantAmount: number;
  enabledSources: {
    federal: boolean;
    foundation: boolean;
    state: boolean;
    corporate: boolean;
  };
}

const DEFAULT_RSS_SETTINGS: RSSSettings = {
  enabled: false, // Disabled by default since it's not implemented
  websiteScrapingEnabled: false,
  autoRefresh: false,
  refreshInterval: 360,
  feedCount: 0,
  websiteCount: 0,
  lastUpdate: null,
  categories: [],
  excludedSources: [],
  minGrantAmount: 1000,
  maxGrantAmount: 10000000,
  enabledSources: {
    federal: true,
    foundation: true,
    state: true,
    corporate: false
  }
};

export const useRSSSettings = () => {
  const [rssSettings, setRSSSettings] = useState<RSSSettings>(DEFAULT_RSS_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load settings from localStorage on component mount
  useEffect(() => {
    const loadSettings = () => {
      try {
        const savedSettings = localStorage.getItem('rss_settings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          setRSSSettings(prev => ({
            ...prev,
            ...parsed,
            // Keep RSS disabled until it's implemented
            enabled: false,
            websiteScrapingEnabled: false,
            autoRefresh: false,
            enabledSources: {
              ...DEFAULT_RSS_SETTINGS.enabledSources,
              ...parsed.enabledSources
            }
          }));
        }
      } catch (error) {
        console.error('Failed to load RSS settings:', error);
        setError('Failed to load RSS settings from local storage');
      }
    };

    loadSettings();
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('rss_settings', JSON.stringify(rssSettings));
      setError(null);
    } catch (error) {
      console.error('Failed to save RSS settings:', error);
      setError('Failed to save RSS settings');
    }
  }, [rssSettings]);

  // Update RSS settings
  const updateRSSSettings = useCallback((updates: Partial<RSSSettings>) => {
    setRSSSettings(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  // Force refresh RSS data (currently returns error)
  const forceRefreshRSS = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/rss-scraper?action=scrape&fresh=true');
      const data = await response.json();
      
      if (data.error) {
        setError(data.message);
        return null;
      }
      
      // If successful, update settings
      updateRSSSettings({ 
        lastUpdate: new Date().toISOString(),
        feedCount: data.feedCount || 0,
        websiteCount: data.websiteCount || 0
      });
      
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'RSS refresh failed';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [updateRSSSettings]);

  // Get RSS status
  const getRSSStatus = useCallback(async () => {
    setError(null);
    
    try {
      const response = await fetch('/api/rss-scraper?action=status');
      const data = await response.json();
      
      if (data.error) {
        setError(data.message);
        return null;
      }
      
      // Update settings with status info
      updateRSSSettings({
        feedCount: data.rssFeeds || 0,
        websiteCount: data.websites || 0,
        lastUpdate: data.lastRun !== 'Never' ? data.lastRun : null
      });
      
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get RSS status';
      setError(errorMessage);
      return null;
    }
  }, [updateRSSSettings]);

  // Reset settings to defaults
  const resetSettings = useCallback(() => {
    setRSSSettings(DEFAULT_RSS_SETTINGS);
    localStorage.removeItem('rss_settings');
    setError(null);
  }, []);

  // Get RSS-related statistics
  const getRSSStats = useCallback(() => {
    return {
      totalSources: rssSettings.feedCount + rssSettings.websiteCount,
      activeSources: Object.values(rssSettings.enabledSources).filter(Boolean).length,
      lastUpdateTime: rssSettings.lastUpdate ? new Date(rssSettings.lastUpdate) : null,
      isAutoRefreshEnabled: rssSettings.autoRefresh,
      refreshIntervalHours: rssSettings.refreshInterval / 60,
      isConfigured: rssSettings.enabled
    };
  }, [rssSettings]);

  // Check if RSS is properly configured
  const isRSSConfigured = useCallback(() => {
    return false; // Always false until RSS is implemented
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    rssSettings,
    updateRSSSettings,
    forceRefreshRSS,
    getRSSStatus,
    getRSSStats,
    resetSettings,
    isRSSConfigured,
    clearError,
    isLoading,
    lastSyncTime,
    error
  };
};