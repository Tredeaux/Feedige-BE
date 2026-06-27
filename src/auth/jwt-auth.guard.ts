import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Protects a route — requires a valid JWT bearer token. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
