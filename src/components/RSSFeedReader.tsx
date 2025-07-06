// src/components/RSSFeedReader.tsx
import React, { useEffect, useState } from 'react';
import { 
  ExternalLink, 
  RefreshCw, 
  Rss, 
  Calendar, 
  Tag, 
  AlertCircle,
  Plus,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { useRSSFeed } from '../hooks/useRSSFeed';
import { formatCurrency, formatDate } from '../utils/formatting';

interface RSSFeedReaderProps {
  query?: string;
  category?: string;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // in minutes
  onAddGrant?: (grant: any) => void;
  showAddButton?: boolean;
}

const RSSFeedReader: React.FC<RSSFeedReaderProps> = ({ 
  query = '',
  category, 
  limit = 10, 
  autoRefresh = false,
  refreshInterval = 30,
  onAddGrant,
  showAddButton = false
}) => {
  const { feedData, loading, error, searchRSSFeeds, clearError } = useRSSFeed();
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    if (query || category) {
      searchRSSFeeds(query, category, limit);
      setLastRefresh(new Date());
    }
  }, [searchRSSFeeds, query, category, limit]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      if (query || category) {
        searchRSSFeeds(query, category, limit);
        setLastRefresh(new Date());
      }
    }, refreshInterval * 60 * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, searchRSSFeeds, query, category, limit]);

  const handleRefresh = () => {
    if (query || category) {
      searchRSSFeeds(query, category, limit);
      setLastRefresh(new Date());
    }
  };

  const handleAddGrant = (rssGrant: any) => {
    if (!onAddGrant) return;
    
    const grant = {
      title: rssGrant.title,
      funder: rssGrant.funder,
      amount: rssGrant.amount,
      deadline: rssGrant.deadline,
      status: 'researching' as const,
      matchPercentage: rssGrant.matchPercentage,
      category: rssGrant.category,
      description: rssGrant.description,
      requirements: rssGrant.requirements,
      applicationDate: null,
      submittedDate: null,
      lastUpdate: new Date().toISOString().split('T')[0],
      source: `RSS: ${rssGrant.source}`,
      url: rssGrant.url,
      funderType: rssGrant.funderType
    };
    
    onAddGrant(grant);
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 text-red-700 mb-2">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">RSS Feed Error</span>
        </div>
        <p className="text-red-600 text-sm mb-3">{error}</p>
        <div className="flex space-x-2">
          <button
            onClick={handleRefresh}
            className="text-red-700 hover:text-red-900 text-sm underline"
          >
            Try Again
          </button>
          <button
            onClick={clearError}
            className="text-red-700 hover:text-red-900 text-sm underline"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Rss className="h-5 w-5 text-orange-600" />
          <h3 className="text-lg font-semibold">RSS Grant Feed</h3>
          {category && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
              {category}
            </span>
          )}
          {query && (
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
              "{query}"
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {lastRefresh && (
            <span className="text-sm text-gray-500">
              Updated: {formatRelativeTime(lastRefresh.toISOString())}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
            title="Refresh feed"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feed Stats */}
      {feedData && (
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span className="flex items-center space-x-1">
                <TrendingUp className="h-4 w-4" />
                <span>{feedData.totalFound} opportunities</span>
              </span>
              {feedData.sources && (
                <span className="flex items-center space-x-1">
                  <Rss className="h-4 w-4" />
                  <span>{feedData.sources.length} sources</span>
                </span>
              )}
            </div>
            <span>Last updated: {formatRelativeTime(feedData.timestamp)}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && !feedData && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white border rounded-lg p-4">
              <div className="bg-gray-200 h-4 rounded w-3/4 mb-2"></div>
              <div className="bg-gray-200 h-3 rounded w-1/2 mb-2"></div>
              <div className="bg-gray-200 h-3 rounded w-full"></div>
            </div>
          ))}
        </div>
      )}

      {/* RSS Items */}
      {feedData && feedData.results.length > 0 && (
        <div className="space-y-4">
          {feedData.results.map((item, index) => (
            <div key={item.id || index} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-medium text-gray-900 leading-tight">
                      {item.title}
                    </h4>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      {item.matchPercentage}% match
                    </span>
                  </div>
                  
                  <p className="text-gray-700 font-medium text-sm mb-1">{item.funder}</p>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {item.description}
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-500 mb-3">
                    <div className="flex items-center space-x-1">
                      <DollarSign className="h-3 w-3" />
                      <span>{item.amount > 0 ? formatCurrency(item.amount) : 'Amount TBD'}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(item.deadline)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Tag className="h-3 w-3" />
                      <span>{item.funderType}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Rss className="h-3 w-3" />
                      <span>{item.source}</span>
                    </div>
                    <span>Published: {formatRelativeTime(item.pubDate)}</span>
                  </div>
                </div>
                
                <div className="ml-4 flex flex-col space-y-2">
                  {showAddButton && onAddGrant && (
                    <button
                      onClick={() => handleAddGrant(item)}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center space-x-1 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add</span>
                    </button>
                  )}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-blue-600 hover:text-blue-800 transition-colors"
                    title="View opportunity"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {feedData && feedData.results.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Rss className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No grant opportunities found in RSS feeds.</p>
          {query && (
            <p className="text-sm mt-1">Try a different search term or category.</p>
          )}
          <button
            onClick={handleRefresh}
            className="mt-2 text-blue-600 hover:text-blue-800 text-sm underline"
          >
            Refresh feeds
          </button>
        </div>
      )}
    </div>
  );
};

export default RSSFeedReader;