
function loadDatabase(type) {
    fetch('/api/admin/database?type=' + type)
        .then(res => res.json())
        .then(data => {
            if (data.success && data.data) {
                renderDatabaseTable(data.data);
            }
        });
}

function renderDatabaseTable(data) {
    const tbody = document.getElementById('databaseTableBody');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">Nenhum registro no banco de dados</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(record => {
        const date = new Date(record.timestamp).toLocaleString('pt-BR');
        const badgeClass = record.type;
        const statusClass = record.success ? 'success' : 'error';
        const statusText = record.success ? '✅' : '❌';

        return `
            <tr>
                <td>${date}</td>
                <td><span class="badge ${badgeClass}">${record.type.toUpperCase()}</span></td>
                <td style="font-family: 'JetBrains Mono', monospace; font-size: 12px;">${record.parameter}</td>
                <td class="${statusClass}">${statusText}</td>
                <td style="font-family: 'JetBrains Mono', monospace; font-size: 12px;">${record.requestInfo.ip}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteDatabaseRecord('${record.queryId}')">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('dbCPF').textContent = data.filter(r => r.type === 'cpf').length;
    document.getElementById('dbNome').textContent = data.filter(r => r.type === 'nome').length;
    document.getElementById('dbNumero').textContent = data.filter(r => r.type === 'numero').length;
}

function searchDatabase() {
    const type = document.getElementById('dbType').value;
    const searchTerm = document.getElementById('dbSearch').value;

    if (!searchTerm) {
        loadDatabase(type);
        return;
    }

    fetch('/api/admin/database?type=' + type + '&search=' + encodeURIComponent(searchTerm), {
        method: 'POST'
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderDatabaseTable(data.data);
            }
        });
}

function refreshDatabase() {
    const type = document.getElementById('dbType').value;
    loadDatabase(type);
    alert('Banco de dados atualizado!');
}

function deleteDatabaseRecord(queryId) {
    if (!confirm('Tem certeza que deseja excluir este registro?')) {
        return;
    }

    fetch('/api/admin/database?id=' + queryId, {
        method: 'DELETE'
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const type = document.getElementById('dbType').value;
                loadDatabase(type);
                alert('Registro excluído com sucesso!');
            }
        });
}

function clearAllDatabase() {
    if (!confirm('Tem certeza que deseja limpar TODO o banco de dados? Esta ação não pode ser desfeita!')) {
        return;
    }

    fetch('/api/admin/database?type=all', {
        method: 'DELETE'
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                document.getElementById('databaseTableBody').innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">Nenhum registro no banco de dados</td></tr>';
                document.getElementById('dbCPF').textContent = '0';
                document.getElementById('dbNome').textContent = '0';
                document.getElementById('dbNumero').textContent = '0';
                alert('Banco de dados limpo com sucesso!');
            }
        });
}
