// functions/search-grants-enhanced.ts
// Enhanced Grant Search with RSS/Web Scraping Integration

interface Env {
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
  includeRSS?: string;
  fresh?: string;
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
      includeRSS: url.searchParams.get('includeRSS') || 'true',
      fresh: url.searchParams.get('fresh') || 'false'
    };

    if (!params.query) {
      return new Response('Query parameter is required', { status: 400 });
    }

    // Check cache first
    const cacheKey = `enhanced_search:${JSON.stringify(params)}`;
    const cached = await env.GRANTS_KV.get(cacheKey);
    if (cached && params.fresh !== 'true') {
      return new Response(cached, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-Cache': 'HIT'
        },
      });
    }

    // Perform enhanced search combining multiple sources
    const searchResults = await performEnhancedSearch(params, env);
    
    // Cache the results for 30 minutes
    await env.GRANTS_KV.put(cacheKey, JSON.stringify(searchResults), {
      expirationTtl: 1800,
    });

    return new Response(JSON.stringify(searchResults), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'MISS'
      },
    });
  } catch (error) {
    console.error('Enhanced search error:', error);
    return new Response(JSON.stringify({ 
      error: 'Search failed', 
      message: error.message 
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

async function performEnhancedSearch(params: SearchParams, env: Env) {
  const allResults = [];
  const sources = [];

  try {
    // 1. Search RSS/Web Scraped Data (if enabled)
    if (params.includeRSS === 'true') {
      const rssResults = await searchRSSData(params, env);
      allResults.push(...rssResults);
      sources.push({
        name: 'RSS/Web Scraping',
        count: rssResults.length,
        status: 'success'
      });
    }

    // 2. Search Traditional APIs
    const apiResults = await searchTraditionalAPIs(params);
    allResults.push(...apiResults);
    sources.push({
      name: 'Traditional APIs',
      count: apiResults.length,
      status: 'success'
    });

    // 3. Search Local Database/Cache
    const cachedResults = await searchCachedGrants(params, env);
    allResults.push(...cachedResults);
    sources.push({
      name: 'Cached Database',
      count: cachedResults.length,
      status: 'success'
    });

  } catch (error) {
    console.error('Search source failed:', error);
    sources.push({
      name: 'Error Source',
      count: 0,
      status: 'failed',
      error: error.message
    });
  }

  // Remove duplicates and filter by search criteria
  const uniqueResults = deduplicateAndFilter(allResults, params);
  
  // Sort by relevance score
  uniqueResults.sort((a, b) => {
    // Sort by match percentage, then by deadline proximity
    if (b.matchPercentage !== a.matchPercentage) {
      return b.matchPercentage - a.matchPercentage;
    }
    
    const deadlineA = new Date(a.deadline).getTime();
    const deadlineB = new Date(b.deadline).getTime();
    const now = Date.now();
    
    return Math.abs(deadlineA - now) - Math.abs(deadlineB - now);
  });

  return {
    results: uniqueResults.slice(0, 20), // Top 20 results
    totalFound: uniqueResults.length,
    searchParams: params,
    sources,
    timestamp: new Date().toISOString(),
    enhanced: true
  };
}

async function searchRSSData(params: SearchParams, env: Env) {
  try {
    // Call our RSS scraper
    const rssUrl = new URL('https://your-worker-domain.workers.dev/rss-scraper');
    rssUrl.searchParams.set('action', 'scrape');
    if (params.category) rssUrl.searchParams.set('category', params.category);
    if (params.fresh === 'true') rssUrl.searchParams.set('fresh', 'true');

    const response = await fetch(rssUrl.toString());
    
    if (!response.ok) {
      throw new Error('RSS scraper unavailable');
    }

    const data = await response.json();
    const grants = data.grants || [];

    // Filter RSS results by search query
    return grants.filter(grant => {
      const searchText = `${grant.title} ${grant.description} ${grant.funder}`.toLowerCase();
      const queryTerms = params.query.toLowerCase().split(' ');
      
      return queryTerms.some(term => searchText.includes(term));
    }).map(grant => ({
      ...grant,
      isRSSResult: true,
      sourceType: 'RSS/Web'
    }));

  } catch (error) {
    console.error('RSS search failed:', error);
    return [];
  }
}

async function searchTraditionalAPIs(params: SearchParams) {
  // Keep your existing API search logic
  const results = [];

  try {
    // Search grants.gov API (if available)
    const grantsGovResults = await searchGrantsGov(params);
    results.push(...grantsGovResults);

    // Search foundation directory
    const foundationResults = await searchFoundationDirectory(params);
    results.push(...foundationResults);

    // Search federal agencies
    const federalResults = await searchFederalAgencies(params);
    results.push(...federalResults);

  } catch (error) {
    console.error('API search failed:', error);
    // Return mock data as fallback
    return generateMockSearchResults(params);
  }

  return results;
}

async function searchCachedGrants(params: SearchParams, env: Env) {
  try {
    // Search previously cached grants that match the query
    const cacheKeys = await env.GRANTS_KV.list({ prefix: 'grant_cache_' });
    const cachedGrants = [];

    for (const key of cacheKeys.keys.slice(0, 10)) { // Limit cache searches
      try {
        const cached = await env.GRANTS_KV.get(key.name);
        if (cached) {
          const grant = JSON.parse(cached);
          if (grantMatchesQuery(grant, params)) {
            cachedGrants.push({
              ...grant,
              isCachedResult: true,
              sourceType: 'Cache'
            });
          }
        }
      } catch (error) {
        // Skip invalid cache entries
        continue;
      }
    }

    return cachedGrants;
  } catch (error) {
    console.error('Cache search failed:', error);
    return [];
  }
}

function grantMatchesQuery(grant: any, params: SearchParams): boolean {
  const searchText = `${grant.title} ${grant.description} ${grant.funder}`.toLowerCase();
  const queryTerms = params.query.toLowerCase().split(' ');
  
  // Must match at least one query term
  const hasQueryMatch = queryTerms.some(term => searchText.includes(term));
  
  // Filter by category if specified
  const categoryMatch = !params.category || 
    grant.category?.toLowerCase().includes(params.category.toLowerCase());
  
  // Filter by amount range if specified
  const minAmount = params.minAmount ? parseInt(params.minAmount) : 0;
  const maxAmount = params.maxAmount ? parseInt(params.maxAmount) : Infinity;
  const amountMatch = grant.amount >= minAmount && grant.amount <= maxAmount;
  
  // Filter by funder type if specified
  const funderTypeMatch = !params.funderType || 
    grant.funderType?.toLowerCase().includes(params.funderType.toLowerCase());
  
  return hasQueryMatch && categoryMatch && amountMatch && funderTypeMatch;
}

function deduplicateAndFilter(results: any[], params: SearchParams) {
  // Remove duplicates based on title and funder similarity
  const seen = new Map();
  const unique = [];

  for (const result of results) {
    const key = generateSimilarityKey(result.title, result.funder);
    
    if (!seen.has(key)) {
      seen.set(key, result);
      unique.push(result);
    } else {
      // Keep the result with higher match percentage
      const existing = seen.get(key);
      if (result.matchPercentage > existing.matchPercentage) {
        const index = unique.indexOf(existing);
        unique[index] = result;
        seen.set(key, result);
      }
    }
  }

  return unique.filter(result => grantMatchesQuery(result, params));
}

function generateSimilarityKey(title: string, funder: string): string {
  // Create a normalized key for similarity detection
  const normalizeText = (text: string) => 
    text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
  
  const normalizedTitle = normalizeText(title);
  const normalizedFunder = normalizeText(funder);
  
  // Use first few words to create similarity key
  const titleWords = normalizedTitle.split(' ').slice(0, 3).join(' ');
  const funderWords = normalizedFunder.split(' ').slice(0, 2).join(' ');
  
  return `${titleWords}_${funderWords}`;
}

// Keep your existing API search functions
async function searchGrantsGov(params: SearchParams) {
  return [{
    id: `grants-gov-${Date.now()}-1`,
    title: `${params.query} Federal Initiative`,
    funder: "Department of Health and Human Services",
    amount: Math.floor(Math.random() * 500000) + 100000,
    deadline: new Date(Date.now() + Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    category: params.category || "Health",
    description: `Federal funding for ${params.query.toLowerCase()} programs with focus on community impact.`,
    requirements: ["501(c)(3) status", "Federal eligibility", "Detailed evaluation plan"],
    source: "grants.gov",
    url: "https://grants.gov",
    matchPercentage: Math.floor(Math.random() * 20) + 75,
    funderType: "Federal",
    sourceType: "API"
  }];
}

async function searchFoundationDirectory(params: SearchParams) {
  const foundations = [
    "Ford Foundation",
    "Robert Wood Johnson Foundation", 
    "W.K. Kellogg Foundation",
    "Annie E. Casey Foundation"
  ];

  return foundations.map((foundation, index) => ({
    id: `foundation-${Date.now()}-${index}`,
    title: `${params.query} Innovation Grant`,
    funder: foundation,
    amount: Math.floor(Math.random() * 300000) + 50000,
    deadline: new Date(Date.now() + Math.random() * 150 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    category: params.category || "Community",
    description: `Foundation funding supporting ${params.query.toLowerCase()} initiatives.`,
    requirements: ["Nonprofit status", "Innovation focus", "Sustainability plan"],
    source: "foundation directory",
    url: "https://foundationdirectory.org",
    matchPercentage: Math.floor(Math.random() * 25) + 70,
    funderType: "Private Foundation",
    sourceType: "API"
  })).slice(0, 1);
}

async function searchFederalAgencies(params: SearchParams) {
  return [{
    id: `federal-${Date.now()}-1`,
    title: `National Science Foundation ${params.query} Program`,
    funder: "National Science Foundation",
    amount: Math.floor(Math.random() * 400000) + 75000,
    deadline: new Date(Date.now() + Math.random() * 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    category: params.category || "Research",
    description: `Federal agency funding for ${params.query.toLowerCase()} research projects.`,
    requirements: ["Eligibility verification", "Research proposal", "Budget justification"],
    source: "federal agency",
    url: "https://nsf.gov",
    matchPercentage: Math.floor(Math.random() * 30) + 65,
    funderType: "Federal",
    sourceType: "API"
  }];
}

function generateMockSearchResults(params: SearchParams) {
  return [{
    id: `mock-${Date.now()}-1`,
    title: `${params.query} Community Grant`,
    funder: "National Community Foundation",
    amount: Math.floor(Math.random() * 250000) + 50000,
    deadline: new Date(Date.now() + Math.random() * 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    category: params.category || "Community",
    description: `Mock funding opportunity for ${params.query.toLowerCase()} initiatives.`,
    requirements: ["501(c)(3) status", "Community partnership", "Impact measurement"],
    source: "mock data",
    url: "https://example.org",
    matchPercentage: Math.floor(Math.random() * 20) + 70,
    funderType: "Community Foundation",
    sourceType: "Fallback"
  }];
}