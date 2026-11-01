import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import QRCode from "npm:qrcode@1.5.4";
import { configuredEnv } from "./http.ts";

type ConfirmedGuest = {
  id: string;
  name: string;
  token: string;
};

function whatsappPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) throw new Error("Family has no WhatsApp phone number");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

async function createGuestPdf(guest: ConfirmedGuest) {
  const publicUrl = configuredEnv("APP_PUBLIC_URL").replace(/\/+$/, "");
  const qrUrl = `${publicUrl}/check-in?token=${encodeURIComponent(guest.token)}`;
  const qrPng = await QRCode.toBuffer(qrUrl, { type: "png", width: 360, margin: 2 });
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await pdf.embedPng(qrPng);
  const qrSize = 280;

  page.drawText("Convite individual", {
    x: 50, y: 765, size: 22, font: boldFont, color: rgb(0.20, 0.30, 0.24),
  });
  page.drawText(guest.name, {
    x: 50, y: 715, size: 18, font: boldFont, color: rgb(0.12, 0.16, 0.13),
  });
  page.drawText("Apresente este QR code na entrada da festa.", {
    x: 50, y: 680, size: 12, font, color: rgb(0.35, 0.39, 0.36),
  });
  page.drawImage(qrImage, {
    x: (595 - qrSize) / 2, y: 340, width: qrSize, height: qrSize,
  });
  page.drawText("Este convite e pessoal e valido para uma entrada.", {
    x: 50, y: 295, size: 10, font, color: rgb(0.45, 0.48, 0.46),
  });

  return await pdf.save();
}

async function sendDocument(phone: string, guest: ConfirmedGuest, pdfBytes: Uint8Array) {
  const graphVersion = configuredEnv("WHATSAPP_GRAPH_API_VERSION");
  const phoneNumberId = configuredEnv("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = configuredEnv("WHATSAPP_ACCESS_TOKEN");
  const templateName = configuredEnv("WHATSAPP_TEMPLATE_NAME");
  const templateLanguage = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "pt_BR";

  const supabase = createClient(
    configuredEnv("SUPABASE_URL"),
    configuredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
  const pdfPath = `${guest.id}/convite.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("guest-qr-pdfs")
    .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw uploadError;
  const { data: signedPdf, error: signedUrlError } = await supabase.storage
    .from("guest-qr-pdfs")
    .createSignedUrl(pdfPath, 60 * 60 * 24 * 7);
  if (signedUrlError || !signedPdf?.signedUrl) {
    throw signedUrlError || new Error("Unable to create a signed PDF URL");
  }

  const sendResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: templateLanguage },
        components: [
          {
            type: "header",
            parameters: [{
              type: "document",
              document: { link: signedPdf.signedUrl, filename: `convite-${guest.id}.pdf` },
            }],
          },
          {
            type: "body",
            parameters: [{ type: "text", text: guest.name }],
          },
        ],
      },
    }),
  });
  const sendBody = await sendResponse.json();
  if (!sendResponse.ok) {
    throw new Error(`WhatsApp message failed: ${JSON.stringify(sendBody)}`);
  }
}

export async function sendGuestQrDocuments(familyPhone: string, guests: ConfirmedGuest[]) {
  const phone = whatsappPhone(familyPhone);
  const results: Array<{ guestId: string; sent: boolean }> = [];

  for (const guest of guests) {
    try {
      const pdf = await createGuestPdf(guest);
      await sendDocument(phone, guest, pdf);
      results.push({ guestId: guest.id, sent: true });
    } catch (error) {
      console.error(`QR document delivery failed for guest ${guest.id}`, error);
      results.push({ guestId: guest.id, sent: false });
    }
  }

  return results;
}
