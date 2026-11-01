# DayRomance

Aplicação web para organizar informações e tarefas do casamento, gerenciar convidados e compartilhar a confirmação de presença, a lista de presentes e outros detalhes do evento.

## Funcionalidades

- **Site dos convidados:** informações do evento, confirmação de presença, lista de presentes e mural de recados.
- **Painel dos noivos:** gerenciamento de famílias e convidados, limite e contagem de convidados, confirmações, presentes, tarefas e controle financeiro.
- **Espaços isolados por casal:** cadastro e login dos noivos, com dados persistidos no Supabase e separados por casamento.
- **Convite por família:** link exclusivo que abre somente o site e as informações do casamento correspondente.
- **Confirmação de presença:** validação do convite pelo nome e pelos quatro últimos dígitos do telefone cadastrado.
- **Convites com QR code:** geração e envio de PDFs individuais para convidados confirmados, com check-in separado e autenticado no evento.
- **Reservas de presentes:** registro do WhatsApp para contato e lembretes programados pelo sistema, quando a integração estiver configurada.
- **Supabase e WhatsApp:** persistência de dados, autenticação do painel, funções de backend e integração com a API oficial do WhatsApp Business Platform.

> **Atenção:** as integrações com Supabase e WhatsApp não ficam ativas apenas por clonar o repositório. É necessário criar e configurar os serviços, aplicar a migração e publicar as funções. Consulte [QR_CHECKIN_SETUP.md](./QR_CHECKIN_SETUP.md).

## Requisitos

- Node.js e npm.
- Para as integrações: projeto Supabase, CLI do Supabase, conta WhatsApp Business Platform da Meta e templates aprovados.

## Executar localmente

1. Clone o repositório e entre na pasta:

   ```powershell
   git clone https://github.com/AlbuquerqueGabriel22/dayromance.git
   cd dayromance
   ```

2. Instale as dependências:

   ```powershell
   npm install
   ```

3. Crie `.env.local` a partir do exemplo:

   ```powershell
   Copy-Item .env.example .env.local
   ```

4. Para usar o Supabase, preencha em `.env.local`:

   ```dotenv
   VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA_ANON
   ```

   Sem configurar o Supabase, o ambiente de desenvolvimento mostra dados demonstrativos locais. A autenticação, os links exclusivos e a persistência só funcionam com o backend configurado.

5. Inicie o servidor de desenvolvimento:

   ```powershell
   npm run dev
   ```

   O Vite exibirá o endereço local no terminal.

## Comandos

```powershell
npm run dev      # inicia o servidor local
npm run build    # gera a versão de produção em dist/
npm run preview  # serve localmente a versão de produção
```

## Supabase, check-in e WhatsApp

As tabelas, políticas de acesso, cadastro dos casais, convites por família, funções de RSVP/check-in, QR codes e reservas de presentes são documentadas em [QR_CHECKIN_SETUP.md](./QR_CHECKIN_SETUP.md). O guia inclui:

- Aplicação das migrações na ordem correta.
- Cadastro pelo portal e criação do espaço de cada casal.
- Isolamento dos dados por casamento e criação de links familiares.
- Publicação das Edge Functions.
- Configuração segura dos segredos da Meta no Supabase.
- Configuração dos templates e envio de PDFs individuais.
- Agendamento dos lembretes automáticos de reservas 30 e 15 dias antes do evento.

Nunca coloque a chave `service_role`, o token do WhatsApp ou outros segredos em variáveis `VITE_`, no código do frontend ou em arquivos versionados. O arquivo `.env.example` contém apenas nomes e valores de exemplo; use `.env.local` para as configurações locais.

## Tecnologias

- React e Vite
- Tailwind CSS
- Supabase Auth, PostgreSQL, Storage e Edge Functions
- WhatsApp Business Platform Cloud API

## Licença

Nenhuma licença de distribuição foi especificada neste repositório.
