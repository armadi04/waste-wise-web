import { Injectable } from '@nestjs/common';
import { MailOutboxService } from './mail-outbox.service';

const EMAIL_COLORS = {
  background: '#F3F4F6',
  card: '#FFFFFF',
  foreground: '#11181C',
  primary: '#CA2222',
  mutedForeground: '#6A7282',
  border: '#E5E7EB',
} as const;

const EMAIL_FONT = "'Poppins', Arial, sans-serif";

type EmailAction = {
  label: string;
  url: string;
};

type EmailTemplate = {
  title: string;
  paragraphs: Array<string>;
  action?: EmailAction;
  code?: string;
  expiry: string;
  fallbackUrl?: string;
  note: string;
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character] ?? character,
  );
}

/**
 * Renders the app's emails and hands them to {@link MailOutboxService}, which
 * owns delivery and retries. Nothing here talks to Mailgun, so a provider
 * outage delays a message instead of losing it.
 */
@Injectable()
export class MailService {
  constructor(private readonly outbox: MailOutboxService) {}
  private get appName(): string {
    return process.env.APP_NAME || 'WasteWise';
  }

  async sendVerificationEmail(email: string, verifyUrl: string): Promise<void> {
    const html = this.renderEmail({
      title: 'Verifikasi alamat email',
      paragraphs: [
        `Terima kasih sudah mendaftar di ${this.appName}. Klik tombol di bawah untuk memverifikasi alamat emailmu.`,
      ],
      action: { label: 'Verifikasi email', url: verifyUrl },
      expiry: '24 jam',
      fallbackUrl: verifyUrl,
      note: 'Jika kamu tidak membuat akun, email ini bisa diabaikan.',
    });

    await this.outbox.enqueue({
      to: email,
      subject: `Verifikasi email ${this.appName}`,
      html,
      text: `Verifikasi alamat email ${this.appName}\n\nTerima kasih sudah mendaftar. Buka tautan berikut untuk memverifikasi alamat emailmu (berlaku selama 24 jam):\n\n${verifyUrl}\n\nJika kamu tidak membuat akun, email ini bisa diabaikan.`,
    });
  }

  async sendInvitationEmail(email: string, inviteUrl: string): Promise<void> {
    const html = this.renderEmail({
      title: 'Kamu mendapat undangan',
      paragraphs: [
        `Kamu diundang untuk bergabung dengan ${this.appName}. Klik tombol di bawah untuk menyiapkan akunmu.`,
      ],
      action: { label: 'Terima undangan', url: inviteUrl },
      expiry: '7 hari',
      fallbackUrl: inviteUrl,
      note: 'Jika kamu tidak mengharapkan undangan ini, email ini bisa diabaikan.',
    });

    await this.outbox.enqueue({
      to: email,
      subject: `Undangan bergabung di ${this.appName}`,
      html,
      text: `Undangan bergabung di ${this.appName}\n\nBuka tautan berikut untuk menyiapkan akunmu (berlaku selama 7 hari):\n\n${inviteUrl}\n\nJika kamu tidak mengharapkan undangan ini, email ini bisa diabaikan.`,
    });
  }

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    const html = this.renderEmail({
      title: 'Atur ulang password',
      paragraphs: [
        `Kami menerima permintaan untuk mengatur ulang password akun ${this.appName}. Klik tombol di bawah untuk membuat password baru.`,
      ],
      action: { label: 'Atur ulang password', url: resetUrl },
      expiry: '30 menit',
      fallbackUrl: resetUrl,
      note: 'Jika kamu tidak meminta pengaturan ulang password, email ini bisa diabaikan. Passwordmu tetap tidak berubah.',
    });

    await this.outbox.enqueue({
      to: email,
      subject: `Atur ulang password ${this.appName}`,
      html,
      text: `Atur ulang password ${this.appName}\n\nKami menerima permintaan untuk mengatur ulang passwordmu. Buka tautan berikut untuk membuat password baru (berlaku selama 30 menit):\n\n${resetUrl}\n\nJika kamu tidak meminta pengaturan ulang password, email ini bisa diabaikan.`,
    });
  }

  async sendLoginOtp(email: string, code: string): Promise<void> {
    const html = this.renderEmail({
      title: 'Kode masuk kamu',
      paragraphs: [
        `Gunakan kode berikut untuk masuk atau membuat akun ${this.appName}.`,
      ],
      code,
      expiry: '10 menit',
      note: 'Kode hanya bisa digunakan sekali. Jika bukan kamu yang meminta kode ini, email ini bisa diabaikan.',
    });

    await this.outbox.enqueue({
      to: email,
      subject: `Kode masuk ${this.appName}`,
      html,
      text: `Kode masuk ${this.appName}: ${code}\n\nKode berlaku selama 10 menit dan hanya bisa digunakan sekali. Jika bukan kamu yang meminta kode ini, email ini bisa diabaikan.`,
      // The code is a credential: never keep it in the outbox, never send it late.
      redactAfterSend: true,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
  }

  private renderEmail({
    title,
    paragraphs,
    action,
    code,
    expiry,
    fallbackUrl,
    note,
  }: EmailTemplate): string {
    const escapedTitle = escapeHtml(title);
    const escapedParagraphs = paragraphs
      .map(
        (paragraph) => `
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${EMAIL_COLORS.mutedForeground};text-align:center;">
                ${escapeHtml(paragraph)}
              </p>`,
      )
      .join('');
    const codeBlock = code
      ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td align="center" style="padding:20px 16px;background-color:${EMAIL_COLORS.background};border:1px solid ${EMAIL_COLORS.border};border-radius:12px;">
                    <p style="margin:0;font-size:36px;line-height:1.2;letter-spacing:.25em;font-weight:800;color:${EMAIL_COLORS.primary};">
                      ${escapeHtml(code)}
                    </p>
                  </td>
                </tr>
              </table>`
      : '';
    const actionBlock = action
      ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <a href="${escapeHtml(action.url)}" style="display:inline-block;padding:14px 36px;background-color:${EMAIL_COLORS.primary};color:#FFFFFF;font-size:15px;font-weight:600;line-height:1.2;text-decoration:none;border-radius:999px;letter-spacing:0.01em;">
                      ${escapeHtml(action.label)}
                    </a>
                  </td>
                </tr>
              </table>`
      : '';
    const fallbackBlock = fallbackUrl
      ? `
              <hr style="border:none;border-top:1px solid ${EMAIL_COLORS.border};margin:0 0 20px;">
              <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:${EMAIL_COLORS.mutedForeground};text-align:center;">
                Jika tombol tidak bekerja, salin dan tempel tautan berikut ke browser:
              </p>
              <p style="margin:0 0 20px;font-size:12px;line-height:1.6;text-align:center;word-break:break-all;">
                <a href="${escapeHtml(fallbackUrl)}" style="color:${EMAIL_COLORS.primary};">${escapeHtml(fallbackUrl)}</a>
              </p>`
      : '';

    return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapedTitle} | ${escapeHtml(this.appName)}</title>
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_COLORS.background};font-family:${EMAIL_FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${EMAIL_COLORS.background};padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:24px;line-height:1.2;font-weight:800;color:${EMAIL_COLORS.primary};letter-spacing:-0.02em;">${escapeHtml(this.appName)}</span>
            </td>
          </tr>
          <tr>
            <td style="background-color:${EMAIL_COLORS.card};border:1px solid ${EMAIL_COLORS.border};border-radius:16px;padding:40px 36px;box-shadow:0 4px 24px rgba(17,24,28,0.06);">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:${EMAIL_COLORS.foreground};text-align:center;">${escapedTitle}</h1>
              ${escapedParagraphs}
              ${codeBlock}
              ${actionBlock}
              <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:${EMAIL_COLORS.mutedForeground};text-align:center;">
                Berlaku selama <strong style="color:${EMAIL_COLORS.foreground};">${escapeHtml(expiry)}</strong>.
              </p>
              ${fallbackBlock}
              <p style="margin:0;font-size:12px;line-height:1.6;color:${EMAIL_COLORS.mutedForeground};text-align:center;">
                ${escapeHtml(note)}
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:${EMAIL_COLORS.mutedForeground};">
                &copy; ${new Date().getFullYear()} ${escapeHtml(this.appName)}. Semua hak dilindungi.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
