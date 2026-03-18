import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../database/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  organizationId: string;
}

// Extract JWT from Bearer header first, then httpOnly cookie, then ?token= query param (for SSE)
function jwtFromRequestOrCookie(req: Request): string | null {
  let token: string | null = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (!token && req?.cookies?.token) {
    token = req.cookies.token;
  }
  if (!token && req?.query?.token) {
    token = req.query.token as string;
  }
  return token;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private database: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET environment variable is required');
    super({
      jwtFromRequest: jwtFromRequestOrCookie,
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: false,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.database.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        organizationId: true,
      },
    });

    if (!user || user.status !== 'Active') {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user; // now includes organizationId
  }
}
