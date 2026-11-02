function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be configured to send gift reminders.`);
  return value;
}

async function sendReminder(reminder) {
  const graphVersion = requiredEnv('WHATSAPP_GRAPH_API_VERSION');
  const phoneNumberId = requiredEnv('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = requiredEnv('WHATSAPP_ACCESS_TOKEN');
  const templateName = requiredEnv('WHATSAPP_REMINDER_TEMPLATE_NAME');
  const digits = reminder.whatsapp.replace(/\D/g, '');
  if (digits.length < 10) throw new Error('Invalid WhatsApp number.');
  const destination = digits.startsWith('55') ? digits : `55${digits}`;
  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: destination,
        type: 'template',
        template: {
          name: templateName,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR' },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: reminder.guest_name },
              { type: 'text', text: reminder.gift_title },
              { type: 'text', text: String(reminder.days_before) }
            ]
          }]
        }
      })
    }
  );
  if (!response.ok) throw new Error(`WhatsApp API returned HTTP ${response.status}.`);
}

export async function processDueGiftReminders(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT id, guest_name, whatsapp, gift_title, days_before
         FROM dr_gift_reminders
        WHERE sent_at IS NULL
          AND scheduled_for <= timezone('America/Sao_Paulo', now())::date
          AND event_date >= timezone('America/Sao_Paulo', now())::date
        ORDER BY scheduled_for, created_at
        LIMIT 50
        FOR UPDATE SKIP LOCKED`
    );
    const sentIds = [];
    for (const reminder of result.rows) {
      try {
        await sendReminder(reminder);
        sentIds.push(reminder.id);
        await client.query(
          'UPDATE dr_gift_reminders SET sent_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1',
          [reminder.id]
        );
      } catch (error) {
        console.error(`Gift reminder ${reminder.id} failed: ${error.message}`);
        await client.query(
          'UPDATE dr_gift_reminders SET attempts = attempts + 1, last_error = $2 WHERE id = $1',
          [reminder.id, error.message.slice(0, 500)]
        );
      }
    }
    await client.query('COMMIT');
    return { processed: result.rows.length, sent: sentIds.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
