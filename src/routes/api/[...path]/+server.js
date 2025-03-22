export function GET() {
  // This prevents SvelteKit from handling API routes
  // All API calls should go through the lib/api.js functions which point to Express
  return new Response(
    JSON.stringify({ error: "API endpoint handled by Express server" }),
    {
      status: 307, // Temporary redirect
      headers: {
        "Content-Type": "application/json",
        Location: "http://localhost:3001/api", // Redirect to Express
      },
    },
  );
}

export { GET as POST, GET as PUT, GET as DELETE };
