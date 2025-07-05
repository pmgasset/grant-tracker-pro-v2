// functions/api/search-rss-grants.ts
// Cloudflare Pages Function for RSS Grant Monitoring

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
      error: 'RSS monitoring service error',
      message: 'Unable to process RSS feeds at this time'
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
      error: 'Query parameter required',
      message: 'Please provide a search query',
      results: []
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    // Check if we have cached RSS data first
    const today = new Date().toISOString().split('T')[0];
    const searchResults = [];

    for (const feed of RSS_FEEDS) {
      if (!feed.active) continue;

      try {
        // Try to get cached data
        const cacheKey = `rss-grants:${feed.name}:${today}`;
        const cached = await env.GRANTS_KV.get(cacheKey, 'json');
        
        if (cached && cached.grants) {
          // Search cached grants
          const matching = cached.grants.filter((grant: any) => 
            grant.title.toLowerCase().includes(query.toLowerCase()) ||
            grant.description.toLowerCase().includes(query.toLowerCase())
          );
          searchResults.push(...matching);
        } else {
          // If no cache, try to fetch fresh data
          const freshGrants = await fetchFeedData(feed);
          if (freshGrants.length > 0) {
            await cacheFeedData(feed, freshGrants, env);
            const matching = freshGrants.filter((grant: any) => 
              grant.title.toLowerCase().includes(query.toLowerCase()) ||
              grant.description.toLowerCase().includes(query.toLowerCase())
            );
            searchResults.push(...matching);
          }
        }
      } catch (feedError) {
        console.error(`Error processing feed ${feed.name}:`, feedError);
        // Continue with other feeds
      }
    }

    return new Response(JSON.stringify({
      results: searchResults.slice(0, 15),
      totalFound: searchResults.length,
      query,
      source: 'rss',
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('RSS search error:', error);
    return new Response(JSON.stringify({
      error: true,
      message: 'RSS search is temporarily unavailable. Please try web search or add grants manually.',
      results: []
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function fetchFeedData(feed: any) {
  try {
    console.log(`Fetching RSS feed: ${feed.name}`);
    
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'Grant Tracker Pro RSS Reader/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xmlText = await response.text();
    const grants = parseRSSFeed(xmlText, feed);
    
    console.log(`Parsed ${grants.length} grants from ${feed.name}`);
    return grants;
    
  } catch (error) {
    console.error(`Error fetching feed ${feed.url}:`, error);
    return [];
  }
}

function parseRSSFeed(xmlText: string, feed: any) {
  const grants = [];
  
  try {
    // Simple RSS parsing using regex (works in Cloudflare environment)
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const items = xmlText.match(itemRegex) || [];
    
    for (const item of items.slice(0, 8)) { // Limit to 8 items per feed
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

  if (!title || title.length < 10) {
    return null;
  }

  // Generate a consistent ID
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
    url: link,
    matchPercentage: 75,
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
  const patterns = [
    /funded by ([^.;,]{5,50})/i,
    /(\w+ foundation)/i,
    /(department of [^.;,]{5,30})/i,
    /(national \w+)/i
  ];
  
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return feed.name;
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
      return amount;
    }
  }
  
  return 0;
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
  
  // Default to 45 days from publication or today
  const baseDate = pubDate ? new Date(pubDate) : new Date();
  const futureDate = new Date(baseDate.getTime() + 45 * 24 * 60 * 60 * 1000);
  return futureDate.toISOString().split('T')[0];
}

function extractCategory(text: string): string {
  const categories = {
    'Health': ['health', 'medical', 'healthcare', 'disease'],
    'Education': ['education', 'school', 'student', 'learning'],
    'Environment': ['environment', 'climate', 'conservation'],
    'Technology': ['technology', 'innovation', 'research'],
    'Community': ['community', 'social', 'development']
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
  return grant.title && 
         grant.title.length > 10 && 
         grant.description && 
         grant.description.length > 20;
}

async function cacheFeedData(feed: any, grants: any[], env: Env) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `rss-grants:${feed.name}:${today}`;
    
    await env.GRANTS_KV.put(cacheKey, JSON.stringify({
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
      }
      
      results.successful++;
      await updateFeedStatus(feed, 'success', null, env);
      
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
    await env.GRANTS_KV.put(statusKey, JSON.stringify({
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
      const status = await env.GRANTS_KV.get(statusKey, 'json');
      
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