export interface Grant {
  id: number;
  title: string;
  funder: string;
  amount: number;
  deadline: string;
  status: GrantStatus;
  matchPercentage: number;
  category: string;
  description: string;
  requirements: string[];
  applicationDate: string | null;
  submittedDate: string | null;
  lastUpdate: string;
  source: string;
  url?: string;
  isSearchResult?: boolean;
  funderType?: string;
}

export type GrantStatus = 'researching' | 'applied' | 'awarded' | 'rejected';

export interface SearchFilters {
  category: string;
  minAmount: string;
  maxAmount: string;
  location: string;
  funderType: string;
}

export interface NewGrantForm {
  title: string;
  funder: string;
  amount: string;
  deadline: string;
  category: string;
  description: string;
  requirements: string;
  url: string;
}

export interface SearchResult extends Omit<Grant, 'id' | 'status' | 'applicationDate' | 'submittedDate' | 'lastUpdate'> {
  id: string;
  isSearchResult: true;
}

export interface StatusConfig {
  [key: string]: {
    color: string;
    icon: any;
    label: string;
  };
}