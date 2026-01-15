/**
 * User Manager - Sistema de gerenciamento de usuários
 * Armazena usuários e suas consultas no mini-service
 */

const fs = require('fs');
const path = require('path');

const USERS_DB = path.join(__dirname, 'users.json');
const QUERIES_DB = path.join(__dirname, 'user-queries.json');

// ==========================================
// INICIALIZAÇÃO
// ==========================================

function initializeDatabases() {
    try {
        // Criar users.json se não existir
        if (!fs.existsSync(USERS_DB)) {
            const initialData = {
                users: [],
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(USERS_DB, JSON.stringify(initialData, null, 2), 'utf-8');
            console.log('[UserManager] users.json inicializado');
        }

        // Criar user-queries.json se não existir
        if (!fs.existsSync(QUERIES_DB)) {
            const initialData = {
                queries: [],
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(QUERIES_DB, JSON.stringify(initialData, null, 2), 'utf-8');
            console.log('[UserManager] user-queries.json inicializado');
        }
    } catch (error) {
        console.error('[UserManager] Erro na inicialização:', error);
    }
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function getUsers() {
    try {
        const data = fs.readFileSync(USERS_DB, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('[UserManager] Erro ao ler usuários:', error);
        return { users: [], lastUpdated: new Date().toISOString() };
    }
}

function getQueries() {
    try {
        const data = fs.readFileSync(QUERIES_DB, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('[UserManager] Erro ao ler consultas:', error);
        return { queries: [], lastUpdated: new Date().toISOString() };
    }
}

function saveUsers(data) {
    try {
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(USERS_DB, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('[UserManager] Erro ao salvar usuários:', error);
        return false;
    }
}

function saveQueries(data) {
    try {
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(QUERIES_DB, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('[UserManager] Erro ao salvar consultas:', error);
        return false;
    }
}

function generateToken() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ==========================================
// GERENCIAMENTO DE USUÁRIOS
// ==========================================

function createUser(username, password) {
    try {
        const data = getUsers();

        // Verificar se usuário já existe
        const existingUser = data.users.find(u => u.username === username);
        if (existingUser) {
            return {
                success: false,
                error: 'Nome de usuário já existe'
            };
        }

        // Criar novo usuário
        const newUser = {
            id: 'user_' + Date.now(),
            username,
            password, // Em produção, usar hash de senha (bcrypt)
            token: generateToken(),
            createdAt: new Date().toISOString(),
            isActive: true
        };

        data.users.push(newUser);
        saveUsers(data);

        console.log(`[UserManager] Usuário criado: ${username}`);

        return {
            success: true,
            user: {
                id: newUser.id,
                username: newUser.username,
                token: newUser.token
            }
        };
    } catch (error) {
        console.error('[UserManager] Erro ao criar usuário:', error);
        return {
            success: false,
            error: 'Erro ao criar usuário'
        };
    }
}

function authenticateUser(username, password) {
    try {
        const data = getUsers();
        const user = data.users.find(u => u.username === username && u.password === password);

        if (!user) {
            return {
                success: false,
                error: 'Usuário ou senha inválidos'
            };
        }

        if (!user.isActive) {
            return {
                success: false,
                error: 'Usuário desativado'
            };
        }

        return {
            success: true,
            user: {
                id: user.id,
                username: user.username,
                token: user.token
            }
        };
    } catch (error) {
        console.error('[UserManager] Erro na autenticação:', error);
        return {
            success: false,
            error: 'Erro na autenticação'
        };
    }
}

function getUserByToken(token) {
    try {
        const data = getUsers();
        const user = data.users.find(u => u.token === token);

        if (!user || !user.isActive) {
            return null;
        }

        return {
            id: user.id,
            username: user.username,
            token: user.token
        };
    } catch (error) {
        console.error('[UserManager] Erro ao buscar usuário por token:', error);
        return null;
    }
}

// ==========================================
// GERENCIAMENTO DE CONSULTAS
// ==========================================

function saveQuery(userId, queryData) {
    try {
        const data = getQueries();

        const queryRecord = {
            id: 'query_' + Date.now(),
            userId,
            type: queryData.type,
            parameter: queryData.parameter,
            success: queryData.success,
            result: queryData.result || null,
            error: queryData.error || null,
            timestamp: new Date().toISOString()
        };

        data.queries.unshift(queryRecord);

        // Manter apenas as últimas 1000 consultas
        if (data.queries.length > 1000) {
            data.queries = data.queries.slice(0, 1000);
        }

        saveQueries(data);

        console.log(`[UserManager] Consulta salva para usuário ${userId}`);

        return {
            success: true,
            query: queryRecord
        };
    } catch (error) {
        console.error('[UserManager] Erro ao salvar consulta:', error);
        return {
            success: false,
            error: 'Erro ao salvar consulta'
        };
    }
}

function getUserQueries(userId, limit = 50) {
    try {
        const data = getQueries();
        const userQueries = data.queries.filter(q => q.userId === userId);

        return {
            success: true,
            total: userQueries.length,
            queries: userQueries.slice(0, limit)
        };
    } catch (error) {
        console.error('[UserManager] Erro ao buscar consultas do usuário:', error);
        return {
            success: false,
            error: 'Erro ao buscar consultas'
        };
    }
}

function getAllQueries(limit = 100) {
    try {
        const data = getQueries();

        return {
            success: true,
            total: data.queries.length,
            queries: data.queries.slice(0, limit)
        };
    } catch (error) {
        console.error('[UserManager] Erro ao buscar todas as consultas:', error);
        return {
            success: false,
            error: 'Erro ao buscar consultas'
        };
    }
}

// ==========================================
// INICIALIZAR
// ==========================================

initializeDatabases();

module.exports = {
    createUser,
    authenticateUser,
    getUserByToken,
    saveQuery,
    getUserQueries,
    getAllQueries
};
