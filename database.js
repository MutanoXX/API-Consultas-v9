/**
 * Database Manager - MutanoX Premium
 * Sistema de armazenamento JSON com proteção e deduplicação
 */

const fs = require('fs');
const path = require('path');

// Database paths
const DB_DIR = path.join(__dirname, 'database');
const CPF_DB = path.join(DB_DIR, 'cpf-queries.json');
const NOME_DB = path.join(DB_DIR, 'nome-queries.json');
const NUMERO_DB = path.join(DB_DIR, 'numero-queries.json');
const INDEX_DB = path.join(DB_DIR, 'index.json');

// ==========================================
// PROTECTION - Check if request is from server
// ==========================================

const SERVER_SIGNATURE = 'MutanoX-Protected-Database-v1';

function isValidServerRequest(req) {
  const signature = req.headers['x-server-signature'];
  return signature === SERVER_SIGNATURE;
}

// ==========================================
// DATABASE INITIALIZATION
// ==========================================

function initializeDatabase() {
  try {
    // Create database directory if not exists
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    // Initialize files if not exists
    const files = [CPF_DB, NOME_DB, NUMERO_DB, INDEX_DB];
    files.forEach(file => {
      if (!fs.existsSync(file) || fs.readFileSync(file, 'utf-8').trim() === '') {
        const isIndex = file === INDEX_DB;
        const initialContent = isIndex 
          ? JSON.stringify({
              cpfIndex: [],
              nomeIndex: [],
              numeroIndex: [],
              lastUpdated: new Date().toISOString()
            }, null, 2)
          : '[]';
        
        fs.writeFileSync(file, initialContent, 'utf-8');
      }
    });

    console.log('[Database] Initialized successfully');
    return true;
  } catch (error) {
    console.error('[Database] Initialization error:', error);
    return false;
  }
}

// ==========================================
// DUPLICATE CHECKING
// ==========================================

function isDuplicate(type, parameter) {
  try {
    const indexData = JSON.parse(fs.readFileSync(INDEX_DB, 'utf-8'));

    // Normalize parameter for comparison
    let normalizedParam;
    if (type === 'cpf' || type === 'numero') {
      // For CPF and numbers, keep only digits
      normalizedParam = parameter.toString().trim().toLowerCase().replace(/\D/g, '');
    } else {
      // For names, keep letters and spaces
      normalizedParam = parameter.toString().trim().toLowerCase();
    }

    let indexArray;
    switch (type) {
      case 'cpf':
        indexArray = indexData.cpfIndex || [];
        break;
      case 'nome':
        indexArray = indexData.nomeIndex || [];
        break;
      case 'numero':
        indexArray = indexData.numeroIndex || [];
        break;
      default:
        return false;
    }

    // Check if parameter exists in index
    return indexArray.some(entry => {
      let existingParam;
      if (type === 'cpf' || type === 'numero') {
        existingParam = entry.parameter.toString().trim().toLowerCase().replace(/\D/g, '');
      } else {
        existingParam = entry.parameter.toString().trim().toLowerCase();
      }
      return existingParam === normalizedParam;
    });
  } catch (error) {
    console.error('[Database] Duplicate check error:', error);
    return false;
  }
}

function addToIndex(type, parameter, queryId) {
  try {
    const indexData = JSON.parse(fs.readFileSync(INDEX_DB, 'utf-8'));
    
    const indexEntry = {
      parameter,
      queryId,
      timestamp: new Date().toISOString()
    };

    switch (type) {
      case 'cpf':
        if (!indexData.cpfIndex) indexData.cpfIndex = [];
        indexData.cpfIndex.push(indexEntry);
        break;
      case 'nome':
        if (!indexData.nomeIndex) indexData.nomeIndex = [];
        indexData.nomeIndex.push(indexEntry);
        break;
      case 'numero':
        if (!indexData.numeroIndex) indexData.numeroIndex = [];
        indexData.numeroIndex.push(indexEntry);
        break;
    }

    indexData.lastUpdated = new Date().toISOString();
    fs.writeFileSync(INDEX_DB, JSON.stringify(indexData, null, 2), 'utf-8');
    
    console.log(`[Database] Added to ${type} index:`, parameter);
    return true;
  } catch (error) {
    console.error('[Database] Index update error:', error);
    return false;
  }
}

// ==========================================
// SAVE QUERY DATA
// ==========================================

function saveQuery(type, parameter, result, req) {
  try {
    // Check for duplicates before saving
    if (isDuplicate(type, parameter)) {
      console.log(`[Database] Duplicate detected for ${type}:`, parameter);
      return {
        success: true,
        saved: false,
        message: 'Data already exists in database'
      };
    }

    // Generate unique query ID
    const queryId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Prepare query data
    const queryData = {
      queryId,
      type,
      parameter: type === 'cpf' ? maskCPF(parameter) : parameter,
      originalParameter: parameter,
      result: result.success ? result.data : null,
      error: result.success ? null : result.error,
      success: result.success,
      timestamp: new Date().toISOString(),
      requestInfo: {
        ip: getClientIP(req),
        userAgent: getUserAgent(req),
        origin: getOrigin(req),
        method: req.method,
        path: req.url
      }
    };

    // Save to appropriate database file
    let dbFile;
    switch (type) {
      case 'cpf':
        dbFile = CPF_DB;
        break;
      case 'nome':
        dbFile = NOME_DB;
        break;
      case 'numero':
        dbFile = NUMERO_DB;
        break;
      default:
        return {
          success: false,
          error: 'Invalid query type'
        };
    }

    // Read existing data
    let existingData = [];
    try {
      existingData = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
    } catch (error) {
      existingData = [];
    }

    // Add new query
    existingData.unshift(queryData);

    // Limit to last 1000 entries per type
    if (existingData.length > 1000) {
      existingData = existingData.slice(0, 1000);
    }

    // Save to file
    fs.writeFileSync(dbFile, JSON.stringify(existingData, null, 2), 'utf-8');

    // Add to index for duplicate checking
    addToIndex(type, parameter, queryId);

    console.log(`[Database] Saved ${type} query:`, queryId);

    return {
      success: true,
      saved: true,
      queryId,
      message: 'Data saved successfully'
    };
  } catch (error) {
    console.error('[Database] Save error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==========================================
// READ QUERIES
// ==========================================

function getQueries(type, limit = 100) {
  try {
    let dbFile;
    switch (type) {
      case 'cpf':
        dbFile = CPF_DB;
        break;
      case 'nome':
        dbFile = NOME_DB;
        break;
      case 'numero':
        dbFile = NUMERO_DB;
        break;
      default:
        return {
          success: false,
          error: 'Invalid query type'
        };
    }

    const data = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
    
    return {
      success: true,
      type,
      total: data.length,
      data: data.slice(0, limit)
    };
  } catch (error) {
    console.error('[Database] Read error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function getQueryById(queryId) {
  try {
    const type = queryId.split('-')[0];
    const result = getQueries(type, 1000);
    
    if (!result.success) {
      return result;
    }

    const query = result.data.find(q => q.queryId === queryId);
    
    if (query) {
      return {
        success: true,
        data: query
      };
    }

    return {
      success: false,
      error: 'Query not found'
    };
  } catch (error) {
    console.error('[Database] Query by ID error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function searchQueries(type, searchTerm) {
  try {
    const result = getQueries(type, 1000);
    
    if (!result.success) {
      return result;
    }

    const normalizedSearch = searchTerm.toLowerCase();
    
    const filtered = result.data.filter(query => {
      return query.parameter.toLowerCase().includes(normalizedSearch) ||
             (query.originalParameter && query.originalParameter.toLowerCase().includes(normalizedSearch));
    });

    return {
      success: true,
      type,
      searchTerm,
      totalResults: filtered.length,
      data: filtered
    };
  } catch (error) {
    console.error('[Database] Search error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==========================================
// DELETE QUERIES
// ==========================================

function deleteQuery(queryId) {
  try {
    const type = queryId.split('-')[0];
    
    let dbFile;
    switch (type) {
      case 'cpf':
        dbFile = CPF_DB;
        break;
      case 'nome':
        dbFile = NOME_DB;
        break;
      case 'numero':
        dbFile = NUMERO_DB;
        break;
      default:
        return {
          success: false,
          error: 'Invalid query type'
        };
    }

    const data = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
    const filtered = data.filter(q => q.queryId !== queryId);
    
    if (data.length === filtered.length) {
      return {
        success: false,
        error: 'Query not found'
      };
    }

    fs.writeFileSync(dbFile, JSON.stringify(filtered, null, 2), 'utf-8');
    
    console.log(`[Database] Deleted query:`, queryId);

    return {
      success: true,
      message: 'Query deleted successfully'
    };
  } catch (error) {
    console.error('[Database] Delete error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function clearDatabase(type) {
  try {
    let dbFile;
    let indexField;

    switch (type) {
      case 'cpf':
        dbFile = CPF_DB;
        indexField = 'cpfIndex';
        break;
      case 'nome':
        dbFile = NOME_DB;
        indexField = 'nomeIndex';
        break;
      case 'numero':
        dbFile = NUMERO_DB;
        indexField = 'numeroIndex';
        break;
      case 'all':
        // Clear all databases
        fs.writeFileSync(CPF_DB, '[]', 'utf-8');
        fs.writeFileSync(NOME_DB, '[]', 'utf-8');
        fs.writeFileSync(NUMERO_DB, '[]', 'utf-8');
        fs.writeFileSync(INDEX_DB, JSON.stringify({
          cpfIndex: [],
          nomeIndex: [],
          numeroIndex: [],
          lastUpdated: new Date().toISOString()
        }, null, 2), 'utf-8');
        
        console.log('[Database] Cleared all databases');
        return {
          success: true,
          message: 'All databases cleared'
        };
      default:
        return {
          success: false,
          error: 'Invalid database type'
        };
    }

    // Clear specific database
    fs.writeFileSync(dbFile, '[]', 'utf-8');
    
    // Clear index
    const indexData = JSON.parse(fs.readFileSync(INDEX_DB, 'utf-8'));
    if (indexField) {
      indexData[indexField] = [];
      indexData.lastUpdated = new Date().toISOString();
      fs.writeFileSync(INDEX_DB, JSON.stringify(indexData, null, 2), 'utf-8');
    }
    
    console.log(`[Database] Cleared ${type} database`);
    
    return {
      success: true,
      message: `${type} database cleared successfully`
    };
  } catch (error) {
    console.error('[Database] Clear error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==========================================
// DATABASE STATS
// ==========================================

function getDatabaseStats() {
  try {
    const cpfData = JSON.parse(fs.readFileSync(CPF_DB, 'utf-8'));
    const nomeData = JSON.parse(fs.readFileSync(NOME_DB, 'utf-8'));
    const numeroData = JSON.parse(fs.readFileSync(NUMERO_DB, 'utf-8'));
    const indexData = JSON.parse(fs.readFileSync(INDEX_DB, 'utf-8'));

    return {
      success: true,
      stats: {
        cpf: {
          totalQueries: cpfData.length,
          indexedQueries: indexData.cpfIndex?.length || 0
        },
        nome: {
          totalQueries: nomeData.length,
          indexedQueries: indexData.nomeIndex?.length || 0
        },
        numero: {
          totalQueries: numeroData.length,
          indexedQueries: indexData.numeroIndex?.length || 0
        },
        total: cpfData.length + nomeData.length + numeroData.length,
        lastUpdated: indexData.lastUpdated
      }
    };
  } catch (error) {
    console.error('[Database] Stats error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

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

function maskCPF(cpf) {
  if (!cpf || cpf.length < 11) return cpf;
  return cpf.substring(0, 3) + '***' + cpf.substring(cpf.length - 2);
}

// ==========================================
// INITIALIZATION
// ==========================================

initializeDatabase();

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  isValidServerRequest,
  saveQuery,
  getQueries,
  getQueryById,
  searchQueries,
  deleteQuery,
  clearDatabase,
  getDatabaseStats,
  isDuplicate,
  SERVER_SIGNATURE
};
