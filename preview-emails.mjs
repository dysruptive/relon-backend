/**
 * Email preview script — run with: node preview-emails.mjs
 * Opens all three email templates in your browser.
 */
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';

// ── Design tokens (mirrors email.service.ts) ─────────────────────────────────
const T = {
  bg: '#f5f3ef',
  card: '#ffffff',
  charcoal: '#141210',
  ink: '#2a2520',
  muted: '#6b6560',
  gold: '#b8873a',
  goldLight: '#f5ead8',
  border: '#e5dfd6',
  danger: '#c0392b',
  dangerLight: '#fdf1f0',
  sans: `'Helvetica Neue', Helvetica, Arial, sans-serif`,
  serif: `Georgia, 'Times New Roman', serif`,
};

// ── Block builders ────────────────────────────────────────────────────────────
function shell({ preheader, headerLabel, headerIcon, accentColor, body }) {
  const accent = accentColor ?? T.gold;
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${headerLabel}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&display=swap');
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .pad-20 { padding: 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${T.bg};font-family:${T.sans};">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:${T.bg};">${preheader}</div>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${T.bg};">
    <tr><td style="padding:40px 16px;">
      <table class="email-container" role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center" style="margin:auto;">
        <!-- HEADER -->
        <tr>
          <td style="background-color:${T.charcoal};border-radius:12px 12px 0 0;padding:0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr><td style="height:3px;background:linear-gradient(90deg,${accent} 0%,${accent}99 60%,transparent 100%);border-radius:12px 12px 0 0;"></td></tr>
              <tr><td style="padding:32px 40px 28px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td width="44" valign="middle">
                      <div style="width:44px;height:44px;border-radius:10px;background-color:${accent};display:inline-block;text-align:center;line-height:44px;font-family:${T.serif};font-size:18px;font-weight:bold;color:#fff;letter-spacing:-0.5px;">KH</div>
                    </td>
                    <td width="12"></td>
                    <td valign="middle">
                      <p style="margin:0;font-family:${T.serif};font-size:17px;color:#ffffff;letter-spacing:0.3px;line-height:1.2;">KH3 Group</p>
                      <p style="margin:2px 0 0;font-family:${T.sans};font-size:11px;color:${accent};letter-spacing:1.5px;text-transform:uppercase;font-weight:600;">CRM Platform</p>
                    </td>
                    <td align="right" valign="middle">
                      <span style="display:inline-block;padding:5px 12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:20px;font-family:${T.sans};font-size:11px;color:rgba(255,255,255,0.55);letter-spacing:0.8px;text-transform:uppercase;">
                        ${headerIcon}&nbsp; ${headerLabel}
                      </span>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </td>
        </tr>
        <!-- BODY -->
        <tr>
          <td style="background-color:${T.card};border-left:1px solid ${T.border};border-right:1px solid ${T.border};">
            <div class="pad-20" style="padding:44px 48px;">${body}</div>
          </td>
        </tr>
        <!-- FOOTER -->
        <tr>
          <td style="background-color:#faf9f7;border:1px solid ${T.border};border-top:none;border-radius:0 0 12px 12px;padding:24px 48px;">
            <p style="margin:0;font-family:${T.sans};font-size:12px;color:${T.muted};line-height:1.6;">
              This is an automated message from <strong style="color:${T.ink};">KH3 Group CRM</strong>. Please do not reply directly to this email.
            </p>
            <p style="margin:8px 0 0;font-family:${T.sans};font-size:12px;color:${T.muted};">
              &copy; ${new Date().getFullYear()} KH3 Group. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function greeting(name) {
  return `<p style="margin:0 0 20px;font-family:${T.serif};font-size:26px;color:${T.charcoal};line-height:1.3;letter-spacing:-0.3px;">Hello, ${name}.</p>`;
}

function paragraph(text) {
  return `<p style="margin:0 0 18px;font-family:${T.sans};font-size:15px;color:${T.ink};line-height:1.75;">${text}</p>`;
}

function divider() {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:28px 0;"><tr><td style="border-top:1px solid ${T.border};"></td></tr></table>`;
}

function ctaButton(label, url, color) {
  const bg = color ?? T.charcoal;
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;">
      <tr>
        <td style="border-radius:8px;background-color:${bg};">
          <a href="${url}" target="_blank"
            style="display:inline-block;padding:14px 32px;font-family:${T.sans};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:0.3px;">
            ${label} &rarr;
          </a>
        </td>
      </tr>
    </table>`;
}

function infoCard(rows) {
  const rowsHtml = rows.map(r => `
    <tr>
      <td style="padding:12px 20px;border-bottom:1px solid ${T.border};">
        <p style="margin:0;font-family:${T.sans};font-size:11px;color:${T.muted};text-transform:uppercase;letter-spacing:1px;font-weight:600;">${r.label}</p>
        <p style="margin:4px 0 0;font-family:${T.sans};font-size:15px;color:${T.ink};font-weight:500;">${r.value}</p>
      </td>
    </tr>`).join('');
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
      style="margin:24px 0;border:1px solid ${T.border};border-radius:10px;overflow:hidden;">
      ${rowsHtml}
    </table>`;
}

function alertBox(message, type = 'warning') {
  const bg   = type === 'danger' ? T.dangerLight : T.goldLight;
  const bar  = type === 'danger' ? T.danger      : T.gold;
  const icon = type === 'danger' ? '⚠' : 'ℹ';
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
      style="margin:24px 0;border-radius:8px;overflow:hidden;background-color:${bg};">
      <tr>
        <td width="4" style="background-color:${bar};border-radius:8px 0 0 8px;"></td>
        <td style="padding:16px 20px;">
          <p style="margin:0;font-family:${T.sans};font-size:14px;color:${T.ink};line-height:1.6;">
            <strong>${icon} ${message}</strong>
          </p>
        </td>
      </tr>
    </table>`;
}

function linkFallback(url) {
  return `<p style="margin:20px 0 0;font-family:${T.sans};font-size:13px;color:${T.muted};line-height:1.6;">
    Or copy this link into your browser:<br/>
    <span style="color:${T.gold};word-break:break-all;">${url}</span>
  </p>`;
}

function signature() {
  return `
    ${divider()}
    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td width="36" valign="middle">
          <div style="width:36px;height:36px;border-radius:8px;background-color:${T.charcoal};text-align:center;line-height:36px;font-family:${T.serif};font-size:13px;color:#fff;">KH</div>
        </td>
        <td width="12"></td>
        <td valign="middle">
          <p style="margin:0;font-family:${T.sans};font-size:14px;color:${T.ink};font-weight:600;line-height:1.3;">The KH3 Group Team</p>
          <p style="margin:2px 0 0;font-family:${T.sans};font-size:12px;color:${T.muted};">kh3group.com</p>
        </td>
      </tr>
    </table>`;
}

// ── Generate all three emails ─────────────────────────────────────────────────
const resetUrl = 'http://localhost:3000/reset-password?token=preview-token-abc123';
const loginUrl = 'http://localhost:3000/login';

const emails = [
  {
    file: 'email-password-reset.html',
    label: 'Password Reset',
    html: shell({
      preheader: 'Reset your KH3 Group CRM password — link expires in 1 hour.',
      headerLabel: 'Password Reset',
      headerIcon: '🔐',
      body: `
        ${greeting('Kweku Hayford')}
        ${paragraph('We received a request to reset the password on your KH3 Group CRM account. Use the button below to set a new password.')}
        ${ctaButton('Reset My Password', resetUrl)}
        ${alertBox('This link expires in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your account remains secure.')}
        ${linkFallback(resetUrl)}
        ${signature()}
      `,
    }),
  },
  {
    file: 'email-welcome.html',
    label: 'Welcome',
    html: shell({
      preheader: 'Welcome to KH3 Group CRM, Kweku Hayford. Your account is ready.',
      headerLabel: 'Welcome',
      headerIcon: '✦',
      accentColor: T.gold,
      body: `
        ${greeting('Kweku Hayford')}
        ${paragraph('Your KH3 Group CRM account is ready. You now have access to the full platform — leads, projects, clients, and reporting — all in one place.')}
        ${infoCard([
          { label: 'Email Address', value: 'kweku@kh3group.com' },
          { label: 'Temporary Password', value: 'Pass123$1' },
        ])}
        ${alertBox('For your security, please change your password immediately after your first login.')}
        ${ctaButton('Access the Dashboard', loginUrl, T.gold)}
        ${paragraph('If you have any questions or need help getting started, reach out to your administrator.')}
        ${signature()}
      `,
    }),
  },
  {
    file: 'email-password-changed.html',
    label: 'Security Notice',
    html: shell({
      preheader: "Your KH3 Group CRM password was changed. If this wasn't you, act now.",
      headerLabel: 'Security Notice',
      headerIcon: '🛡',
      accentColor: '#6b7280',
      body: `
        ${greeting('Kweku Hayford')}
        ${paragraph('This is a confirmation that the password for your KH3 Group CRM account was successfully updated.')}
        ${infoCard([
          { label: 'Account', value: 'kweku@kh3group.com' },
          { label: 'Changed', value: new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) },
        ])}
        ${alertBox('If you did not make this change, contact your administrator immediately — your account may be compromised.', 'danger')}
        ${signature()}
      `,
    }),
  },
];

// ── Write and open ────────────────────────────────────────────────────────────
const tmp = tmpdir();
for (const email of emails) {
  const path = join(tmp, email.file);
  writeFileSync(path, email.html, 'utf8');
  console.log(`✅ ${email.label} → ${path}`);
  execSync(`open "${path}"`);
}
console.log('\nAll three emails opened in your browser.');
