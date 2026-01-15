# Consultas Service - Versões Alternativas

Este mini-service possui duas versões para máxima compatibilidade:

## Versão Bun (Principal)
- **Arquivo:** `index.ts`
- **Runtime:** Bun (https://bun.sh)
- **Framework:** Hono
- **Quando usar:** Quando Bun está instalado e disponível

## Versão Node.js (Fallback)
- **Arquivo:** `server-node.js`
- **Runtime:** Node.js (v14+)
- **Framework:** http nativo
- **Quando usar:** Quando Bun não está disponível ou falha ao iniciar

## Funcionamento Automático

O servidor principal (`index.js`) usa automaticamente a melhor opção:

1. **Primeiro:** Tenta encontrar e usar Bun
2. **Se Bun não funcionar:** Faz fallback automático para Node.js

## Como Iniciar Manualmente

### Usando Bun (se disponível)
```bash
cd mini-services/consultas-service
bun install
bun run dev
```

### Usando Node.js
```bash
cd mini-services/consultas-service
node server-node.js
```

## Dependências

### Versão Bun
- hono (^4.0.0)
- tailwindcss (para CSS)

### Versão Node.js
- **Nenhuma dependência externa!**
- Apenas módulos nativos do Node.js

## Funcionalidades

Ambas as versões oferecem as mesmas funcionalidades:
- ✅ Registro e autenticação de usuários
- ✅ Proxy para o servidor principal
- ✅ Histórico de consultas por usuário
- ✅ Health check endpoint
- ✅ CORS habilitado
- ✅ Servir arquivos estáticos

## Endpoints

### Público
- `GET /health` - Health check
- `POST /api/users/register` - Registrar novo usuário
- `POST /api/users/login` - Login
- `ALL /api/proxy/*` - Proxy para servidor principal

### Requer Autenticação
- `GET /api/user/queries` - Buscar consultas do usuário

### Estáticos
- `/` - Página principal
- `*.html`, `*.css`, `*.js`, `*.png`, `*.jpg`, `*.svg`

## Porta

Ambas as versões usam a porta **3001** por padrão.

## Logs

### Versão Bun
Logs aparecem como: `[Mini-Service] ...`

### Versão Node.js
Logs aparecem como: `[Mini-Service Node] ...`

Isso ajuda a identificar qual runtime está sendo usado.

## Desenvolvimento

### Testar Versão Bun
1. Certifique-se que Bun está instalado: `bun --version`
2. Instale dependências: `bun install`
3. Execute: `bun run dev`

### Testar Versão Node.js
1. Certifique-se que Node.js está instalado: `node --version`
2. Execute: `node server-node.js`

## Qual Versão Usar?

### Use Bun se:
- ✅ Performance é crítica
- ✅ Quer startup mais rápido
- ✅ Bun já está instalado no ambiente
- ✅ Precisa de recursos avançados do Bun

### Use Node.js se:
- ✅ Bun não está disponível
- ✅ Quer maximizar compatibilidade
- ✅ Ambiente tem restrições de instalação
- ✅ Prefere usar apenas Node.js padrão

## Notas Importantes

1. **Compatibilidade:** A versão Node.js é 100% funcional e não depende de Bun
2. **Transparência:** O servidor principal escolhe automaticamente a melhor opção
3. **Manutenção:** Ambas as versões mantêm paridade funcional
4. **Logs:** Verifique os logs para saber qual versão está rodando

## Troubleshooting

### Bun não é encontrado
**Solução:** O sistema usa Node.js automaticamente como fallback.

### Node.js não funciona
**Solução:** Verifique se Node.js v14+ está instalado: `node --version`

### Erro EADDRINUSE (porta 3001 em uso)
**Solução:**
```bash
# Encontrar processo usando a porta
lsof -i :3001
# Ou no Linux:
fuser 3001/tcp

# Matar o processo
kill -9 <PID>
```

### Ver logs do servidor
Os logs mostram claramente qual runtime está em uso:
- Bun: `[Mini-Service] ...`
- Node.js: `[Mini-Service Node] ...`

## Exemplo de Output

### Usando Bun
```
[Mini-Service] Tentando iniciar com bun...
[Mini-Service] Bun encontrado: /usr/local/bin/bun
[Mini-Service] Iniciando serviço de consultas com bun...
[Mini-Service] Bun encontrado: /usr/local/bin/bun
✅ [Mini-Service] Iniciado com sucesso na porta 3001
```

### Usando Node.js (Fallback)
```
[Mini-Service] Tentando iniciar com bun...
[Mini-Service] Bun não disponível ou erro ao iniciar: Bun não encontrado no sistema
[Mini-Service] Fazendo fallback para Node.js...
[Mini-Service] Iniciando serviço de consultas com Node.js...
[Consultas Service - Node.js] Servidor iniciado na porta 3001
✅ [Mini-Service Node] Iniciado com sucesso na porta 3001
```
