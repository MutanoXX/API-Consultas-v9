/**
 * MutanoX Consultas App - Sistema Avançado com Cache Local
 * Versão 3.0 - Frontend Otimizado
 */

// ========================================
// CONFIGURAÇÃO
// ========================================

const CONFIG = {
    API_BASE: window.location.origin,
    CACHE_DURATION: 30 * 60 * 1000, // 30 minutos
    CACHE_KEY_PREFIX: 'mutanox_cache_',
    HISTORY_KEY: 'consultas_history',
    HISTORY_MAX_ITEMS: 50,
    TOAST_DURATION: 3000
};

// Estado da aplicação
const state = {
    currentTab: 'cpf',
    lastResults: null,
    lastQueryType: null,
    lastQuery: null,
    ignoreCache: false,
    history: JSON.parse(localStorage.getItem(CONFIG.HISTORY_KEY) || '[]'),
    user: JSON.parse(localStorage.getItem('user_data') || 'null'),
    token: localStorage.getItem('user_token') || null
};

// Configuração de input por tipo
const INPUT_CONFIG = {
    cpf: {
        label: 'CPF (apenas números)',
        placeholder: 'Digite o CPF...',
        mask: (value) => value.replace(/\D/g, '').slice(0, 11),
        type: 'tel',
        inputmode: 'numeric'
    },
    nome: {
        label: 'Nome completo',
        placeholder: 'Digite o nome completo...',
        mask: (value) => value,
        type: 'text',
        inputmode: 'text'
    },
    numero: {
        label: 'Número com DDD',
        placeholder: 'Digite o número (ex: 11999999999)...',
        mask: (value) => value.replace(/\D/g, '').slice(0, 11),
        type: 'tel',
        inputmode: 'numeric'
    }
};

// ========================================
// INICIALIZAÇÃO
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('[MutanoX] Inicializando sistema v3.0...');

    checkAuthentication();
    setupTabs();
    setupSearch();
    setupButtons();
    updateUserDisplay();
    showToast('🚀 Sistema pronto para uso!', 'success');
});

// ========================================
// SISTEMA DE CACHE LOCAL
// ========================================

/**
 * Gera chave única para o cache
 */
function getCacheKey(type, query) {
    const normalized = normalizeQuery(type, query);
    return `${CONFIG.CACHE_KEY_PREFIX}${type}_${btoa(normalized)}`;
}

/**
 * Normaliza a query para cache
 */
function normalizeQuery(type, query) {
    if (type === 'cpf' || type === 'numero') {
        return query.replace(/\D/g, '');
    }
    return query.toLowerCase().trim();
}

/**
 * Salva resultado no cache
 */
function saveToCache(type, query, result) {
    try {
        const key = getCacheKey(type, query);
        const cacheData = {
            result,
            timestamp: Date.now(),
            type,
            query: maskQuery(type, query)
        };

        localStorage.setItem(key, JSON.stringify(cacheData));
        console.log('[Cache] Dados salvos:', key);

        // Manter apenas os 50 itens mais recentes
        cleanOldCache();
    } catch (error) {
        console.error('[Cache] Erro ao salvar:', error);
    }
}

/**
 * Recupera resultado do cache
 */
function getFromCache(type, query) {
    try {
        const key = getCacheKey(type, query);
        const cached = localStorage.getItem(key);

        if (!cached) return null;

        const cacheData = JSON.parse(cached);
        const age = Date.now() - cacheData.timestamp;

        // Verificar se cache ainda é válido
        if (age > CONFIG.CACHE_DURATION) {
            console.log('[Cache] Cache expirado:', key);
            localStorage.removeItem(key);
            return null;
        }

        console.log('[Cache] Dados recuperados:', key, `(${Math.round(age / 1000)}s atrás)`);
        return cacheData;
    } catch (error) {
        console.error('[Cache] Erro ao recuperar:', error);
        return null;
    }
}

/**
 * Limpa cache antigo para manter apenas 50 itens
 */
function cleanOldCache() {
    const cacheKeys = Object.keys(localStorage);
    const cacheItems = cacheKeys
        .filter(key => key.startsWith(CONFIG.CACHE_KEY_PREFIX))
        .map(key => {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                return { key, timestamp: data.timestamp || 0 };
            } catch {
                return { key, timestamp: 0 };
            }
        })
        .sort((a, b) => b.timestamp - a.timestamp);

    // Manter apenas os 50 mais recentes
    if (cacheItems.length > CONFIG.HISTORY_MAX_ITEMS) {
        cacheItems.slice(CONFIG.HISTORY_MAX_ITEMS).forEach(item => {
            localStorage.removeItem(item.key);
        });
        console.log('[Cache] Limpeza realizada:', cacheItems.length - CONFIG.HISTORY_MAX_ITEMS, 'itens removidos');
    }
}

/**
 * Limpa todo o cache
 */
function clearAllCache() {
    const cacheKeys = Object.keys(localStorage)
        .filter(key => key.startsWith(CONFIG.CACHE_KEY_PREFIX));

    cacheKeys.forEach(key => localStorage.removeItem(key));
    console.log('[Cache] Todo o cache limpo:', cacheKeys.length, 'itens');
}

/**
 * Mascarar query para exibição
 */
function maskQuery(type, query) {
    if (type === 'cpf') {
        const cleaned = query.replace(/\D/g, '');
        if (cleaned.length >= 11) {
            return cleaned.substring(0, 3) + '***' + cleaned.substring(cleaned.length - 2);
        }
    }
    return query.length > 20 ? query.substring(0, 20) + '...' : query;
}

// ========================================
// NOTIFICAÇÕES TOAST
// ========================================

/**
 * Exibe notificação toast
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');

    const bgColor = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-indigo-500'
    }[type];

    toast.className = `toast ${bgColor} text-white px-6 py-4 rounded-xl shadow-2xl pointer-events-auto min-w-[300px] max-w-[400px]`;
    toast.innerHTML = `
        <div class="flex items-start gap-3">
            <span class="text-xl">${getToastIcon(type)}</span>
            <p class="flex-1 text-sm font-medium">${message}</p>
        </div>
    `;

    container.appendChild(toast);

    // Remover após duration
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, CONFIG.TOAST_DURATION);
}

/**
 * Retorna ícone do toast
 */
function getToastIcon(type) {
    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠️',
        info: 'ℹ️'
    };
    return icons[type] || 'ℹ️';
}

// ========================================
// CONFIGURAÇÃO DE ABAS
// ========================================

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const inputLabel = document.getElementById('inputLabel');
    const searchInput = document.getElementById('searchInput');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            state.currentTab = tab.dataset.tab;
            const config = INPUT_CONFIG[state.currentTab];

            // Atualizar label e placeholder
            inputLabel.textContent = config.label;
            searchInput.placeholder = config.placeholder;
            searchInput.value = '';

            // Atualizar tipo de input
            searchInput.type = config.type;
            searchInput.inputMode = config.inputmode;

            // Limpar resultados
            clearResults();
            hideCacheIndicator();
        });
    });
}

// ========================================
// CONFIGURAÇÃO DE BUSCA
// ========================================

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    searchBtn.addEventListener('click', performSearch);

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // Máscara de input
    searchInput.addEventListener('input', (e) => {
        const config = INPUT_CONFIG[state.currentTab];
        if (config.mask) {
            const cursorPos = e.target.selectionStart;
            e.target.value = config.mask(e.target.value);
            // Restaurar posição do cursor
            e.target.setSelectionRange(cursorPos, cursorPos);
        }
        hideCacheIndicator();
    });
}

// ========================================
// CONFIGURAÇÃO DE BOTÕES
// ========================================

function setupButtons() {
    document.getElementById('copyResultsBtn').addEventListener('click', copyResults);
    document.getElementById('clearResultsBtn').addEventListener('click', clearResults);
    document.getElementById('historyBtn').addEventListener('click', toggleHistoryPanel);
    document.getElementById('closeHistoryBtn').addEventListener('click', toggleHistoryPanel);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('ignoreCacheBtn').addEventListener('click', () => {
        state.ignoreCache = true;
        performSearch();
    });
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
}

// ========================================
// AUTENTICAÇÃO
// ========================================

function checkAuthentication() {
    if (!state.token) {
        window.location.href = '/login.html';
    }
}

function updateUserDisplay() {
    const userDisplay = document.getElementById('userDisplay');
    const logoutBtn = document.getElementById('logoutBtn');

    if (state.user && state.user.username) {
        userDisplay.textContent = `👤 ${state.user.username}`;
        userDisplay.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');
    } else {
        userDisplay.classList.add('hidden');
        logoutBtn.classList.add('hidden');
    }
}

function handleLogout() {
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('user_username');
    showToast('👋 Até logo!', 'info');
    setTimeout(() => window.location.href = '/login.html', 1000);
}

// ========================================
// BUSCA PRINCIPAL
// ========================================

async function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const query = searchInput.value.trim();

    if (!query) {
        showToast('Por favor, preencha o campo de busca.', 'warning');
        searchInput.focus();
        return;
    }

    // Validações
    if (state.currentTab === 'cpf' && query.length !== 11) {
        showToast('CPF deve conter 11 dígitos.', 'error');
        return;
    }

    if (state.currentTab === 'numero' && (query.length < 10 || query.length > 11)) {
        showToast('Número deve ter 10 ou 11 dígitos (incluindo DDD).', 'error');
        return;
    }

    // Verificar cache primeiro
    if (!state.ignoreCache) {
        const cached = getFromCache(state.currentTab, query);
        if (cached) {
            displayCacheIndicator(cached);
            state.lastResults = cached.result;
            state.lastQueryType = state.currentTab;
            state.lastQuery = query;
            saveToHistory(state.currentTab, query, true, true);
            displayResults(cached.result);
            showToast('💾 Dados carregados do cache', 'info');
            return;
        }
    } else {
        state.ignoreCache = false;
    }

    // Mostrar loading
    showLoading(true);
    hideError();
    hideEmptyState();
    searchBtn.disabled = true;

    try {
        const url = buildApiUrl(query);
        console.log('[MutanoX] Fazendo requisição para:', url);

        const response = await authenticatedFetch(url);
        const data = await response.json();

        console.log('[MutanoX] Resposta:', data);

        if (data.success) {
            state.lastResults = data;
            state.lastQueryType = state.currentTab;
            state.lastQuery = query;

            // Salvar no cache
            saveToCache(state.currentTab, query, data);

            // Salvar no histórico
            saveToHistory(state.currentTab, query, true, false);

            // Exibir resultados
            displayResults(data);
            showToast('✅ Consulta realizada com sucesso!', 'success');
        } else if (data.protected) {
            saveToHistory(state.currentTab, query, false, false);
            showError('⛔ Consulta bloqueada - Este usuário está protegido.');
            showToast('⛔ Usuário protegido', 'error');
        } else {
            saveToHistory(state.currentTab, query, false, false);
            showError(data.error || 'Erro ao realizar consulta.');
            showToast('❌ Erro na consulta', 'error');
        }
    } catch (error) {
        console.error('[MutanoX] Erro:', error);
        showError('Erro de conexão com a API. Tente novamente.');
        showToast('🔴 Erro de conexão', 'error');
    } finally {
        showLoading(false);
        searchBtn.disabled = false;
    }
}

// ========================================
// CONSTRUÇÃO DE URL DA API
// ========================================

function buildApiUrl(query) {
    let url;

    if (state.currentTab === 'cpf') {
        url = `/api/proxy/consultas?tipo=cpf&cpf=${encodeURIComponent(query)}`;
    } else {
        url = `/api/proxy/consultas?tipo=${state.currentTab}&q=${encodeURIComponent(query)}`;
    }

    return url;
}

// ========================================
// FETCH COM AUTENTICAÇÃO
// ========================================

async function authenticatedFetch(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }

    return fetch(url, { ...options, headers });
}

// ========================================
// EXIBIÇÃO DE INDICADOR DE CACHE
// ========================================

function displayCacheIndicator(cachedData) {
    const indicator = document.getElementById('cacheIndicator');
    const age = Date.now() - cachedData.timestamp;
    const ageMinutes = Math.round(age / 60000);

    indicator.classList.remove('hidden');
    indicator.querySelector('span:last-child').textContent =
        `Dados carregados do cache (${ageMinutes} min atrás)`;
}

function hideCacheIndicator() {
    document.getElementById('cacheIndicator').classList.add('hidden');
}

// ========================================
// EXIBIÇÃO DE RESULTADOS
// ========================================

function displayResults(data) {
    const container = document.getElementById('resultsContainer');
    const summary = document.getElementById('resultsSummary');
    const countEl = document.getElementById('resultsCount');

    container.innerHTML = '';

    if (state.currentTab === 'cpf') {
        displayCPFResults(data.data, container);
        countEl.textContent = data.data && Object.keys(data.data).length > 0 ? '1' : '0';
    } else if (state.currentTab === 'nome' || state.currentTab === 'numero') {
        displayListResults(data.results, container, state.currentTab);
        countEl.textContent = data.totalResults || data.results?.length || 0;
    }

    summary.classList.remove('hidden');
}

// ========================================
// EXIBIÇÃO DE RESULTADOS CPF
// ========================================

function displayCPFResults(data, container) {
    if (!data || Object.keys(data).length === 0) {
        container.innerHTML = `
            <div class="glass-card rounded-xl p-6 sm:p-8 text-center border-2 border-yellow-500/30 bg-yellow-500/10">
                <div class="text-4xl sm:text-5xl mb-4">⚠️</div>
                <h3 class="text-base sm:text-lg font-semibold text-yellow-400 mb-2">Nenhum dado encontrado</h3>
                <p class="text-sm sm:text-base text-gray-400">O CPF informado não retornou dados na consulta.</p>
            </div>
        `;
        return;
    }

    const basic = data.basicData || {};
    const economic = data.economicData || {};
    const addresses = data.addresses || [];
    const important = data.importantInfo || {};

    container.innerHTML = `
        <div class="result-card glass-card rounded-2xl overflow-hidden">
            <!-- Header -->
            <div class="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10">
                <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <div class="text-2xl sm:text-3xl">📄</div>
                    <div class="flex-1">
                        <h3 class="text-base sm:text-lg font-semibold">Consulta de CPF</h3>
                        <p class="text-xs sm:text-sm text-gray-400">${maskCPF(basic.cpf || 'N/A')}</p>
                    </div>
                </div>
            </div>

            <!-- Content -->
            <div class="p-4 sm:p-6 space-y-4 sm:space-y-6">

                <!-- Dados Básicos -->
                <section>
                    <h4 class="text-xs sm:text-sm font-semibold text-indigo-400 mb-3 flex items-center gap-2">
                        <span>👤</span> Dados Básicos
                    </h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        ${createInfoField('Nome', basic.name || 'N/A')}
                        ${createInfoField('CPF', maskCPF(basic.cpf || 'N/A'))}
                        ${createInfoField('Data de Nascimento', basic.birthDate || 'N/A')}
                        ${createInfoField('Sexo', basic.sex || 'N/A')}
                        ${createInfoField('CNS', basic.cns || 'N/A')}
                        ${createInfoField('Situação Cadastral', basic.registrationStatus || 'N/A')}
                    </div>
                    ${basic.motherName ? createInfoRow('Nome da Mãe', basic.motherName) : ''}
                    ${basic.fatherName ? createInfoRow('Nome do Pai', basic.fatherName) : ''}
                </section>

                ${addresses.length > 0 ? `
                <!-- Endereços -->
                <section>
                    <h4 class="text-xs sm:text-sm font-semibold text-indigo-400 mb-3 flex items-center gap-2">
                        <span>🏠</span> Endereços (${addresses.length})
                    </h4>
                    <div class="space-y-2 sm:space-y-3">
                        ${addresses.map(addr => `
                            <div class="bg-slate-800/50 rounded-xl p-3 sm:p-4 border border-white/5">
                                <p class="text-sm sm:text-base text-gray-200">${addr.street || 'N/A'}</p>
                                <p class="text-xs sm:text-sm text-gray-400 mt-1">${addr.neighborhood || ''} - ${addr.cityUF || ''}</p>
                                <p class="text-xs sm:text-sm text-gray-500 mt-1">CEP: ${addr.cep || 'N/A'}</p>
                            </div>
                        `).join('')}
                    </div>
                </section>
                ` : ''}

                ${Object.keys(economic).length > 0 ? `
                <!-- Dados Econômicos -->
                <section>
                    <h4 class="text-xs sm:text-sm font-semibold text-indigo-400 mb-3 flex items-center gap-2">
                        <span>💰</span> Dados Econômicos
                    </h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        ${economic.income ? createInfoField('Renda', economic.income) : ''}
                        ${economic.incomeRange ? createInfoField('Faixa de Renda', economic.incomeRange) : ''}
                        ${economic.purchasingPower ? createInfoField('Poder Aquisitivo', economic.purchasingPower) : ''}
                        ${economic.scoreCSBA ? createInfoField('Score CSBA', economic.scoreCSBA) : ''}
                    </div>
                </section>
                ` : ''}

                ${Object.keys(important).length > 0 ? `
                <!-- Informações Importantes -->
                <section>
                    <h4 class="text-xs sm:text-sm font-semibold text-indigo-400 mb-3 flex items-center gap-2">
                        <span>⚠️</span> Informações Importantes
                    </h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        ${important.cpfValid ? createInfoField('CPF Válido', important.cpfValid) : ''}
                        ${important.death ? createInfoField('Óbito', important.death) : ''}
                        ${important.pep ? createInfoField('PEP', important.pep) : ''}
                    </div>
                </section>
                ` : ''}

            </div>
        </div>
    `;
}

// ========================================
// EXIBIÇÃO DE RESULTADOS LISTA
// ========================================

function displayListResults(results, container, type) {
    if (!results || results.length === 0) {
        container.innerHTML = `
            <div class="glass-card rounded-xl p-6 sm:p-8 text-center border-2 border-yellow-500/30 bg-yellow-500/10">
                <div class="text-4xl sm:text-5xl mb-4">⚠️</div>
                <h3 class="text-base sm:text-lg font-semibold text-yellow-400 mb-2">Nenhum resultado encontrado</h3>
                <p class="text-sm sm:text-base text-gray-400">Nenhum registro foi encontrado para esta consulta.</p>
            </div>
        `;
        return;
    }

    const displayResults = results.slice(0, 50);

    container.innerHTML = `
        <div class="space-y-3 sm:space-y-4">
            ${displayResults.map((result, index) => createResultCard(result, type, index)).join('')}
        </div>
        ${results.length > 50 ? `
            <div class="glass-card rounded-xl p-3 sm:p-4 text-center mt-4">
                <p class="text-xs sm:text-sm text-gray-400">Mostrando 50 de ${results.length} resultados</p>
            </div>
        ` : ''}
    `;
}

// ========================================
// CRIAÇÃO DE CARDS
// ========================================

function createResultCard(result, type, index) {
    if (type === 'nome') {
        return createNomeCard(result, index);
    } else {
        return createNumeroCard(result, index);
    }
}

function createNomeCard(result, index) {
    return `
        <div class="result-card glass-card rounded-xl overflow-hidden" style="animation-delay: ${index * 0.05}s">
            <div class="bg-gradient-to-r from-purple-600/20 to-indigo-600/20 px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div class="flex items-center gap-2 sm:gap-3">
                        <div class="text-2xl sm:text-3xl">👤</div>
                        <div>
                            <h3 class="text-base sm:text-lg font-semibold">${result.name || 'N/A'}</h3>
                            <p class="text-xs sm:text-sm text-gray-400">CPF: ${maskCPF(result.cpf || 'N/A')}</p>
                        </div>
                    </div>
                    <div class="self-start sm:self-end">
                        <span class="px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(result.registrationStatus)}">
                            ${result.registrationStatus || 'N/A'}
                        </span>
                    </div>
                </div>
            </div>
            <div class="p-4 sm:p-6">
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    ${createInfoField('Data de Nascimento', result.birthDate || 'N/A')}
                    ${createInfoField('Nome da Mãe', result.motherName || 'Não informado')}
                    ${result.street ? createInfoField('Logradouro', result.street) : ''}
                    ${result.neighborhood ? createInfoField('Bairro', result.neighborhood) : ''}
                    ${result.cep ? createInfoField('CEP', result.cep) : ''}
                </div>
            </div>
        </div>
    `;
}

function createNumeroCard(result, index) {
    return `
        <div class="result-card glass-card rounded-xl overflow-hidden" style="animation-delay: ${index * 0.05}s">
            <div class="bg-gradient-to-r from-green-600/20 to-emerald-600/20 px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10">
                <div class="flex items-center gap-2 sm:gap-3">
                    <div class="text-2xl sm:text-3xl">📱</div>
                    <div>
                        <h3 class="text-base sm:text-lg font-semibold">${result.name || 'N/A'}</h3>
                        <p class="text-xs sm:text-sm text-gray-400">${maskCNPJ(result.cpfCnpj || 'N/A')}</p>
                    </div>
                </div>
            </div>
            <div class="p-4 sm:p-6">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    ${createInfoField('Data de Nascimento', result.birthDate || 'N/A')}
                    ${result.neighborhood ? createInfoField('Bairro', result.neighborhood) : ''}
                    ${result.cityUF ? createInfoField('Cidade/UF', result.cityUF) : ''}
                    ${result.cep ? createInfoField('CEP', result.cep) : ''}
                </div>
            </div>
        </div>
    `;
}

// ========================================
// CAMPOS DE INFORMAÇÃO
// ========================================

function createInfoField(label, value) {
    if (!value || value === 'N/A') return '';
    return `
        <div class="info-field bg-slate-800/30 rounded-xl p-3 sm:p-4 border border-white/5">
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">${label}</p>
            <p class="text-xs sm:text-sm text-gray-200 font-medium">${value}</p>
        </div>
    `;
}

function createInfoRow(label, value) {
    if (!value || value === 'N/A') return '';
    return `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-4 border-t border-white/5">
            <p class="text-xs text-gray-500 uppercase tracking-wider">${label}</p>
            <p class="text-xs sm:text-sm text-gray-200 sm:col-span-2 font-medium">${value}</p>
        </div>
    `;
}

// ========================================
// UTILITÁRIOS DE MÁSCARA
// ========================================

function maskCPF(cpf) {
    if (!cpf || cpf.length < 11) return cpf || 'N/A';
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.substring(0, 3) + '.' + cleaned.substring(3, 6) + '.' +
           cleaned.substring(6, 9) + '-' + cleaned.substring(9, 11);
}

function maskCNPJ(cnpj) {
    if (!cnpj) return 'N/A';
    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length === 11) return maskCPF(cleaned);
    if (cleaned.length === 14) {
        return cleaned.substring(0, 2) + '.' + cleaned.substring(2, 5) + '.' +
               cleaned.substring(5, 8) + '/' + cleaned.substring(8, 12) +
               '-' + cleaned.substring(12, 14);
    }
    return cnpj;
}

function getStatusColor(status) {
    const statusMap = {
        'REGULAR': 'bg-green-500/20 text-green-400',
        'SUSPENSA': 'bg-yellow-500/20 text-yellow-400',
        'TITULAR FALECIDO': 'bg-red-500/20 text-red-400',
        'CANCELADA': 'bg-red-500/20 text-red-400'
    };
    return statusMap[status] || 'bg-gray-500/20 text-gray-400';
}

// ========================================
// CONTROLE DE VISUALIZAÇÃO
// ========================================

function showLoading(show) {
    const loadingState = document.getElementById('loadingState');
    if (show) {
        loadingState.classList.remove('hidden');
    } else {
        loadingState.classList.add('hidden');
    }
}

function showError(message) {
    const errorState = document.getElementById('errorState');
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorState.classList.remove('hidden');
}

function hideError() {
    document.getElementById('errorState').classList.add('hidden');
}

function hideEmptyState() {
    document.getElementById('emptyState').classList.add('hidden');
}

function clearResults() {
    document.getElementById('resultsContainer').innerHTML = '';
    document.getElementById('resultsSummary').classList.add('hidden');
    document.getElementById('searchInput').value = '';
    document.getElementById('emptyState').classList.remove('hidden');
    state.lastResults = null;
    hideError();
    hideCacheIndicator();
}

// ========================================
// CÓPIA DE RESULTADOS
// ========================================

function copyResults() {
    if (!state.lastResults) {
        showToast('Nenhum resultado para copiar', 'warning');
        return;
    }

    let text = '';

    if (state.lastQueryType === 'cpf') {
        const data = state.lastResults.data;
        text = `CONSULTA DE CPF\n================\n`;
        if (data.basicData) {
            text += `Nome: ${data.basicData.name}\n`;
            text += `CPF: ${data.basicData.cpf}\n`;
            text += `Data de Nascimento: ${data.basicData.birthDate}\n`;
            text += `Sexo: ${data.basicData.sex}\n`;
        }
        if (data.addresses && data.addresses.length > 0) {
            text += `\nEndereços:\n`;
            data.addresses.forEach(addr => {
                text += `- ${addr.street}, ${addr.neighborhood}\n`;
                text += `  ${addr.cityUF} - CEP: ${addr.cep}\n`;
            });
        }
    } else {
        const results = state.lastResults.results;
        text = `RESULTADOS DA CONSULTA (${state.lastQueryType.toUpperCase()})\n=========================================\n\n`;
        results.slice(0, 10).forEach((r, i) => {
            text += `${i + 1}. ${r.name}\n`;
            if (r.cpf || r.cpfCnpj) {
                text += `   ${state.lastQueryType === 'nome' ? 'CPF' : 'CPF/CNPJ'}: ${r.cpf || r.cpfCnpj}\n`;
            }
            if (r.birthDate) text += `   Nascimento: ${r.birthDate}\n`;
            text += '\n';
        });
        if (results.length > 10) {
            text += `... e mais ${results.length - 10} resultados\n`;
        }
    }

    navigator.clipboard.writeText(text).then(() => {
        showToast('📋 Resultados copiados!', 'success');
    }).catch(err => {
        showToast('❌ Erro ao copiar resultados', 'error');
    });
}

// ========================================
// HISTÓRICO DE CONSULTAS
// ========================================

function saveToHistory(type, query, success, fromCache) {
    const historyItem = {
        id: Date.now(),
        type,
        query: maskQuery(type, query),
        originalQuery: query,
        success,
        fromCache,
        timestamp: new Date().toISOString()
    };

    state.history.unshift(historyItem);

    if (state.history.length > CONFIG.HISTORY_MAX_ITEMS) {
        state.history = state.history.slice(0, CONFIG.HISTORY_MAX_ITEMS);
    }

    localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(state.history));

    if (!document.getElementById('historyPanel').classList.contains('hidden')) {
        updateHistoryPanel();
    }
}

function toggleHistoryPanel() {
    const historyPanel = document.getElementById('historyPanel');
    historyPanel.classList.toggle('hidden');

    if (!historyPanel.classList.contains('hidden')) {
        updateHistoryPanel();
    }
}

function updateHistoryPanel() {
    const historyList = document.getElementById('historyList');

    if (state.history.length === 0) {
        historyList.innerHTML = `
            <div class="text-center text-gray-500 py-6 sm:py-8">
                <p class="text-3xl sm:text-4xl mb-2">📜</p>
                <p class="text-sm sm:text-base">Nenhuma consulta realizada ainda</p>
            </div>
        `;
        return;
    }

    historyList.innerHTML = state.history.map(item => {
        const date = new Date(item.timestamp);
        const formattedDate = date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const typeIcon = {
            'cpf': '📄',
            'nome': '👤',
            'numero': '📱'
        }[item.type];

        const statusColor = item.success ? 'text-green-400' : 'text-red-400';
        const statusIcon = item.success ? '✓' : '✗';

        const cacheBadge = item.fromCache ?
            '<span class="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Cache</span>' : '';

        return `
            <div class="bg-slate-800/50 rounded-xl p-3 sm:p-4 border border-white/5 hover:border-indigo-500/30 transition-all cursor-pointer"
                 onclick="loadFromHistory('${item.type}', '${item.originalQuery.replace(/'/g, "\\'")}')">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <span class="text-lg sm:text-xl">${typeIcon}</span>
                        <div class="min-w-0">
                            <p class="text-xs sm:text-sm font-semibold text-gray-200 truncate">${item.type.toUpperCase()}</p>
                            <p class="text-xs text-gray-500 truncate">${item.query}</p>
                        </div>
                    </div>
                    <div class="flex flex-col items-end gap-1 flex-shrink-0">
                        <span class="${statusColor} text-sm">${statusIcon}</span>
                        ${cacheBadge}
                        <span class="text-xs text-gray-500">${formattedDate}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function loadFromHistory(type, query) {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        if (tab.dataset.tab === type) {
            tab.click();
        }
    });

    const searchInput = document.getElementById('searchInput');
    searchInput.value = query;

    toggleHistoryPanel();
    showToast('📜 Consulta carregada do histórico', 'info');
}

function clearHistory() {
    if (confirm('Tem certeza que deseja limpar todo o histórico de consultas?')) {
        state.history = [];
        localStorage.setItem(CONFIG.HISTORY_KEY, '[]');
        updateHistoryPanel();
        showToast('🗑️ Histórico limpo', 'success');
    }
}

// ========================================
// EXPORTAR FUNÇÕES PARA USO GLOBAL
// ========================================

window.loadFromHistory = loadFromHistory;

console.log('[MutanoX] Sistema v3.0 inicializado com sucesso! 🚀');
