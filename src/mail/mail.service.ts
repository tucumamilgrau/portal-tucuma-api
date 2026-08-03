import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  private get configured(): boolean {
    return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    if (!this.configured) {
      this.logger.warn(
        'GMAIL_USER/GMAIL_APP_PASSWORD não configurados — e-mail de redefinição não enviado.',
      );
      return;
    }

    await this.transporter.sendMail({
      from: `"Portal Tucumã Milgrau" <${process.env.GMAIL_USER}>`,
      to,
      subject: 'Redefinição de senha — Portal Tucumã Milgrau',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #e4590e;">Portal Tucumã Milgrau</h2>
          <p>Recebemos um pedido para redefinir a senha da sua conta.</p>
          <p>
            <a href="${resetUrl}" style="display: inline-block; background: #e4590e; color: #fff; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: bold;">
              Redefinir minha senha
            </a>
          </p>
          <p style="color: #666; font-size: 0.85rem;">
            Esse link expira em 30 minutos. Se você não pediu isso, pode ignorar este e-mail com segurança.
          </p>
        </div>
      `,
    });
  }
}
