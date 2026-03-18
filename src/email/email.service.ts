import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

// ─────────────────────────────────────────────────────────────────────────────
// Shared design tokens (email-safe: no CSS variables)
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg: '#f5f3ef',          // warm parchment background
  card: '#ffffff',
  charcoal: '#141210',    // near-black header
  ink: '#2a2520',         // body text
  muted: '#6b6560',       // secondary text
  gold: '#b8873a',        // warm gold accent
  goldLight: '#f5ead8',   // gold tint
  border: '#e5dfd6',      // warm border
  danger: '#c0392b',
  dangerLight: '#fdf1f0',
  sans: `'Helvetica Neue', Helvetica, Arial, sans-serif`,
  serif: `Georgia, 'Times New Roman', serif`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Base layout shell — every email shares this chrome
// ─────────────────────────────────────────────────────────────────────────────
function shell(opts: {
  preheader: string;
  headerLabel: string;
  headerIcon: string;
  accentColor?: string;
  body: string;
}): string {
  const accent = opts.accentColor ?? T.gold;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${opts.headerLabel}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&display=swap');
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .fluid { max-width: 100% !important; height: auto !important; }
      .stack-column, .stack-column-center { display: block !important; width: 100% !important; max-width: 100% !important; }
      .pad-20 { padding: 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${T.bg};font-family:${T.sans};">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${T.bg};">
    ${opts.preheader}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;
  </div>

  <!-- Outer wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${T.bg};">
    <tr>
      <td style="padding:40px 16px;">

        <!-- Email container -->
        <table class="email-container" role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center" style="margin:auto;">

          <!-- ── HEADER ─────────────────────────────────────────── -->
          <tr>
            <td style="background-color:${T.charcoal};border-radius:12px 12px 0 0;padding:0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <!-- Top accent bar -->
                <tr>
                  <td style="height:3px;background:linear-gradient(90deg,${accent} 0%,${accent}99 60%,transparent 100%);border-radius:12px 12px 0 0;"></td>
                </tr>
                <tr>
                  <td style="padding:32px 40px 28px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <!-- Monogram -->
                        <td width="44" valign="middle">
                          <div style="width:44px;height:44px;border-radius:10px;background-color:${accent};display:inline-block;text-align:center;line-height:44px;font-family:${T.serif};font-size:18px;font-weight:bold;color:#fff;letter-spacing:-0.5px;">
                            R
                          </div>
                        </td>
                        <td width="12"></td>
                        <!-- Brand -->
                        <td valign="middle">
                          <p style="margin:0;font-family:${T.serif};font-size:17px;color:#ffffff;letter-spacing:0.3px;line-height:1.2;">Relon</p>
                          <p style="margin:2px 0 0;font-family:${T.sans};font-size:11px;color:${accent};letter-spacing:1.5px;text-transform:uppercase;font-weight:600;">CRM Platform</p>
                        </td>
                        <!-- Icon label -->
                        <td align="right" valign="middle">
                          <span style="display:inline-block;padding:5px 12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:20px;font-family:${T.sans};font-size:11px;color:rgba(255,255,255,0.55);letter-spacing:0.8px;text-transform:uppercase;">
                            ${opts.headerIcon}&nbsp; ${opts.headerLabel}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── BODY ──────────────────────────────────────────── -->
          <tr>
            <td style="background-color:${T.card};border-left:1px solid ${T.border};border-right:1px solid ${T.border};">
              <div class="pad-20" style="padding:44px 48px;">
                ${opts.body}
              </div>
            </td>
          </tr>

          <!-- ── FOOTER ────────────────────────────────────────── -->
          <tr>
            <td style="background-color:#faf9f7;border:1px solid ${T.border};border-top:none;border-radius:0 0 12px 12px;padding:24px 48px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    <p style="margin:0;font-family:${T.sans};font-size:12px;color:${T.muted};line-height:1.6;">
                      This is an automated message from <strong style="color:${T.ink};">Relon CRM</strong>. Please do not reply directly to this email.
                    </p>
                    <p style="margin:8px 0 0;font-family:${T.sans};font-size:12px;color:${T.muted};">
                      &copy; ${new Date().getFullYear()} Relon. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Email container -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable block builders
// ─────────────────────────────────────────────────────────────────────────────
function greeting(name: string): string {
  return `<p style="margin:0 0 20px;font-family:${T.serif};font-size:26px;color:${T.charcoal};line-height:1.3;letter-spacing:-0.3px;">Hello, ${name}.</p>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 18px;font-family:${T.sans};font-size:15px;color:${T.ink};line-height:1.75;">${text}</p>`;
}

function divider(): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:28px 0;"><tr><td style="border-top:1px solid ${T.border};"></td></tr></table>`;
}

function ctaButton(label: string, url: string, color?: string): string {
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

function infoCard(rows: { label: string; value: string }[]): string {
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

function alertBox(message: string, type: 'warning' | 'danger' = 'warning'): string {
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

function linkFallback(url: string): string {
  return `<p style="margin:20px 0 0;font-family:${T.sans};font-size:13px;color:${T.muted};line-height:1.6;">
    Or copy this link into your browser:<br/>
    <span style="color:${T.gold};word-break:break-all;">${url}</span>
  </p>`;
}

function signature(): string {
  return `
    ${divider()}
    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td width="36" valign="middle">
          <div style="width:36px;height:36px;border-radius:8px;background-color:${T.charcoal};text-align:center;line-height:36px;font-family:${T.serif};font-size:13px;color:#fff;">RL</div>
        </td>
        <td width="12"></td>
        <td valign="middle">
          <p style="margin:0;font-family:${T.sans};font-size:14px;color:${T.ink};font-weight:600;line-height:1.3;">The Relon Team</p>
          <p style="margin:2px 0 0;font-family:${T.sans};font-size:12px;color:${T.muted};">relon.com</p>
        </td>
      </tr>
    </table>`;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('✅ Resend email service initialized');
    } else {
      this.logger.warn('⚠️  RESEND_API_KEY not set — emails will be logged to console');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Password Reset
  // ─────────────────────────────────────────────────────────────────────────
  async sendPasswordResetEmail(email: string, resetToken: string, userName: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    const body = `
      ${greeting(userName)}
      ${paragraph('We received a request to reset the password on your Relon CRM account. Use the button below to set a new password.')}
      ${ctaButton('Reset My Password', resetUrl)}
      ${alertBox('This link expires in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your account remains secure.')}
      ${linkFallback(resetUrl)}
      ${signature()}
    `;

    const html = shell({
      preheader: 'Reset your Relon CRM password — link expires in 1 hour.',
      headerLabel: 'Password Reset',
      headerIcon: '🔐',
      body,
    });

    const text = `Hi ${userName},\n\nWe received a request to reset your password.\n\nReset link: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.\n\nThe Relon Team`;

    await this.send({ to: email, subject: 'Reset Your Password — Relon CRM', html, text, label: 'Password Reset' });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Welcome
  // ─────────────────────────────────────────────────────────────────────────
  async sendWelcomeEmail(email: string, userName: string, tempPassword?: string): Promise<void> {
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    const credentialsBlock = tempPassword
      ? infoCard([
          { label: 'Email Address', value: email },
          { label: 'Temporary Password', value: tempPassword },
        ]) + alertBox('For your security, please change your password immediately after your first login.')
      : '';

    const body = `
      ${greeting(userName)}
      ${paragraph('Your Relon CRM account is ready. You now have access to the full platform — leads, projects, clients, and reporting — all in one place.')}
      ${credentialsBlock}
      ${ctaButton('Access the Dashboard', loginUrl, T.gold)}
      ${paragraph('If you have any questions or need help getting started, reach out to your administrator.')}
      ${signature()}
    `;

    const html = shell({
      preheader: `Welcome to Relon CRM, ${userName}. Your account is ready.`,
      headerLabel: 'Welcome',
      headerIcon: '✦',
      accentColor: T.gold,
      body,
    });

    const text = `Hi ${userName},\n\nWelcome to Relon CRM. Your account has been created.\n\n${tempPassword ? `Email: ${email}\nTemporary Password: ${tempPassword}\n\nPlease change your password after first login.\n\n` : ''}Login: ${loginUrl}\n\nThe Relon Team`;

    await this.send({ to: email, subject: 'Welcome to Relon CRM', html, text, label: 'Welcome' });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Email Verification
  // ─────────────────────────────────────────────────────────────────────────
  async sendEmailVerificationEmail(email: string, token: string, userName: string): Promise<void> {
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

    const body = `
      ${greeting(userName)}
      ${paragraph('Thank you for creating a Relon CRM account. To complete your registration and activate your account, please verify your email address by clicking the button below.')}
      ${ctaButton('Verify Email', verifyUrl, T.gold)}
      ${alertBox('This link will expire in <strong>24 hours</strong>. If you did not create an account, you can safely ignore this email.')}
      ${linkFallback(verifyUrl)}
      ${signature()}
    `;

    const html = shell({
      preheader: `Verify your email to activate your Relon CRM account.`,
      headerLabel: 'Email Verification',
      headerIcon: '✉',
      accentColor: T.gold,
      body,
    });

    const text = `Hi ${userName},\n\nPlease verify your email address to activate your Relon CRM account.\n\nVerification link: ${verifyUrl}\n\nThis link expires in 24 hours. If you didn't create an account, ignore this email.\n\nThe Relon Team`;

    await this.send({ to: email, subject: 'Verify Your Email — Relon CRM', html, text, label: 'Email Verification' });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Password Changed
  // ─────────────────────────────────────────────────────────────────────────
  async sendPasswordChangedEmail(email: string, userName: string): Promise<void> {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    const body = `
      ${greeting(userName)}
      ${paragraph('This is a confirmation that the password for your Relon CRM account was successfully updated.')}
      ${infoCard([
        { label: 'Account', value: email },
        { label: 'Changed', value: new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) },
      ])}
      ${alertBox('If you did not make this change, contact your administrator immediately — your account may be compromised.', 'danger')}
      ${signature()}
    `;

    const html = shell({
      preheader: 'Your Relon CRM password was changed. If this wasn\'t you, act now.',
      headerLabel: 'Security Notice',
      headerIcon: '🛡',
      accentColor: '#6b7280',
      body,
    });

    const text = `Hi ${userName},\n\nYour Relon CRM password was successfully changed.\n\nIf you didn't do this, please contact your administrator immediately.\n\nThe Relon Team`;

    await this.send({ to: email, subject: 'Password Changed — Relon CRM', html, text, label: 'Password Changed' });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal send helper
  // ─────────────────────────────────────────────────────────────────────────
  private async send(opts: {
    to: string;
    subject: string;
    html: string;
    text: string;
    label: string;
    critical?: boolean;
  }): Promise<void> {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    if (!this.resend) {
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.log(`📧 [DEV] ${opts.label}`);
      this.logger.log(`To: ${opts.to} | Subject: ${opts.subject}`);
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }

    try {
      await this.resend.emails.send({
        from: fromEmail,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      });
      this.logger.log(`✅ ${opts.label} email sent to: ${opts.to}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send ${opts.label} email to ${opts.to}:`, error);
      if (opts.critical) throw new Error(`Failed to send ${opts.label} email`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Trial Expiring
  // ─────────────────────────────────────────────────────────────────────────
  async sendTrialExpiringEmail(email: string, name: string, daysLeft: number): Promise<void> {
    const billingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing`;
    const dayWord = daysLeft === 1 ? 'day' : 'days';

    const body = `
      ${greeting(name)}
      ${paragraph(`Your Relon CRM free trial expires in <strong>${daysLeft} ${dayWord}</strong>. To keep your team's work uninterrupted, upgrade to a paid plan before your trial ends.`)}
      ${alertBox(`Trial ends in <strong>${daysLeft} ${dayWord}</strong>. After expiry, your account will be locked until you upgrade.`)}
      ${ctaButton('Upgrade Now', billingUrl, T.gold)}
      ${paragraph('Questions about pricing? Reply to this email or visit the billing page to compare plans.')}
      ${signature()}
    `;

    const html = shell({
      preheader: `Your Relon trial expires in ${daysLeft} ${dayWord}. Upgrade to keep access.`,
      headerLabel: 'Trial Expiring',
      headerIcon: '⏳',
      accentColor: T.gold,
      body,
    });

    const text = `Hi ${name},\n\nYour Relon CRM trial expires in ${daysLeft} ${dayWord}.\n\nUpgrade here: ${billingUrl}\n\nThe Relon Team`;

    await this.send({
      to: email,
      subject: `Your Relon trial expires in ${daysLeft} ${dayWord}`,
      html,
      text,
      label: 'Trial Expiring',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Subscription Cancelled
  // ─────────────────────────────────────────────────────────────────────────
  async sendSubscriptionCancelledEmail(email: string, name: string): Promise<void> {
    const billingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing`;

    const body = `
      ${greeting(name)}
      ${paragraph('We have confirmed that your Relon CRM subscription has been cancelled. You will retain full access to your account until the end of your current billing period.')}
      ${infoCard([
        { label: 'Status', value: 'Cancelled — access continues until period end' },
      ])}
      ${paragraph('If this was a mistake or you would like to continue using Relon, you can reactivate your subscription at any time from the billing page.')}
      ${ctaButton('Reactivate Subscription', billingUrl, T.gold)}
      ${paragraph('Thank you for using Relon. We hope to see you back.')}
      ${signature()}
    `;

    const html = shell({
      preheader: 'Your Relon CRM subscription has been cancelled. Access continues until period end.',
      headerLabel: 'Subscription Cancelled',
      headerIcon: '📋',
      accentColor: '#6b7280',
      body,
    });

    const text = `Hi ${name},\n\nYour Relon CRM subscription has been cancelled. You will have access until the end of your billing period.\n\nReactivate: ${billingUrl}\n\nThe Relon Team`;

    await this.send({
      to: email,
      subject: 'Your Relon subscription has been cancelled',
      html,
      text,
      label: 'Subscription Cancelled',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Payment Failed
  // ─────────────────────────────────────────────────────────────────────────
  async sendPaymentFailedEmail(email: string, name: string): Promise<void> {
    const billingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing`;

    const body = `
      ${greeting(name)}
      ${alertBox('Your most recent payment for Relon CRM was declined. Please update your payment method to avoid interruption.', 'danger')}
      ${paragraph('We were unable to process your subscription payment. This can happen when a card expires, has insufficient funds, or the billing details have changed.')}
      ${infoCard([
        { label: 'Action Required', value: 'Update payment method' },
        { label: 'Grace Period', value: '7 days before service interruption' },
      ])}
      ${ctaButton('Update Payment Method', billingUrl, T.danger)}
      ${paragraph('If you believe this is an error, please contact your bank or reach out to our support team. We want to make sure your team stays uninterrupted.')}
      ${signature()}
    `;

    const html = shell({
      preheader: 'Action required: Your Relon CRM payment failed. Update your payment method to avoid interruption.',
      headerLabel: 'Payment Failed',
      headerIcon: '⚠',
      accentColor: T.danger,
      body,
    });

    const text = `Hi ${name},\n\nYour Relon CRM payment failed. Please update your payment method within 7 days to avoid service interruption.\n\nUpdate billing: ${billingUrl}\n\nThe Relon Team`;

    await this.send({
      to: email,
      subject: 'Action required: Payment failed for your Relon subscription',
      html,
      text,
      label: 'Payment Failed',
      critical: false,
    });
  }

  async sendPaymentReminderEmail(
    email: string,
    name: string,
    daysLeft: number,
    billingUrl: string,
  ): Promise<void> {
    const urgency = daysLeft <= 2 ? 'URGENT: ' : '';
    const body = `
      ${greeting(name)}
      ${alertBox(
        `${urgency}Your Relon subscription payment is still outstanding. You have ${daysLeft} day${daysLeft === 1 ? '' : 's'} before service interruption.`,
        'danger',
      )}
      ${paragraph('Please update your payment method immediately to avoid losing access to your team\'s data.')}
      ${ctaButton('Update Payment Method Now', billingUrl, T.danger)}
      ${signature()}
    `;
    const html = shell({
      preheader: `${urgency}${daysLeft} day${daysLeft === 1 ? '' : 's'} until Relon service interruption — action required`,
      headerLabel: 'Payment Reminder',
      headerIcon: '⚠',
      accentColor: T.danger,
      body,
    });
    await this.send({
      to: email,
      subject: `${urgency}${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining to update your Relon payment`,
      html,
      text: `Hi ${name},\n\nYour Relon payment is ${daysLeft} day${daysLeft === 1 ? '' : 's'} overdue.\n\nUpdate billing: ${billingUrl}\n\nThe Relon Team`,
      label: 'Payment Reminder',
      critical: false,
    });
  }

  async sendPaymentFinalEmail(
    email: string,
    name: string,
    billingUrl: string,
  ): Promise<void> {
    const body = `
      ${greeting(name)}
      ${alertBox('Your Relon CRM account has been suspended due to non-payment.', 'danger')}
      ${paragraph('Your subscription has been suspended. You can reactivate at any time by updating your payment method in the billing portal. Your data is safe and will be retained.')}
      ${ctaButton('Reactivate Account', billingUrl, T.danger)}
      ${paragraph('If you have any questions or need assistance, please contact our support team.')}
      ${signature()}
    `;
    const html = shell({
      preheader: 'Your Relon CRM account has been suspended — reactivate to restore access',
      headerLabel: 'Account Suspended',
      headerIcon: '🔒',
      accentColor: T.danger,
      body,
    });
    await this.send({
      to: email,
      subject: 'Your Relon CRM account has been suspended',
      html,
      text: `Hi ${name},\n\nYour Relon CRM account has been suspended due to non-payment.\n\nReactivate: ${billingUrl}\n\nThe Relon Team`,
      label: 'Account Suspended',
      critical: false,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Payment Confirmation
  // ─────────────────────────────────────────────────────────────────────────
  async sendPaymentConfirmationEmail(
    email: string,
    name: string,
    planName: string,
    amount: string,
    currency: string,
    nextBillingDate?: string,
  ): Promise<void> {
    const billingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing`;

    const body = `
      ${greeting(name)}
      ${paragraph(`Thank you! Your payment was successful and your <strong>${planName}</strong> subscription is now active.`)}
      ${infoCard([
        { label: 'Plan', value: planName },
        { label: 'Amount charged', value: `${amount} ${currency}` },
        ...(nextBillingDate ? [{ label: 'Next billing date', value: nextBillingDate }] : []),
      ])}
      ${paragraph('You can manage your subscription, view invoices, and update your payment method from the billing page.')}
      ${ctaButton('Manage Billing', billingUrl, T.gold)}
      ${signature()}
    `;

    const html = shell({
      preheader: `Payment confirmed — ${planName} plan is now active.`,
      headerLabel: 'Payment Confirmed',
      headerIcon: '✅',
      accentColor: T.gold,
      body,
    });

    await this.send({
      to: email,
      subject: `Payment confirmed — your Relon ${planName} plan is active`,
      html,
      text: `Hi ${name},\n\nYour payment was successful. Your ${planName} plan is now active.\n\nManage billing: ${billingUrl}\n\nThe Relon Team`,
      label: 'Payment Confirmation',
      critical: false,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Reactivation
  // ─────────────────────────────────────────────────────────────────────────
  async sendReactivationEmail(email: string, name: string, planName: string): Promise<void> {
    const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;

    const body = `
      ${greeting(name)}
      ${paragraph(`Welcome back! Your Relon CRM account has been <strong>reactivated</strong>. Your <strong>${planName}</strong> plan is now active and your team's data is fully accessible.`)}
      ${ctaButton('Go to Dashboard', dashboardUrl, T.gold)}
      ${paragraph('If you have any questions, reply to this email and we\'ll be happy to help.')}
      ${signature()}
    `;

    const html = shell({
      preheader: `Your Relon CRM account has been reactivated. Welcome back!`,
      headerLabel: 'Account Reactivated',
      headerIcon: '🎉',
      accentColor: T.gold,
      body,
    });

    await this.send({
      to: email,
      subject: 'Your Relon CRM account has been reactivated',
      html,
      text: `Hi ${name},\n\nWelcome back! Your Relon CRM account has been reactivated. Your ${planName} plan is now active.\n\nGo to dashboard: ${dashboardUrl}\n\nThe Relon Team`,
      label: 'Account Reactivated',
      critical: false,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Assignment notification
  // ─────────────────────────────────────────────────────────────────────────
  async sendAssignmentNotificationEmail(opts: {
    to: string;
    userName: string;
    role: string;
    entityType: 'lead' | 'project';
    entityName: string;
    entityUrl: string;
    assignedByName: string;
  }): Promise<void> {
    const { to, userName, role, entityType, entityName, entityUrl, assignedByName } = opts;
    const label = entityType === 'lead' ? 'Prospective Project' : 'Project';

    const body = `
      ${greeting(userName)}
      ${paragraph(`You have been assigned to a ${label.toLowerCase()} on Relon CRM by <strong>${assignedByName}</strong>.`)}
      ${infoCard([
        { label: label, value: entityName },
        { label: 'Your Role', value: role },
        { label: 'Assigned by', value: assignedByName },
      ])}
      ${ctaButton(`View ${label}`, entityUrl)}
      ${signature()}
    `;

    const html = shell({
      preheader: `You've been assigned to "${entityName}" as ${role}.`,
      headerLabel: `${label} Assignment`,
      headerIcon: '📋',
      body,
    });

    const text = `Hi ${userName},\n\nYou have been assigned to a ${label.toLowerCase()} on Relon CRM.\n\n${label}: ${entityName}\nYour Role: ${role}\nAssigned by: ${assignedByName}\n\nView it here: ${entityUrl}\n\nThe Relon Team`;

    await this.send({
      to,
      subject: `You've been assigned to "${entityName}" — Relon CRM`,
      html,
      text,
      label: 'Assignment Notification',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Task emails
  // ─────────────────────────────────────────────────────────────────────────

  async sendTaskAssignedEmail(opts: {
    to: string;
    userName: string;
    taskTitle: string;
    assignedByName: string;
    dueDate?: string;
    entityName?: string;
    taskUrl: string;
  }): Promise<void> {
    const { to, userName, taskTitle, assignedByName, dueDate, entityName, taskUrl } = opts;

    const rows: { label: string; value: string }[] = [
      { label: 'Task', value: taskTitle },
      { label: 'Assigned by', value: assignedByName },
    ];
    if (entityName) rows.push({ label: 'Related to', value: entityName });
    if (dueDate) rows.push({ label: 'Due', value: dueDate });

    const body = `
      ${greeting(userName)}
      ${paragraph(`<strong>${assignedByName}</strong> has assigned you a task on Relon CRM.`)}
      ${infoCard(rows)}
      ${ctaButton('View Task', taskUrl)}
      ${signature()}
    `;

    const html = shell({
      preheader: `New task assigned: "${taskTitle}"`,
      headerLabel: 'Task Assigned',
      headerIcon: '✅',
      body,
    });

    await this.send({
      to,
      subject: `New task assigned: "${taskTitle}" — Relon CRM`,
      html,
      text: `Hi ${userName},\n\n${assignedByName} has assigned you a task: "${taskTitle}"${dueDate ? `\nDue: ${dueDate}` : ''}${entityName ? `\nRelated to: ${entityName}` : ''}\n\nView it here: ${taskUrl}\n\nThe Relon Team`,
      label: 'Task Assigned',
    });
  }

  async sendTaskDueReminderEmail(opts: {
    to: string;
    userName: string;
    taskTitle: string;
    dueDate: string;
    entityName?: string;
    taskUrl: string;
    overdue?: boolean;
    daysOverdue?: number;
  }): Promise<void> {
    const { to, userName, taskTitle, dueDate, entityName, taskUrl, overdue, daysOverdue } = opts;

    const isOverdue = overdue && daysOverdue && daysOverdue > 0;
    const heading = isOverdue
      ? `Task overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}`
      : 'Task due today';

    const rows: { label: string; value: string }[] = [
      { label: 'Task', value: taskTitle },
      { label: 'Due date', value: dueDate },
    ];
    if (entityName) rows.push({ label: 'Related to', value: entityName });

    const body = `
      ${greeting(userName)}
      ${isOverdue
        ? paragraph(`Your task <strong>"${taskTitle}"</strong> is <strong>${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue</strong>. Please action it as soon as possible.`)
        : paragraph(`Your task <strong>"${taskTitle}"</strong> is due today. Don't let it slip through the cracks.`)}
      ${infoCard(rows)}
      ${ctaButton('View Task', taskUrl)}
      ${signature()}
    `;

    const html = shell({
      preheader: heading,
      headerLabel: heading,
      headerIcon: isOverdue ? '🔴' : '⏰',
      accentColor: isOverdue ? T.danger : T.gold,
      body,
    });

    await this.send({
      to,
      subject: `${heading}: "${taskTitle}" — Relon CRM`,
      html,
      text: `Hi ${userName},\n\n${heading}: "${taskTitle}"\nDue: ${dueDate}${entityName ? `\nRelated to: ${entityName}` : ''}\n\nView it here: ${taskUrl}\n\nThe Relon Team`,
      label: isOverdue ? 'Task Overdue' : 'Task Due',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Onboarding drip emails
  // ─────────────────────────────────────────────────────────────────────────
  async sendOnboardingDripDay1(email: string, name: string, companyName: string): Promise<void> {
    const leadsUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/leads`;

    const body = `
      ${greeting(name)}
      ${paragraph(`You're one step away from getting ${companyName} organised. The most valuable thing you can do in your first 60 seconds in Relon is add your first lead.`)}
      ${paragraph('A <strong>lead</strong> in Relon is any deal you\'re pursuing — a new project enquiry, a referral, or a tender. Once it\'s in the system, you can track its progress, assign it to your team, and move it through your pipeline.')}
      ${ctaButton('Add My First Lead →', leadsUrl, T.gold)}
      ${paragraph('It takes under 60 seconds and you\'ll immediately see how the pipeline view works.')}
      ${signature()}
    `;

    const html = shell({
      preheader: 'Add your first lead to Relon — takes 60 seconds.',
      headerLabel: 'Your First Step',
      headerIcon: '🎯',
      accentColor: T.gold,
      body,
    });

    await this.send({
      to: email,
      subject: 'Your first step in Relon — takes 60 seconds',
      html,
      text: `Hi ${name},\n\nAdd your first lead to Relon — it only takes 60 seconds.\n\n${leadsUrl}\n\nThe Relon Team`,
      label: 'Onboarding Day 1',
      critical: false,
    });
  }

  async sendOnboardingDripDay3(email: string, name: string, companyName: string): Promise<void> {
    const pipelineUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/pipeline`;

    const body = `
      ${greeting(name)}
      ${paragraph(`Relon has pre-configured pipeline stages designed for ${companyName}'s sector — but you can customise them to match exactly how your team works.`)}
      ${paragraph('Your pipeline stages define the journey each lead takes from enquiry to contract. Common stages include: <em>New Enquiry → Proposal Sent → Negotiation → Won/Lost</em>.')}
      ${ctaButton('Configure My Pipeline →', pipelineUrl, T.gold)}
      ${paragraph('Customising your stages takes about 2 minutes and makes your reporting much more meaningful.')}
      ${signature()}
    `;

    const html = shell({
      preheader: `Set up your pipeline stages for ${companyName}.`,
      headerLabel: 'Pipeline Setup',
      headerIcon: '🔧',
      accentColor: T.gold,
      body,
    });

    await this.send({
      to: email,
      subject: `Set up your pipeline stages for ${companyName}`,
      html,
      text: `Hi ${name},\n\nCustomise your pipeline stages for ${companyName}.\n\n${pipelineUrl}\n\nThe Relon Team`,
      label: 'Onboarding Day 3',
      critical: false,
    });
  }

  async sendOnboardingDripDay7(email: string, name: string): Promise<void> {
    const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;
    const billingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing`;

    const body = `
      ${greeting(name)}
      ${paragraph("You're halfway through your trial. Here are a few features you may not have explored yet:")}
      ${infoCard([
        { label: '📋 Quote builder', value: 'Build itemised quotes and send PDFs directly to clients' },
        { label: '🏥 Client health tracking', value: 'Get AI-generated health reports on your key accounts' },
        { label: '🤖 AI insights', value: 'Available on Growth plan — executive briefs and risk analysis' },
      ])}
      ${ctaButton('Explore the Dashboard →', dashboardUrl, T.gold)}
      ${paragraph('Your trial ends in 7 days. If you\'re finding Relon useful, now is a great time to choose your plan.')}
      ${ctaButton('View Plans →', billingUrl, '#4b5563')}
      ${signature()}
    `;

    const html = shell({
      preheader: "Halfway through your trial — here's what to explore next.",
      headerLabel: "Halfway Through Your Trial",
      headerIcon: '⏱',
      accentColor: T.gold,
      body,
    });

    await this.send({
      to: email,
      subject: "Halfway through your trial — here's what to explore",
      html,
      text: `Hi ${name},\n\nYou're halfway through your Relon trial. Explore the quote builder, client health tracking, and AI insights.\n\nDashboard: ${dashboardUrl}\nPlans: ${billingUrl}\n\nThe Relon Team`,
      label: 'Onboarding Day 7',
      critical: false,
    });
  }

  /**
   * Generic workflow-triggered email — plain text body wrapped in branded shell.
   */
  async sendWorkflowEmail(to: string, subject: string, body: string): Promise<void> {
    const html = shell({
      preheader: subject,
      headerLabel: 'Automated Notification',
      headerIcon: '⚡',
      body: `
        <p style="margin:0 0 16px;font-family:${T.sans};font-size:16px;color:${T.ink};line-height:1.6;">
          ${body.replace(/\n/g, '<br/>')}
        </p>
        ${signature()}
      `,
    });

    await this.send({
      to,
      subject,
      html,
      text: body,
      label: 'Workflow',
      critical: false,
    });
  }
}
