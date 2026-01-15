/**
 * Consultas Service - Mini-service para interface de consultas
 * Porta: 3001
 * Endpoint: /consultas
 */

import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import * as userManager from './user-manager.js';

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

// Middleware de autenticação
async function authMiddleware(c: any, next: any) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return c.json({ success: false, error: 'Token não fornecido' }, 401);
  }

  const user = userManager.getUserByToken(token);

  if (!user) {
    return c.json({ success: false, error: 'Token inválido ou expirado' }, 401);
  }

  // Adicionar usuário ao contexto
  c.set('user', user);

  await next();
}

// ==========================================
// ENDPOINTS PÚBLICOS
// ==========================================

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'consultas-service' });
});

// Registro de usuário
app.post('/api/users/register', async (c) => {
  try {
    const { username, password } = await c.req.json();

    if (!username || !password) {
      return c.json({ success: false, error: 'Usuário e senha são obrigatórios' }, 400);
    }

    if (username.length < 3 || username.length > 20) {
      return c.json({ success: false, error: 'Nome de usuário deve ter entre 3 e 20 caracteres' }, 400);
    }

    if (password.length < 6) {
      return c.json({ success: false, error: 'Senha deve ter pelo menos 6 caracteres' }, 400);
    }

    const result = userManager.createUser(username, password);

    if (!result.success) {
      return c.json(result, 400);
    }

    return c.json(result);
  } catch (error: any) {
    console.error('[API] Erro no registro:', error);
    return c.json({ success: false, error: 'Erro ao criar usuário' }, 500);
  }
});

// Login de usuário
app.post('/api/users/login', async (c) => {
  try {
    const { username, password } = await c.req.json();

    if (!username || !password) {
      return c.json({ success: false, error: 'Usuário e senha são obrigatórios' }, 400);
    }

    const result = userManager.authenticateUser(username, password);

    if (!result.success) {
      return c.json(result, 401);
    }

    return c.json(result);
  } catch (error: any) {
    console.error('[API] Erro no login:', error);
    return c.json({ success: false, error: 'Erro na autenticação' }, 500);
  }
});

// API proxy para o servidor principal
app.all('/api/proxy/*', async (c) => {
  const path = c.req.path.replace('/api/proxy', '');
  const url = new URL(`http://localhost:8080${path}`);
  const query = c.req.query();

  // Obter usuário autenticado (se existir)
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  const user = token ? userManager.getUserByToken(token) : null;

  // Adicionar query parameters
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

    // Salvar a consulta se usuário estiver autenticado
    if (user && data) {
      const queryType = query.tipo || 'unknown';
      const queryParam = query.cpf || query.q || 'unknown';

      userManager.saveQuery(user.id, {
        type: queryType,
        parameter: queryParam,
        success: data.success || false,
        result: data.success ? data.data : null,
        error: data.error || null
      });
    }

    return c.json(data);
  } catch (error: any) {
    console.error('[Proxy] Error:', error.message);
    return c.json(
      { success: false, error: 'Erro ao conectar com API' },
      500
    );
  }
});

// ==========================================
// ENDPOINTS PRIVADOS (Requer Autenticação)
// ==========================================

// Obter consultas do usuário atual
app.get('/api/user/queries', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const limit = parseInt(c.req.query('limit') || '50');

    const result = userManager.getUserQueries(user.id, limit);

    return c.json(result);
  } catch (error: any) {
    console.error('[API] Erro ao buscar consultas:', error);
    return c.json({ success: false, error: 'Erro ao buscar consultas' }, 500);
  }
});

// ==========================================
// ARQUIVOS ESTÁTICOS
// ==========================================

app.use('*', serveStatic({ root: './' }));

// ==========================================
// INICIALIZAR SERVIDOR
// ==========================================

console.log(`[Consultas Service] Servidor iniciado na porta ${PORT}`);
console.log(`[Consultas Service] Acesse: http://localhost:${PORT}/consultas`);

export default {
  port: PORT,
  fetch: app.fetch,
  idleTimeout: 255,
};
