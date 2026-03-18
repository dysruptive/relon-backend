import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private static readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID') || 'disabled';
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET') || 'disabled';
    if (clientID === 'disabled' || clientSecret === 'disabled') {
      GoogleStrategy.logger.warn('GOOGLE_CLIENT_ID/SECRET not set — Google OAuth disabled');
    }
    super({
      clientID,
      clientSecret,
      callbackURL:
        configService.get('GOOGLE_CALLBACK_URL') ||
        'http://localhost:4000/api/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const { emails, displayName, photos, id } = profile;
    const email = emails?.[0]?.value;
    const avatarUrl = photos?.[0]?.value;
    done(null, {
      email,
      name: displayName,
      avatarUrl,
      oauthProvider: 'google',
      oauthProviderId: id,
    });
  }
}
