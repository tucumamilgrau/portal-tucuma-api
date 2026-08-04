import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

  private get from(): string {
    return process.env.RESEND_FROM_EMAIL ?? 'Portal Tucumã Milgrau <onboarding@resend.dev>';
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY não configurada — e-mail de redefinição não enviado.');
      return;
    }

    // Nunca deixa uma falha de envio travar ou derrubar o fluxo de
    // "esqueci a senha" — o token já foi criado no banco de qualquer forma.
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
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
      if (error) {
        this.logger.error(`Falha ao enviar e-mail de redefinição para ${to}: ${error.message}`);
      }
    } catch (err) {
      this.logger.error(
        `Falha ao enviar e-mail de redefinição para ${to}: ${(err as Error).message}`,
      );
    }
  }
}
