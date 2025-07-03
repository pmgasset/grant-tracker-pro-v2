import React, { useState } from 'react';
import { 
  Search, 
  Target, 
  ExternalLink, 
  Search as SearchIcon, 
  Clock, 
  CheckCircle, 
  XCircle 
} from 'lucide-react';
import { Grant, GrantStatus } from '../types/Grant';
import { formatCurrency, formatDate, getDaysUntilDeadline } from '../utils/formatting';

interface GrantListProps {
  grants: Grant[];
  onUpdateStatus: (id: number, status: GrantStatus) => void;
  onRemoveGrant: (id: number) => void;
}

const statusConfig = {
  researching: { color: 'bg-blue-100 text-blue-800', icon: SearchIcon, label: 'Researching' },
  applied: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Applied' },
  awarded: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Awarded' },
  rejected: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejected' }
};

const GrantList: React.FC<GrantListProps> = ({ grants, onUpdateStatus, onRemoveGrant }) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredGrants = grants.filter(grant => {
    const matchesStatus = filterStatus === 'all' || grant.status === filterStatus;
    const matchesSearch = grant.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         grant.funder.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         grant.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search grants..."
                className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="researching">Researching</option>
              <option value="applied">Applied</option>
              <option value="awarded">Awarded</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="text-sm text-gray-500">
            Showing {filteredGrants.length} of {grants.length} grants
          </div>
        </div>
      </div>

      {/* Grant Cards */}
      <div className="grid gap-6">
        {filteredGrants.map(grant => {
          const StatusIcon = statusConfig[grant.status].icon;
          const daysLeft = getDaysUntilDeadline(grant.deadline);
          
          return (
            <div key={grant.id} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{grant.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm flex items-center space-x-1 ${statusConfig[grant.status].color}`}>
                      <StatusIcon className="h-3 w-3" />
                      <span>{statusConfig[grant.status].label}</span>
                    </span>
                    {grant.source && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        {grant.source}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 mb-2">
                    <p className="text-gray-600 font-medium">{grant.funder}</p>
                    {grant.url && (
                      <a
                        href={grant.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-3">{grant.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Award Amount:</span>
                      <p className="text-green-600 font-semibold">{formatCurrency(grant.amount)}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Deadline:</span>
                      <p className={`${
                        daysLeft <= 7 ? 'text-red-600' : 
                        daysLeft <= 14 ? 'text-yellow-600' : 'text-gray-600'
                      }`}>
                        {formatDate(grant.deadline)} ({daysLeft > 0 ? `${daysLeft} days left` : 'Expired'})
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Category:</span>
                      <p className="text-gray-600">{grant.category}</p>
                    </div>
                  </div>

                  {grant.requirements && grant.requirements.length > 0 && (
                    <div className="mt-3">
                      <span className="font-medium text-gray-700">Requirements:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {grant.requirements.map((req, idx) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            {req}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {grant.applicationDate && (
                    <div className="mt-3 text-sm text-gray-500">
                      Application started: {formatDate(grant.applicationDate)}
                      {grant.submittedDate && ` • Submitted: ${formatDate(grant.submittedDate)}`}
                    </div>
                  )}
                </div>

                <div className="ml-4 flex flex-col items-end space-y-3">
                  <div className="text-right">
                    <div className="text-sm text-gray-500 mb-1">Match Score</div>
                    <div className="text-lg font-bold text-blue-600">{grant.matchPercentage}%</div>
                  </div>
                  
                  <select
                    value={grant.status}
                    onChange={(e) => onUpdateStatus(grant.id, e.target.value as GrantStatus)}
                    className="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="researching">Researching</option>
                    <option value="applied">Applied</option>
                    <option value="awarded">Awarded</option>
                    <option value="rejected">Rejected</option>
                  </select>

                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to remove this grant from your tracker?')) {
                        onRemoveGrant(grant.id);
                      }
                    }}
                    className="text-red-600 hover:text-red-800 text-sm transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredGrants.length === 0 && (
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No grants found matching your criteria</p>
          <p className="text-gray-400 text-sm">Try adjusting your search terms or filters</p>
        </div>
      )}
    </div>
  );
};

export default GrantList;