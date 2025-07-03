// Cloudflare Worker for Grant Data Persistence
// Handles saving and loading grant data using Cloudflare KV

interface Env {
  GRANTS_KV: KVNamespace;
  GRANTS_D1?: D1Database;
}

interface GrantData {
  grants: any[];
  timestamp: string;
  userId?: string;
}

export async function onRequest(context: EventContext<Env, "save-grants", any>) {
  const { request, env } = context;
  
  // Handle CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    switch (request.method) {
      case 'POST':
        return await saveGrants(request, env, corsHeaders);
      case 'GET':
        return await loadGrants(request, env, corsHeaders);
      case 'PUT':
        return await updateGrants(request, env, corsHeaders);
      case 'DELETE':
        return await deleteGrants(request, env, corsHeaders);
      default:
        return new Response('Method not allowed', { 
          status: 405,
          headers: corsHeaders 
        });
    }
  } catch (error) {
    console.error('Grant data operation error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function saveGrants(request: Request, env: Env, corsHeaders: Record<string, string>) {
  const data: GrantData = await request.json();
  
  if (!data.grants || !Array.isArray(data.grants)) {
    return new Response(JSON.stringify({ 
      error: 'Invalid data format',
      message: 'grants array is required' 
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }

  // Generate user ID from request (in real app, use authentication)
  const userAgent = request.headers.get('User-Agent') || '';
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const userId = data.userId || `user_${hashString(userAgent + ip)}`;

  const saveData = {
    ...data,
    userId,
    timestamp: new Date().toISOString(),
    version: '1.0'
  };

  try {
    // Save to KV store
    await env.GRANTS_KV.put(
      `grants:${userId}`,
      JSON.stringify(saveData),
      {
        metadata: {
          userId,
          lastModified: saveData.timestamp,
          grantCount: data.grants.length
        }
      }
    );

    // Also save to D1 if available for advanced queries
    if (env.GRANTS_D1) {
      try {
        await saveToD1Database(env.GRANTS_D1, saveData);
      } catch (d1Error) {
        console.error('D1 save failed, KV save successful:', d1Error);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Grants saved successfully',
      userId,
      grantCount: data.grants.length,
      timestamp: saveData.timestamp
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('Save to KV failed:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to save grants',
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function loadGrants(request: Request, env: Env, corsHeaders: Record<string, string>) {
  const url = new URL(request.url);
  let userId = url.searchParams.get('userId');

  // Generate user ID if not provided
  if (!userId) {
    const userAgent = request.headers.get('User-Agent') || '';
    const ip = request.headers.get('CF-Connecting-IP') || '';
    userId = `user_${hashString(userAgent + ip)}`;
  }

  try {
    const data = await env.GRANTS_KV.get(`grants:${userId}`, 'json') as GrantData | null;
    
    if (!data) {
      return new Response(JSON.stringify({ 
        grants: [],
        message: 'No saved grants found',
        userId 
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    return new Response(JSON.stringify({
      grants: data.grants,
      timestamp: data.timestamp,
      userId: data.userId,
      grantCount: data.grants.length
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('Load from KV failed:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to load grants',
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function updateGrants(request: Request, env: Env, corsHeaders: Record<string, string>) {
  // For updating individual grants or partial data
  const { grantId, updates, userId } = await request.json();
  
  if (!grantId || !updates) {
    return new Response(JSON.stringify({ 
      error: 'Grant ID and updates are required' 
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }

  try {
    // Load existing data
    const existingData = await env.GRANTS_KV.get(`grants:${userId}`, 'json') as GrantData | null;
    
    if (!existingData) {
      return new Response(JSON.stringify({ 
        error: 'No grants found for user' 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Update the specific grant
    const updatedGrants = existingData.grants.map(grant => 
      grant.id === grantId ? { ...grant, ...updates, lastUpdate: new Date().toISOString().split('T')[0] } : grant
    );

    const saveData = {
      ...existingData,
      grants: updatedGrants,
      timestamp: new Date().toISOString()
    };

    await env.GRANTS_KV.put(`grants:${userId}`, JSON.stringify(saveData));

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Grant updated successfully',
      updatedGrant: updatedGrants.find(g => g.id === grantId)
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('Update failed:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to update grant',
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function deleteGrants(request: Request, env: Env, corsHeaders: Record<string, string>) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const grantId = url.searchParams.get('grantId');

  if (!userId) {
    return new Response(JSON.stringify({ 
      error: 'User ID is required' 
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }

  try {
    if (grantId) {
      // Delete specific grant
      const existingData = await env.GRANTS_KV.get(`grants:${userId}`, 'json') as GrantData | null;
      
      if (existingData) {
        const updatedGrants = existingData.grants.filter(grant => grant.id !== parseInt(grantId));
        const saveData = {
          ...existingData,
          grants: updatedGrants,
          timestamp: new Date().toISOString()
        };
        
        await env.GRANTS_KV.put(`grants:${userId}`, JSON.stringify(saveData));
      }
    } else {
      // Delete all grants for user
      await env.GRANTS_KV.delete(`grants:${userId}`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: grantId ? 'Grant deleted successfully' : 'All grants deleted successfully'
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('Delete failed:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete grants',
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function saveToD1Database(db: D1Database, data: GrantData) {
  // Create table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS grants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      grant_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert or update user's grants
  await db.prepare(`
    INSERT OR REPLACE INTO grants (user_id, grant_data, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `).bind(data.userId, JSON.stringify(data)).run();
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}