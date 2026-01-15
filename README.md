# 🚀 MutanoX Premium API

API premium para consultas de CPF, Nome e Número de Telefone, com dashboard administrativo avançado e WebSocket para dados em tempo real.

Criado por: **@MutanoX**

## 📋 Sumário

- [✨ Funcionalidades](#funcionalidades)
- [🛠️ Instalação](#instalação)
- [📡 Endpoints](#endpoints)
- [🎨 Dashboard](#dashboard)
- [⚙️ Configuração](#configuração)
- [🔌 WebSocket](#websocket)
- [📦 Deploy](#deploy)

---

## ✨ Funcionalidades

### API
- ✅ **Consultas de CPF** - Dados completos de CPF
- ✅ **Consultas por Nome** - Busca por nome completo
- ✅ **Consultas por Número** - Busca por telefone
- ✅ **Estatísticas em tempo real** - Contagem de consultas
- ✅ **Histórico de consultas** - Últimas 100 consultas

### Dashboard Admin
- 🎨 **Design Premium** - Interface moderna e responsiva
- 📊 **Estatísticas ao vivo** - Gráficos e métricas em tempo real
- 🔌 **WebSocket** - Dados em tempo real sem recarregar
- 🧪 **API Tester** - Teste endpoints diretamente do dashboard
- 📜 **Logs em tempo real** - Acompanhe todas as consultas
- 🌙 **Tema Dark/Light** - Alternância de tema
- 📱 **Responsivo** - Funciona em qualquer dispositivo

---

## 🛠️ Instalação

### Pré-requisitos
- Node.js 18+ 
- npm ou bun

### Passos

```bash
# Clone o repositório
git clone <seu-repositorio>
cd MutanoX-Premium

# Instale as dependências
npm install

# Inicie o servidor
npm start
```

### Desenvolvimento
```bash
npm run dev
```

---

## 📡 Endpoints

### Consultas

#### Consultar CPF
```
GET /api/consultas?tipo=cpf&cpf=XXXXXXXXXXX
```

**Parâmetros:**
- `tipo`: "cpf"
- `cpf`: Número do CPF (apenas números)

**Resposta:**
```json
{
  "sucesso": true,
  "dados": {
    "dadosBasicos": { ... },
    "dadosEconomicos": { ... },
    "enderecos": [ ... ]
  },
  "criador": "@MutanoX"
}
```

#### Consultar Nome
```
GET /api/consultas?tipo=nome&q=Nome+Completo
```

**Parâmetros:**
- `tipo`: "nome"
- `q`: Nome completo a buscar

#### Consultar Número
```
GET /api/consultas?tipo=numero&q=11999999999
```

**Parâmetros:**
- `tipo`: "numero"
- `q`: Número com DDD

### Gerenciamento

#### Estatísticas
```
GET /api/stats
```

Retorna estatísticas completas da API:
- Total de consultas
- Consultas por tipo
- Taxa de sucesso/erro
- Uptime

#### Histórico
```
GET /api/historico?limit=50
```

Retorna o histórico de consultas.

---

## 🎨 Dashboard

Acesse o dashboard administrativo em:
```
http://localhost:8080/dashboard
```

### Recursos do Dashboard

1. **Visão Geral** - Estatísticas principais
2. **API Tester** - Teste endpoints visualmente
3. **Logs em Tempo Real** - Acompanhe consultas ao vivo
4. **Gerenciamento de Endpoints** - Status dos endpoints
5. **Configurações** - Ajustes da API

---

## 🔌 WebSocket

Conecte-se ao WebSocket para receber atualizações em tempo real:

```
ws://localhost:8080
```

**Nota**: O WebSocket está integrado no mesmo servidor HTTP, usando a porta 8080. Não há necessidade de uma porta separada.

### Eventos

#### Stats Update
Recebe atualizações de estatísticas:
```json
{
  "type": "stats",
  "data": {
    "totalConsultas": 100,
    "consultasSucesso": 95,
    "consultasErro": 5,
    ...
  }
}
```

#### Nova Consulta
Recebe notificação de nova consulta:
```json
{
  "type": "consulta",
  "data": {
    "tipo": "cpf",
    "parametro": "***789-01",
    "sucesso": true,
    "timestamp": "2024-01-13T12:00:00.000Z"
  }
}
```

---

## ⚙️ Configuração

### Portas
- **API (HTTP + WebSocket)**: 8080

**Nota**: Tanto o servidor HTTP quanto o WebSocket utilizam a porta 8080, integrados no mesmo servidor. Isso permite funcionamento em hospedagens com apenas uma porta disponível.

### Variáveis de Ambiente
Nenhuma variável de ambiente necessária para funcionamento básico.

### Discloud Config
```
ID=mutano-x
TYPE=site
MAIN=index.js
NAME=MutanoX-Premium
RAM=512
VERSION=latest
AUTORESTART=true
APT=tools
START=node index.js
```

---

## 📦 Deploy

### Localmente
```bash
npm install
npm start
```

### Discloud
1. Faça upload dos arquivos
2. O arquivo `discloud.config` será reconhecido automaticamente
3. O servidor iniciará automaticamente

### Outros Hosts
Certifique-se de:
- Node.js 18+ instalado
- Porta 8080 liberada (HTTP + WebSocket integrados)
- Dependências instaladas com `npm install`

---

## 📝 Estrutura do Projeto

```
MutanoX-Premium/
├── endpoints/
│   ├── cpf.js           # Endpoint CPF
│   ├── nome.js          # Endpoint Nome
│   └── numero.js        # Endpoint Número
├── index.js             # Servidor principal + WebSocket
├── dashboard.html       # Dashboard administrativo
├── package.json         # Dependências
├── discloud.config      # Configuração Discloud
└── README.md           # Documentação
```

---

## 🔐 Segurança

- CPFs são mascarados nos logs (ex: ***789-01)
- Validação de entrada em todos os endpoints
- CORS habilitado para produção
- Tratamento robusto de erros

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

---

## 📄 Licença

MIT License - Veja o arquivo LICENSE para detalhes

---

## 👨‍💻 Autor

**@MutanoX**

- [GitHub](https://github.com/MutanoX)

---

## ⭐ Suporte

Se você gostou do projeto, considere dar uma ⭐!

Para suporte, abra uma issue no GitHub.

---

**Desenvolvido com ❤️ por @MutanoX**
