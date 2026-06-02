import { Injectable, Inject, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import type { ConfigType } from '@nestjs/config';
import resendConfig from '../config/resend.config';

@Injectable()
export class EmailsService {
  private readonly resend: Resend | null = null;
  private readonly logger = new Logger(EmailsService.name);

  constructor(
    @Inject(resendConfig.KEY)
    private readonly resendConf: ConfigType<typeof resendConfig>,
  ) {
    const apiKey = this.resendConf.apiKey;
    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('Resend initialized.');
    } else {
      this.logger.warn(
        'RESEND_API_KEY not set — emails will log to console (dev mode).',
      );
    }
  }

  async sendEmail(to: string, subject: string, html: string) {
    if (this.resend) {
      try {
        const result = await this.resend.emails.send({
          from: 'TiKit <noreply@tikit.se>',
          to,
          subject,
          html,
        });
        if (result.error) {
          this.logger.error(`Resend error: ${JSON.stringify(result.error)}`);
          return { success: false, error: result.error };
        }
        return { success: true, id: result.data?.id };
      } catch (error) {
        this.logger.error(`Email send failed: ${error.message}`, error.stack);
        return { success: false, error };
      }
    }

    // Dev fallback — log email without exposing sensitive content
    this.logger.log(
      `[DEV EMAIL] To: ${to} | Subject: ${subject} | (HTML omitted — check template)`,
    );
    return { success: true, localLog: true };
  }

  async sendWelcomeEmail(email: string, displayName: string) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #eaeaea;border-radius:5px;">
        <h2 style="color:#6c5ce7;">Hej ${displayName}! 👋</h2>
        <p>Welcome to <strong>TiKit</strong> — your school events platform.</p>
        <p>Your account is registered. Log in to browse events and claim tickets.</p>
        <hr style="border:0;border-top:1px solid #eaeaea;margin:20px 0;"/>
        <p style="font-size:12px;color:#999;">The TiKit Team</p>
      </div>
    `;
    return this.sendEmail(email, 'Welcome to TiKit!', html);
  }

  async sendTicketReceiptEmail(
    email: string,
    displayName: string,
    eventTitle: string,
    ticketCode: string,
  ) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #eaeaea;border-radius:5px;">
        <h2 style="color:#6c5ce7;">Hej ${displayName}! 🎟️</h2>
        <p>Your ticket for <strong>${eventTitle}</strong> is ready.</p>
        <div style="background:#f9f9f9;padding:15px;border-radius:5px;margin:20px 0;border-left:4px solid #6c5ce7;">
          <p style="margin:0;font-size:14px;color:#555;">Ticket Code:</p>
          <h3 style="margin:8px 0 0;color:#333;letter-spacing:2px;">${ticketCode}</h3>
        </div>
        <p>Open the TiKit app wallet to show your QR code at entry.</p>
        <hr style="border:0;border-top:1px solid #eaeaea;margin:20px 0;"/>
        <p style="font-size:12px;color:#999;">The TiKit Team</p>
      </div>
    `;
    return this.sendEmail(email, `Your ticket for ${eventTitle} 🎟️`, html);
  }

  async sendPasswordResetEmail(
    email: string,
    displayName: string,
    resetUrl: string,
  ) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #eaeaea;border-radius:5px;">
        <h2 style="color:#6c5ce7;">Reset your TiKit password</h2>
        <p>Hej ${displayName}, we received a request to reset your password.</p>
        <div style="margin:30px 0;text-align:center;">
          <a href="${resetUrl}" style="background-color:#6c5ce7;color:white;padding:12px 28px;border-radius:4px;text-decoration:none;font-weight:bold;">Reset Password</a>
        </div>
        <p>Or copy this link:<br/><a href="${resetUrl}">${resetUrl}</a></p>
        <p><strong>This link expires in 1 hour.</strong></p>
        <p>If you didn't request this, ignore this email — your password won't change.</p>
        <hr style="border:0;border-top:1px solid #eaeaea;margin:20px 0;"/>
        <p style="font-size:12px;color:#999;">The TiKit Team</p>
      </div>
    `;
    return this.sendEmail(email, 'Reset your TiKit password', html);
  }

  async sendCampaignEmail(to: string, subject: string, body: string) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <p style="white-space:pre-line;">${body}</p>
        <hr style="border:0;border-top:1px solid #eaeaea;margin:20px 0;"/>
        <p style="font-size:12px;color:#999;">TiKit — School Events Platform</p>
      </div>
    `;
    return this.sendEmail(to, subject, html);
  }
}
