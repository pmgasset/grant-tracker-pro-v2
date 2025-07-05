// functions/api/rss-status.js
// RSS status endpoint - JavaScript version

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
  }
];

export async function onRequestGET(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const statuses = [];
    
    for (const feed of RSS_FEEDS) {
      let status = { status: 'unknown', lastChecked: null, error: null };
      
      if (env.GRANTS_KV) {
        const statusKey = `feed-status:${feed.name}`;
        const storedStatus = await env.GRANTS_KV.get(statusKey, 'json');
        if (storedStatus) {
          status = storedStatus;
        }
      }
      
      statuses.push({
        name: feed.name,
        url: feed.url,
        type: feed.type,
        active: feed.active,
        ...status
      });
    }
    
    return new Response(JSON.stringify({
      feeds: statuses,
      timestamp: new Date().toISOString(),
      totalFeeds: RSS_FEEDS.length,
      activeFeeds: RSS_FEEDS.filter(f => f.active).length
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    console.error('RSS status error:', error);
    return new Response(JSON.stringify({
      error: 'Unable to retrieve RSS feed status',
      feeds: [],
      message: error.message
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