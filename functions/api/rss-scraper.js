export async function onRequestGET(context) {
  const { request } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'status';

  try {
    if (action === 'status') {
      return new Response(JSON.stringify({
        error: true,
        message: 'RSS scraping service is not yet implemented.',
        rssFeeds: 0,
        websites: 0,
        lastRun: 'Never',
        status: 'Not configured'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({
      error: true,
      message: 'RSS functionality is in development. Please check back later.',
      results: []
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: true,
      message: 'RSS service is currently unavailable.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

export async function onRequestPOST(context) {
  return new Response(JSON.stringify({
    error: true,
    message: 'RSS configuration is not yet implemented.'
  }), {
    status: 501,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export async function onRequestOPTIONS(context) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}