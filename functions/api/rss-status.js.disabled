export async function onRequestGET(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const feeds = [
      {
        name: 'Grants.gov New Opportunities',
        url: 'https://www.grants.gov/rss/GG_NewOppByAgency.xml',
        type: 'federal',
        active: true,
        status: 'monitoring'
      },
      {
        name: 'NSF Funding Opportunities',
        url: 'https://www.nsf.gov/rss/rss_funding.xml',
        type: 'federal',
        active: true,
        status: 'monitoring'
      }
    ];
    
    return new Response(JSON.stringify({
      feeds: feeds,
      timestamp: new Date().toISOString(),
      totalFeeds: feeds.length,
      message: "RSS status working!"
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'RSS status error',
      message: error.message
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