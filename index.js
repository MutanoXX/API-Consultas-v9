/**
 * MutanoX Premium API - @MutanoX
 * Consolidated endpoint for queries (CPF, NAME, NUMBER)
 *
 * Port: 8080
 * Author: @MutanoX
 */

const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Import endpoints
const { consultarCPF } = require('./endpoints/cpf');
const { consultarNome } = require('./endpoints/nome');
const { consultarNumero } = require('./endpoints/numero');

// Import database manager
const database = require('./database');

// Import protected users manager
const protectedUsers = require('./protected-users');

// ==========================================
// CONFIGURATION
// ==========================================

const PORT = 8080;
const CREATOR = '@MutanoX';
const ADMIN_PASSWORD = 'MutanoX3397';
const MAX_CONCURRENT_REQUESTS = 50;

// Endpoint management - maintenance mode
const endpointStatus = {
  cpf: { active: true, maintenance: false },
  nome: { active: true, maintenance: false },
  numero: { active: true, maintenance: false }
};

// API statistics
const stats = {
  totalQueries: 0,
  cpfQueries: 0,
  nameQueries: 0,
  numberQueries: 0,
  successfulQueries: 0,
  failedQueries: 0,
  startTime: new Date().toISOString(),
  lastQueries: []
};

// Store query history (last 200)
const queryHistory = [];

// Active requests tracking
let activeRequests = 0;

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function isValidString(str) {
  return typeof str === 'string' && str.trim().length > 0;
}

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const remoteAddr = req.socket.remoteAddress;

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  if (remoteAddr) {
    return remoteAddr.replace(/^::ffff:/, '');
  }
  return 'Unknown';
}

function getUserAgent(req) {
  return req.headers['user-agent'] || 'Unknown';
}

function getOrigin(req) {
  return req.headers['origin'] || req.headers['referer'] || 'Unknown';
}

function registerQuery(type, parameter, result, req) {
  const queryLog = {
    type,
    parameter: type === 'cpf' ? maskCPF(parameter) : parameter,
    success: result.success,
    timestamp: new Date().toISOString(),
    ip: getClientIP(req),
    userAgent: getUserAgent(req),
    origin: getOrigin(req),
    endpoint: `/api/consultas?tipo=${type}`
  };

  // Update stats
  stats.totalQueries++;

  switch (type) {
    case 'cpf':
      stats.cpfQueries++;
      break;
    case 'nome':
      stats.nameQueries++;
      break;
    case 'numero':
      stats.numberQueries++;
      break;
  }

  if (result.success) {
    stats.successfulQueries++;
  } else {
    stats.failedQueries++;
  }

  // Add to history
  queryHistory.unshift(queryLog);
  if (queryHistory.length > 200) {
    queryHistory.pop();
  }

  stats.lastQueries = queryHistory.slice(0, 10);

  // Log to console
  console.log(`[Query] ${type.toUpperCase()} | IP: ${queryLog.ip} | Success: ${result.success} | Parameter: ${queryLog.parameter}`);

  // Send to WebSocket
  if (websocketClients.length > 0) {
    const wsMessage = {
      type: 'query',
      data: {
        type,
        parameter: queryLog.parameter,
        success: result.success,
        timestamp: queryLog.timestamp,
        ip: queryLog.ip,
        endpoint: queryLog.endpoint
      }
    };
    websocketClients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(wsMessage));
      }
    });
  }
}

function maskCPF(cpf) {
  if (!cpf || cpf.length < 11) return cpf;
  return cpf.substring(0, 3) + '***' + cpf.substring(cpf.length - 2);
}

function isEndpointActive(type) {
  const status = endpointStatus[type.toLowerCase()];
  return status && status.active && !status.maintenance;
}

// ==========================================
// AUTHENTICATION
// ==========================================

function authenticateDashboard(req, res) {
  const cookie = req.headers['cookie'] || '';
  const sessionMatch = cookie.match(/admin_session=([^;]+)/);

  if (sessionMatch && sessionMatch[1] === 'authenticated') {
    return true;
  }

  return false;
}

function setAuthCookie(res) {
  res.setHeader('Set-Cookie', 'admin_session=authenticated; Path=/; Max-Age=3600');
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', 'admin_session=; Path=/; Max-Age=0');
}

// ==========================================
// WEBSOCKET
// ==========================================

const WebSocket = require('ws');
let wss;
let websocketClients = [];

function setupWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('[WebSocket] New client connected');
    websocketClients.push(ws);

    // Send current status
    ws.send(JSON.stringify({
      type: 'stats',
      data: stats
    }));

    ws.send(JSON.stringify({
      type: 'endpointStatus',
      data: endpointStatus
    }));

    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
      websocketClients = websocketClients.filter(client => client !== ws);
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Error:', error);
    });

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);

        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        } else if (data.type === 'getStats') {
          ws.send(JSON.stringify({ type: 'stats', data: stats }));
        } else if (data.type === 'getEndpointStatus') {
          ws.send(JSON.stringify({ type: 'endpointStatus', data: endpointStatus }));
        } else if (data.type === 'toggleEndpoint') {
          // Admin command to toggle endpoint
          if (data.endpoint && endpointStatus[data.endpoint]) {
            endpointStatus[data.endpoint].maintenance = !endpointStatus[data.endpoint].maintenance;
            ws.send(JSON.stringify({ type: 'endpointStatus', data: endpointStatus }));
            console.log(`[Admin] Endpoint ${data.endpoint} maintenance mode: ${endpointStatus[data.endpoint].maintenance}`);
          }
        }
      } catch (error) {
        console.error('[WebSocket] Error processing message:', error);
      }
    });
  });

  console.log(`[WebSocket] Server initialized on HTTP server (port ${PORT})`);
}

// ==========================================
// API HANDLERS
// ==========================================

async function handleConsultaCPF(cpf, req) {
  if (!isEndpointActive('cpf')) {
    return {
      success: false,
      error: 'CPF endpoint is under maintenance',
      creator: CREATOR
    };
  }

  // Check if user is protected
  if (protectedUsers.isProtected('cpf', cpf)) {
    console.log('[Protected] CPF blocked:', cpf);
    return {
      success: false,
      error: 'Consulta não autorizada - Usuário protegido',
      protected: true,
      creator: CREATOR
    };
  }

  const resultado = await consultarCPF(cpf);
  registerQuery('cpf', cpf, resultado, req);

  // Save to database
  database.saveQuery('cpf', cpf, resultado, req);

  return resultado;
}

async function handleConsultaNome(nome, req) {
  if (!isEndpointActive('nome')) {
    return {
      success: false,
      error: 'Name endpoint is under maintenance',
      creator: CREATOR
    };
  }

  // Check if user is protected
  if (protectedUsers.isProtected('nome', nome)) {
    console.log('[Protected] Nome blocked:', nome);
    return {
      success: false,
      error: 'Consulta não autorizada - Usuário protegido',
      protected: true,
      creator: CREATOR
    };
  }

  const resultado = await consultarNome(nome);
  registerQuery('nome', nome, resultado, req);

  // Save to database
  database.saveQuery('nome', nome, resultado, req);

  return resultado;
}

async function handleConsultaNumero(numero, req) {
  if (!isEndpointActive('numero')) {
    return {
      success: false,
      error: 'Number endpoint is under maintenance',
      creator: CREATOR
    };
  }

  // Check if user is protected
  if (protectedUsers.isProtected('numero', numero)) {
    console.log('[Protected] Numero blocked:', numero);
    return {
      success: false,
      error: 'Consulta não autorizada - Usuário protegido',
      protected: true,
      creator: CREATOR
    };
  }

  const resultado = await consultarNumero(numero);
  registerQuery('numero', numero, resultado, req);

  // Save to database
  database.saveQuery('numero', numero, resultado, req);

  return resultado;
}

// ==========================================
// HTTP SERVER
// ==========================================

const server = http.createServer(async (req, res) => {
  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  } catch (error) {
    console.error('[Server] Invalid URL:', error.message);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid URL', creator: CREATOR }));
    return;
  }

  const query = Object.fromEntries(parsedUrl.searchParams);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname} | IP: ${getClientIP(req)} | UA: ${getUserAgent(req)}`);

  try {
    // Dashboard login
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.password === ADMIN_PASSWORD) {
            setAuthCookie(res);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Login successful' }));
          } else {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid password' }));
          }
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid request' }));
        }
      });
      return;
    }

    // Dashboard logout
    if (pathname === '/api/admin/logout') {
      clearAuthCookie(res);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Logout successful' }));
      return;
    }

    // Check authentication for dashboard
    if (pathname === '/dashboard' || pathname === '/dashboard.html' || pathname.startsWith('/api/admin/')) {
      if (!authenticateDashboard(req, res) && pathname !== '/api/admin/login') {
        // Return login page
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(loginHtml);
        return;
      }
    }

    // Query endpoint
    if (pathname === '/api/consultas') {
      // Rate limiting
      if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Too many concurrent requests. Please try again later.',
          creator: CREATOR
        }));
        return;
      }

      activeRequests++;
      const type = query.tipo;

      if (!type) {
        activeRequests--;
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          error: 'Query type not specified',
          availableTypes: ['cpf', 'nome', 'numero'],
          creator: CREATOR
        }, null, 2));
        return;
      }

      let result;

      try {
        switch (type.toLowerCase()) {
          case 'cpf':
            result = await handleConsultaCPF(query.cpf, req);
            break;
          case 'nome':
            result = await handleConsultaNome(query.q, req);
            break;
          case 'numero':
            result = await handleConsultaNumero(query.q, req);
            break;
          default:
            result = {
              success: false,
              error: `Unknown type: ${type}`,
              availableTypes: ['cpf', 'nome', 'numero'],
              creator: CREATOR
            };
        }
      } finally {
        activeRequests--;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result, null, 2));
      return;
    }

    // Stats endpoint (public)
    if (pathname === '/api/stats') {
      const publicStats = {
        totalQueries: stats.totalQueries,
        cpfQueries: stats.cpfQueries,
        nameQueries: stats.nameQueries,
        numberQueries: stats.numberQueries,
        successfulQueries: stats.successfulQueries,
        failedQueries: stats.failedQueries,
        startTime: stats.startTime,
        uptime: Math.floor((Date.now() - new Date(stats.startTime)) / 1000) + 's'
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(publicStats, null, 2));
      return;
    }

    // History endpoint (admin only)
    if (pathname === '/api/admin/history') {
      const limit = parseInt(query.limit) || 100;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(queryHistory.slice(0, limit), null, 2));
      return;
    }

    // Database protection - block direct access
    if (pathname.startsWith('/database/')) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Direct access to database is forbidden',
        creator: CREATOR
      }, null, 2));
      return;
    }

    // Database endpoint management (admin only)
    if (pathname === '/api/admin/database') {
      if (req.method === 'GET') {
        const type = query.type;
        const limit = parseInt(query.limit) || 100;
        
        if (type === 'cpf' || type === 'nome' || type === 'numero') {
          const result = database.getQueries(type, limit);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result, null, 2));
        } else if (type === 'stats') {
          const result = database.getDatabaseStats();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result, null, 2));
        } else {
          // Get all databases
          const cpf = database.getQueries('cpf', limit);
          const nome = database.getQueries('nome', limit);
          const numero = database.getQueries('numero', limit);
          const stats = database.getDatabaseStats();
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            cpf,
            nome,
            numero,
            stats
          }, null, 2));
        }
      } else if (req.method === 'DELETE') {
        const queryId = query.id;
        
        if (queryId) {
          const result = database.deleteQuery(queryId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result, null, 2));
        } else {
          const type = query.type;
          if (type) {
            const result = database.clearDatabase(type);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result, null, 2));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid request' }, null, 2));
          }
        }
      } else if (req.method === 'POST') {
        const type = query.type;
        const searchTerm = query.search;
        
        if (type && searchTerm) {
          const result = database.searchQueries(type, searchTerm);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result, null, 2));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid request' }, null, 2));
        }
      }
      return;
    }

    // Protected users endpoint management (admin only)
    if (pathname === '/api/admin/protected') {
      if (req.method === 'GET') {
        // Get all protected users or search
        const searchTerm = query.search;
        const result = protectedUsers.searchProtectedUsers(searchTerm);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
      } else if (req.method === 'POST') {
        // Add new protected user
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const { type, value, reason } = data;

            if (!type || !value) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Type and value are required' }, null, 2));
              return;
            }

            const result = protectedUsers.addProtectedUser(type, value, reason, 'admin');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result, null, 2));
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid request' }, null, 2));
          }
        });
        return;
      } else if (req.method === 'PUT') {
        // Update protected user
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const { id, reason, value } = data;

            if (!id) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'ID is required' }, null, 2));
              return;
            }

            const updates = {};
            if (reason !== undefined) updates.reason = reason;
            if (value !== undefined) updates.value = value;

            const result = protectedUsers.updateProtectedUser(id, updates);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result, null, 2));
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid request' }, null, 2));
          }
        });
        return;
      } else if (req.method === 'DELETE') {
        // Delete protected user
        const id = query.id;

        if (!id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'ID is required' }, null, 2));
          return;
        }

        const result = protectedUsers.deleteProtectedUser(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
        return;
      }
    }

    // Protected users stats endpoint
    if (pathname === '/api/admin/protected/stats') {
      const result = protectedUsers.getProtectedStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result, null, 2));
      return;
    }

    // Dashboard JavaScript
    if (pathname === '/dashboard.js') {
      console.log('[Server] Request for dashboard.js');
      console.log('[Server] __dirname:', __dirname);
      try {
        const dashboardJsPath = path.join(__dirname, 'dashboard.js');
        console.log('[Server] Full path:', dashboardJsPath);
        console.log('[Server] File exists:', fs.existsSync(dashboardJsPath));
        const dashboardJsContent = fs.readFileSync(dashboardJsPath, 'utf-8');
        console.log('[Server] File read successfully, size:', dashboardJsContent.length);
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.writeHead(200);
        res.end(dashboardJsContent);
        console.log('[Server] dashboard.js served successfully, size:', dashboardJsContent.length);
      } catch (error) {
        console.error('[Dashboard] Error loading dashboard.js:', error);
        console.error('[Dashboard] Error stack:', error.stack);
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'dashboard.js not found', details: error.message }));
      }
      return;
    }

    // Dashboard HTML
    if (pathname === '/dashboard' || pathname === '/dashboard.html') {
      console.log('[Server] Request for dashboard HTML');
      if (dashboardHtml) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.writeHead(200);
        res.end(dashboardHtml);
      } else {
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Dashboard not available' }));
      }
      return;
    }

    // Consultas page - serve HTML
    if (pathname === '/consultas') {
      console.log('[Server] Request for consultas page');
      try {
        const consultasHtml = fs.readFileSync(path.join(__dirname, 'consultas', 'index.html'), 'utf-8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.writeHead(200);
        res.end(consultasHtml);
      } catch (error) {
        console.error('[Server] Error loading consultas page:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Consultas page not available' }));
      }
      return;
    }

    // Consultas JS
    if (pathname === '/app.js') {
      console.log('[Server] Request for app.js');
      try {
        const consultasJs = fs.readFileSync(path.join(__dirname, 'consultas', 'app.js'), 'utf-8');
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.writeHead(200);
        res.end(consultasJs);
      } catch (error) {
        console.error('[Server] Error loading app.js:', error.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'app.js not available' }));
      }
      return;
    }

    // Favicon handler
    if (pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    // Root path - API info
    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        name: 'MutanoX Premium API',
        version: '2.0.0',
        creator: CREATOR,
        endpoints: {
          query: '/api/consultas',
          stats: '/api/stats',
          dashboard: '/dashboard'
        },
        description: 'Premium API for CPF, Name and Number queries'
      }, null, 2));
      return;
    }

  } catch (error) {
    console.error('[Server] Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error.message,
      creator: CREATOR
    }, null, 2));
  }
});

const dashboardPath = path.join(__dirname, 'dashboard.html');
let dashboardHtml = '';

try {
  dashboardHtml = fs.readFileSync(dashboardPath, 'utf-8');
  console.log('[Dashboard] HTML loaded successfully');
} catch (error) {
  console.error('[Dashboard] Error loading dashboard:', error.message);
}

// Login page
const loginHtml = `<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MutanoX Premium - Login</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-primary: #0a0f1a;
            --bg-glass: rgba(17, 24, 39, 0.8);
            --surface: #1f2937;
            --text-primary: #f9fafb;
            --text-secondary: #9ca3af;
            --border: #374151;
            --primary: #22d3ee;
            --primary-gradient: linear-gradient(135deg, #22d3ee 0%, #06b6d4 50%, #0891b2 100%);
            --danger: #f87171;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Space Grotesk', sans-serif;
            background: var(--bg-primary);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
        }

        .bg-orb {
            position: absolute;
            border-radius: 50%;
            filter: blur(80px);
            opacity: 0.3;
            animation: float 20s ease-in-out infinite;
        }

        .orb-1 { width: 600px; height: 600px; background: var(--primary); top: -200px; right: -200px; }
        .orb-2 { width: 400px; height: 400px; background: #8b5cf6; bottom: -100px; left: -100px; }

        @keyframes float {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(30px, -30px) scale(1.1); }
        }

        .login-card {
            background: var(--bg-glass);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 48px;
            width: 100%;
            max-width: 420px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            position: relative;
            z-index: 1;
        }

        .login-header { text-align: center; margin-bottom: 32px; }

        .logo {
            width: 80px;
            height: 80px;
            background: var(--primary-gradient);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            font-size: 36px;
            color: white;
            font-weight: bold;
            box-shadow: 0 0 30px rgba(34, 211, 238, 0.4);
        }

        .login-header h1 { font-size: 28px; color: var(--text-primary); margin-bottom: 8px; }
        .login-header p { color: var(--text-secondary); font-size: 14px; }

        .form-group { margin-bottom: 24px; }

        .form-label {
            display: block;
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 8px;
        }

        .form-input {
            width: 100%;
            padding: 14px 16px;
            background: rgba(0, 0, 0, 0.3);
            border: 2px solid var(--border);
            border-radius: 12px;
            color: var(--text-primary);
            font-size: 15px;
            transition: all 0.25s ease;
        }

        .form-input:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 20px rgba(34, 211, 238, 0.3);
        }

        .btn {
            width: 100%;
            padding: 14px;
            background: var(--primary-gradient);
            border: none;
            border-radius: 12px;
            color: white;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.25s ease;
            position: relative;
            overflow: hidden;
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 0 30px rgba(34, 211, 238, 0.5);
        }

        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }

        .error-msg {
            background: rgba(248, 113, 113, 0.1);
            border: 1px solid var(--danger);
            border-radius: 12px;
            padding: 12px 16px;
            color: var(--danger);
            font-size: 14px;
            margin-bottom: 20px;
            text-align: center;
            display: none;
        }

        .footer {
            text-align: center;
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid var(--border);
            color: var(--text-secondary);
            font-size: 12px;
        }

        .footer a { color: var(--primary); text-decoration: none; }
        .footer a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="bg-orb orb-1"></div>
    <div class="bg-orb orb-2"></div>

    <div class="login-card">
        <div class="login-header">
            <div class="logo">M</div>
            <h1>MutanoX Premium</h1>
            <p>Dashboard Administrativo</p>
        </div>

        <div class="error-msg" id="errorMsg"></div>

        <form id="loginForm">
            <div class="form-group">
                <label class="form-label">Senha de Administrador</label>
                <input type="password" class="form-input" id="password" placeholder="Digite sua senha" required autofocus>
            </div>

            <button type="submit" class="btn" id="loginBtn">
                Entrar no Dashboard
            </button>
        </form>

        <div class="footer">
            <p>MutanoX Premium API v2.0.0</p>
            <p>© 2024 @MutanoX</p>
        </div>
    </div>

    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const btn = document.getElementById('loginBtn');
            const errorMsg = document.getElementById('errorMsg');

            btn.disabled = true;
            btn.textContent = 'Entrando...';
            errorMsg.style.display = 'none';

            try {
                const response = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });

                const data = await response.json();

                if (data.success) {
                    window.location.href = '/dashboard';
                } else {
                    errorMsg.textContent = data.error || 'Senha incorreta';
                    errorMsg.style.display = 'block';
                }
            } catch (error) {
                errorMsg.textContent = 'Erro de conexão';
                errorMsg.style.display = 'block';
            }

            btn.disabled = false;
            btn.textContent = 'Entrar no Dashboard';
        });

        document.getElementById('password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('loginForm').dispatchEvent(new Event('submit'));
            }
        });
    </script>
</body>
</html>`;

// Setup WebSocket on the same server
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`✅ HTTP Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket integrated on HTTP server (port ${PORT})`);
  console.log(`🚀 MutanoX Premium API - ${CREATOR}`);
  console.log(`🔐 Admin Password: ${ADMIN_PASSWORD}`);
  console.log(`⚡ Max Concurrent Requests: ${MAX_CONCURRENT_REQUESTS}`);
});
