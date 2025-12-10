// Netlify Serverless Function: /api/health
// Health check endpoint

export default async (request, context) => {
    return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: 'production'
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};

export const config = {
    path: "/api/health"
};
