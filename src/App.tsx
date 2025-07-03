import { useState, useEffect } from 'react';
import { Target, Zap, Bell, Users, TrendingUp, Search, FileText, Activity, Settings } from 'lucide-react';
import Dashboard from './components/Dashboard';
import GrantSearch from './components/GrantSearch';
import GrantList from './components/GrantList';
import RSSMonitoringDashboard from './components/RSSMonitoringDashboard';
import { Grant, GrantStatus } from './types/Grant';
import { useCloudflareSync } from './hooks/useCloudflareSync';
import { useRSSSettings } from './hooks/useRSSSettings';
import './App.css';

const INITIAL_GRANTS: Grant[] = [
  {
    id: 1,
    title: "Community Health Initiative Grant",
    funder: "Robert Wood Johnson Foundation",
    amount: 250000,
    deadline: "2025-08-15",
    status: "researching",
    matchPercentage: 85,
    category: "Health",
    description: "Funding for community-based health programs",
    requirements: ["501(c)(3) status", "Community health focus", "Detailed budget"],
    applicationDate: null,
    submittedDate: null,
    lastUpdate: "2025-06-20",
    source: "foundation database",
    url: "https://rwjf.org/grants"
  },
  {
    id: 2,
    title: "Education Excellence Fund",
    funder: "Gates Foundation",
    amount: 500000,
    deadline: "2025-07-30",
    status: "applied",
    matchPercentage: 92,
    category: "Education",
    description: "Supporting innovative educational programs",
    requirements: ["Educational focus", "Measurable outcomes", "Sustainability plan"],
    applicationDate: "2025-06-10",
    submittedDate: "2025-06-15",
    lastUpdate: "2025-06-15",
    source: "gates foundation",
    url: "https://gatesfoundation.org"
  },
  {
    id: 3,
    title: "Environmental Conservation Grant",
    funder: "EPA Small Grants Program",
    amount: 75000,
    deadline: "2025-09-01",
    status: "awarded",
    matchPercentage: 78,
    category: "Environment",
    description: "Environmental protection and conservation efforts",
    requirements: ["Environmental impact", "Community involvement"],
    applicationDate: "2025-05-01",
    submittedDate: "2025-05-10",
    lastUpdate: "2025-06-01",
    source: "grants.gov",
    url: "https://grants.gov"
  },
  {
    id: 4,
    title: "Youth Technology Innovation Grant",
    funder: "National Science Foundation",
    amount: 150000,
    deadline: "2025-08-30",
    status: "researching",
    matchPercentage: 91,
    category: "Technology",
    description: "Supporting youth-focused STEM technology programs discovered through RSS feeds",
    requirements: ["501(c)(3) status", "Youth focus", "STEM education", "Technology integration"],
    applicationDate: null,
    submittedDate: null,
    lastUpdate: "2025-07-03",
    source: "RSS: NSF Research Grants",
    url: "https://nsf.gov/funding"
  }
];

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [grants, setGrants] = useState<Grant[]>(INITIAL_GRANTS);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSettings, setShowSettings] = useState(false);
  
  const { saveToCloudflare, loadFromCloudflare } = useCloudflareSync();
  const { rssSettings, updateRSSSettings } = useRSSSettings();

  // Monitor online status for Cloudflare connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load grants from Cloudflare on startup
  useEffect(() => {
    const loadInitialGrants = async () => {
      try {
        const savedGrants = await loadFromCloudflare();
        if (savedGrants.length > 0) {
          setGrants(savedGrants);
        }
      } catch (error) {
        console.log('No saved grants found, using initial data');
      }
    };
    
    loadInitialGrants();
  }, [loadFromCloudflare]);

  // Auto-save to Cloudflare when grants change
  useEffect(() => {
    if (grants.length > 0) {
      saveToCloudflare(grants);
    }
  }, [grants, saveToCloudflare]);

  const addGrant = (grant: Omit<Grant, 'id'>) => {
    const newGrant: Grant = {
      ...grant,
      id: Math.max(...grants.map(g => g.id), 0) + 1,
      lastUpdate: new Date().toISOString().split('T')[0]
    };
    setGrants(prev => [...prev, newGrant]);
  };

  const updateGrantStatus = (id: number, newStatus: GrantStatus) => {
    setGrants(prev => prev.map(grant => {
      if (grant.id === id) {
        const updated = { 
          ...grant, 
          status: newStatus, 
          lastUpdate: new Date().toISOString().split('T')[0] 
        };
        if (newStatus === 'applied' && !grant.applicationDate) {
          updated.applicationDate = new Date().toISOString().split('T')[0];
        }
        if (newStatus === 'applied' && !grant.submittedDate) {
          updated.submittedDate = new Date().toISOString().split('T')[0];
        }
        return updated;
      }
      return grant;
    }));
  };

  const removeGrant = (id: number) => {
    setGrants(prev => prev.filter(grant => grant.id !== id));
  };

  const getNotificationCount = () => {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    return grants.filter(grant => {
      const deadline = new Date(grant.deadline);
      return deadline >= today && deadline <= thirtyDaysFromNow && grant.status === 'researching';
    }).length;
  };

  const hasRSSGrants = grants.some(grant => grant.source.includes('RSS:'));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <Target className="h-8 w-8 text-blue-600" />
                  <Zap className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">GrantTracker Pro</h1>
                  <p className="text-xs text-gray-500">
                    Powered by Cloudflare
                    {rssSettings.enabled && (
                      <span className="ml-2 px-1 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                        RSS Active
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${
                isOnline ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span>{isOnline ? 'Online' : 'Offline'}</span>
              </div>
              
              <div className="relative">
                <Bell className="h-5 w-5 text-gray-400" />
                {getNotificationCount() > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {getNotificationCount()}
                  </span>
                )}
              </div>
              
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <Settings className="h-5 w-5 text-gray-400" />
              </button>
              
              <Users className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-blue-900">RSS & Web Scraping Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={rssSettings.enabled}
                  onChange={(e) => updateRSSSettings({ enabled: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-blue-800">Enable RSS Scraping</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={rssSettings.websiteScrapingEnabled}
                  onChange={(e) => updateRSSSettings({ websiteScrapingEnabled: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-blue-800">Enable Website Scraping</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={rssSettings.autoRefresh}
                  onChange={(e) => updateRSSSettings({ autoRefresh: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-blue-800">Auto-refresh (6 hours)</span>
              </label>
            </div>
            
            <div className="mt-4 flex items-center space-x-4 text-sm text-blue-700">
              <span>RSS Sources: {rssSettings.feedCount}</span>
              <span>•</span>
              <span>Websites: {rssSettings.websiteCount}</span>
              <span>•</span>
              <span>Last Update: {rssSettings.lastUpdate || 'Never'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-8">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Dashboard</span>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'search'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <span>Search Grants</span>
              {rssSettings.enabled && (
                <span className="ml-1 px-1 py-0.5 bg-orange-500 text-white rounded text-xs">
                  RSS
                </span>
              )}
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('grants')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'grants'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>All Grants</span>
              {hasRSSGrants && (
                <span className="ml-1 w-2 h-2 bg-orange-500 rounded-full"></span>
              )}
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'monitoring'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>RSS Monitor</span>
              {rssSettings.enabled && (
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              )}
            </div>
          </button>
        </div>

        {/* RSS Status Banner */}
        {rssSettings.enabled && (
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-3">
              <Zap className="h-6 w-6" />
              <div>
                <h3 className="font-semibold">Enhanced Grant Discovery Active</h3>
                <p className="text-sm opacity-90">
                  RSS feeds and web scraping are monitoring {rssSettings.feedCount + rssSettings.websiteCount} sources 
                  for new grant opportunities. Last updated: {rssSettings.lastUpdate || 'initializing...'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <Dashboard 
            grants={grants} 
            isOnline={isOnline}
          />
        )}
        
        {activeTab === 'search' && (
          <GrantSearch 
            onAddGrant={addGrant}
            isOnline={isOnline}
          />
        )}
        
        {activeTab === 'grants' && (
          <GrantList 
            grants={grants}
            onUpdateStatus={updateGrantStatus}
            onRemoveGrant={removeGrant}
          />
        )}
        
        {activeTab === 'monitoring' && (
          <RSSMonitoringDashboard />
        )}
      </div>
    </div>
  );
}

export default App;