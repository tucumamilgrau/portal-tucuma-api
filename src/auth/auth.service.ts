import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 min

type UserRecord = {
  id: string;
  name: string;
  email: string;
  city: string;
  role: string;
};
type PublicUser = {
  id: string;
  name: string;
  email: string;
  city: string;
  role: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Este e-mail já está cadastrado');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        city: dto.city ?? '',
      },
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('E-mail ou senha inválidos');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('E-mail ou senha inválidos');

    return this.buildAuthResponse(user);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    return this.toPublicUser(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Senha atual incorreta');

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { ok: true };
  }

  // ---------- Recuperação de senha ----------

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    // Resposta genérica sempre — não revela se o e-mail existe ou não na base.
    if (!user) return { ok: true };

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.passwordReset.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://portaltucumamilgrau.com.br';
    const resetUrl = `${frontendUrl}/redefinir-senha?token=${rawToken}`;
    await this.mail.sendPasswordResetEmail(user.email, resetUrl);

    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const reset = await this.prisma.passwordReset.findUnique({
      where: { tokenHash },
    });

    if (
      !reset ||
      reset.usedAt ||
      reset.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Link de redefinição inválido ou expirado');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { ok: true };
  }

  // ---------- Gestão de usuários (admin) ----------

  findAllUsers(): Promise<PublicUser[]> {
    return this.prisma.user.findMany({
      select: { id: true, name: true, email: true, city: true, role: true },
      orderBy: { name: 'asc' },
    });
  }

  private async countAdmins(): Promise<number> {
    return this.prisma.user.count({ where: { role: 'ADMIN' } });
  }

  async updateUserRole(
    id: string,
    role: 'READER' | 'ADMIN',
    requesterId: string,
  ): Promise<PublicUser> {
    if (id === requesterId) {
      throw new BadRequestException(
        'Você não pode alterar seu próprio papel por aqui',
      );
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (
      user.role === 'ADMIN' &&
      role === 'READER' &&
      (await this.countAdmins()) <= 1
    ) {
      throw new ForbiddenException(
        'Não é possível remover o único administrador do sistema',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
    });
    return this.toPublicUser(updated);
  }

  async removeUser(id: string, requesterId: string): Promise<{ id: string }> {
    if (id === requesterId) {
      throw new BadRequestException(
        'Você não pode excluir sua própria conta por aqui',
      );
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (user.role === 'ADMIN' && (await this.countAdmins()) <= 1) {
      throw new ForbiddenException(
        'Não é possível excluir o único administrador do sistema',
      );
    }

    await this.prisma.user.delete({ where: { id } });
    return { id };
  }

  private buildAuthResponse(user: UserRecord) {
    const token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { token, user: this.toPublicUser(user) };
  }

  private toPublicUser(user: UserRecord): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      city: user.city,
      role: user.role,
    };
  }
}
