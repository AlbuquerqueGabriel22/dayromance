# DayRomance: PostgreSQL e hospedagem

O DayRomance agora usa uma API Node.js própria e um banco PostgreSQL. Os dados ficam isolados por conta/casamento; as senhas são armazenadas com hash, as sessões podem ser revogadas e os links familiares e QR codes usam tokens aleatórios cujo hash é salvo no banco.

> **Migração de dados pendente:** o endereço Supabase usado anteriormente não resolveu no DNS, então não foi possível verificar se há dados nem copiá-los. Os arquivos antigos de schema e funções continuam no diretório `supabase/` apenas como referência; não são usados pelo backend atual. Não apague o projeto ou o banco Supabase até confirmar a migração. Para continuar, será necessário fornecer a URL correta do projeto ou um backup exportado.

## 1. Arquitetura e isolamento do PostgreSQL existente

O serviço Node escuta somente em `127.0.0.1:3001`. O Nginx serve o site e encaminha `/api/` para essa porta. O PostgreSQL não deve ser exposto à internet.

Como o servidor já atende outra aplicação, use um **banco novo** (`dayromance`) e um **usuário novo** (`dayromance_app`). Não execute a migração no banco usado pela aplicação existente e não altere `postgresql.conf`, `pg_hba.conf` ou as credenciais da aplicação atual.

Antes de escolher a porta, confira se `3001` está livre (`sudo ss -ltnp`). Se já estiver em uso, escolha outra porta livre e atualize `PORT` no `.env` e o destino `127.0.0.1:PORT` no Nginx.

Antes de criar os nomes, verifique se já existem:

```bash
sudo -u postgres psql -c '\du'
sudo -u postgres psql -c '\l'
```

Se `dayromance` ou `dayromance_app` já existir, pare e escolha nomes exclusivos; não reutilize nem remova objetos existentes. Se estiverem livres, crie apenas os objetos novos:

```bash
sudo -u postgres createuser --pwprompt dayromance_app
sudo -u postgres createdb --owner=dayromance_app dayromance
```

O comando solicitará uma senha sem exibi-la. Use uma senha aleatória, exclusiva para esta aplicação. O servidor Node conecta via loopback, e a senha ficará somente no `.env` com permissão restrita.

## 2. Preparar o servidor Linux

Requisitos: Ubuntu/Debian, PostgreSQL já em execução, Node.js 20 ou superior, Nginx, DNS apontando para o servidor e acesso administrativo. Primeiro, publique/instale a versão atualizada do código no GitHub ou transfira os arquivos para o servidor. Não publique arquivos `.env`.

Instale as ferramentas necessárias sem reinstalar nem reconfigurar o PostgreSQL:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx git
node --version
npm --version
```

Instale Node.js 20+ caso a versão já disponível seja antiga. Crie um usuário Linux próprio para o processo:

```bash
sudo adduser --system --group --home /var/lib/dayromance dayromance
sudo install -d -o dayromance -g dayromance /opt/dayromance
```

Clone o repositório ou copie a versão atual para `/opt/dayromance`. Em seguida, instale os pacotes, crie a configuração privada e aplique o esquema **somente ao banco novo**:

```bash
sudo -u dayromance git clone https://github.com/AlbuquerqueGabriel22/dayromance.git /opt/dayromance
cd /opt/dayromance
sudo -u dayromance npm ci
sudo cp .env.example .env
sudo nano .env
sudo chown dayromance:dayromance .env
sudo chmod 600 .env
```

Preencha no `.env`:

```dotenv
VITE_API_URL=/api
PORT=3001
APP_PUBLIC_URL=https://SEU_DOMINIO
APP_ORIGIN=https://SEU_DOMINIO
TRUST_PROXY=true
DATABASE_URL=postgresql://dayromance_app:SENHA_ALEATORIA@127.0.0.1:5432/dayromance
DATABASE_NAME=dayromance
DATABASE_SSL=false
DATABASE_POOL_SIZE=10
JWT_SECRET=SEGREDO_ALEATORIO_COM_PELO_MENOS_32_CARACTERES
```

Gere o segredo da sessão com `openssl rand -hex 32`. Substitua `SEU_DOMINIO` pelo endereço HTTPS real. Se a senha do banco tiver caracteres especiais, faça o percent-encoding deles na `DATABASE_URL` ou use uma senha hexadecimal aleatória para simplificar. Não use `VITE_` em segredos.

Para recuperar senhas, configure SMTP no mesmo `.env`:

```dotenv
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM=
```

Sem SMTP, o login funciona, mas recuperação de senha retorna um aviso explícito de que o serviço de e-mail não está configurado.

Execute a migração e compile os arquivos estáticos:

```bash
cd /opt/dayromance
sudo -u dayromance npm run db:migrate
sudo -u dayromance npm run build
```

A migração cria tabelas com prefixo `dr_` dentro do banco `dayromance`; é idempotente. Confira a API antes de publicar:

```bash
sudo -u dayromance npm start
```

Em outro terminal, teste `curl http://127.0.0.1:3001/api/health`. Depois interrompa o processo manual com `Ctrl+C`; o systemd será responsável por mantê-lo ativo.

## 3. Ativar o serviço e o domínio

Instale o serviço de API, o timer de lembretes e o site Nginx de exemplo:

```bash
sudo cp /opt/dayromance/deploy/dayromance.service /etc/systemd/system/
sudo cp /opt/dayromance/deploy/dayromance-reminders.service /etc/systemd/system/
sudo cp /opt/dayromance/deploy/dayromance-reminders.timer /etc/systemd/system/
sudo cp /opt/dayromance/deploy/dayromance.nginx.conf.example /etc/nginx/sites-available/dayromance
sudo nano /etc/nginx/sites-available/dayromance
```

No arquivo Nginx, substitua `SEU_DOMINIO`. Ative o site e o serviço:

```bash
sudo ln -s /etc/nginx/sites-available/dayromance /etc/nginx/sites-enabled/dayromance
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now dayromance.service
sudo systemctl enable --now dayromance-reminders.timer
sudo systemctl reload nginx
sudo systemctl status dayromance.service
```

Emita o certificado HTTPS depois que o DNS já apontar para o servidor:

```bash
sudo certbot --nginx -d SEU_DOMINIO
```

O painel do firewall/roteador deve expor somente HTTP/HTTPS (80 e 443). Mantenha PostgreSQL (5432) e a API Node (3001) inacessíveis externamente. Em servidor atrás de roteador, encaminhe apenas as portas web e configure o DNS público.

Após atualizar o código no futuro, repita `npm ci`, `npm run db:migrate`, `npm run build` e `sudo systemctl restart dayromance.service`. O timer de lembretes roda diariamente às 12:00 UTC (09:00 em Brasília).

## 4. WhatsApp, QR code e reservas

Sem credenciais WhatsApp, RSVP e check-in continuam sendo registrados, mas o envio do PDF QR retorna como não entregue; o painel informa que é necessário reenviar depois da configuração. Para habilitar entrega, configure no `.env`:

```dotenv
WHATSAPP_GRAPH_API_VERSION=vXX.X
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_TEMPLATE_NAME=
WHATSAPP_TEMPLATE_LANGUAGE=pt_BR
WHATSAPP_REMINDER_TEMPLATE_NAME=
```

Na Meta, aprove:

- Um template com cabeçalho de **documento** e uma variável de texto no corpo (nome do convidado) para o PDF QR.
- Um template de categoria Utility com três parâmetros no corpo, na ordem: nome do convidado, presente reservado e dias até o casamento.

Obtenha o opt-in dos destinatários e use um token com permissões mínimas necessárias. O envio dos lembretes depende de `WHATSAPP_REMINDER_TEMPLATE_NAME` e das credenciais da Cloud API. O timer registra erros e tenta novamente nas execuções seguintes, sem reenviar mensagens marcadas como concluídas.

Os lembretes são agendados para 30 e 15 dias antes, somente se a reserva ocorrer antes da respectiva data. O link QR é individual; o check-in exige login de um dos noivos e só é aceito para um convidado confirmado.

## 5. Backup e atualizações

Faça backups regulares do banco isolado e armazene-os fora do servidor. Exemplo de backup manual:

```bash
sudo -u postgres pg_dump --format=custom --file=/caminho-seguro/dayromance-$(date +%F).dump dayromance
```

Proteja também o `.env`, que contém credenciais. Faça um teste de restauração em um banco separado antes de depender de qualquer backup.

## 6. Dados antigos do Supabase

O backend novo ainda não importou os dados do Supabase. A URL informada anteriormente não era resolvida pelo DNS e não há um dump acessível neste ambiente. Para migrar sem perder informações, confirme primeiro a URL correta do projeto ou exporte um backup; então será possível mapear casais, convidados, convites, presentes, tarefas e finanças para o novo esquema. Não desative o projeto de origem antes dessa conferência.
