// functions/api/search-grants.ts
// Main grant search function

interface Env {
  GRANTS_KV: KVNamespace;
}

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
        error: 'Query parameter is required',
        results: []
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check cache first
    const cacheKey = `web-search:${query}`;
    const cached = await env.GRANTS_KV?.get(cacheKey);
    
    if (cached) {
      return new Response(cached, {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          ...corsHeaders
        }
      });
    }

    // For now, return a message that web search needs API keys
    const response = {
      error: true,
      message: 'Web grant search requires API keys to be configured. Use RSS search or add grants manually.',
      results: [],
      suggestion: 'Try the RSS Feeds option for real-time grant discovery.'
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