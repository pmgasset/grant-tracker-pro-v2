import React, { useState, useEffect } from 'react';
import { Target, Zap, Bell, Users, TrendingUp, Search, FileText } from 'lucide-react';
import Dashboard from './components/Dashboard';
import GrantSearch from './components/GrantSearch';
import GrantList from './components/GrantList';
import { Grant, GrantStatus } from './types/Grant';
import { useCloudflareSync } from './hooks/useCloudflareSync';
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
  }
];

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [grants, setGrants] = useState<Grant[]>(INITIAL_GRANTS);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const { saveToCloudflare } = useCloudflareSync();

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
    saveToCloudflare(grants);
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
              <span>All Grants</span>
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
      </div>
    </div>
  );
}

export default App;