// functions/api/save-grants.js - Fixed version
export async function onRequest(context) {
  const { request, env } = context;
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Always return JSON responses
  const jsonHeaders = {
    'Content-Type': 'application/json',
    ...corsHeaders
  };

  try {
    console.log('Request method:', request.method);

    // Handle POST - Save grants
    if (request.method === 'POST') {
      console.log('Processing POST request');
      
      let data;
      try {
        data = await request.json();
        console.log('Received data:', data);
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        return new Response(JSON.stringify({ 
          error: 'Invalid JSON in request body',
          message: jsonError.message 
        }), {
          status: 400,
          headers: jsonHeaders
        });
      }
      
      if (!data.grants || !Array.isArray(data.grants)) {
        return new Response(JSON.stringify({ 
          error: 'Invalid data format',
          message: 'grants array is required',
          received: typeof data.grants
        }), {
          status: 400,
          headers: jsonHeaders
        });
      }

      // Generate user ID
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const userAgent = request.headers.get('User-Agent') || 'unknown';
      const userId = `user_${hashString(ip + userAgent)}`;
      
      const saveData = {
        grants: data.grants,
        timestamp: new Date().toISOString(),
        userId: userId
      };

      console.log('Saving data for user:', userId);

      // Save to KV if available
      let kvSaved = false;
      if (env.GRANTS_KV) {
        try {
          await env.GRANTS_KV.put(`grants:${userId}`, JSON.stringify(saveData));
          kvSaved = true;
          console.log('Successfully saved to KV');
        } catch (kvError) {
          console.error('KV save failed:', kvError);
        }
      } else {
        console.log('KV not available');
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Grants saved successfully',
        userId: userId,
        grantCount: data.grants.length,
        kvSaved: kvSaved,
        timestamp: saveData.timestamp
      }), {
        status: 200,
        headers: jsonHeaders
      });
    }

    // Handle GET - Load grants  
    if (request.method === 'GET') {
      console.log('Processing GET request');
      
      const url = new URL(request.url);
      let userId = url.searchParams.get('userId');
      
      // Generate user ID if not provided
      if (!userId) {
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const userAgent = request.headers.get('User-Agent') || 'unknown';
        userId = `user_${hashString(ip + userAgent)}`;
      }

      console.log('Loading data for user:', userId);

      let grants = [];
      let kvLoaded = false;
      
      // Load from KV if available
      if (env.GRANTS_KV) {
        try {
          const data = await env.GRANTS_KV.get(`grants:${userId}`, 'json');
          if (data && data.grants) {
            grants = data.grants;
            kvLoaded = true;
            console.log('Successfully loaded from KV');
          }
        } catch (kvError) {
          console.error('KV load failed:', kvError);
        }
      } else {
        console.log('KV not available');
      }

      return new Response(JSON.stringify({ 
        grants: grants,
        userId: userId,
        grantCount: grants.length,
        kvLoaded: kvLoaded,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: jsonHeaders
      });
    }

    // Method not supported
    console.log('Unsupported method:', request.method);
    return new Response(JSON.stringify({
      error: 'Method not allowed',
      method: request.method,
      supportedMethods: ['GET', 'POST', 'OPTIONS']
    }), { 
      status: 405,
      headers: jsonHeaders
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message,
      stack: error.stack
    }), { 
      status: 500,
      headers: jsonHeaders
    });
  }
}

// Hash function for user ID generation
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}