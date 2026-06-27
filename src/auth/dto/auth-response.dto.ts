import { ApiProperty } from '@nestjs/swagger';
import type { User } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true, example: 'Jane Admin' })
  name!: string | null;

  @ApiProperty({ example: 'jane@feedige.dev' })
  email!: string;

  @ApiProperty({ example: 'triage' })
  role!: string;

  static fromEntity(user: User): AuthUserDto {
    const dto = new AuthUserDto();
    dto.id = user.id;
    dto.name = user.name;
    dto.email = user.email;
    dto.role = user.role;
    return dto;
  }
}

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT bearer token' })
  accessToken!: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
