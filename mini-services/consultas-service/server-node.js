/**
 * Consultas Service - Node.js version (sem dependência de Bun)
 * Porta: 3001
 * Endpoint: /consultas
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const userManager = require('./user-manager');

const PORT = 3001;

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, data, statusCode = 200) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function getQueryParam(req, param) {
  const parsedUrl = url.parse(req.url, true);
  return parsedUrl.query[param];
}

function getAuthToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

function serveStaticFile(req, res) {
  let filePath = path.join(__dirname, req.url);

  // Default to index.html for root
  if (filePath === path.join(__dirname, '/')) {
    filePath = path.join(__dirname, 'index.html');
  }

  // Remove query parameters
  filePath = filePath.split('?')[0];

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    sendJson(res, { error: 'File not found' }, 404);
    return;
  }

  // Read and serve file
  const ext = path.extname(filePath);
  const contentType = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  }[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, { error: 'Error reading file' }, 500);
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// ==========================================
// ROUTE HANDLERS
// ==========================================

// Middleware de autenticação
function authMiddleware(req, res, next) {
  const token = getAuthToken(req);

  if (!token) {
    return sendJson(res, { success: false, error: 'Token não fornecido' }, 401);
  }

  const user = userManager.getUserByToken(token);

  if (!user) {
    return sendJson(res, { success: false, error: 'Token inválido ou expirado' }, 401);
  }

  req.user = user;
  next();
}

// ==========================================
// ENDPOINTS PÚBLICOS
// ==========================================

// Health check
function handleHealth(req, res) {
  sendJson(res, { status: 'ok', service: 'consultas-service' });
}

// Registro de usuário
async function handleRegister(req, res) {
  try {
    const body = await parseBody(req);
    const { username, password } = body;

    if (!username || !password) {
      return sendJson(res, { success: false, error: 'Usuário e senha são obrigatórios' }, 400);
    }

    if (username.length < 3 || username.length > 20) {
      return sendJson(res, { success: false, error: 'Nome de usuário deve ter entre 3 e 20 caracteres' }, 400);
    }

    if (password.length < 6) {
      return sendJson(res, { success: false, error: 'Senha deve ter pelo menos 6 caracteres' }, 400);
    }

    const result = userManager.createUser(username, password);

    if (!result.success) {
      return sendJson(res, result, 400);
    }

    sendJson(res, result);
  } catch (error) {
    console.error('[API] Erro no registro:', error);
    sendJson(res, { success: false, error: 'Erro ao criar usuário' }, 500);
  }
}

// Login de usuário
async function handleLogin(req, res) {
  try {
    const body = await parseBody(req);
    const { username, password } = body;

    if (!username || !password) {
      return sendJson(res, { success: false, error: 'Usuário e senha são obrigatórios' }, 400);
    }

    const result = userManager.authenticateUser(username, password);

    if (!result.success) {
      return sendJson(res, result, 401);
    }

    sendJson(res, result);
  } catch (error) {
    console.error('[API] Erro no login:', error);
    sendJson(res, { success: false, error: 'Erro na autenticação' }, 500);
  }
}

// API proxy para o servidor principal
async function handleProxy(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const proxyPath = pathname.replace('/api/proxy', '');

  // Construir URL do servidor principal
  const mainServerUrl = `http://localhost:8080${proxyPath}`;
  const queryParams = parsedUrl.query;

  // Obter usuário autenticado (se existir)
  const token = getAuthToken(req);
  const user = token ? userManager.getUserByToken(token) : null;

  // Adicionar query parameters
  const queryString = new URLSearchParams(queryParams).toString();
  const fullUrl = `${mainServerUrl}${queryString ? '?' + queryString : ''}`;

  console.log('[Proxy] Requesting:', fullUrl);

  try {
    const proxyResponse = await fetch(fullUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await proxyResponse.json();

    // Salvar a consulta se usuário estiver autenticado
    if (user && data) {
      const queryType = queryParams.tipo || 'unknown';
      const queryParam = queryParams.cpf || queryParams.q || 'unknown';

      userManager.saveQuery(user.id, {
        type: queryType,
        parameter: queryParam,
        success: data.success || false,
        result: data.success ? data.data : null,
        error: data.error || null
      });
    }

    sendJson(res, data, proxyResponse.status);
  } catch (error) {
    console.error('[Proxy] Error:', error.message);
    sendJson(res, { success: false, error: 'Erro ao conectar com API' }, 500);
  }
}

// ==========================================
// ENDPOINTS PRIVADOS (Requer Autenticação)
// ==========================================

// Obter consultas do usuário atual
async function handleUserQueries(req, res) {
  try {
    const user = req.user;
    const limit = parseInt(getQueryParam(req, 'limit')) || 50;

    const result = userManager.getUserQueries(user.id, limit);
    sendJson(res, result);
  } catch (error) {
    console.error('[API] Erro ao buscar consultas:', error);
    sendJson(res, { success: false, error: 'Erro ao buscar consultas' }, 500);
  }
}

// ==========================================
// ROUTER
// ==========================================

function router(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);

  // CORS
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  setCorsHeaders(res);

  // Public endpoints
  if (pathname === '/health') {
    return handleHealth(req, res);
  }

  if (pathname === '/api/users/register' && req.method === 'POST') {
    return handleRegister(req, res);
  }

  if (pathname === '/api/users/login' && req.method === 'POST') {
    return handleLogin(req, res);
  }

  if (pathname.startsWith('/api/proxy/')) {
    return handleProxy(req, res);
  }

  // Protected endpoints
  if (pathname === '/api/user/queries' && req.method === 'GET') {
    return authMiddleware(req, res, () => handleUserQueries(req, res));
  }

  // Static files
  if (pathname === '/' || pathname.startsWith('/index') ||
      pathname.endsWith('.html') || pathname.endsWith('.css') ||
      pathname.endsWith('.js') || pathname.endsWith('.png') ||
      pathname.endsWith('.jpg') || pathname.endsWith('.svg')) {
    return serveStaticFile(req, res);
  }

  // 404
  sendJson(res, { error: 'Not found' }, 404);
}

// ==========================================
// SERVER
// ==========================================

const server = http.createServer(router);

server.listen(PORT, () => {
  console.log(`[Consultas Service - Node.js] Servidor iniciado na porta ${PORT}`);
  console.log(`[Consultas Service - Node.js] Acesse: http://localhost:${PORT}/consultas`);
  console.log(`[Consultas Service - Node.js] Health: http://localhost:${PORT}/health`);
});

module.exports = server;
