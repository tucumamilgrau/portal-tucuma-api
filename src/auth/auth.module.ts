import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    JwtModule.register({
      // Em produção, defina JWT_SECRET no ambiente — este valor só serve para desenvolvimento local.
      secret: process.env.JWT_SECRET ?? 'dev-secret-troque-em-producao',
      signOptions: { expiresIn: '7d' },
    }),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, AdminGuard],
  exports: [JwtAuthGuard, AdminGuard, JwtModule],
})
export class AuthModule {}
