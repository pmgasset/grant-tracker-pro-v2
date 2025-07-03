import React, { useState, useEffect } from 'react';
import { 
  Rss, 
  Database, 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Settings
} from 'lucide-react';

interface RSSStatus {
  rssFeeds: number;
  websites: number;
  lastRun: string;
  cacheStatus: string;
  uptime: string;
}

interface SourceStatus {
  name: string;
  url: string;
  status: 'active' | 'error' | 'slow';
  lastUpdate: string;
  resultCount: number;
  responseTime: number;
  errorMessage?: string;
}

interface MonitoringData {
  status: RSSStatus;
  sources: SourceStatus[];
  performance: {
    avgResponseTime: number;
    successRate: number;
    totalRequests: number;
    cacheHitRate: number;
  };
  recentActivity: Array<{
    timestamp: string;
    action: string;
    source: string;
    result: string;
  }>;
}

const RSSMonitoringDashboard: React.FC = (): JSX.Element => {
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchMonitoringData = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Fetch status from RSS scraper
      const statusResponse = await fetch('/api/rss-scraper?action=status');
      const status = await statusResponse.json();

      // Simulate additional monitoring data
      const mockData: MonitoringData = {
        status,
        sources: [
          {
            name: 'Grants.gov Federal',
            url: 'https://grants.gov/rss',
            status: 'active',
            lastUpdate: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            resultCount: 45,
            responseTime: 1200
          },
          {
            name: 'NSF Research Grants',
            url: 'https://nsf.gov/rss',
            status: 'active',
            lastUpdate: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
            resultCount: 23,
            responseTime: 800
          },
          {
            name: 'Ford Foundation',
            url: 'https://fordfoundation.org/grants',
            status: 'slow',
            lastUpdate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            resultCount: 12,
            responseTime: 3400
          },
          {
            name: 'Gates Foundation',
            url: 'https://gatesfoundation.org/grants',
            status: 'error',
            lastUpdate: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            resultCount: 0,
            responseTime: 0,
            errorMessage: 'Connection timeout'
          }
        ],
        performance: {
          avgResponseTime: 1350,
          successRate: 87.5,
          totalRequests: 248,
          cacheHitRate: 73.2
        },
        recentActivity: [
          {
            timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            action: 'RSS Scan',
            source: 'Grants.gov',
            result: '15 new grants found'
          },
          {
            timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
            action: 'Website Scrape',
            source: 'Ford Foundation',
            result: '3 new opportunities'
          },
          {
            timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
            action: 'Cache Refresh',
            source: 'System',
            result: 'Cache updated successfully'
          }
        ]
      };

      setMonitoringData(mockData);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchMonitoringData, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getStatusIcon = (status: string): JSX.Element => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'slow':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'slow':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffMinutes < 1440) {
      return `${Math.floor(diffMinutes / 60)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Loading state
  if (!monitoringData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  // Main component render
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center space-x-2">
            <Activity className="h-6 w-6 text-blue-600" />
            <span>RSS & Web Scraping Monitor</span>
          </h2>
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span>Auto-refresh</span>
            </label>
            <button
              onClick={fetchMonitoringData}
              disabled={isLoading}
              className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {lastRefresh && (
          <p className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-gray-600">Success Rate</span>
          </div>
          <div className="text-2xl font-bold text-green-600">
            {monitoringData.performance.successRate}%
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-600">Avg Response</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {monitoringData.performance.avgResponseTime}ms
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Database className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-600">Cache Hit Rate</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {monitoringData.performance.cacheHitRate}%
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="h-5 w-5 text-orange-600" />
            <span className="text-sm font-medium text-gray-600">Total Requests</span>
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {monitoringData.performance.totalRequests}
          </div>
        </div>
      </div>

      {/* Source Status */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Rss className="h-5 w-5 text-blue-600" />
          <span>Source Status</span>
        </h3>
        
        <div className="space-y-3">
          {monitoringData.sources.map((source, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
              <div className="flex items-center space-x-3">
                {getStatusIcon(source.status)}
                <div>
                  <div className="font-medium">{source.name}</div>
                  <div className="text-sm text-gray-500">{source.url}</div>
                  {source.errorMessage && (
                    <div className="text-sm text-red-600">{source.errorMessage}</div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-4 text-sm">
                <div className="text-right">
                  <div className="font-medium">{source.resultCount} grants</div>
                  <div className="text-gray-500">{formatTime(source.lastUpdate)}</div>
                </div>
                
                <div className="text-right">
                  <div className="font-medium">{source.responseTime}ms</div>
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(source.status)}`}>
                    {source.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Clock className="h-5 w-5 text-blue-600" />
          <span>Recent Activity</span>
        </h3>
        
        <div className="space-y-3">
          {monitoringData.recentActivity.map((activity, index) => (
            <div key={index} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{activity.action}</span>
                  <span className="text-gray-500">from</span>
                  <span className="text-blue-600">{activity.source}</span>
                </div>
                <div className="text-sm text-gray-600">{activity.result}</div>
              </div>
              <div className="text-sm text-gray-500">
                {formatTime(activity.timestamp)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Settings className="h-5 w-5 text-blue-600" />
          <span>System Status</span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-1">RSS Feeds Monitored</div>
            <div className="text-xl font-bold">{monitoringData.status.rssFeeds}</div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600 mb-1">Websites Scraped</div>
            <div className="text-xl font-bold">{monitoringData.status.websites}</div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600 mb-1">Cache Status</div>
            <div className="text-xl font-bold text-green-600">{monitoringData.status.cacheStatus}</div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600 mb-1">System Uptime</div>
            <div className="text-xl font-bold text-blue-600">{monitoringData.status.uptime}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RSSMonitoringDashboard;