export async function onRequestGET(context) {
  return new Response(JSON.stringify({
    message: "Pages Functions are working!",
    timestamp: new Date().toISOString(),
    path: "Direct function test"
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}