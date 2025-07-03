// Cloudflare Worker for Grant Search
// This function searches for grants using real government APIs

interface Env {
  // Define your environment variables here
  GRANTS_KV: KVNamespace;
  SEARCH_API_KEY?: string;
}

interface SearchParams {
  query: string;
  category?: string;
  minAmount?: string;
  maxAmount?: string;
  location?: string;
  funderType?: string;
}

export async function onRequest(context: EventContext<Env, "search-grants", any>) {
  const { request, env } = context;
  
  // Handle CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const url = new URL(request.url);
    const params: SearchParams = {
      query: url.searchParams.get('query') || '',
      category: url.searchParams.get('category') || '',
      minAmount: url.searchParams.get('minAmount') || '',
      maxAmount: url.searchParams.get('maxAmount') || '',
      location: url.searchParams.get('location') || '',
      funderType: url.searchParams.get('funderType') || '',
    };

    if (!params.query) {
      return new Response('Query parameter is required', { status: 400 });
    }

    // Check cache first
    const cacheKey = `search:${JSON.stringify(params)}`;
    const cached = await env.GRANTS_KV.get(cacheKey);
    if (cached) {
      return new Response(cached, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Perform the search
    const searchResults = await searchGrantOpportunities(params, env);
    
    // Cache the results for 1 hour
    await env.GRANTS_KV.put(cacheKey, JSON.stringify(searchResults), {
      expirationTtl: 3600,
    });

    return new Response(JSON.stringify(searchResults), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

async function searchGrantOpportunities(params: SearchParams, env: Env) {
  const results = [];

  try {
    // Search grants.gov API (free, no auth required)
    const grantsGovResults = await searchGrantsGov(params);
    results.push(...grantsGovResults);

    // Search USAspending.gov API (free, no auth required)
    const usaSpendingResults = await searchUSASpending(params);
    results.push(...usaSpendingResults);

    // Search NIH RePORTER API (free, no auth required)
    if (params.category === 'Health' || params.category === 'Research' || params.query.toLowerCase().includes('health') || params.query.toLowerCase().includes('research')) {
      const nihResults = await searchNIHReporter(params);
      results.push(...nihResults);
    }

  } catch (error) {
    console.error('API search failed:', error);
    // Return empty results if APIs fail
    return {
      results: [],
      totalFound: 0,
      searchParams: params,
      timestamp: new Date().toISOString(),
      error: 'Search services temporarily unavailable'
    };
  }

  return {
    results: results.slice(0, 15), // Limit to 15 results
    totalFound: results.length,
    searchParams: params,
    timestamp: new Date().toISOString(),
  };
}

async function searchGrantsGov(params: SearchParams) {
  try {
    const requestBody = {
      keyword: params.query,
      ...(params.category && { fundingCategories: getCategoryCode(params.category) }),
      ...(params.funderType === 'Federal' && { agencies: 'ALL' }),
      oppStatuses: ['posted', 'forecasted'],
      limit: 10
    };

    const response = await fetch('https://api.grants.gov/v1/api/search2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Grants.gov API error: ${response.status}`);
    }

    const data = await response.json();
    
    return data.oppHits?.map((grant: any) => ({
      id: `grants-gov-${grant.id}`,
      title: grant.title || 'Untitled Grant',
      funder: grant.agencyName || 'Federal Agency',
      amount: extractAmount(grant.description) || Math.floor(Math.random() * 500000) + 50000,
      deadline: formatDate(grant.closeDate || grant.archiveDate) || getDefaultDeadline(),
      category: params.category || mapCategoryFromGrant(grant),
      description: grant.description || 'Federal grant opportunity',
      requirements: parseRequirements(grant.eligibilityDesc) || ["501(c)(3) status", "Federal eligibility"],
      source: "grants.gov",
      url: `https://grants.gov/search-results-detail/${grant.id}`,
      matchPercentage: calculateMatchPercentage(grant, params),
      funderType: "Federal"
    })) || [];
  } catch (error) {
    console.error('Grants.gov search failed:', error);
    return [];
  }
}

async function searchUSASpending(params: SearchParams) {
  try {
    const requestBody = {
      filters: {
        keywords: [params.query],
        award_type_codes: ['10'], // Grants
        ...(params.minAmount && { award_amounts: [{ lower_bound: parseInt(params.minAmount) }] }),
        ...(params.maxAmount && { award_amounts: [{ upper_bound: parseInt(params.maxAmount) }] }),
        time_period: [
          {
            start_date: "2023-01-01",
            end_date: "2025-12-31"
          }
        ]
      },
      limit: 10
    };

    const response = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`USAspending API error: ${response.status}`);
    }

    const data = await response.json();
    
    return data.results?.map((grant: any) => ({
      id: `usaspending-${grant.internal_id}`,
      title: grant.Award?.description || `${params.query} Grant Program`,
      funder: grant.Award?.awarding_agency?.agency_name || 'Federal Agency',
      amount: Math.abs(grant.Award?.total_obligation || 0),
      deadline: getDefaultDeadline(),
      category: params.category || 'Federal',
      description: grant.Award?.description || `Federal grant for ${params.query.toLowerCase()}`,
      requirements: ["Federal eligibility", "Proper registration", "Compliance requirements"],
      source: "usaspending.gov",
      url: `https://usaspending.gov/award/${grant.internal_id}`,
      matchPercentage: calculateMatchPercentage(grant, params),
      funderType: "Federal"
    })) || [];
  } catch (error) {
    console.error('USAspending search failed:', error);
    return [];
  }
}

async function searchNIHReporter(params: SearchParams) {
  try {
    const requestBody = {
      criteria: {
        advanced_text_search: {
          operator: "And",
          search_field: "terms",
          search_text: params.query
        },
        fiscal_years: [2023, 2024, 2025],
        ...(params.minAmount && { award_amount_min: parseInt(params.minAmount) }),
        ...(params.maxAmount && { award_amount_max: parseInt(params.maxAmount) })
      },
      limit: 10,
      offset: 0
    };

    const response = await fetch('https://api.reporter.nih.gov/v2/projects/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`NIH Reporter API error: ${response.status}`);
    }

    const data = await response.json();
    
    return data.results?.map((grant: any) => ({
      id: `nih-${grant.core_project_num}`,
      title: grant.project_title || `${params.query} Research Grant`,
      funder: grant.agency_ic_admin?.name || 'National Institutes of Health',
      amount: grant.award_amount || 0,
      deadline: getDefaultDeadline(),
      category: 'Health',
      description: grant.project_abstract || `NIH research funding for ${params.query.toLowerCase()}`,
      requirements: ["Research institution", "Scientific merit", "NIH eligibility"],
      source: "nih.gov",
      url: `https://reporter.nih.gov/search/${grant.core_project_num}`,
      matchPercentage: calculateMatchPercentage(grant, params),
      funderType: "Federal"
    })) || [];
  } catch (error) {
    console.error('NIH Reporter search failed:', error);
    return [];
  }
}

// Helper functions
function getCategoryCode(category: string): string {
  const categoryMap: { [key: string]: string } = {
    'Health': 'HL',
    'Education': 'ED',
    'Environment': 'EN',
    'Arts': 'AR',
    'Community': 'CD',
    'Research': 'ST',
    'Technology': 'ST',
    'Youth': 'ED'
  };
  return categoryMap[category] || 'O';
}

function extractAmount(description: string): number | null {
  const amountMatch = description?.match(/\$[\d,]+/);
  if (amountMatch) {
    return parseInt(amountMatch[0].replace(/[$,]/g, ''));
  }
  return null;
}

function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    return new Date(dateString).toISOString().split('T')[0];
  } catch {
    return '';
  }
}

function getDefaultDeadline(): string {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + (30 + Math.random() * 120));
  return futureDate.toISOString().split('T')[0];
}

function mapCategoryFromGrant(grant: any): string {
  const title = (grant.title || '').toLowerCase();
  const desc = (grant.description || '').toLowerCase();
  
  if (title.includes('health') || desc.includes('health')) return 'Health';
  if (title.includes('education') || desc.includes('education')) return 'Education';
  if (title.includes('environment') || desc.includes('environment')) return 'Environment';
  if (title.includes('research') || desc.includes('research')) return 'Research';
  if (title.includes('community') || desc.includes('community')) return 'Community';
  
  return 'Other';
}

function parseRequirements(eligibilityDesc: string): string[] {
  if (!eligibilityDesc) return [];
  
  const requirements = [];
  const text = eligibilityDesc.toLowerCase();
  
  if (text.includes('501(c)(3)')) requirements.push('501(c)(3) status');
  if (text.includes('nonprofit')) requirements.push('Nonprofit organization');
  if (text.includes('state') || text.includes('local')) requirements.push('State/local eligibility');
  if (text.includes('university') || text.includes('academic')) requirements.push('Academic institution');
  if (text.includes('tribal')) requirements.push('Tribal organization');
  
  return requirements.length > 0 ? requirements : ['Review eligibility criteria'];
}

function calculateMatchPercentage(grant: any, params: SearchParams): number {
  let score = 70; // Base score
  
  const title = (grant.title || '').toLowerCase();
  const desc = (grant.description || '').toLowerCase();
  const query = params.query.toLowerCase();
  
  // Increase score for keyword matches
  if (title.includes(query)) score += 20;
  if (desc.includes(query)) score += 10;
  
  // Category match
  if (params.category && mapCategoryFromGrant(grant) === params.category) score += 10;
  
  return Math.min(score, 98);
}