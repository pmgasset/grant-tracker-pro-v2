// functions/api/search-grants.ts
// Fixed with proper GET handling

interface Env {
  GRANTS_KV: KVNamespace;
}

// Handle GET requests
export async function onRequestGET(context: any) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';

    if (!query) {
      return new Response(JSON.stringify({
        error: true,
        message: 'Please provide a search query',
        results: []
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check cache first
    const cacheKey = `web-search:${query}`;
    let cached = null;
    if (env.GRANTS_KV) {
      cached = await env.GRANTS_KV.get(cacheKey);
    }
    
    if (cached) {
      return new Response(cached, {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          ...corsHeaders
        }
      });
    }

    // Return message about needing API configuration
    const response = {
      error: true,
      message: 'Web grant search requires API keys to be configured. Try RSS search for real-time grant discovery, or add grants manually.',
      results: [],
      suggestion: 'Use the RSS Feeds option to search real grant opportunities.'
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Search grants error:', error);
    return new Response(JSON.stringify({
      error: true,
      message: 'Grant search service is temporarily unavailable.',
      results: []
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Handle OPTIONS requests (CORS)
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