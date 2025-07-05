// functions/api/search-rss-grants.js
// RSS search - JavaScript version (simplified)

const RSS_FEEDS = [
  {
    url: 'https://www.grants.gov/rss/GG_NewOppByAgency.xml',
    name: 'Grants.gov New Opportunities',
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
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'search';
    const query = url.searchParams.get('query') || '';

    if (action === 'status') {
      return new Response(JSON.stringify({
        feeds: RSS_FEEDS.map(feed => ({
          name: feed.name,
          url: feed.url,
          type: feed.type,
          active: feed.active,
          status: 'unknown'
        })),
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

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

    // For now, return message that RSS feeds are being set up
    return new Response(JSON.stringify({
      error: true,
      message: 'RSS feed monitoring is being configured. Please try again later or add grants manually.',
      results: [],
      query
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('RSS search error:', error);
    return new Response(JSON.stringify({
      error: true,
      message: 'RSS search service is temporarily unavailable.',
      results: []
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

export async function onRequestOPTIONS(context) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}