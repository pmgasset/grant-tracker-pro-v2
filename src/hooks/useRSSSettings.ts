// src/hooks/useRSSSettings.ts
import { useState, useEffect, useCallback } from 'react';

export interface RSSSettings {
  enabled: boolean;
  websiteScrapingEnabled: boolean;
  autoRefresh: boolean;
  refreshInterval: number; // in minutes
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
  enabled: true,
  websiteScrapingEnabled: true,
  autoRefresh: true,
  refreshInterval: 360, // 6 hours
  feedCount: 7,
  websiteCount: 3,
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
            // Ensure we have default values for new settings
            enabledSources: {
              ...DEFAULT_RSS_SETTINGS.enabledSources,
              ...parsed.enabledSources
            }
          }));
        }
      } catch (error) {
        console.error('Failed to load RSS settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('rss_settings', JSON.stringify(rssSettings));
    } catch (error) {
      console.error('Failed to save RSS settings:', error);
    }
  }, [rssSettings]);

  // Sync settings with Cloudflare Workers
  const syncSettingsWithWorkers = useCallback(async (settings: RSSSettings) => {
    if (!settings.enabled) return;

    setIsLoading(true);
    try {
      // Send settings to RSS scraper worker
      const response = await fetch('/api/rss-scraper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update-settings',
          settings: {
            enabled: settings.enabled,
            websiteScrapingEnabled: settings.websiteScrapingEnabled,
            autoRefresh: settings.autoRefresh,
            refreshInterval: settings.refreshInterval,
            categories: settings.categories,
            excludedSources: settings.excludedSources,
            minGrantAmount: settings.minGrantAmount,
            maxGrantAmount: settings.maxGrantAmount,
            enabledSources: settings.enabledSources
          }
        })
      });

      if (response.ok) {
        setLastSyncTime(new Date());
        console.log('RSS settings synced successfully');
      } else {
        console.warn('Failed to sync RSS settings');
      }
    } catch (error) {
      console.error('RSS settings sync error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update RSS settings
  const updateRSSSettings = useCallback((updates: Partial<RSSSettings>) => {
    setRSSSettings(prev => {
      const newSettings = { ...prev, ...updates };
      
      // Auto-sync with workers when certain settings change
      if (updates.enabled !== undefined || 
          updates.websiteScrapingEnabled !== undefined || 
          updates.categories !== undefined ||
          updates.enabledSources !== undefined) {
        syncSettingsWithWorkers(newSettings);
      }
      
      return newSettings;
    });
  }, [syncSettingsWithWorkers]);

  // Force refresh RSS data
  const forceRefreshRSS = useCallback(async () => {
    if (!rssSettings.enabled) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/rss-scraper?action=scrape&fresh=true');
      if (response.ok) {
        const data = await response.json();
        updateRSSSettings({ 
          lastUpdate: new Date().toISOString(),
          feedCount: data.sources?.find((s: any) => s.name.includes('RSS'))?.count || rssSettings.feedCount,
          websiteCount: data.sources?.find((s: any) => s.name.includes('Website'))?.count || rssSettings.websiteCount
        });
        return data;
      }
    } catch (error) {
      console.error('Failed to force refresh RSS:', error);
    } finally {
      setIsLoading(false);
    }
  }, [rssSettings.enabled, updateRSSSettings]);

  // Get RSS status
  const getRSSStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/rss-scraper?action=status');
      if (response.ok) {
        const status = await response.json();
        updateRSSSettings({
          feedCount: status.rssFeeds || rssSettings.feedCount,
          websiteCount: status.websites || rssSettings.websiteCount,
          lastUpdate: status.lastRun !== 'Never' ? status.lastRun : rssSettings.lastUpdate
        });
        return status;
      }
    } catch (error) {
      console.error('Failed to get RSS status:', error);
    }
    return null;
  }, [updateRSSSettings, rssSettings.feedCount, rssSettings.websiteCount, rssSettings.lastUpdate]);

  // Auto-refresh RSS data based on settings
  useEffect(() => {
    if (!rssSettings.enabled || !rssSettings.autoRefresh) return;

    const interval = setInterval(() => {
      forceRefreshRSS();
    }, rssSettings.refreshInterval * 60 * 1000);

    return () => clearInterval(interval);
  }, [rssSettings.enabled, rssSettings.autoRefresh, rssSettings.refreshInterval, forceRefreshRSS]);

  // Get initial RSS status on mount
  useEffect(() => {
    if (rssSettings.enabled) {
      getRSSStatus();
    }
  }, [rssSettings.enabled, getRSSStatus]);

  // Reset settings to defaults
  const resetSettings = useCallback(() => {
    setRSSSettings(DEFAULT_RSS_SETTINGS);
    localStorage.removeItem('rss_settings');
  }, []);

  // Get RSS-related statistics
  const getRSSStats = useCallback(() => {
    return {
      totalSources: rssSettings.feedCount + rssSettings.websiteCount,
      activeSources: Object.values(rssSettings.enabledSources).filter(Boolean).length,
      lastUpdateTime: rssSettings.lastUpdate ? new Date(rssSettings.lastUpdate) : null,
      isAutoRefreshEnabled: rssSettings.autoRefresh,
      refreshIntervalHours: rssSettings.refreshInterval / 60
    };
  }, [rssSettings]);

  // Check if RSS is properly configured
  const isRSSConfigured = useCallback(() => {
    return rssSettings.enabled && 
           (rssSettings.feedCount > 0 || rssSettings.websiteCount > 0) &&
           Object.values(rssSettings.enabledSources).some(Boolean);
  }, [rssSettings]);

  return {
    rssSettings,
    updateRSSSettings,
    forceRefreshRSS,
    getRSSStatus,
    getRSSStats,
    resetSettings,
    isRSSConfigured,
    isLoading,
    lastSyncTime
  };
};