export async function onRequestPOST(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    let data;
    try {
      data = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({
        error: true,
        message: 'Invalid JSON in request body'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (!data.grants || !Array.isArray(data.grants)) {
      return new Response(JSON.stringify({
        error: true,
        message: 'grants array is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Generate user ID from request headers
    const userAgent = request.headers.get('User-Agent') || '';
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userId = `user_${simpleHash(userAgent + ip)}`;

    const saveData = {
      grants: data.grants,
      timestamp: new Date().toISOString(),
      userId
    };

    // Try to save to KV if available
    if (env.GRANTS_KV) {
      try {
        await env.GRANTS_KV.put(`grants:${userId}`, JSON.stringify(saveData));
        return new Response(JSON.stringify({
          success: true,
          message: 'Grants saved successfully',
          userId,
          grantCount: data.grants.length
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (kvError) {
        console.error('KV save failed:', kvError);
      }
    }

    // If KV not available, return error
    return new Response(JSON.stringify({
      error: true,
      message: 'Data storage service is not configured. Please contact support.',
      temporary: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Save function error:', error);
    return new Response(JSON.stringify({
      error: true,
      message: 'Failed to save grants. Please try again later.'
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
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