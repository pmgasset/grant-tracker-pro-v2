// functions/api/load-grants.js
// This is the same as save-grants.js since it handles both operations
export async function onRequest(context) {
  const { request, env } = context;
  
  // Handle CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Handle POST - Save grants
    if (request.method === 'POST') {
      const data = await request.json();
      
      if (!data.grants || !Array.isArray(data.grants)) {
        return new Response(JSON.stringify({ 
          error: 'Invalid data - grants array required' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Generate simple user ID from IP and User-Agent
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const userAgent = request.headers.get('User-Agent') || 'unknown';
      const userId = `user_${hashString(ip + userAgent)}`;
      
      const saveData = {
        grants: data.grants,
        timestamp: new Date().toISOString(),
        userId: userId
      };

      // Save to KV if available
      if (env.GRANTS_KV) {
        try {
          await env.GRANTS_KV.put(`grants:${userId}`, JSON.stringify(saveData));
        } catch (kvError) {
          console.error('KV save failed:', kvError);
        }
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Grants saved successfully',
        userId: userId,
        grantCount: data.grants.length
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Handle GET - Load grants  
    if (request.method === 'GET') {
      const url = new URL(request.url);
      let userId = url.searchParams.get('userId');
      
      // Generate user ID if not provided
      if (!userId) {
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const userAgent = request.headers.get('User-Agent') || 'unknown';
        userId = `user_${hashString(ip + userAgent)}`;
      }

      let grants = [];
      
      // Load from KV if available
      if (env.GRANTS_KV) {
        try {
          const data = await env.GRANTS_KV.get(`grants:${userId}`, 'json');
          if (data && data.grants) {
            grants = data.grants;
          }
        } catch (kvError) {
          console.error('KV load failed:', kvError);
        }
      }

      return new Response(JSON.stringify({ 
        grants: grants,
        userId: userId,
        grantCount: grants.length,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Method not allowed
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Simple hash function for user ID generation
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}