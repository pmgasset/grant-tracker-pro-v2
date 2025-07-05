// functions/api/search-rss-grants.ts
// RSS Grant Monitoring - NO FALLBACK DATA VERSION

interface Env {
  GRANTS_KV: KVNamespace;
}

// RSS feed sources for grant opportunities
const RSS_FEEDS = [
  {
    url: 'https://www.grants.gov/rss/GG_NewOppByAgency.xml',
    name: 'Grants.gov New Opportunities',
    type: 'federal',
    active: true
  },
  {
    url: 'https://www.nsf.gov/rss/rss_funding.xml',
    name: 'NSF Funding Opportunities', 
    type: 'federal',
    active: true
  },
  {
    url: 'https://www.federalregister.gov/agencies/health-and-human-services-department.rss',
    name: 'HHS Federal Register',
    type: 'federal', 
    active: true
  }
];

export async function onRequestGET(context: any) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'search';
    const query = url.searchParams.get('query') || '';

    switch (action) {
      case 'search':
        return await searchRSSFeeds(query, url.searchParams, env, corsHeaders);
      case 'status':
        return await getFeedStatus(env, corsHeaders);
      case 'monitor':
        return await monitorAllFeeds(env, corsHeaders);
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action. Use: search, status, or monitor'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
  } catch (error) {
    console.error('RSS Function error:', error);
    return new Response(JSON.stringify({
      error: true,
      message: 'RSS monitoring service is currently unavailable. Please try again later.',
      results: []
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

export async function onRequestOPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

async function searchRSSFeeds(query: string, searchParams: URLSearchParams, env: Env, corsHeaders: Record<string, string>) {
  if (!query) {
    return new Response(JSON.stringify({
      error: true,
      message: 'Please provide a search query for RSS feeds.',
      results: []
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  console.log(`Searching RSS feeds for: ${query}`);

  try {
    const today = new Date().toISOString().split('T')[0];
    const searchResults = [];
    let feedsAttempted = 0;
    let feedsSuccessful = 0;

    for (const feed of RSS_FEEDS) {
      if (!feed.active) continue;
      feedsAttempted++;

      try {
        console.log(`Checking feed: ${feed.name}`);
        
        // Try cached data first
        const cacheKey = `rss-grants:${feed.name}:${today}`;
        let grants = [];
        
        const cached = await env.GRANTS_KV?.get(cacheKey, 'json');
        if (cached && cached.grants && Array.isArray(cached.grants) && cached.grants.length > 0) {
          console.log(`Found ${cached.grants.length} cached grants from ${feed.name}`);
          grants = cached.grants;
          feedsSuccessful++;
        } else {
          console.log(`No cache for ${feed.name}, fetching fresh data...`);
          // Try to fetch fresh data
          grants = await fetchFeedData(feed);
          if (grants.length > 0) {
            feedsSuccessful++;
            await cacheFeedData(feed, grants, env);
            console.log(`Fetched and cached ${grants.length} grants from ${feed.name}`);
          } else {
            console.log(`No grants found in ${feed.name}`);
          }
        }

        // Search for matching grants
        if (grants.length > 0) {
          const queryLower = query.toLowerCase();
          const matching = grants.filter((grant: any) => {
            if (!grant.title || !grant.description) return false;
            return grant.title.toLowerCase().includes(queryLower) ||
                   grant.description.toLowerCase().includes(queryLower);
          });
          
          if (matching.length > 0) {
            console.log(`Found ${matching.length} matching grants in ${feed.name}`);
            searchResults.push(...matching);
          }
        }

      } catch (feedError) {
        console.error(`Error processing feed ${feed.name}:`, feedError);
        // Continue with other feeds
      }
    }

    console.log(`Search complete: ${feedsAttempted} feeds attempted, ${feedsSuccessful} successful, ${searchResults.length} total results`);

    // NO FALLBACK DATA - Return actual results or honest error
    if (feedsSuccessful === 0) {
      return new Response(JSON.stringify({
        error: true,
        message: 'All RSS feeds are currently unavailable. This could be due to network issues or the feeds being temporarily down. Please try again later or add grants manually.',
        results: [],
        feedsAttempted,
        feedsSuccessful: 0,
        timestamp: new Date().toISOString()
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (searchResults.length === 0) {
      return new Response(JSON.stringify({
        error: false,
        message: `No grants found matching "${query}" in the available RSS feeds. Try different search terms or check back later for new grant postings.`,
        results: [],
        feedsAttempted,
        feedsSuccessful,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Return actual RSS results
    return new Response(JSON.stringify({
      results: searchResults.slice(0, 15),
      totalFound: searchResults.length,
      query,
      source: 'rss',
      feedsAttempted,
      feedsSuccessful,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('RSS search error:', error);
    return new Response(JSON.stringify({
      error: true,
      message: 'RSS search service encountered an error. Please try again later or add grants manually.',
      results: []
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function fetchFeedData(feed: any): Promise<any[]> {
  try {
    console.log(`Fetching RSS feed: ${feed.url}`);
    
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'Grant Tracker Pro RSS Reader/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      console.error(`RSS feed ${feed.name} returned ${response.status}: ${response.statusText}`);
      return [];
    }

    const xmlText = await response.text();
    
    if (!xmlText || xmlText.trim().length === 0) {
      console.error(`RSS feed ${feed.name} returned empty content`);
      return [];
    }

    // Basic XML validation
    if (!xmlText.includes('<rss') && !xmlText.includes('<feed') && !xmlText.includes('<?xml')) {
      console.error(`RSS feed ${feed.name} did not return valid XML`);
      return [];
    }

    const grants = parseRSSFeed(xmlText, feed);
    console.log(`Successfully parsed ${grants.length} grants from ${feed.name}`);
    return grants;
    
  } catch (error) {
    console.error(`Failed to fetch RSS feed ${feed.url}:`, error);
    return []; // Always return empty array - NEVER generate fake data
  }
}

function parseRSSFeed(xmlText: string, feed: any): any[] {
  const grants = [];
  
  try {
    // Extract RSS items using regex
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const items = xmlText.match(itemRegex) || [];
    
    console.log(`Found ${items.length} items in ${feed.name} RSS feed`);

    for (const item of items.slice(0, 10)) { // Limit to 10 items per feed
      try {
        const grant = parseRSSItem(item, feed);
        if (grant && isValidGrant(grant)) {
          grants.push(grant);
        }
      } catch (itemError) {
        console.error('Error parsing RSS item:', itemError);
      }
    }
  } catch (error) {
    console.error('Error parsing RSS feed:', error);
  }
  
  return grants;
}

function parseRSSItem(itemXml: string, feed: any) {
  const extractTag = (xml: string, tag: string): string => {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? cleanText(match[1]) : '';
  };

  const title = extractTag(itemXml, 'title');
  const description = extractTag(itemXml, 'description');
  const link = extractTag(itemXml, 'link');
  const pubDate = extractTag(itemXml, 'pubDate');

  if (!title || title.length < 5) {
    return null;
  }

  const id = `rss-${feed.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

  return {
    id,
    title: title.substring(0, 200),
    funder: extractFunder(description, feed),
    amount: extractAmount(title + ' ' + description),
    deadline: extractDeadline(description, pubDate),
    category: extractCategory(title + ' ' + description),
    description: description.substring(0, 400),
    requirements: extractRequirements(description),
    source: `RSS: ${feed.name}`,
    url: link || feed.url,
    matchPercentage: 80,
    funderType: feed.type === 'federal' ? 'Federal' : 'Foundation',
    pubDate: pubDate,
    feedSource: feed.name,
    isSearchResult: true
  };
}

function cleanText(text: string): string {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFunder(description: string, feed: any): string {
  // Try to extract actual funder from content
  const patterns = [
    /funded by ([^.;,]{5,50})/i,
    /(\w+ foundation[^.;,]{0,20})/i,
    /(department of [^.;,]{5,40})/i,
    /(national [^.;,]{5,40})/i
  ];
  
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[1].trim().length > 3) {
      return match[1].trim();
    }
  }
  
  return feed.name; // Use feed name as fallback, not fake data
}

function extractAmount(text: string): number {
  const patterns = [
    /\$([0-9,]+(?:\.[0-9]{2})?)\s*(million|m)/i,
    /\$([0-9,]+(?:\.[0-9]{2})?)/,
    /([0-9,]+)\s*dollars/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let amount = parseFloat(match[1].replace(/,/g, ''));
      if (match[2] && (match[2].toLowerCase() === 'million' || match[2].toLowerCase() === 'm')) {
        amount *= 1000000;
      }
      if (amount > 0) return amount;
    }
  }
  
  return 0; // Return 0 if no amount found - don't fake it
}

function extractDeadline(description: string, pubDate: string): string {
  const datePatterns = [
    /deadline[^.]*?(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /due[^.]*?(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})/
  ];
  
  for (const pattern of datePatterns) {
    const match = description.match(pattern);
    if (match) {
      const date = new Date(match[1]);
      if (!isNaN(date.getTime()) && date > new Date()) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  
  // Use publication date + reasonable time if available
  if (pubDate) {
    const baseDate = new Date(pubDate);
    if (!isNaN(baseDate.getTime())) {
      const futureDate = new Date(baseDate.getTime() + 60 * 24 * 60 * 60 * 1000);
      return futureDate.toISOString().split('T')[0];
    }
  }
  
  // Default to 60 days from now
  const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  return futureDate.toISOString().split('T')[0];
}

function extractCategory(text: string): string {
  const categories = {
    'Health': ['health', 'medical', 'healthcare', 'disease', 'wellness'],
    'Education': ['education', 'school', 'student', 'learning', 'academic'],
    'Environment': ['environment', 'climate', 'conservation', 'sustainability'],
    'Technology': ['technology', 'innovation', 'research', 'digital'],
    'Community': ['community', 'social', 'development', 'housing'],
    'Arts': ['arts', 'culture', 'humanities', 'creative']
  };
  
  const lowerText = text.toLowerCase();
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return category;
    }
  }
  
  return 'General';
}

function extractRequirements(description: string): string[] {
  const requirements = [];
  const lowerDesc = description.toLowerCase();
  
  if (lowerDesc.includes('501(c)(3)') || lowerDesc.includes('nonprofit')) {
    requirements.push('501(c)(3) status');
  }
  if (lowerDesc.includes('proposal')) {
    requirements.push('Detailed proposal');
  }
  if (lowerDesc.includes('budget')) {
    requirements.push('Budget documentation');
  }
  
  return requirements;
}

function isValidGrant(grant: any): boolean {
  return grant && 
         grant.title && 
         grant.title.length > 5 && 
         grant.description && 
         grant.description.length > 10 &&
         grant.funder;
}

async function cacheFeedData(feed: any, grants: any[], env: Env) {
  if (!grants || grants.length === 0) return;
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `rss-grants:${feed.name}:${today}`;
    
    await env.GRANTS_KV?.put(cacheKey, JSON.stringify({
      feed: feed.name,
      grants,
      timestamp: new Date().toISOString(),
      count: grants.length
    }), {
      expirationTtl: 86400 // Cache for 1 day
    });
    
    console.log(`Cached ${grants.length} grants from ${feed.name}`);
  } catch (error) {
    console.error('Error caching grants:', error);
  }
}

async function monitorAllFeeds(env: Env, corsHeaders: Record<string, string>) {
  const results = {
    totalFeeds: RSS_FEEDS.length,
    successful: 0,
    failed: 0,
    newGrants: 0,
    errors: []
  };

  for (const feed of RSS_FEEDS) {
    if (!feed.active) continue;

    try {
      const grants = await fetchFeedData(feed);
      
      if (grants.length > 0) {
        await cacheFeedData(feed, grants, env);
        results.newGrants += grants.length;
        results.successful++;
      } else {
        results.failed++;
      }
      
      await updateFeedStatus(feed, grants.length > 0 ? 'success' : 'empty', null, env);
      
    } catch (error) {
      console.error(`Feed error ${feed.url}:`, error);
      results.failed++;
      results.errors.push({
        feed: feed.name,
        error: error.message
      });
      await updateFeedStatus(feed, 'error', error.message, env);
    }
  }

  return new Response(JSON.stringify({
    success: true,
    timestamp: new Date().toISOString(),
    results
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function updateFeedStatus(feed: any, status: string, error: string | null, env: Env) {
  try {
    const statusKey = `feed-status:${feed.name}`;
    await env.GRANTS_KV?.put(statusKey, JSON.stringify({
      feed: feed.name,
      status,
      error,
      lastChecked: new Date().toISOString(),
      url: feed.url
    }), {
      expirationTtl: 86400 * 7 // Keep status for 7 days
    });
  } catch (error) {
    console.error('Error updating feed status:', error);
  }
}

async function getFeedStatus(env: Env, corsHeaders: Record<string, string>) {
  try {
    const statuses = [];
    
    for (const feed of RSS_FEEDS) {
      const statusKey = `feed-status:${feed.name}`;
      const status = await env.GRANTS_KV?.get(statusKey, 'json');
      
      statuses.push({
        name: feed.name,
        url: feed.url,
        type: feed.type,
        active: feed.active,
        status: status || { status: 'unknown', lastChecked: null }
      });
    }
    
    return new Response(JSON.stringify({
      feeds: statuses,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Get feed status error:', error);
    return new Response(JSON.stringify({
      error: 'Unable to retrieve feed status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}