import { Controller, Get, Req, Res, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response, Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private jwt: JwtService) {}

  // Step 1: redirect to Google
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() { /* passport handles redirect */ }

  // Step 2: Google callback
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const user = req.user; // set by GoogleStrategy validate()
    const tokens = await this.auth.issueTokens(user.id, user.email);

    // For demo: return JSON. In production, set httpOnly cookies and redirect to web app.
    return res.json({ user: { id: user.id, email: user.email }, ...tokens });
  }

  // Token rotation
  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    return this.auth.rotateRefreshToken(body.refreshToken);
  }

  // Logout: needs access token to identify user
  @Post('logout')
  async logout(@Body() body: { accessToken: string }) {
    const decoded = this.jwt.decode(body.accessToken) as any;
    const sub = decoded?.sub;
    if (!sub) return { ok: true }; // nothing to do
    return this.auth.logout(sub);
  }
}
