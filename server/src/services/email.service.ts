import nodemailer from 'nodemailer';

function createTransport() {
  // Configure via env vars — works with Gmail, SendGrid, Mailgun, or any SMTP
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  // Dev fallback: log to console instead of sending
  return null;
}

export async function sendPasswordResetCode(to: string, code: string): Promise<void> {
  const transport = createTransport();

  if (!transport) {
    // No SMTP configured — print to console so dev can use it
    console.log(`\n──────────────────────────────────────`);
    console.log(`  Password reset code for ${to}: ${code}`);
    console.log(`──────────────────────────────────────\n`);
    return;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? `"Socialess" <noreply@socialess.app>`,
    to,
    subject: 'Your Socialess password reset code',
    text: `Your password reset code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#6C5CE7">Reset your password</h2>
        <p>Use the code below to reset your Socialess password:</p>
        <div style="background:#1E1E2E;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
          <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#fff">${code}</span>
        </div>
        <p style="color:#636E72;font-size:14px">This code expires in 15 minutes. If you didn't request a reset, ignore this email.</p>
      </div>
    `,
  });
}
