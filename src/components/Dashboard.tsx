import React from 'react';
import { 
  DollarSign, 
  Clock, 
  Bell, 
  Target, 
  TrendingUp, 
  AlertCircle, 
  Zap, 
  Globe 
} from 'lucide-react';
import { Grant } from '../types/Grant';
import { formatCurrency, formatDate, getDaysUntilDeadline } from '../utils/formatting';

interface DashboardProps {
  grants: Grant[];
  isOnline: boolean;
}

const statusConfig = {
  researching: { color: 'bg-blue-100 text-blue-800', label: 'Researching' },
  applied: { color: 'bg-yellow-100 text-yellow-800', label: 'Applied' },
  awarded: { color: 'bg-green-100 text-green-800', label: 'Awarded' },
  rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected' }
};

const Dashboard: React.FC<DashboardProps> = ({ grants, isOnline }) => {
  const totalFunding = grants.reduce((sum, grant) => {
    return grant.status === 'awarded' ? sum + grant.amount : sum;
  }, 0);

  const pendingApplications = grants.filter(g => g.status === 'applied').length;
  
  const upcomingDeadlines = grants.filter(g => {
    const deadline = new Date(g.deadline);
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return deadline >= today && deadline <= thirtyDaysFromNow && g.status === 'researching';
  }).length;

  return (
    <div className="space-y-6">
      {/* Cloudflare Status Banner */}
      <div className={`rounded-lg p-4 flex items-center space-x-3 ${
        isOnline ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
      }`}>
        <div className={`flex items-center space-x-2 ${
          isOnline ? 'text-green-700' : 'text-yellow-700'
        }`}>
          {isOnline ? <Zap className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <Globe className="h-4 w-4" />
        </div>
        <div>
          <p className={`font-medium ${isOnline ? 'text-green-800' : 'text-yellow-800'}`}>
            {isOnline ? 'Connected to Cloudflare Network' : 'Offline Mode - Data Cached Locally'}
          </p>
          <p className={`text-sm ${isOnline ? 'text-green-600' : 'text-yellow-600'}`}>
            {isOnline ? 'Real-time grant search and sync enabled' : 'Changes will sync when connection restored'}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Total Funding Awarded</p>
              <p className="text-2xl font-bold">{formatCurrency(totalFunding)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Pending Applications</p>
              <p className="text-2xl font-bold">{pendingApplications}</p>
            </div>
            <Clock className="h-8 w-8 text-blue-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100">Upcoming Deadlines</p>
              <p className="text-2xl font-bold">{upcomingDeadlines}</p>
            </div>
            <Bell className="h-8 w-8 text-yellow-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100">Total Opportunities</p>
              <p className="text-2xl font-bold">{grants.length}</p>
            </div>
            <Target className="h-8 w-8 text-purple-200" />
          </div>
        </div>
      </div>

      {/* Recent Activity and Urgent Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <span>Recent Activity</span>
          </h3>
          <div className="space-y-3">
            {grants.slice(0, 5).map(grant => (
              <div key={grant.id} className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${
                  grant.status === 'awarded' ? 'bg-green-500' :
                  grant.status === 'applied' ? 'bg-yellow-500' :
                  grant.status === 'rejected' ? 'bg-red-500' : 'bg-blue-500'
                }`}></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{grant.title}</p>
                  <p className="text-xs text-gray-500">Updated {formatDate(grant.lastUpdate)}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${statusConfig[grant.status].color}`}>
                  {statusConfig[grant.status].label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span>Urgent Deadlines</span>
          </h3>
          <div className="space-y-3">
            {grants
              .filter(g => getDaysUntilDeadline(g.deadline) <= 30 && g.status === 'researching')
              .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
              .slice(0, 5)
              .map(grant => {
                const daysLeft = getDaysUntilDeadline(grant.deadline);
                return (
                  <div key={grant.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{grant.title}</p>
                      <p className="text-xs text-gray-500">{grant.funder}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${
                        daysLeft <= 7 ? 'text-red-600' : 
                        daysLeft <= 14 ? 'text-yellow-600' : 'text-gray-600'
                      }`}>
                        {daysLeft} days left
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(grant.deadline)}</p>
                    </div>
                  </div>
                );
              })}
            {grants.filter(g => getDaysUntilDeadline(g.deadline) <= 30 && g.status === 'researching').length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">
                No urgent deadlines at this time
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;