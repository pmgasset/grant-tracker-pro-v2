// functions/rss-monitor.ts
// Dedicated RSS monitoring worker for grant opportunities

interface Env {
  GRANTS_KV: KVNamespace;
  GRANTS_D1?: D1Database;
  RSS_WEBHOOK_URL?: string;
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
    url: 'https://foundationcenter.org/rss/new-grants.xml',
    name: 'Foundation Center',
    type: 'foundation',
    active: true
  },
  {
    url: 'https://www.federalregister.gov/agencies/health-and-human-services-department.rss',
    name: 'HHS Federal Register',
    type: 'federal',
    active: true
  },
  {
    url: 'https://www.nsf.gov/rss/rss_funding.xml',
    name: 'NSF Funding Opportunities',
    type: 'federal',
    active: true
  }
];

export async function onRequest(context: EventContext<Env, "rss-monitor", any>) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'monitor';

    switch (action) {
      case 'monitor':
        return await monitorAllFeeds(env, corsHeaders);
      case 'search':
        return await searchCachedFeeds(request, env, corsHeaders);
      case 'status':
        return await getFeedStatus(env, corsHeaders);
      default:
        return new Response('Invalid action', { status: 400, headers: corsHeaders });
    }
  } catch (error) {
    console.error('RSS Monitor error:', error);
    return new Response(JSON.stringify({
      error: 'RSS monitoring service error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
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
      console.log(`Monitoring feed: ${feed.name}`);
      const grants = await processFeed(feed, env);
      
      if (grants.length > 0) {
        await cacheGrants(feed, grants, env);
        results.newGrants += grants.length;
      }
      
      results.successful++;
      
      // Update feed status
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

async function processFeed(feed: any, env: Env) {
  try {
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'Grant Tracker Pro RSS Monitor/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      },
      cf: {
        cacheTtl: 300, // Cache for 5 minutes
        cacheEverything: true
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xmlText = await response.text();
    const grants = parseRSSFeed(xmlText, feed);
    
    return grants;
  } catch (error) {
    console.error(`Error processing feed ${feed.url}:`, error);
    throw error;
  }
}

function parseRSSFeed(xmlText: string, feed: any) {
  const grants = [];
  
  try {
    // Extract RSS items using regex (simple approach for Cloudflare Workers)
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const items = xmlText.match(itemRegex) || [];
    
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
  const guid = extractTag(itemXml, 'guid') || `${feed.name}-${Date.now()}`;

  if (!title || title.length < 10) {
    return null; // Skip invalid items
  }

  return {
    id: `rss-${btoa(guid).replace(/[^a-zA-Z0-9]/g, '').substring(0, 12)}`,
    title: title.substring(0, 200),
    funder: extractFunder(description, feed),
    amount: extractAmount(title + ' ' + description),
    deadline: extractDeadline(description, pubDate),
    category: extractCategory(title + ' ' + description),
    description: description.substring(0, 500),
    requirements: extractRequirements(description),
    source: `RSS: ${feed.name}`,
    url: link,
    matchPercentage: 75,
    funderType: feed.type === 'federal' ? 'Federal' : 'Foundation',
    pubDate: pubDate,
    feedSource: feed.name,
    isNew: true
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
    /submit[^.]*?by[^.]*?(\d{1,2}\/\d{1,2}\/\d{4})/i,
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
  
  // Default to 60 days from publication
  const baseDate = pubDate ? new Date(pubDate) : new Date();
  const futureDate = new Date(baseDate.getTime() + 60 * 24 * 60 * 60 * 1000);
  return futureDate.toISOString().split('T')[0];
}

function extractCategory(text: string): string {
  const categories = {
    'Health': ['health', 'medical', 'healthcare', 'wellness', 'disease', 'clinical'],
    'Education': ['education', 'school', 'student', 'learning', 'academic', 'university'],
    'Environment': ['environment', 'climate', 'conservation', 'sustainability', 'green', 'energy'],
    'Arts': ['arts', 'culture', 'music', 'theater', 'creative', 'humanities'],
    'Technology': ['technology', 'digital', 'innovation', 'research', 'science'],
    'Community': ['community', 'social', 'development', 'nonprofit', 'poverty', 'housing']
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
  if (lowerDesc.includes('proposal') || lowerDesc.includes('application')) {
    requirements.push('Detailed proposal');
  }
  if (lowerDesc.includes('budget')) {
    requirements.push('Budget documentation');
  }
  if (lowerDesc.includes('evaluation') || lowerDesc.includes('outcome')) {
    requirements.push('Evaluation plan');
  }
  if (lowerDesc.includes('partnership') || lowerDesc.includes('collaboration')) {
    requirements.push('Partnership required');
  }
  
  return requirements;
}

function isValidGrant(grant: any): boolean {
  return grant.title && 
         grant.title.length > 10 && 
         grant.description && 
         grant.description.length > 20 &&
         grant.funder &&
         grant.deadline;
}

async function cacheGrants(feed: any, grants: any[], env: Env) {
  try {
    const cacheKey = `rss-grants:${feed.name}:${new Date().toISOString().split('T')[0]}`;
    
    await env.GRANTS_KV.put(cacheKey, JSON.stringify({
      feed: feed.name,
      grants,
      timestamp: new Date().toISOString(),
      count: grants.length
    }), {
      expirationTtl: 86400 * 7 // Cache for 7 days
    });
    
    console.log(`Cached ${grants.length} grants from ${feed.name}`);
  } catch (error) {
    console.error('Error caching grants:', error);
  }
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
      expirationTtl: 86400 * 30 // Keep status for 30 days
    });
  } catch (error) {
    console.error('Error updating feed status:', error);
  }
}

async function searchCachedFeeds(request: Request, env: Env, corsHeaders: Record<string, string>) {
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || '';
  const category = url.searchParams.get('category') || '';
  
  if (!query) {
    return new Response(JSON.stringify({
      error: 'Query parameter required',
      results: []
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const searchResults = [];
    const today = new Date().toISOString().split('T')[0];
    
    // Search cached grants from all feeds
    for (const feed of RSS_FEEDS) {
      const cacheKey = `rss-grants:${feed.name}:${today}`;
      const cached = await env.GRANTS_KV.get(cacheKey, 'json');
      
      if (cached && cached.grants) {
        const matching = cached.grants.filter(grant => 
          grant.title.toLowerCase().includes(query.toLowerCase()) ||
          grant.description.toLowerCase().includes(query.toLowerCase()) ||
          (category && grant.category === category)
        );
        searchResults.push(...matching);
      }
    }
    
    return new Response(JSON.stringify({
      results: searchResults.slice(0, 20),
      totalFound: searchResults.length,
      query,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Search cached feeds error:', error);
    return new Response(JSON.stringify({
      error: 'RSS search temporarily unavailable',
      results: []
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
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

// Scheduled function for automatic monitoring (called by Cloudflare Cron)
export async function scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
  console.log('Starting scheduled RSS monitoring...');
  
  try {
    await monitorAllFeeds(env, {});
    console.log('Scheduled RSS monitoring completed successfully');
  } catch (error) {
    console.error('Scheduled RSS monitoring failed:', error);
  }
}