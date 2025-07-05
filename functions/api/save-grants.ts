// functions/api/save-grants.ts
// Fixed with proper POST handling

interface Env {
  GRANTS_KV: KVNamespace;
}

// Handle POST requests
export async function onRequestPOST(context: any) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const data = await request.json();
    
    if (!data.grants || !Array.isArray(data.grants)) {
      return new Response(JSON.stringify({
        error: 'Invalid data format - grants array required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Generate simple user ID
    const userAgent = request.headers.get('User-Agent') || '';
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userId = data.userId || `user_${simpleHash(userAgent + ip)}`;

    const saveData = {
      grants: data.grants,
      userId,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };

    // Save to KV
    if (env.GRANTS_KV) {
      await env.GRANTS_KV.put(
        `grants:${userId}`,
        JSON.stringify(saveData),
        { expirationTtl: 86400 * 30 } // 30 days
      );
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Grants saved successfully',
      userId,
      grantCount: data.grants.length
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Save grants error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to save grants',
      message: error.message
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}