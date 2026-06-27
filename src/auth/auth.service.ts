import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './jwt.strategy';
import { ROLES } from './roles';

const BCRYPT_ROUNDS = 12;
// A throwaway hash compared against when no user is found, so login takes the
// same time whether or not the email exists (prevents timing-based enumeration).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, passwordHash: true },
    });
    // Reject if an account with a password already exists. A user that only
    // submitted feedback (no password) can still claim the account.
    if (existing?.passwordHash) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    // Product decision: registering grants triage access (open/collaborative
    // triage). Feedback-only users that never register stay `member`. `admin` is
    // still granted out-of-band (seed / future promotion endpoint).
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { name: dto.name, passwordHash, role: ROLES.TRIAGE },
        })
      : await this.prisma.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            passwordHash,
            role: ROLES.TRIAGE,
          },
        });

    await this.audit.record({
      action: 'user_registered',
      userId: user.id,
      newValue: { email: user.email, role: user.role },
    });
    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Always run a bcrypt comparison (against a dummy hash when the user is
    // missing) so response timing doesn't reveal whether the email exists.
    const valid = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user?.passwordHash || !valid) {
      await this.audit.record({
        action: 'login_failed',
        userId: user?.id ?? null,
        newValue: { email: dto.email },
      });
      throw new UnauthorizedException('Invalid email or password.');
    }

    await this.audit.record({ action: 'user_logged_in', userId: user.id });
    return this.buildAuthResponse(user);
  }

  async me(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return AuthUserDto.fromEntity(user);
  }

  private async buildAuthResponse(user: User): Promise<AuthResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, user: AuthUserDto.fromEntity(user) };
  }
}
