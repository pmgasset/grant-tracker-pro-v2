export async function onRequestGET(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const url = new URL(request.url);
    let userId = url.searchParams.get('userId');

    if (!userId) {
      const userAgent = request.headers.get('User-Agent') || '';
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      userId = `user_${simpleHash(userAgent + ip)}`;
    }

    if (!env.GRANTS_KV) {
      return new Response(JSON.stringify({
        error: true,
        message: 'Data storage service is not configured.',
        grants: []
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    try {
      const data = await env.GRANTS_KV.get(`grants:${userId}`, 'json');
      
      if (!data) {
        return new Response(JSON.stringify({
          grants: [],
          message: 'No saved grants found',
          userId
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      return new Response(JSON.stringify({
        grants: data.grants || [],
        timestamp: data.timestamp,
        userId: data.userId,
        grantCount: data.grants?.length || 0
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (kvError) {
      console.error('KV read failed:', kvError);
      return new Response(JSON.stringify({
        error: true,
        message: 'Failed to load grants from storage.',
        grants: []
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

  } catch (error) {
    console.error('Load function error:', error);
    return new Response(JSON.stringify({
      error: true,
      message: 'Failed to load grants. Please try again later.',
      grants: []
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

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}