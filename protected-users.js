/**
 * Protected Users Manager - MutanoX Premium
 * Sistema de proteção de usuários (CPF, NOME, NÚMERO)
 */

const fs = require('fs');
const path = require('path');

// Database path
const PROTECTED_USERS_DB = path.join(__dirname, 'protected-users.json');

// ==========================================
// DATABASE INITIALIZATION
// ==========================================

function initializeProtectedDB() {
  try {
    if (!fs.existsSync(PROTECTED_USERS_DB)) {
      const initialData = {
        users: [],
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(PROTECTED_USERS_DB, JSON.stringify(initialData, null, 2), 'utf-8');
      console.log('[ProtectedUsers] Database initialized');
    }
  } catch (error) {
    console.error('[ProtectedUsers] Initialization error:', error);
  }
}

// ==========================================
// ADD PROTECTED USER
// ==========================================

function addProtectedUser(type, value, reason, addedBy) {
  try {
    const data = getProtectedUsers();

    // Check if already exists
    const exists = data.users.some(user => {
      const normalizedExisting = user.value.toString().trim().toLowerCase();
      const normalizedNew = value.toString().trim().toLowerCase();

      if (type === 'cpf' || type === 'numero') {
        return normalizedExisting.replace(/\D/g, '') === normalizedNew.replace(/\D/g, '');
      }
      return normalizedExisting === normalizedNew;
    });

    if (exists) {
      return {
        success: false,
        error: 'User already protected'
      };
    }

    const newUser = {
      id: `protected-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      value: type === 'cpf' ? value.replace(/\D/g, '') : value.toString().trim(),
      originalValue: value.toString().trim(),
      reason: reason || '',
      addedBy: addedBy || 'admin',
      createdAt: new Date().toISOString()
    };

    data.users.push(newUser);
    data.lastUpdated = new Date().toISOString();

    fs.writeFileSync(PROTECTED_USERS_DB, JSON.stringify(data, null, 2), 'utf-8');

    console.log(`[ProtectedUsers] Added protection for ${type}:`, maskProtectedValue(type, value));

    return {
      success: true,
      user: newUser
    };
  } catch (error) {
    console.error('[ProtectedUsers] Add error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==========================================
// CHECK PROTECTION
// ==========================================

function isProtected(type, value) {
  try {
    const data = getProtectedUsers();

    const normalizedValue = value.toString().trim().toLowerCase();

    return data.users.some(user => {
      if (user.type !== type) return false;

      const normalizedUserValue = user.value.toString().trim().toLowerCase();

      if (type === 'cpf' || type === 'numero') {
        return normalizedValue.replace(/\D/g, '') === normalizedUserValue.replace(/\D/g, '');
      }
      return normalizedValue === normalizedUserValue;
    });
  } catch (error) {
    console.error('[ProtectedUsers] Check error:', error);
    return false;
  }
}

// ==========================================
// GET PROTECTED USERS
// ==========================================

function getProtectedUsers() {
  try {
    const content = fs.readFileSync(PROTECTED_USERS_DB, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('[ProtectedUsers] Read error:', error);
    return { users: [], lastUpdated: new Date().toISOString() };
  }
}

// ==========================================
// UPDATE PROTECTED USER
// ==========================================

function updateProtectedUser(id, updates) {
  try {
    const data = getProtectedUsers();

    const userIndex = data.users.findIndex(user => user.id === id);
    if (userIndex === -1) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    // Update fields
    if (updates.reason !== undefined) {
      data.users[userIndex].reason = updates.reason;
    }
    if (updates.value !== undefined) {
      const type = data.users[userIndex].type;
      data.users[userIndex].value = type === 'cpf' ? updates.value.replace(/\D/g, '') : updates.value.toString().trim();
      data.users[userIndex].originalValue = updates.value.toString().trim();
    }

    data.users[userIndex].updatedAt = new Date().toISOString();
    data.lastUpdated = new Date().toISOString();

    fs.writeFileSync(PROTECTED_USERS_DB, JSON.stringify(data, null, 2), 'utf-8');

    console.log(`[ProtectedUsers] Updated protection ID:`, id);

    return {
      success: true,
      user: data.users[userIndex]
    };
  } catch (error) {
    console.error('[ProtectedUsers] Update error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==========================================
// DELETE PROTECTED USER
// ==========================================

function deleteProtectedUser(id) {
  try {
    const data = getProtectedUsers();

    const userIndex = data.users.findIndex(user => user.id === id);
    if (userIndex === -1) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    const deletedUser = data.users.splice(userIndex, 1)[0];
    data.lastUpdated = new Date().toISOString();

    fs.writeFileSync(PROTECTED_USERS_DB, JSON.stringify(data, null, 2), 'utf-8');

    console.log(`[ProtectedUsers] Removed protection ID:`, id);

    return {
      success: true,
      deletedUser
    };
  } catch (error) {
    console.error('[ProtectedUsers] Delete error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==========================================
// SEARCH PROTECTED USERS
// ==========================================

function searchProtectedUsers(searchTerm) {
  try {
    const data = getProtectedUsers();

    if (!searchTerm) {
      return {
        success: true,
        users: data.users
      };
    }

    const normalizedSearch = searchTerm.toLowerCase();

    const filtered = data.users.filter(user => {
      const normalizedValue = user.value.toString().toLowerCase();
      const normalizedReason = user.reason.toString().toLowerCase();

      return normalizedValue.includes(normalizedSearch) ||
             normalizedReason.includes(normalizedSearch) ||
             user.type.includes(normalizedSearch);
    });

    return {
      success: true,
      users: filtered,
      total: filtered.length
    };
  } catch (error) {
    console.error('[ProtectedUsers] Search error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==========================================
// GET STATS
// ==========================================

function getProtectedStats() {
  try {
    const data = getProtectedUsers();

    const stats = {
      total: data.users.length,
      cpf: data.users.filter(u => u.type === 'cpf').length,
      nome: data.users.filter(u => u.type === 'nome').length,
      numero: data.users.filter(u => u.type === 'numero').length,
      lastUpdated: data.lastUpdated
    };

    return {
      success: true,
      stats
    };
  } catch (error) {
    console.error('[ProtectedUsers] Stats error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function maskProtectedValue(type, value) {
  if (type === 'cpf') {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length < 11) return cleaned;
    return cleaned.substring(0, 3) + '***' + cleaned.substring(cleaned.length - 2);
  } else if (type === 'numero') {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length < 4) return cleaned;
    return cleaned.substring(0, 2) + '***' + cleaned.substring(cleaned.length - 2);
  }
  // For names, show first 2 characters
  if (value.length < 4) return value;
  return value.substring(0, 2) + '***';
}

// ==========================================
// INITIALIZATION
// ==========================================

initializeProtectedDB();

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  addProtectedUser,
  isProtected,
  getProtectedUsers,
  updateProtectedUser,
  deleteProtectedUser,
  searchProtectedUsers,
  getProtectedStats,
  maskProtectedValue
};
