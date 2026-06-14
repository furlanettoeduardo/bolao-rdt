// Envio de e-mail transacional via Gmail (SMTP, Nodemailer). Por ora, só o link
// de redefinição de senha. Em dev (sem credenciais) caímos num "modo console":
// o link é logado em vez de enviado, então o fluxo funciona localmente sem
// configurar nada.
//
// Requer uma conta Gmail com verificação em 2 etapas e uma "Senha de app"
// (https://myaccount.google.com/apppasswords). Defina GMAIL_USER e
// GMAIL_APP_PASSWORD. O Gmail força o remetente para a conta autenticada — por
// isso o endereço de EMAIL_FROM deve ser o próprio GMAIL_USER (o nome de
// exibição é livre).

import nodemailer from "nodemailer";

const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;
const from = process.env.EMAIL_FROM ?? (user ? `Bolão RDT <${user}>` : undefined);

const transporter =
  user && pass
    ? nodemailer.createTransport({ service: "gmail", auth: { user, pass } })
    : null;

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string
): Promise<void> {
  const subject = "Redefinição de senha — Bolão RDT";
  const html = passwordResetHtml(name, resetUrl);

  if (!transporter) {
    // Sem credenciais (dev): não derruba o fluxo; loga o link para teste manual.
    console.warn(
      `[email] GMAIL_USER/GMAIL_APP_PASSWORD ausentes — e-mail NÃO enviado.\n` +
        `[email] Link para ${to}: ${resetUrl}`
    );
    return;
  }

  // Em caso de falha, lança — o chamador (Server Action) já captura e mantém a
  // resposta neutra, registrando o erro.
  await transporter.sendMail({ from, to, subject, html });
}

function passwordResetHtml(name: string, resetUrl: string): string {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl);
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:480px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border-radius:12px;padding:24px;">
        <h1 style="margin:0 0 8px;font-size:20px;">Redefinição de senha</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#475569;">
          Olá, ${safeName}. Recebemos um pedido para redefinir a senha da sua
          conta no Bolão RDT. Clique no botão abaixo para criar uma nova senha:
        </p>
        <p style="margin:0 0 16px;">
          <a href="${safeUrl}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;font-size:14px;">
            Redefinir senha
          </a>
        </p>
        <p style="margin:0 0 8px;font-size:12px;color:#64748b;">
          O link vale por 1 hora e só pode ser usado uma vez. Se você não pediu
          isso, ignore este e-mail — sua senha continua a mesma.
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;word-break:break-all;">
          Se o botão não funcionar, copie e cole este endereço no navegador:<br/>
          ${safeUrl}
        </p>
      </div>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
