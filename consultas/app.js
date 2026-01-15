/**
 * Consultas App - Lógica para interface de consultas
 */

// Usar caminho relativo para funcionar em qualquer domínio
const API_BASE = '/api';

// Estado da aplicação
const state = {
    currentTab: 'cpf',
    lastResults: null,
    lastQueryType: null
};

// Configuração de input por tipo
const INPUT_CONFIG = {
    cpf: {
        label: 'CPF (apenas números)',
        placeholder: 'Digite o CPF...',
        mask: (value) => value.replace(/\D/g, '').slice(0, 11)
    },
    nome: {
        label: 'Nome completo',
        placeholder: 'Digite o nome completo...',
        mask: (value) => value
    },
    numero: {
        label: 'Número com DDD',
        placeholder: 'Digite o número (ex: 11999999999)...',
        mask: (value) => value.replace(/\D/g, '').slice(0, 11)
    }
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupSearch();
    setupButtons();
    console.log('[Consultas App] Inicializado');
});

// Configuração das abas
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const inputLabel = document.getElementById('inputLabel');
    const searchInput = document.getElementById('searchInput');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remover classe active de todas as abas
            tabs.forEach(t => t.classList.remove('active'));
            // Adicionar classe active à aba clicada
            tab.classList.add('active');

            // Atualizar estado
            state.currentTab = tab.dataset.tab;

            // Atualizar label e placeholder do input
            const config = INPUT_CONFIG[state.currentTab];
            inputLabel.textContent = config.label;
            searchInput.placeholder = config.placeholder;
            searchInput.value = '';

            // Limpar resultados
            clearResults();
        });
    });
}

// Configuração da busca
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    // Evento de clique no botão
    searchBtn.addEventListener('click', performSearch);

    // Evento de Enter no input
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // Máscara de input
    searchInput.addEventListener('input', (e) => {
        const config = INPUT_CONFIG[state.currentTab];
        if (config.mask) {
            e.target.value = config.mask(e.target.value);
        }
    });
}

// Configuração dos botões
function setupButtons() {
    document.getElementById('copyResultsBtn').addEventListener('click', copyResults);
    document.getElementById('clearResultsBtn').addEventListener('click', clearResults);
}

// Realizar busca
async function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const query = searchInput.value.trim();

    if (!query) {
        showError('Por favor, preencha o campo de busca.');
        return;
    }

    // Validar CPF
    if (state.currentTab === 'cpf' && query.length !== 11) {
        showError('CPF deve conter 11 dígitos.');
        return;
    }

    // Validar número
    if (state.currentTab === 'numero' && (query.length < 10 || query.length > 11)) {
        showError('Número deve ter 10 ou 11 dígitos (incluindo DDD).');
        return;
    }

    // Mostrar loading
    showLoading(true);
    hideError();
    hideEmptyState();

    // Desabilitar botão
    searchBtn.disabled = true;

    try {
        const url = buildApiUrl(query);
        console.log('[Consultas App] Fazendo requisição para:', url);

        const response = await fetch(url);
        const data = await response.json();

        console.log('[Consultas App] Resposta:', data);

        if (data.success) {
            state.lastResults = data;
            state.lastQueryType = state.currentTab;
            displayResults(data);
        } else if (data.protected) {
            showError('⛔ Consulta bloqueada - Este usuário está protegido.');
        } else {
            showError(data.error || 'Erro ao realizar consulta.');
        }
    } catch (error) {
        console.error('[Consultas App] Erro:', error);
        showError('Erro de conexão com a API. Tente novamente.');
    } finally {
        showLoading(false);
        searchBtn.disabled = false;
    }
}

// Construir URL da API
function buildApiUrl(query) {
    if (state.currentTab === 'cpf') {
        return `${API_BASE}/consultas?tipo=cpf&cpf=${encodeURIComponent(query)}`;
    } else {
        return `${API_BASE}/consultas?tipo=${state.currentTab}&q=${encodeURIComponent(query)}`;
    }
}

// Exibir resultados
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

// Exibir resultados de CPF
function displayCPFResults(data, container) {
    if (!data || Object.keys(data).length === 0) {
        container.innerHTML = `
            <div class="glass-card rounded-xl p-8 text-center border-2 border-yellow-500/30 bg-yellow-500/10">
                <div class="text-4xl mb-3">⚠️</div>
                <h3 class="text-lg font-semibold text-yellow-400 mb-2">Nenhum dado encontrado</h3>
                <p class="text-gray-400">O CPF informado não retornou dados na consulta.</p>
            </div>
        `;
        return;
    }

    const basic = data.basicData || {};
    const economic = data.economicData || {};
    const addresses = data.addresses || [];
    const important = data.importantInfo || {};

    container.innerHTML = `
        <div class="result-card glass-card rounded-xl overflow-hidden">
            <!-- Header -->
            <div class="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 px-6 py-4 border-b border-white/10">
                <div class="flex items-center gap-3">
                    <div class="text-3xl">📄</div>
                    <div>
                        <h3 class="text-lg font-semibold">Consulta de CPF</h3>
                        <p class="text-sm text-gray-400">${maskCPF(basic.cpf || 'N/A')}</p>
                    </div>
                </div>
            </div>

            <!-- Content -->
            <div class="p-6 space-y-6">

                <!-- Dados Básicos -->
                <section>
                    <h4 class="text-sm font-semibold text-indigo-400 mb-3 flex items-center gap-2">
                        <span>👤</span> Dados Básicos
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <h4 class="text-sm font-semibold text-indigo-400 mb-3 flex items-center gap-2">
                        <span>🏠</span> Endereços (${addresses.length})
                    </h4>
                    <div class="space-y-3">
                        ${addresses.map(addr => `
                            <div class="bg-slate-800/50 rounded-lg p-4 border border-white/5">
                                <p class="text-gray-200">${addr.street || 'N/A'}</p>
                                <p class="text-sm text-gray-400 mt-1">${addr.neighborhood || ''} - ${addr.cityUF || ''}</p>
                                <p class="text-sm text-gray-500 mt-1">CEP: ${addr.cep || 'N/A'}</p>
                            </div>
                        `).join('')}
                    </div>
                </section>
                ` : ''}

                ${Object.keys(economic).length > 0 ? `
                <!-- Dados Econômicos -->
                <section>
                    <h4 class="text-sm font-semibold text-indigo-400 mb-3 flex items-center gap-2">
                        <span>💰</span> Dados Econômicos
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <h4 class="text-sm font-semibold text-indigo-400 mb-3 flex items-center gap-2">
                        <span>⚠️</span> Informações Importantes
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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

// Exibir resultados de lista (Nome/Número)
function displayListResults(results, container, type) {
    if (!results || results.length === 0) {
        container.innerHTML = `
            <div class="glass-card rounded-xl p-8 text-center border-2 border-yellow-500/30 bg-yellow-500/10">
                <div class="text-4xl mb-3">⚠️</div>
                <h3 class="text-lg font-semibold text-yellow-400 mb-2">Nenhum resultado encontrado</h3>
                <p class="text-gray-400">Nenhum registro foi encontrado para esta consulta.</p>
            </div>
        `;
        return;
    }

    const displayResults = results.slice(0, 50); // Mostrar até 50 resultados

    container.innerHTML = `
        <div class="space-y-4">
            ${displayResults.map((result, index) => createResultCard(result, type, index)).join('')}
        </div>
        ${results.length > 50 ? `
            <div class="glass-card rounded-xl p-4 text-center">
                <p class="text-gray-400">Mostrando 50 de ${results.length} resultados</p>
            </div>
        ` : ''}
    `;
}

// Criar card de resultado
function createResultCard(result, type, index) {
    if (type === 'nome') {
        return createNomeCard(result, index);
    } else {
        return createNumeroCard(result, index);
    }
}

// Criar card de nome
function createNomeCard(result, index) {
    return `
        <div class="result-card glass-card rounded-xl overflow-hidden">
            <div class="bg-gradient-to-r from-purple-600/20 to-indigo-600/20 px-6 py-4 border-b border-white/10">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="text-3xl">👤</div>
                        <div>
                            <h3 class="text-lg font-semibold">${result.name || 'N/A'}</h3>
                            <p class="text-sm text-gray-400">CPF: ${maskCPF(result.cpf || 'N/A')}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(result.registrationStatus)}">
                            ${result.registrationStatus || 'N/A'}
                        </span>
                    </div>
                </div>
            </div>
            <div class="p-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

// Criar card de número
function createNumeroCard(result, index) {
    return `
        <div class="result-card glass-card rounded-xl overflow-hidden">
            <div class="bg-gradient-to-r from-green-600/20 to-emerald-600/20 px-6 py-4 border-b border-white/10">
                <div class="flex items-center gap-3">
                    <div class="text-3xl">📱</div>
                    <div>
                        <h3 class="text-lg font-semibold">${result.name || 'N/A'}</h3>
                        <p class="text-sm text-gray-400">${maskCNPJ(result.cpfCnpj || 'N/A')}</p>
                    </div>
                </div>
            </div>
            <div class="p-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${createInfoField('Data de Nascimento', result.birthDate || 'N/A')}
                    ${result.neighborhood ? createInfoField('Bairro', result.neighborhood) : ''}
                    ${result.cityUF ? createInfoField('Cidade/UF', result.cityUF) : ''}
                    ${result.cep ? createInfoField('CEP', result.cep) : ''}
                </div>
            </div>
        </div>
    `;
}

// Criar campo de informação
function createInfoField(label, value) {
    if (!value || value === 'N/A') return '';
    return `
        <div class="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">${label}</p>
            <p class="text-sm text-gray-200">${value}</p>
        </div>
    `;
}

// Criar linha de informação
function createInfoRow(label, value) {
    if (!value || value === 'N/A') return '';
    return `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/5">
            <p class="text-xs text-gray-500 uppercase tracking-wider">${label}</p>
            <p class="text-sm text-gray-200 md:col-span-2">${value}</p>
        </div>
    `;
}

// Obter cor do status
function getStatusColor(status) {
    const statusMap = {
        'REGULAR': 'bg-green-500/20 text-green-400',
        'SUSPENSA': 'bg-yellow-500/20 text-yellow-400',
        'TITULAR FALECIDO': 'bg-red-500/20 text-red-400',
        'CANCELADA': 'bg-red-500/20 text-red-400'
    };
    return statusMap[status] || 'bg-gray-500/20 text-gray-400';
}

// Mascarar CPF
function maskCPF(cpf) {
    if (!cpf || cpf.length < 11) return cpf || 'N/A';
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.substring(0, 3) + '.' + cleaned.substring(3, 6) + '.' +
           cleaned.substring(6, 9) + '-' + cleaned.substring(9, 11);
}

// Mascarar CNPJ
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

// Mostrar/ocultar loading
function showLoading(show) {
    const loadingState = document.getElementById('loadingState');
    if (show) {
        loadingState.classList.remove('hidden');
    } else {
        loadingState.classList.add('hidden');
    }
}

// Mostrar erro
function showError(message) {
    const errorState = document.getElementById('errorState');
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorState.classList.remove('hidden');
}

function hideError() {
    const errorState = document.getElementById('errorState');
    errorState.classList.add('hidden');
}

// Ocultar estado vazio
function hideEmptyState() {
    const emptyState = document.getElementById('emptyState');
    emptyState.classList.add('hidden');
}

// Limpar resultados
function clearResults() {
    document.getElementById('resultsContainer').innerHTML = '';
    document.getElementById('resultsSummary').classList.add('hidden');
    document.getElementById('searchInput').value = '';
    document.getElementById('emptyState').classList.remove('hidden');
    state.lastResults = null;
    hideError();
}

// Copiar resultados
function copyResults() {
    if (!state.lastResults) return;

    let text = '';

    if (state.lastQueryType === 'cpf') {
        const data = state.lastResults.data;
        text = `CONSULTA DE CPF\n`;
        text += `================\n`;
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
        text = `RESULTADOS DA CONSULTA (${state.lastQueryType.toUpperCase()})\n`;
        text += `=========================================\n\n`;
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
        alert('Resultados copiados para a área de transferência!');
    }).catch(err => {
        alert('Erro ao copiar resultados.');
    });
}
