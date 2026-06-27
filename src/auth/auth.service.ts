import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
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
    // Self-registration never grants privileged access; triage/admin is granted
    // out-of-band (seeded admin / future promotion endpoint).
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { name: dto.name, passwordHash },
        })
      : await this.prisma.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            passwordHash,
            role: ROLES.MEMBER,
          },
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
      throw new UnauthorizedException('Invalid email or password.');
    }

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
