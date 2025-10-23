import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private cfg: ConfigService, private auth: AuthService) {
    super({
      clientID: cfg.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: cfg.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: cfg.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName;
    const googleId = profile.id;

    const user = await this.auth.validateGoogle({ id: googleId, email, name });
    done(null, { id: user.id, email: user.email });
  }
}
