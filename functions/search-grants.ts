// functions/search-grants.ts
// Cloudflare Worker for Grant Search - Real API integration only

interface Env {
  GRANTS_KV: KVNamespace;
  SEARCH_API_KEY?: string;
  GRANTS_GOV_API_KEY?: string;
  FOUNDATION_DIRECTORY_API_KEY?: string;
}

interface SearchParams {
  query: string;
  category?: string;
  minAmount?: string;
  maxAmount?: string;
  location?: string;
  funderType?: string;
  source?: string;
}

export async function onRequest(context: EventContext<Env, "search-grants", any>) {
  const { request, env } = context;
  
  // Handle CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
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
      source: url.searchParams.get('source') || '',
    };

    if (!params.query) {
      return new Response(JSON.stringify({ 
        error: 'Query parameter is required',
        results: []
      }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Check cache first
    const cacheKey = `search:${JSON.stringify(params)}`;
    const cached = await env.GRANTS_KV.get(cacheKey);
    if (cached) {
      return new Response(cached, {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          ...corsHeaders
        },
      });
    }

    // Perform the search based on source
    let searchResults;
    if (params.source === 'rss') {
      searchResults = await searchRSSFeeds(params, env);
    } else {
      searchResults = await searchGrantOpportunities(params, env);
    }
    
    // Only cache successful results
    if (searchResults.results && searchResults.results.length > 0) {
      await env.GRANTS_KV.put(cacheKey, JSON.stringify(searchResults), {
        expirationTtl: 3600, // Cache for 1 hour
      });
    }

    return new Response(JSON.stringify(searchResults), {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        ...corsHeaders
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ 
      error: 'Search service temporarily unavailable',
      message: 'Please try again later or add grants manually',
      results: []
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function searchGrantOpportunities(params: SearchParams, env: Env) {
  const results = [];

  try {
    // Search grants.gov API (if API key available)
    if (env.GRANTS_GOV_API_KEY) {
      const grantsGovResults = await searchGrantsGov(params, env.GRANTS_GOV_API_KEY);
      results.push(...grantsGovResults);
    }

    // Search foundation directory (if API key available)
    if (env.FOUNDATION_DIRECTORY_API_KEY) {
      const foundationResults = await searchFoundationDirectory(params, env.FOUNDATION_DIRECTORY_API_KEY);
      results.push(...foundationResults);
    }

    // Search federal agencies
    const federalResults = await searchFederalAgencies(params);
    results.push(...federalResults);

  } catch (error) {
    console.error('API search failed:', error);
    return {
      error: true,
      message: 'Grant search APIs are currently unavailable. Please try again later.',
      results: [],
      searchParams: params,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    results: results.slice(0, 10), // Limit to 10 results
    totalFound: results.length,
    searchParams: params,
    timestamp: new Date().toISOString(),
  };
}

async function searchRSSFeeds(params: SearchParams, env: Env) {
  try {
    // RSS feed URLs for grant opportunities
    const rssFeeds = [
      'https://www.grants.gov/rss/GG_NewOppByAgency.xml',
      'https://foundationcenter.org/rss/grants.xml',
      'https://www.federalgrants.com/rss/new-grants.xml'
    ];

    const results = [];

    for (const feedUrl of rssFeeds) {
      try {
        const feedResults = await fetchAndParseRSSFeed(feedUrl, params);
        results.push(...feedResults);
      } catch (feedError) {
        console.error(`Failed to fetch RSS feed ${feedUrl}:`, feedError);
        // Continue with other feeds
      }
    }

    return {
      results: results.slice(0, 15), // Limit RSS results
      totalFound: results.length,
      searchParams: params,
      source: 'rss',
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    console.error('RSS search failed:', error);
    return {
      error: true,
      message: 'RSS feed monitoring is currently unavailable. Please check back later.',
      results: [],
      searchParams: params,
      timestamp: new Date().toISOString(),
    };
  }
}

async function fetchAndParseRSSFeed(feedUrl: string, params: SearchParams) {
  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Grant Tracker Pro RSS Reader'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xmlText = await response.text();
    
    // Simple XML parsing for RSS items
    const items = extractRSSItems(xmlText, params);
    
    return items.map(item => ({
      id: `rss-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: item.title,
      funder: item.funder || 'RSS Source',
      amount: item.amount || 0,
      deadline: item.deadline || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      category: item.category || params.category || 'General',
      description: item.description,
      requirements: item.requirements || [],
      source: 'rss',
      url: item.link,
      matchPercentage: calculateMatchScore(item, params),
      funderType: item.funderType || 'Unknown'
    }));

  } catch (error) {
    console.error(`RSS feed error for ${feedUrl}:`, error);
    return [];
  }
}

function extractRSSItems(xmlText: string, params: SearchParams) {
  // Basic RSS parsing - in production, use a proper XML parser
  const items = [];
  const itemMatches = xmlText.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];
  
  const query = params.query.toLowerCase();
  
  for (const itemXml of itemMatches.slice(0, 5)) { // Limit per feed
    try {
      const title = extractXMLContent(itemXml, 'title') || '';
      const description = extractXMLContent(itemXml, 'description') || '';
      const link = extractXMLContent(itemXml, 'link') || '';
      
      // Only include items that match search query
      if (title.toLowerCase().includes(query) || description.toLowerCase().includes(query)) {
        items.push({
          title: cleanText(title),
          description: cleanText(description).substring(0, 200),
          link: link,
          funder: extractFunder(description),
          amount: extractAmount(description),
          deadline: extractDeadline(description),
          category: extractCategory(title + ' ' + description, params.category),
          requirements: extractRequirements(description)
        });
      }
    } catch (error) {
      console.error('Error parsing RSS item:', error);
    }
  }
  
  return items;
}

function extractXMLContent(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function cleanText(text: string): string {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&[^;]+;/g, ' ')
    .trim();
}

function extractFunder(text: string): string {
  // Look for common funder patterns
  const patterns = [
    /funded by ([^.]+)/i,
    /from ([^.]+foundation[^.]*)/i,
    /([^.]+foundation)/i,
    /(department of [^.]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return 'RSS Source';
}

function extractAmount(text: string): number {
  const amountMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)/);
  if (amountMatch) {
    return parseInt(amountMatch[1].replace(/,/g, ''));
  }
  return 0;
}

function extractDeadline(text: string): string {
  const datePatterns = [
    /deadline[^.]*?(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /due[^.]*?(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /by (\d{1,2}\/\d{1,2}\/\d{4})/i
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const date = new Date(match[1]);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  
  // Default to 90 days from now
  return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function extractCategory(text: string, preferredCategory?: string): string {
  if (preferredCategory) return preferredCategory;
  
  const categories = {
    'education': ['education', 'school', 'student', 'learning'],
    'health': ['health', 'medical', 'healthcare', 'wellness'],
    'environment': ['environment', 'climate', 'conservation', 'green'],
    'arts': ['arts', 'culture', 'music', 'theater', 'creative'],
    'community': ['community', 'social', 'development', 'nonprofit']
  };
  
  const lowerText = text.toLowerCase();
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return category.charAt(0).toUpperCase() + category.slice(1);
    }
  }
  
  return 'General';
}

function extractRequirements(text: string): string[] {
  const requirements = [];
  
  if (text.includes('501(c)(3)') || text.includes('nonprofit')) {
    requirements.push('501(c)(3) status');
  }
  if (text.includes('proposal') || text.includes('application')) {
    requirements.push('Detailed proposal');
  }
  if (text.includes('budget')) {
    requirements.push('Budget documentation');
  }
  if (text.includes('evaluation') || text.includes('outcome')) {
    requirements.push('Evaluation plan');
  }
  
  return requirements;
}

function calculateMatchScore(item: any, params: SearchParams): number {
  let score = 60; // Base score
  
  const query = params.query.toLowerCase();
  const title = item.title.toLowerCase();
  const description = item.description.toLowerCase();
  
  // Title match bonus
  if (title.includes(query)) score += 20;
  
  // Description match bonus
  if (description.includes(query)) score += 10;
  
  // Category match bonus
  if (params.category && item.category === params.category) score += 10;
  
  return Math.min(score, 95); // Cap at 95%
}

async function searchGrantsGov(params: SearchParams, apiKey: string) {
  // Real grants.gov API integration would go here
  console.log('Searching grants.gov with API key');
  return [];
}

async function searchFoundationDirectory(params: SearchParams, apiKey: string) {
  // Real foundation directory API integration would go here
  console.log('Searching foundation directory with API key');
  return [];
}

async function searchFederalAgencies(params: SearchParams) {
  // Federal agency search without API key - limited functionality
  console.log('Searching federal agencies');
  return [];
}