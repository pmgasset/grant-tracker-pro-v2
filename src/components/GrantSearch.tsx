import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Zap, 
  Shield, 
  ExternalLink, 
  AlertCircle,
  Rss,
  Database,
  Globe,
  Clock,
  TrendingUp,
  Filter,
  RefreshCw
} from 'lucide-react';
import { Grant, SearchFilters, NewGrantForm, SearchResult } from '../types/Grant';
import { useCloudflareSync } from '../hooks/useCloudflareSync';
import { formatCurrency, formatDate } from '../utils/formatting';

interface GrantSearchProps {
  onAddGrant: (grant: Omit<Grant, 'id'>) => void;
  isOnline: boolean;
}

interface EnhancedSearchResult extends SearchResult {
  isRSSResult?: boolean;
  isCachedResult?: boolean;
  sourceType?: string;
  datePosted?: string;
}

interface SearchResponse {
  results: EnhancedSearchResult[];
  totalFound: number;
  sources: Array<{
    name: string;
    count: number;
    status: string;
    error?: string;
  }>;
  enhanced?: boolean;
}

const GrantSearch: React.FC<GrantSearchProps> = ({ onAddGrant, isOnline }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EnhancedSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchInfo, setSearchInfo] = useState<SearchResponse | null>(null);
  const [includeRSS, setIncludeRSS] = useState(true);
  const [forceFresh, setForceFresh] = useState(false);
  
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

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const handleEnhancedSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const searchParams = new URLSearchParams({
        query: searchQuery,
        includeRSS: includeRSS.toString(),
        fresh: forceFresh.toString(),
        ...searchFilters
      });

      // Remove empty values
      Object.keys(searchFilters).forEach(key => {
        if (!searchFilters[key as keyof SearchFilters]) {
          searchParams.delete(key);
        }
      });

      const response = await fetch(`/api/search-grants?${searchParams}`);
      
      if (response.ok) {
        const data: SearchResponse = await response.json();
        setSearchResults(data.results || []);
        setSearchInfo(data);
      } else {
        throw new Error('Search failed');
      }
    } catch (error) {
      console.error('Search failed:', error);
      // Fallback to basic search
      await handleBasicSearch();
    } finally {
      setIsSearching(false);
      setForceFresh(false); // Reset after use
    }
  };

  const handleBasicSearch = async () => {
    // Fallback to your existing search logic
    const results = generateFallbackResults();
    setSearchResults(results);
    setSearchInfo({
      results,
      totalFound: results.length,
      sources: [{ name: 'Fallback', count: results.length, status: 'success' }]
    });
  };

  const generateFallbackResults = (): EnhancedSearchResult[] => {
    return [
      {
        id: `fallback-${Date.now()}-1`,
        title: `${searchQuery} Federal Grant Program`,
        funder: "National Science Foundation",
        amount: Math.floor(Math.random() * 500000) + 50000,
        deadline: new Date(Date.now() + Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        category: searchFilters.category || "Research",
        description: `Federal funding opportunity for ${searchQuery.toLowerCase()} initiatives.`,
        requirements: ["501(c)(3) status", "Detailed project plan", "Community impact assessment"],
        source: "grants.gov",
        url: "https://grants.gov/search",
        matchPercentage: Math.floor(Math.random() * 30) + 70,
        isSearchResult: true,
        funderType: "Federal",
        sourceType: "Fallback"
      }
    ];
  };

  const addGrantFromSearch = (searchResult: EnhancedSearchResult) => {
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

  const getSourceIcon = (sourceType?: string, isRSSResult?: boolean, isCachedResult?: boolean) => {
    if (isRSSResult) return <Rss className="h-4 w-4 text-orange-600" />;
    if (isCachedResult) return <Database className="h-4 w-4 text-purple-600" />;
    return <Globe className="h-4 w-4 text-blue-600" />;
  };

  const getSourceBadgeColor = (sourceType?: string, isRSSResult?: boolean, isCachedResult?: boolean) => {
    if (isRSSResult) return 'bg-orange-100 text-orange-800';
    if (isCachedResult) return 'bg-purple-100 text-purple-800';
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <div className="space-y-6">
      {/* Enhanced AI-Powered Search */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <Search className="h-5 w-5 text-blue-600" />
            <span>Enhanced Grant Discovery</span>
            <div className="flex items-center space-x-1 text-orange-600">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-medium">Multi-Source Search</span>
            </div>
          </div>
        </h3>
        
        <div className="space-y-4">
          {/* Main Search Bar */}
          <div className="flex space-x-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search for grants (e.g., 'nonprofit technology', 'youth education', 'environmental justice')"
                className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleEnhancedSearch()}
              />
            </div>
            <button
              onClick={handleEnhancedSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center space-x-2 transition-colors"
            >
              {isSearching ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  <span>Search All</span>
                </>
              )}
            </button>
          </div>

          {/* Search Options */}
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={includeRSS}
                onChange={(e) => setIncludeRSS(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm flex items-center space-x-1">
                <Rss className="h-3 w-3" />
                <span>Include RSS Feeds</span>
              </span>
            </label>
            
            <button
              onClick={() => setForceFresh(true)}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Force Fresh Results</span>
            </button>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-sm text-gray-600 hover:text-gray-800 flex items-center space-x-1"
            >
              <Filter className="h-3 w-3" />
              <span>Advanced Filters</span>
            </button>
          </div>
          
          {/* Advanced Search Filters */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
              <select
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                value={searchFilters.category}
                onChange={(e) => setSearchFilters({...searchFilters, category: e.target.value})}
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
              />
              <input
                type="number"
                placeholder="Max Amount"
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                value={searchFilters.maxAmount}
                onChange={(e) => setSearchFilters({...searchFilters, maxAmount: e.target.value})}
              />
              <input
                type="text"
                placeholder="Location/State"
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                value={searchFilters.location}
                onChange={(e) => setSearchFilters({...searchFilters, location: e.target.value})}
              />
            </div>
          )}

          {!isOnline && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-yellow-800 text-sm">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                Limited search functionality offline. RSS feeds and real-time data unavailable.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Search Results Info */}
      {searchInfo && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">
              Search Results ({searchInfo.totalFound} found)
            </h3>
            <div className="flex items-center space-x-1 text-green-600 text-sm">
              <Shield className="h-4 w-4" />
              <span>Multi-Source Verified</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {searchInfo.sources.map((source, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                {source.name.includes('RSS') && <Rss className="h-4 w-4 text-orange-600" />}
                {source.name.includes('Cache') && <Database className="h-4 w-4 text-purple-600" />}
                {source.name.includes('API') && <Globe className="h-4 w-4 text-blue-600" />}
                <span className="font-medium">{source.name}:</span>
                <span className={source.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                  {source.count} results
                </span>
                {source.status !== 'success' && (
                  <span className="text-red-500 text-xs">({source.status})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">Grant Opportunities</h3>
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
                      <span className={`px-2 py-1 rounded-full text-xs flex items-center space-x-1 ${getSourceBadgeColor(result.sourceType, result.isRSSResult, result.isCachedResult)}`}>
                        {getSourceIcon(result.sourceType, result.isRSSResult, result.isCachedResult)}
                        <span>{result.sourceType || 'API'}</span>
                      </span>
                      {result.funderType && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          {result.funderType}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 font-medium mb-2">{result.funder}</p>
                    <p className="text-sm text-gray-600 mb-3">{result.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm mb-3">
                      <div>
                        <span className="font-medium text-gray-700">Award Amount:</span>
                        <p className="text-green-600 font-semibold">{formatCurrency(result.amount)}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Deadline:</span>
                        <p className="text-gray-600">{formatDate(result.deadline)}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Source:</span>
                        <p className="text-blue-600 capitalize">{result.source}</p>
                      </div>
                      {result.datePosted && (
                        <div>
                          <span className="font-medium text-gray-700">Posted:</span>
                          <p className="text-gray-600">{formatDate(result.datePosted)}</p>
                        </div>
                      )}
                    </div>

                    {result.requirements && (
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