// Lets the app check it can actually reach the server. The browser's own
// online flag stays true on Wi-Fi with no internet, or when only this server
// is down.
export function GET() {
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
