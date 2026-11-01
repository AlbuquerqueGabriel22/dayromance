# Configuração do DayRomance, QR code, check-in e WhatsApp

O Supabase armazena as contas, casamentos, configurações, convidados, confirmações, presentes, reservas, tarefas, finanças e mensagens. Cada conta administra um casamento isolado. Cada família recebe um link privado para acessar somente o site e o RSVP do casamento associado. O QR contém um token aleatório; o banco guarda somente o hash. O leitor da entrada exige login de administrador.

## 1. Configurar o Supabase

1. Crie um projeto Supabase e copie a URL e a chave `anon`/publishable para um arquivo local `.env.local`, usando `.env.example` como modelo. Não coloque a chave `service_role` nesse arquivo nem no frontend.
2. Vincule a CLI ao projeto e aplique as migrações versionadas:

   ```powershell
   npx supabase login
   npx supabase link --project-ref SEU_PROJECT_REF
   npx supabase db push
   ```

3. Configure a URL pública do site como secret e publique as funções. As contas dos noivos são criadas pelo portal do site; depois do cadastro, cada casal configura seu espaço e adiciona as famílias no painel.

   ```powershell
   npx supabase secrets set APP_PUBLIC_URL=https://SEU_SITE_PUBLICO
   npx supabase functions deploy verify-invite
   npx supabase functions deploy submit-rsvp
   npx supabase functions deploy get-family-invite
   npx supabase functions deploy create-family-invite
   npx supabase functions deploy create-guest-message
   npx supabase functions deploy check-in
   npx supabase functions deploy resend-guest-qrs
   npx supabase functions deploy create-gift-reservation
   npx supabase functions deploy send-gift-reminders
   ```

No painel, use **Link do convite** na família desejada para gerar e copiar o link exclusivo, no formato `/convite/TOKEN`. Compartilhe esse endereço apenas com a família correspondente. A geração do link exige que `APP_PUBLIC_URL` esteja configurada.

## 2. Configurar o WhatsApp da Meta

1. Configure uma conta WhatsApp Business Platform e um número habilitado para a Cloud API.
2. Crie e obtenha aprovação de um template em português com **cabeçalho de documento** e um parâmetro de texto no corpo (`{{1}}`) para o nome do convidado. O envio é feito usando o nome e idioma configurados abaixo.
3. Obtenha autorização/opt-in dos convidados para receber a mensagem pelo WhatsApp.
4. Configure os segredos nas Edge Functions. Use a versão Graph API ativa para sua conta; nunca adicione esses valores ao código ou a variáveis `VITE_`:

   ```powershell
   npx supabase secrets set APP_PUBLIC_URL=https://SEU_SITE_PUBLICO `
     WHATSAPP_GRAPH_API_VERSION=vXX.X `
     WHATSAPP_PHONE_NUMBER_ID=SEU_PHONE_NUMBER_ID `
     WHATSAPP_ACCESS_TOKEN=SEU_TOKEN `
     WHATSAPP_TEMPLATE_NAME=SEU_TEMPLATE `
     WHATSAPP_TEMPLATE_LANGUAGE=pt_BR `
     WHATSAPP_REMINDER_TEMPLATE_NAME=SEU_TEMPLATE_DE_LEMBRETE `
     GIFT_REMINDER_CRON_SECRET=SUBSTITUA_POR_UM_SEGREDO_ALEATORIO_FORTE
   ```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são usados apenas pelas Edge Functions. Verifique a disponibilidade deles no ambiente das funções; se necessário, configure-os como secrets no projeto. A chave `service_role` deve permanecer exclusivamente no servidor.

O endereço público deve ser HTTPS e apontar para esta aplicação. O leitor da festa usa `/check-in` e a câmera do navegador.

## 3. Ativar os lembretes automáticos de reservas

1. Crie e obtenha aprovação da Meta para um template de WhatsApp da categoria **Utility**, idioma `pt_BR`, sem cabeçalho, com três variáveis no corpo. Exemplo de texto para submeter:

   ```text
   Olá, {{1}}! Este é um lembrete da sua reserva de {{2}} para o casamento. Faltam {{3}} dias para o evento. Para combinar o pagamento, responda a esta mensagem.
   ```

   Configure `WHATSAPP_REMINDER_TEMPLATE_NAME` com o nome aprovado. A conta também precisa ter opt-in dos destinatários para mensagens pelo WhatsApp.

2. Publique `create-gift-reservation` e `send-gift-reminders` após configurar os secrets. As reservas feitas com a automação ativa ficam armazenadas no Supabase, com telefone, presente e data do casamento.

3. No painel **Database → Extensions** do Supabase, habilite `pg_cron`, `pg_net` e `supabase_vault`, caso ainda não estejam habilitadas.

4. No SQL Editor, salve a URL da função e o mesmo segredo configurado em `GIFT_REMINDER_CRON_SECRET` no Vault. Substitua os valores de exemplo:

   ```sql
   select vault.create_secret(
     'https://SEU_PROJECT_REF.supabase.co/functions/v1/send-gift-reminders',
     'gift_reminder_url'
   );
   select vault.create_secret(
     'SUBSTITUA_PELO_MESMO_SEGREDO_CONFIGURADO_NO_SUPABASE',
     'gift_reminder_cron_secret'
   );
   ```

5. Agende a execução diária às 12:00 UTC (09:00 no horário de Brasília):

   ```sql
   select cron.schedule(
     'send-gift-reminders-daily',
     '0 12 * * *',
     $$
     select net.http_post(
       url := (
         select decrypted_secret
         from vault.decrypted_secrets
         where name = 'gift_reminder_url'
       ),
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (
           select decrypted_secret
           from vault.decrypted_secrets
           where name = 'gift_reminder_cron_secret'
         )
       ),
       body := '{}'::jsonb
     );
     $$
   );
   ```

6. Depois de confirmar que o job `send-gift-reminders-daily` está ativo em **Database → Cron Jobs**, habilite os registros de reserva:

   ```sql
   update public.gift_reminder_settings
   set enabled = true
   where id is true;
   ```

O sistema envia um lembrete por reserva 30 dias antes e outro 15 dias antes. A reserva precisa ser registrada até cada data correspondente para receber aquele lembrete. Falhas são registradas e tentadas novamente nas execuções diárias seguintes; envios registrados como concluídos não são processados novamente. Enquanto `gift_reminder_settings.enabled` estiver desativado, a tela não aceitará uma reserva prometendo lembretes automáticos.

## 4. Fluxo

- Os noivos criam a conta no site, configuram o casamento e cadastram famílias, telefone e convidados no painel.
- Cada família recebe um link exclusivo, que só carrega o casamento e os membros associados àquele convite. Não compartilhe o link publicamente.
- O convidado informa o nome e os quatro últimos dígitos do telefone da família na área de RSVP do link.
- A validação limita tentativas por endereço de rede e nome informado (10 a cada 15 minutos).
- Depois da validação, responde uma única vez. A resposta é bloqueada no banco para impedir reenvio.
- Para cada pessoa confirmada, a função cria um token QR individual, gera um PDF e envia o documento ao telefone WhatsApp cadastrado para a família.
- Se a entrega falhar, um administrador pode clicar no ícone de envio da família no painel para gerar novos QR codes e reenviar os documentos.
- O QR só é aceito se a pessoa ainda estiver confirmada. Alterar o status invalida o token e remove o check-in anterior; excluir a pessoa invalida o convite por cascata.
- Os PDFs ficam em um bucket privado do Supabase. O banco remove o arquivo quando o convidado é excluído ou quando o status/nome muda.
- Na entrada, a organização acessa `/check-in`, entra com uma conta autorizada e lê o QR. O primeiro scan registra o check-in e mostra o nome; scans seguintes informam que a entrada já foi registrada. QR inválido, ausente ou não confirmado mostra **“Convidado não confirmado”**.
- Para reservas de presentes, o convidado informa o WhatsApp após escolher “Reservar para pagar depois”. Com a automação habilitada, o Supabase guarda a reserva e envia os lembretes programados pelo template aprovado da Meta.

Se as credenciais ou o template da Meta estiverem ausentes/incorretos, a resposta de RSVP ainda será registrada, mas o PDF poderá não ser entregue; a página informa quando o envio falha.
