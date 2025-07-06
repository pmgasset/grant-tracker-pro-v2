// functions/api/search-grants.js
export async function onRequestGET(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');

    if (!query) {
      return new Response(JSON.stringify({
        error: true,
        message: 'Please provide a search query parameter.',
        results: []
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Try to search real APIs first
    let results = [];
    try {
      // Search Grants.gov API
      const grantsGovResults = await searchGrantsGov(query);
      results.push(...grantsGovResults);
    } catch (error) {
      console.error('Grants.gov search failed:', error);
    }

    if (results.length === 0) {
      return new Response(JSON.stringify({
        error: true,
        message: 'Grant search service is temporarily unavailable. Government APIs may be down or rate-limited.',
        results: [],
        suggestion: 'Please try again later or add grants manually.'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({
      results: results.slice(0, 10),
      totalFound: results.length,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Search function error:', error);
    return new Response(JSON.stringify({
      error: true,
      message: 'Search service is currently unavailable. Please try again later.',
      results: []
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

async function searchGrantsGov(query) {
  const response = await fetch('https://api.grants.gov/v1/api/search2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keyword: query,
      oppStatuses: ['posted'],
      limit: 8
    })
  });

  if (!response.ok) {
    throw new Error(`Grants.gov API error: ${response.status}`);
  }

  const data = await response.json();
  return data.oppHits?.map(grant => ({
    id: `grants-gov-${grant.id}`,
    title: grant.title || 'Federal Grant Opportunity',
    funder: grant.agencyName || 'Federal Agency',
    amount: extractAmount(grant.description) || 0,
    deadline: formatDate(grant.closeDate) || getDefaultDeadline(),
    category: 'Federal',
    description: grant.description || 'Federal grant opportunity',
    requirements: ["501(c)(3) status", "Federal eligibility"],
    source: "grants.gov",
    url: `https://grants.gov/search-results-detail/${grant.id}`,
    matchPercentage: 85,
    funderType: "Federal"
  })) || [];
}

function extractAmount(description) {
  if (!description) return 0;
  const match = description.match(/\$[\d,]+/);
  return match ? parseInt(match[0].replace(/[$,]/g, '')) : 0;
}

function formatDate(dateString) {
  if (!dateString) return '';
  try {
    return new Date(dateString).toISOString().split('T')[0];
  } catch {
    return '';
  }
}

function getDefaultDeadline() {
  const date = new Date();
  date.setDate(date.getDate() + 60);
  return date.toISOString().split('T')[0];
}