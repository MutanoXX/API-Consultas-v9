/**
 * Consultas Service - Mini-service para interface de consultas
 * Porta: 3001
 * Endpoint: /consultas
 */

import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';

const app = new Hono();
const PORT = 3001;

// CORS configuration
app.use('*', async (c, next) => {
  c.res.headers.set('Access-Control-Allow-Origin', '*');
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  await next();
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'consultas-service' });
});

// Serve static files
app.use('*', serveStatic({ root: './' }));

// API proxy to main server
app.all('/api/proxy/*', async (c) => {
  const path = c.req.path.replace('/api/proxy', '');
  const url = new URL(`http://localhost:8080${path}`);
  const query = c.req.query();

  // Add query parameters
  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, value as string);
  });

  console.log('[Proxy] Requesting:', url.toString());

  try {
    const response = await fetch(url.toString(), {
      method: c.req.method,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return c.json(data);
  } catch (error: any) {
    console.error('[Proxy] Error:', error.message);
    return c.json(
      { success: false, error: 'Erro ao conectar com API' },
      500
    );
  }
});

// Start server
console.log(`[Consultas Service] Servidor iniciado na porta ${PORT}`);
console.log(`[Consultas Service] Acesse: http://localhost:${PORT}/consultas`);

export default {
  port: PORT,
  fetch: app.fetch,
  idleTimeout: 255,
};
