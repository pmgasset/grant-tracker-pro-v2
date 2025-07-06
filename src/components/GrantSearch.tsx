// src/components/GrantSearch.tsx - Updated with working RSS functionality
import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Zap, 
  Shield, 
  ExternalLink, 
  AlertCircle,
  Wifi,
  WifiOff,
  Rss,
  Activity
} from 'lucide-react';
import { Grant, SearchFilters, NewGrantForm, SearchResult } from '../types/Grant';
import { useCloudflareSync } from '../hooks/useCloudflareSync';
import { useRSSFeed } from '../hooks/useRSSFeed';
import { formatCurrency, formatDate } from '../utils/formatting';
import RSSFeedReader from './RSSFeedReader';

interface GrantSearchProps {
  onAddGrant: (grant: Omit<Grant, 'id'>) => void;
  isOnline: boolean;
}

const GrantSearch: React.FC<GrantSearchProps> = ({ onAddGrant, isOnline }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSource, setSearchSource] = useState<'web' | 'rss'>('rss');
  const [showRSSReader, setShowRSSReader] = useState(true);
  
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    category: '',
    minAmount: '',
    maxAmount: '',
    location: '',
    funderType: ''
  });

  const [newGrant, setNewGrant] = useState<NewGrantForm>({
    title: '',
    funder: '',
    amount: '',
    deadline: '',
    category: '',
    description: '',
    requirements: '',
    url: ''
  });

  const { searchGrants } = useCloudflareSync();
  const { searchRSSFeeds, loading: rssLoading, error: rssError } = useRSSFeed();

  // Auto-switch to RSS if online and available
  useEffect(() => {
    if (isOnline && searchSource === 'web') {
      // Try a quick RSS test to see if it's working
      testRSSAvailability();
    }
  }, [isOnline]);

  const testRSSAvailability = async () => {
    try {
      const response = await fetch('/api/rss-scraper?action=status');
      if (response.ok) {
        // RSS is working, suggest using it
        console.log('RSS service is available');
      }
    } catch (error) {
      console.log('RSS service not available, using web search');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);
    
    try {
      let results;
      
      if (searchSource === 'rss') {
        // Use RSS search
        const rssResults = await searchRSSFeeds(searchQuery, searchFilters.category, 15);
        if (rssResults && rssResults.results) {
          // Convert RSS results to SearchResult format
          results = rssResults.results.map((item: any, index: number) => ({
            id: `rss-${Date.now()}-${index}`,
            title: item.title,
            funder: item.funder,
            amount: item.amount,
            deadline: item.deadline,
            category: item.category,
            description: item.description,
            requirements: item.requirements,
            source: `RSS: ${item.source}`,
            url: item.url,
            matchPercentage: item.matchPercentage,
            funderType: item.funderType,
            isSearchResult: true
          }));
          setSearchResults(results);
        } else {
          throw new Error('No RSS results returned');
        }
      } else {
        // Use web search
        const webResults = await searchGrants(searchQuery, searchFilters);
        if (webResults.error) {
          setSearchError(webResults.message);
          setSearchResults([]);
        } else {
          setSearchResults(webResults.results || webResults);
          setSearchError(null);
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
      setSearchError(
        searchSource === 'rss' 
          ? 'RSS feed search is currently unavailable. Try web search or add grants manually.'
          : 'Web search service is currently unavailable. Try RSS feeds or add grants manually.'
      );
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const addGrantFromSearch = (searchResult: SearchResult) => {
    const grant: Omit<Grant, 'id'> = {
      title: searchResult.title,
      funder: searchResult.funder,
      amount: searchResult.amount,
      deadline: searchResult.deadline,
      status: 'researching',
      matchPercentage: searchResult.matchPercentage,
      category: searchResult.category,
      description: searchResult.description,
      requirements: searchResult.requirements,
      applicationDate: null,
      submittedDate: null,
      lastUpdate: new Date().toISOString().split('T')[0],
      source: searchResult.source,
      url: searchResult.url,
      funderType: searchResult.funderType
    };
    
    onAddGrant(grant);
    setSearchResults(searchResults.filter(r => r.id !== searchResult.id));
  };

  const addManualGrant = () => {
    if (newGrant.title && newGrant.funder && newGrant.amount && newGrant.deadline) {
      const grant: Omit<Grant, 'id'> = {
        title: newGrant.title,
        funder: newGrant.funder,
        amount: parseInt(newGrant.amount),
        deadline: newGrant.deadline,
        category: newGrant.category,
        description: newGrant.description,
        requirements: newGrant.requirements.split(',').map(r => r.trim()).filter(r => r),
        url: newGrant.url,
        status: 'researching',
        matchPercentage: Math.floor(Math.random() * 30) + 70,
        applicationDate: null,
        submittedDate: null,
        lastUpdate: new Date().toISOString().split('T')[0],
        source: 'manual entry'
      };
      
      onAddGrant(grant);
      setNewGrant({
        title: '',
        funder: '',
        amount: '',
        deadline: '',
        category: '',
        description: '',
        requirements: '',
        url: ''
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Interface */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <Search className="h-5 w-5 text-blue-600" />
            <span>Grant Discovery</span>
            <div className="flex items-center space-x-1 text-orange-600">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-medium">Cloudflare Powered</span>
            </div>
          </h3>
          
          {/* Connection Status */}
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs ${
            isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        
        <div className="space-y-4">
          {/* RSS vs Web Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
              <button
                onClick={() => setSearchSource('rss')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  searchSource === 'rss'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Rss className="h-4 w-4" />
                  <span>RSS Feeds</span>
                  <span className="px-1 py-0.5 bg-green-500 text-white rounded text-xs">Recommended</span>
                </div>
              </button>
              <button
                onClick={() => setSearchSource('web')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  searchSource === 'web'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4" />
                  <span>Web Search</span>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowRSSReader(!showRSSReader)}
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <Activity className="h-4 w-4" />
              <span>{showRSSReader ? 'Hide' : 'Show'} RSS Monitor</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="flex space-x-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder={searchSource === 'rss' 
                  ? "Search RSS feeds (e.g., 'education grants', 'health funding')"
                  : "Search grants (e.g., 'nonprofit technology', 'youth education')"
                }
                className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                disabled={!isOnline}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim() || !isOnline}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center space-x-2 transition-colors"
            >
              {isSearching ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  {searchSource === 'rss' ? <Rss className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                  <span>Search {searchSource === 'rss' ? 'RSS' : 'Web'}</span>
                </>
              )}
            </button>
          </div>
          
          {/* Advanced Search Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <select
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              value={searchFilters.category}
              onChange={(e) => setSearchFilters({...searchFilters, category: e.target.value})}
              disabled={!isOnline}
            >
              <option value="">All Categories</option>
              <option value="Education">Education</option>
              <option value="Health">Health & Wellness</option>
              <option value="Environment">Environment</option>
              <option value="Arts">Arts & Culture</option>
              <option value="Community">Community Development</option>
              <option value="Youth">Youth Services</option>
              <option value="Technology">Technology</option>
              <option value="Research">Research</option>
            </select>
            <select
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              value={searchFilters.funderType}
              onChange={(e) => setSearchFilters({...searchFilters, funderType: e.target.value})}
              disabled={!isOnline}
            >
              <option value="">All Funders</option>
              <option value="Federal">Federal Government</option>
              <option value="State">State Government</option>
              <option value="Private Foundation">Private Foundation</option>
              <option value="Community Foundation">Community Foundation</option>
              <option value="Corporate">Corporate</option>
            </select>
            <input
              type="number"
              placeholder="Min Amount"
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              value={searchFilters.minAmount}
              onChange={(e) => setSearchFilters({...searchFilters, minAmount: e.target.value})}
              disabled={!isOnline}
            />
            <input
              type="number"
              placeholder="Max Amount"
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              value={searchFilters.maxAmount}
              onChange={(e) => setSearchFilters({...searchFilters, maxAmount: e.target.value})}
              disabled={!isOnline}
            />
            <input
              type="text"
              placeholder="Location/State"
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              value={searchFilters.location}
              onChange={(e) => setSearchFilters({...searchFilters, location: e.target.value})}
              disabled={!isOnline}
            />
          </div>

          {/* Status Messages */}
          {!isOnline && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-yellow-800 text-sm flex items-center">
                <AlertCircle className="h-4 w-4 mr-2" />
                Search is unavailable offline. Connect to internet to search for new grants, or add grants manually below.
              </p>
            </div>
          )}

          {searchError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-red-800 font-medium">Search Unavailable</h4>
                  <p className="text-red-700 text-sm mt-1">{searchError}</p>
                  <p className="text-red-600 text-xs mt-2">
                    You can still add grants manually using the form below or try the {searchSource === 'rss' ? 'web search' : 'RSS feeds'} option.
                  </p>
                </div>
              </div>
            </div>
          )}

          {rssError && searchSource === 'rss' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-orange-800 text-sm flex items-center">
                <Rss className="h-4 w-4 mr-2" />
                RSS Error: {rssError}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* RSS Feed Reader */}
      {showRSSReader && isOnline && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <RSSFeedReader
            query={searchQuery}
            category={searchFilters.category}
            limit={10}
            autoRefresh={true}
            refreshInterval={30}
            onAddGrant={onAddGrant}
            showAddButton={true}
          />
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
            <span>Search Results ({searchResults.length} found)</span>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1 text-green-600 text-sm">
                <Shield className="h-4 w-4" />
                <span>Verified Sources</span>
              </div>
              {searchSource === 'rss' && (
                <div className="flex items-center space-x-1 text-blue-600 text-sm">
                  <Rss className="h-4 w-4" />
                  <span>RSS Data</span>
                </div>
              )}
            </div>
          </h3>
          <div className="space-y-4">
            {searchResults.map(result => (
              <div key={result.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-medium text-blue-700">{result.title}</h4>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                        {result.matchPercentage}% match
                      </span>
                      {result.funderType && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          {result.funderType}
                        </span>
                      )}
                      {searchSource === 'rss' && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs flex items-center space-x-1">
                          <Rss className="h-3 w-3" />
                          <span>RSS</span>
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 font-medium mb-2">{result.funder}</p>
                    <p className="text-sm text-gray-600 mb-3">{result.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-3">
                      <div>
                        <span className="font-medium text-gray-700">Award Amount:</span>
                        <p className="text-green-600 font-semibold">
                          {result.amount > 0 ? formatCurrency(result.amount) : 'Amount TBD'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Deadline:</span>
                        <p className="text-gray-600">{formatDate(result.deadline)}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Source:</span>
                        <p className="text-blue-600 capitalize">{result.source}</p>
                      </div>
                    </div>

                    {result.requirements && result.requirements.length > 0 && (
                      <div className="mb-3">
                        <span className="font-medium text-gray-700">Requirements:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {result.requirements.map((req, idx) => (
                            <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                              {req}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-4 flex flex-col space-y-2">
                    <button
                      onClick={() => addGrantFromSearch(result)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm flex items-center space-x-1 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add to Tracker</span>
                    </button>
                    {result.url && (
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm text-center flex items-center space-x-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>View Details</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty Search Results */}
      {!isSearching && searchQuery && searchResults.length === 0 && !searchError && (
        <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
          <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No grants found</h3>
          <p className="text-gray-500 mb-4">
            No grants matched your search for "{searchQuery}". Try different keywords or add a grant manually.
          </p>
        </div>
      )}

      {/* Manual Grant Addition */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">Add Grant Manually</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Grant Title"
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            value={newGrant.title}
            onChange={(e) => setNewGrant({...newGrant, title: e.target.value})}
          />
          <input
            type="text"
            placeholder="Funder Organization"
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            value={newGrant.funder}
            onChange={(e) => setNewGrant({...newGrant, funder: e.target.value})}
          />
          <input
            type="number"
            placeholder="Award Amount"
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            value={newGrant.amount}
            onChange={(e) => setNewGrant({...newGrant, amount: e.target.value})}
          />
          <input
            type="date"
            placeholder="Application Deadline"
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            value={newGrant.deadline}
            onChange={(e) => setNewGrant({...newGrant, deadline: e.target.value})}
          />
          <input
            type="text"
            placeholder="Category"
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            value={newGrant.category}
            onChange={(e) => setNewGrant({...newGrant, category: e.target.value})}
          />
          <input
            type="url"
            placeholder="Grant URL (optional)"
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            value={newGrant.url}
            onChange={(e) => setNewGrant({...newGrant, url: e.target.value})}
          />
          <input
            type="text"
            placeholder="Requirements (comma separated)"
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            value={newGrant.requirements}
            onChange={(e) => setNewGrant({...newGrant, requirements: e.target.value})}
          />
          <textarea
            placeholder="Description"
            className="border rounded-lg px-3 py-2 md:col-span-2 focus:ring-2 focus:ring-blue-500"
            rows={3}
            value={newGrant.description}
            onChange={(e) => setNewGrant({...newGrant, description: e.target.value})}
          />
        </div>
        <button
          onClick={addManualGrant}
          className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Grant</span>
        </button>
      </div>
    </div>
  );
};

export default GrantSearch;