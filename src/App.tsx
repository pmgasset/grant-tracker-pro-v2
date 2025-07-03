import { useState, useEffect } from 'react';
import { Target, Zap, Bell, Users, TrendingUp, Search, FileText } from 'lucide-react';
import Dashboard from './components/Dashboard';
import GrantSearch from './components/GrantSearch';
import GrantList from './components/GrantList';
import { Grant, GrantStatus } from './types/Grant';
import { useCloudflareSync } from './hooks/useCloudflareSync';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [grants, setGrants] = useState<Grant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const { saveToCloudflare, loadFromCloudflare, searchGrants } = useCloudflareSync();

  // Load initial data on app start
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        
        // First try to load saved grants from Cloudflare
        const savedGrants = await loadFromCloudflare();
        if (savedGrants.length > 0) {
          setGrants(savedGrants);
        } else {
          // If no saved grants, load some popular grant opportunities
          const popularQueries = ['nonprofit', 'education', 'health', 'community'];
          const initialGrants: Grant[] = [];
          
          for (const query of popularQueries) {
            try {
              const results = await searchGrants(query, { category: '' });
              const convertedGrants = results.slice(0, 2).map((result: any, index: number) => ({
                ...result,
                id: Date.now() + index,
                status: 'researching' as GrantStatus,
                applicationDate: null,
                submittedDate: null,
                lastUpdate: new Date().toISOString().split('T')[0],
                isSearchResult: false
              }));
              initialGrants.push(...convertedGrants);
            } catch (error) {
              console.log(`Failed to load ${query} grants:`, error);
            }
          }
          
          if (initialGrants.length > 0) {
            setGrants(initialGrants);
          }
        }
      } catch (error) {
        console.error('Failed to load initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [loadFromCloudflare, searchGrants]);

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
                  <p className="text-xs text-gray-500">Powered by Cloudflare</p>
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
              <Bell className="h-5 w-5 text-gray-400" />
              <Users className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading grant opportunities...</p>
              <p className="text-sm text-gray-500 mt-1">Fetching data from Grants.gov, USAspending.gov, and NIH Reporter</p>
            </div>
          </div>
        )}

        {/* App Content */}
        {!isLoading && (
          <>
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
                  <span>All Grants ({grants.length})</span>
                </div>
              </button>
            </div>

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
          </>
        )}
      </div>
    </div>
  );
}

export default App;