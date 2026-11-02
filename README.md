# DayRomance

Aplicação web para organizar casamentos, convidados, confirmações de presença, presentes, tarefas e orçamento. Cada casal tem login e dados separados; convidados usam links privados de família.

## Funcionalidades

- Cadastro/login dos noivos, recuperação de senha por e-mail e sessão revogável.
- Configurações do casamento, lista de convidados, RSVP e dados persistidos no PostgreSQL.
- Link exclusivo por família, confirmação protegida por nome e quatro últimos dígitos do telefone.
- QR code individual, PDF de entrada e check-in autenticado.
- Presentes, reservas e lembretes programados para 30 e 15 dias antes do evento.
- API Node.js separada do frontend React/Vite.

## Executar localmente

Requisitos: Node.js 20+, npm e PostgreSQL. O backend usa uma base própria; não use o banco de outra aplicação.

1. Instale as dependências e configure as variáveis:

   ```bash
   npm ci
   cp .env.example .env
   ```

2. No `.env`, configure `DATABASE_URL` para um banco PostgreSQL exclusivo, gere um `JWT_SECRET` com `openssl rand -hex 32` e deixe `VITE_API_URL=/api`. SMTP é necessário para recuperação de senha; as credenciais de WhatsApp são opcionais.

3. Crie o esquema e inicie a API:

   ```bash
   npm run db:migrate
   npm start
   ```

4. Em outro terminal, inicie o frontend:

   ```bash
   npm run dev
   ```

   A configuração do Vite encaminha `/api` para `http://127.0.0.1:3001`. A API pode ser verificada em `http://127.0.0.1:3001/api/health`.

## Produção

O guia [QR_CHECKIN_SETUP.md](./QR_CHECKIN_SETUP.md) descreve a hospedagem Ubuntu/Debian, banco PostgreSQL isolado, SMTP, Nginx/HTTPS, systemd, integração WhatsApp, lembretes e backups. Há modelos de serviço em `deploy/`.

## Migração do Supabase

Os dados não foram migrados: a URL anterior não resolvia no DNS e não há um backup disponível neste ambiente. Não apague a origem antes de conferir os dados e concluir a migração. O backend PostgreSQL não importa automaticamente tabelas Supabase existentes. Os arquivos de schema e funções Supabase foram mantidos no repositório como referência para mapear a migração; eles não são usados pelo frontend/API novos.

## Tecnologias

- React, Vite e Tailwind CSS.
- Node.js, Express e PostgreSQL.
- bcryptjs para hashes de senha; JWT com sessões revogáveis.
- WhatsApp Business Platform Cloud API e SMTP, quando configurados.

## Licença

Nenhuma licença de distribuição foi especificada neste repositório.
