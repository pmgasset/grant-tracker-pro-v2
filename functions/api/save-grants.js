// functions/api/search-grants.js
export async function onRequest(context) {
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
    const query = url.searchParams.get('query') || '';

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query parameter required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Simple test response for now
    const results = [
      {
        id: 'test-1',
        title: `Test Grant for ${query}`,
        funder: 'Test Agency',
        amount: 50000,
        deadline: '2025-12-31',
        description: `Test grant opportunity for ${query}`,
        source: 'test'
      }
    ];

    return new Response(JSON.stringify({
      results: results,
      totalFound: results.length,
      timestamp: new Date().toISOString()
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
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