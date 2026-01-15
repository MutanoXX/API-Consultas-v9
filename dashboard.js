/**
 * MutanoX Premium Dashboard
 * Sistema completo com polling em vez de WebSocket
 */

// ========================
// CONFIGURAÇÃO
// ========================

const CONFIG = {
    pollInterval: 1000, // 1 segundo
    cachePrefix: 'mutanox_cache_',
    cacheDuration: 30 * 60 * 1000, // 30 minutos
    apiBase: window.location.origin
};

// ========================
// ESTADO GLOBAL
// ========================

const state = {
    isAuthenticated: false,
    currentTab: 'dashboard',
    stats: {
        totalQueries: 0,
        cpfQueries: 0,
        nameQueries: 0,
        numberQueries: 0,
        successfulQueries: 0,
        failedQueries: 0,
        startTime: new Date().toISOString()
    },
    logs: [],
    protectedUsers: [],
    charts: {
        history: null,
        distribution: null
    }
};


// ========================
// COOKIE HELPERS
// ========================

function getCookie(name) {
    const value = "; " + document.cookie;
    const parts = value.split("; " + name + "=");
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
}

function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

function deleteCookie(name) {
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
}

// ========================
// CACHE LOCAL
// ========================

function getCachedData(type, param) {
    const key = CONFIG.cachePrefix + type + '_' + param.toLowerCase().trim();
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const data = JSON.parse(cached);
    const now = Date.now();
    if (now - data.timestamp > CONFIG.cacheDuration) {
        localStorage.removeItem(key);
        return null;
    }

    return data;
}

function setCachedData(type, param, result) {
    const key = CONFIG.cachePrefix + type + '_' + param.toLowerCase().trim();
    const cacheEntry = {
        timestamp: Date.now(),
        result: result
    };
    localStorage.setItem(key, JSON.stringify(cacheEntry));
}

function clearCache() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.startsWith(CONFIG.cachePrefix)) {
            localStorage.removeItem(key);
        }
    });
    showNotification('Cache limpo com sucesso!', 'success');
    document.getElementById('cacheInfo').style.display = 'none';
}

// ========================
// AUTENTICAÇÃO
// ========================

function checkAuth() {
    const session = getCookie('admin_session');
    state.isAuthenticated = session === 'authenticated';

    if (!state.isAuthenticated) {
        document.getElementById('loginModal').classList.add('active');
        document.querySelector('.dashboard-container').style.display = 'none';
    } else {
        document.getElementById('loginModal').classList.remove('active');
        document.querySelector('.dashboard-container').style.display = 'block';
        loadProtectedUsers();
        startPolling();
    }
}

async function attemptLogin() {
    const password = document.getElementById('loginPassword').value;

    if (!password) {
        showNotification('Por favor, digite a senha.', 'error');
        return;
    }

    try {
        const response = await fetch(`${CONFIG.apiBase}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const result = await response.json();

        if (result.success) {
            setCookie('admin_session', 'authenticated', 1);
            checkAuth();
            showNotification('Login realizado com sucesso!', 'success');
        } else {
            document.getElementById('loginError').style.display = 'block';
        }
    } catch (error) {
        console.error('[Login] Error:', error);
        showNotification('Erro ao fazer login. Tente novamente.', 'error');
    }
}

function logout() {
    deleteCookie('admin_session');
    fetch(`${CONFIG.apiBase}/api/admin/logout`);
    state.isAuthenticated = false;
    stopPolling();
    checkAuth();
    showNotification('Logout realizado com sucesso!', 'success');
}

// ========================
// NAVEGAÇÃO POR ABAS
// ========================

function showTab(tabName) {
    state.currentTab = tabName;

    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab
    const selectedTab = document.getElementById(`tab-${tabName}`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // Update tab buttons
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// ========================
// POLLING (em vez de WebSocket)
// ========================

let pollingInterval = null;

function startPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }

    // Poll immediately
    fetchData();

    // Then every second
    pollingInterval = setInterval(() => {
        fetchData();
    }, CONFIG.pollInterval);

    console.log('[Polling] Iniciado - atualização a cada', CONFIG.pollInterval / 1000, 'segundos');
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log('[Polling] Parado');
    }
}

async function fetchData() {
    try {
        // Fetch stats
        const statsRes = await fetch(`${CONFIG.apiBase}/api/stats`);
        const statsData = await statsRes.json();
        updateStats(statsData);

        // Fetch history para gráficos
        const historyRes = await fetch(`${CONFIG.apiBase}/api/admin/history?limit=100`);
        const historyData = await historyRes.json();
        updateCharts(historyData);

        // Fetch logs se estiver na aba de logs
        if (state.currentTab === 'logs') {
            // Logs são atualizados em tempo real pelo backend
        }
    } catch (error) {
        console.error('[Polling] Erro ao buscar dados:', error);
    }
}

// ========================
// ATUALIZAÇÃO DE UI
// ========================

function updateStats(data) {
    state.stats = data;

    document.getElementById('totalQueries').textContent = data.totalQueries.toLocaleString();
    document.getElementById('cpfQueries').textContent = data.cpfQueries.toLocaleString();
    document.getElementById('nameQueries').textContent = data.nameQueries.toLocaleString();
    document.getElementById('numberQueries').textContent = data.numberQueries.toLocaleString();

    const total = data.totalQueries || 1;
    const successRate = ((data.successfulQueries / total) * 100).toFixed(1);
    document.getElementById('successRate').textContent = successRate + '%';

    const uptime = Math.floor((Date.now() - new Date(data.startTime)) / 1000);
    document.getElementById('uptime').textContent = formatUptime(uptime);

    // Atualizar estatísticas do mini-service
    updateMiniServiceStats(data);
}

function updateMiniServiceStats(data) {
    const miniTotal = document.getElementById('miniServiceTotal');
    const miniCPF = document.getElementById('miniServiceCPF');
    const miniNome = document.getElementById('miniServiceNome');
    const miniNumero = document.getElementById('miniServiceNumero');

    if (miniTotal) miniTotal.textContent = data.totalQueries.toLocaleString();
    if (miniCPF) miniCPF.textContent = data.cpfQueries.toLocaleString();
    if (miniNome) miniNome.textContent = data.nameQueries.toLocaleString();
    if (miniNumero) miniNumero.textContent = data.numberQueries.toLocaleString();
}

function formatUptime(seconds) {
    if (seconds < 60) return seconds + 's';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
    return Math.floor(seconds / 86400) + 'd';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 12px;
        background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        font-weight: 600;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========================
// CONSULTAS API
// ========================

async function submitQuery() {
    const type = document.getElementById('queryType').value;
    const param = document.getElementById('queryParam').value.trim();

    if (!param) {
        showNotification('Por favor, preencha o campo de busca.', 'error');
        return;
    }

    // Check cache
    const cached = getCachedData(type, param);
    if (cached) {
        console.log('[Cache] Dados encontrados no cache');
        document.getElementById('cacheInfo').style.display = 'flex';
        displayResult(type, param, cached.result);
        return;
    }

    // Make API request
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span><span>Consultando...</span>';

    try {
        const url = type === 'cpf'
            ? `${CONFIG.apiBase}/api/consultas?tipo=cpf&cpf=${encodeURIComponent(param)}`
            : `${CONFIG.apiBase}/api/consultas?tipo=${type}&q=${encodeURIComponent(param)}`;

        const response = await fetch(url);
        const result = await response.json();

        // Cache result
        if (!result.protected) {
            setCachedData(type, param, result);
        }

        displayResult(type, param, result);

        if (result.protected) {
            showNotification('⛔ Consulta bloqueada - Usuário protegido!', 'error');
        }
    } catch (error) {
        console.error('[Query] Erro:', error);
        showNotification('Erro ao fazer consulta. Tente novamente.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>🔍</span><span>Consultar</span>';
    }
}

function displayResult(type, param, result) {
    const container = document.getElementById('resultsContainer');
    const isSuccess = result.success;

    let content = '';

    if (type === 'cpf' && isSuccess) {
        content = formatCPFResult(result.data);
    } else if (type === 'nome' && isSuccess) {
        content = formatNomeResult(result);
    } else if (type === 'numero' && isSuccess) {
        content = formatNumeroResult(result);
    } else if (result.protected) {
        content = `
            <div style="background: rgba(239, 68, 68, 0.2); padding: 16px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <span style="font-size: 32px;">🛡️</span>
                    <div>
                        <strong style="color: #ef4444; font-size: 16px;">Consulta Bloqueada</strong>
                        <p style="margin: 4px 0 0 0; color: #94a3b8;">${result.error}</p>
                    </div>
                </div>
            </div>
        `;
    } else {
        content = `<div style="color: #ef4444; padding: 20px;">
            <strong>Erro:</strong> ${result.error || 'Consulta sem sucesso'}
        </div>`;
    }

    const resultHtml = `
        <div class="result-item">
            <div class="result-header">
                <span class="result-type ${type}">${type}</span>
                <span class="result-status ${isSuccess ? 'success' : result.protected ? 'blocked' : 'error'}">
                    ${isSuccess ? 'Sucesso' : result.protected ? 'Bloqueado' : 'Erro'}
                </span>
            </div>
            <div class="result-param">${type === 'cpf' ? maskCPF(param) : param}</div>
            <div style="margin-top: 12px;">
                ${content}
            </div>
        </div>
    `;

    // Add to container
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) {
        container.innerHTML = resultHtml;
    } else {
        container.insertAdjacentHTML('afterbegin', resultHtml);
    }
}

function formatCPFResult(data) {
    const basic = data.basicData || {};
    const economic = data.economicData || {};
    const addresses = data.addresses || [];

    return `
        <div class="result-details">
            <div class="detail-section">
                <div class="detail-title">📄 Dados Básicos</div>
                <div class="detail-grid">
                    <div class="detail-item"><span class="label">Nome:</span> ${basic.name || 'N/A'}</div>
                    <div class="detail-item"><span class="label">CPF:</span> ${basic.cpf || 'N/A'}</div>
                    <div class="detail-item"><span class="label">Nascimento:</span> ${basic.birthDate || 'N/A'}</div>
                    <div class="detail-item"><span class="label">Sexo:</span> ${basic.sex || 'N/A'}</div>
                </div>
            </div>
            ${addresses.length > 0 ? `
            <div class="detail-section">
                <div class="detail-title">🏠 Endereços (${addresses.length})</div>
                ${addresses.map(addr => `
                    <div class="detail-item" style="padding: 8px; background: rgba(255,255,255,0.05); border-radius: 6px; margin-top: 8px;">
                        <p style="margin: 0;">${addr.street || ''} - ${addr.neighborhood || ''}</p>
                        <p style="margin: 4px 0 0 0; color: #94a3b8;">${addr.cityUF || ''} - ${addr.cep || ''}</p>
                    </div>
                `).join('')}
            </div>
            ` : ''}
        </div>
    `;
}

function formatNomeResult(result) {
    const results = result.results || [];
    return `
        <div class="result-details">
            <div class="detail-title">📊 ${results.length} resultados encontrados</div>
            ${results.slice(0, 10).map(person => `
                <div class="person-card">
                    <div class="person-name">${person.name || 'N/A'}</div>
                    <div class="person-details">
                        <span>CPF: ${person.cpf || 'N/A'}</span>
                        <span>Nascimento: ${person.birthDate || 'N/A'}</span>
                    </div>
                    ${person.street ? `<p style="margin: 8px 0 0 0; color: #94a3b8;">${person.street} - ${person.cityUF || ''}</p>` : ''}
                </div>
            `).join('')}
            ${results.length > 10 ? `<p style="margin-top: 12px; color: #94a3b8;">...e mais ${results.length - 10} resultados</p>` : ''}
        </div>
    `;
}

function formatNumeroResult(result) {
    const results = result.results || [];
    return `
        <div class="result-details">
            <div class="detail-title">📱 ${results.length} resultados encontrados</div>
            ${results.slice(0, 10).map(person => `
                <div class="person-card">
                    <div class="person-name">${person.name || 'N/A'}</div>
                    <div class="person-details">
                        <span>CPF/CNPJ: ${person.cpfCnpj || 'N/A'}</span>
                        <span>Cidade: ${person.cityUF || 'N/A'}</span>
                    </div>
                    ${person.neighborhood ? `<p style="margin: 8px 0 0 0; color: #94a3b8;">${person.neighborhood} - ${person.cityUF || ''}</p>` : ''}
                </div>
            `).join('')}
            ${results.length > 10 ? `<p style="margin-top: 12px; color: #94a3b8;">...e mais ${results.length - 10} resultados</p>` : ''}
        </div>
    `;
}

function maskCPF(cpf) {
    if (!cpf || cpf.length < 11) return cpf;
    return cpf.substring(0, 3) + '***' + cpf.substring(cpf.length - 2);
}

// ========================
// USUÁRIOS PROTEGIDOS
// ========================

async function loadProtectedUsers() {
    try {
        const response = await fetch(`${CONFIG.apiBase}/api/admin/protected`);
        const result = await response.json();
        state.protectedUsers = result.users || [];
        renderProtectedUsers(state.protectedUsers);
    } catch (error) {
        console.error('[Protected] Error loading:', error);
    }
}

function renderProtectedUsers(users) {
    const container = document.getElementById('protectedContainer');

    if (users.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🛡️</div>
                <p>Nenhum usuário protegido</p>
                <p style="font-size: 13px; color: #64748b; margin-top: 12px;">
                    Adicione proteções para bloquear consultas a usuários específicos
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="protected-table">
            <thead>
                <tr>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th>Motivo</th>
                    <th>Data</th>
                    <th style="text-align: right;">Ações</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>
                            <span class="type-badge type-${user.type}">${user.type.toUpperCase()}</span>
                        </td>
                        <td>
                            <span class="value-text">${user.type === 'cpf' ? maskCPF(user.value) : user.value}</span>
                        </td>
                        <td>${user.reason || '-'}</td>
                        <td>${new Date(user.createdAt).toLocaleString('pt-BR')}</td>
                        <td style="text-align: right;">
                            <button class="btn-icon" onclick="editProtection('${user.id}')" title="Editar">
                                ✏️
                            </button>
                            <button class="btn-icon btn-icon-danger" onclick="deleteProtection('${user.id}')" title="Remover">
                                🗑️
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function openAddProtectionModal() {
    document.getElementById('protectionModal').classList.add('active');
    document.getElementById('protectionType').value = 'cpf';
    document.getElementById('protectionValue').value = '';
    document.getElementById('protectionReason').value = '';
    updateProtectionPlaceholder();
}

function closeProtectionModal() {
    document.getElementById('protectionModal').classList.remove('active');
}

function updateProtectionPlaceholder() {
    const type = document.getElementById('protectionType').value;
    const label = document.getElementById('protectionValueLabel');
    const input = document.getElementById('protectionValue');

    if (type === 'cpf') {
        label.textContent = 'CPF (apenas números)';
        input.placeholder = 'Digite o CPF...';
    } else if (type === 'nome') {
        label.textContent = 'Nome completo';
        input.placeholder = 'Digite o nome completo...';
    } else {
        label.textContent = 'Número com DDD';
        input.placeholder = 'Digite o número (ex: 11999999999)...';
    }
}

async function saveProtection() {
    const type = document.getElementById('protectionType').value;
    const value = document.getElementById('protectionValue').value.trim();
    const reason = document.getElementById('protectionReason').value.trim();

    if (!value) {
        showNotification('Por favor, preencha o campo de valor.', 'error');
        return;
    }

    try {
        const response = await fetch(`${CONFIG.apiBase}/api/admin/protected`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, value, reason })
        });

        const result = await response.json();

        if (result.success) {
            closeProtectionModal();
            loadProtectedUsers();
            showNotification('✅ Proteção adicionada com sucesso!', 'success');
        } else {
            showNotification('❌ Erro ao adicionar proteção: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('[Protection] Error:', error);
        showNotification('Erro ao adicionar proteção. Tente novamente.', 'error');
    }
}

function editProtection(id) {
    const user = state.protectedUsers.find(u => u.id === id);
    if (!user) {
        loadProtectedUsers();
        return;
    }

    document.getElementById('editProtectionId').value = id;
    document.getElementById('editProtectionType').value = user.type;
    document.getElementById('editProtectionValue').value = user.value;
    document.getElementById('editProtectionReason').value = user.reason || '';

    const label = document.getElementById('editProtectionValueLabel');
    if (user.type === 'cpf') {
        label.textContent = 'CPF (apenas números)';
    } else if (user.type === 'nome') {
        label.textContent = 'Nome completo';
    } else {
        label.textContent = 'Número com DDD';
    }

    document.getElementById('editProtectionModal').classList.add('active');
}

function closeEditProtectionModal() {
    document.getElementById('editProtectionModal').classList.remove('active');
}

async function updateProtection() {
    const id = document.getElementById('editProtectionId').value;
    const reason = document.getElementById('editProtectionReason').value.trim();

    if (!id) {
        showNotification('ID inválido.', 'error');
        return;
    }

    try {
        const response = await fetch(`${CONFIG.apiBase}/api/admin/protected`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, reason })
        });

        const result = await response.json();

        if (result.success) {
            closeEditProtectionModal();
            loadProtectedUsers();
            showNotification('✅ Proteção atualizada com sucesso!', 'success');
        } else {
            showNotification('❌ Erro ao atualizar proteção: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('[Protection] Error:', error);
        showNotification('Erro ao atualizar proteção. Tente novamente.', 'error');
    }
}

async function deleteProtection(id) {
    if (!confirm('Tem certeza que deseja remover esta proteção?')) {
        return;
    }

    try {
        const response = await fetch(`${CONFIG.apiBase}/api/admin/protected?id=${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            loadProtectedUsers();
            showNotification('✅ Proteção removida com sucesso!', 'success');
        } else {
            showNotification('❌ Erro ao remover proteção: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('[Protection] Error:', error);
        showNotification('Erro ao remover proteção. Tente novamente.', 'error');
    }
}

// ========================
// GRÁFICOS
// ========================

function initCharts() {
    const historyCtx = document.getElementById('historyChart').getContext('2d');
    state.charts.history = new Chart(historyCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'CPF',
                    data: [],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                },
                {
                    label: 'Nome',
                    data: [],
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                },
                {
                    label: 'Número',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#e2e8f0',
                        font: { size: 13 }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8', font: { size: 11 } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8', font: { size: 11 } },
                    beginAtZero: true
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });

    const distributionCtx = document.getElementById('distributionChart').getContext('2d');
    state.charts.distribution = new Chart(distributionCtx, {
        type: 'bar',
        data: {
            labels: ['CPF', 'Nome', 'Número'],
            datasets: [{
                label: 'Consultas',
                data: [0, 0, 0],
                backgroundColor: [
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(16, 185, 129, 0.8)'
                ],
                borderColor: [
                    '#6366f1',
                    '#8b5cf6',
                    '#10b981'
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#e2e8f0', font: { size: 12, weight: '600' } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8', font: { size: 11 } },
                    beginAtZero: true
                }
            }
        }
    });
}

function updateCharts(historyData = null) {
    if (!state.charts.distribution || !state.charts.history) {
        return;
    }

    // Update distribution chart
    state.charts.distribution.data.datasets[0].data = [
        state.stats.cpfQueries,
        state.stats.nameQueries,
        state.stats.numberQueries
    ];
    state.charts.distribution.update('none');

    // Update history chart com dados reais
    if (historyData && historyData.length > 0) {
        const now = new Date();
        const labels = [];
        const cpfData = [];
        const nomeData = [];
        const numData = [];

        // Agrupar consultas por hora (últimas 10 horas)
        const hourlyData = {};
        for (let i = 9; i >= 0; i--) {
            const hour = new Date(now - i * 3600000);
            const key = hour.toISOString().slice(0, 13); // YYYY-MM-DDTHH
            labels.push(hour.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
            hourlyData[key] = { cpf: 0, nome: 0, numero: 0 };
        }

        // Preencher dados reais
        historyData.forEach(query => {
            if (query.timestamp) {
                const key = new Date(query.timestamp).toISOString().slice(0, 13);
                if (hourlyData[key]) {
                    const type = query.type?.toLowerCase() || '';
                    if (type === 'cpf') hourlyData[key].cpf++;
                    else if (type === 'nome') hourlyData[key].nome++;
                    else if (type === 'numero') hourlyData[key].numero++;
                }
            }
        });

        // Preencher arrays
        Object.values(hourlyData).forEach(data => {
            cpfData.push(data.cpf);
            nomeData.push(data.nome);
            numData.push(data.numero);
        });

        state.charts.history.data.labels = labels;
        state.charts.history.data.datasets[0].data = cpfData;
        state.charts.history.data.datasets[1].data = nomeData;
        state.charts.history.data.datasets[2].data = numData;
        state.charts.history.update('none');
    }
}

// ========================
// UI HELPERS
// ========================

function updateQueryTypePlaceholder() {
    const type = document.getElementById('queryType').value;
    const label = document.getElementById('queryTypeLabel');
    const input = document.getElementById('queryParam');

    if (type === 'cpf') {
        label.textContent = 'CPF (apenas números)';
        input.placeholder = 'Digite o CPF...';
    } else if (type === 'nome') {
        label.textContent = 'Nome completo';
        input.placeholder = 'Digite o nome completo...';
    } else {
        label.textContent = 'Número com DDD';
        input.placeholder = 'Digite o número (ex: 11999999999)...';
    }
}

// ========================
// INICIALIZAÇÃO
// ========================

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Dashboard] Inicializando...');

    // Check authentication
    checkAuth();

    // Initialize charts if authenticated
    if (state.isAuthenticated) {
        initCharts();
    }

    // Setup event listeners
    document.getElementById('loginPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            attemptLogin();
        }
    });

    document.getElementById('queryParam').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitQuery();
        }
    });

    console.log('[Dashboard] Inicializado com sucesso');
});
