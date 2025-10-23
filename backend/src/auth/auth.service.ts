import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { JwtPair, JwtPayload } from './types';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private cfg: ConfigService,
  ) {}

  // Create or update user from Google profile
  async validateGoogle(profile: { id: string; email: string; name?: string }) {
    const user = await this.prisma.user.upsert({
      where: { email: profile.email },
      update: { googleId: profile.id, name: profile.name ?? undefined },
      create: {
        email: profile.email,
        googleId: profile.id,
        name: profile.name ?? null,
      },
    });
    return user;
  }

  // Issue access + refresh
  async issueTokens(userId: string, email: string): Promise<JwtPair> {
    const accessPayload: JwtPayload = { sub: userId, email };
    const refreshPayload: JwtPayload = { sub: userId, email };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.cfg.get('JWT_ACCESS_SECRET'),
      expiresIn: this.cfg.get('JWT_ACCESS_TTL') || '15m',
    });

    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.cfg.get('JWT_REFRESH_SECRET'),
      expiresIn: this.cfg.get('JWT_REFRESH_TTL') || '7d',
    });

    // store hashed refresh token in DB for rotation/revocation
    const hash = this.hash(refreshToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hash }, // reuse "password" field to store hashed refresh (simple for demo)
    });

    return { accessToken, refreshToken };
  }

  async rotateRefreshToken(refreshToken: string): Promise<JwtPair> {
    try {
      const decoded = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.cfg.get('JWT_REFRESH_SECRET'),
      });
      const user = await this.prisma.user.findUnique({ where: { id: decoded.sub } });
      if (!user) throw new UnauthorizedException('User not found');

      // compare hashes
      const storedHash = user.password ?? '';
      if (storedHash !== this.hash(refreshToken)) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // issue new pair and overwrite stored hash (rotation)
      return this.issueTokens(user.id, user.email);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    // clear stored refresh hash (revocation)
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: null },
    });
    return { ok: true };
  }

  private hash(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}
