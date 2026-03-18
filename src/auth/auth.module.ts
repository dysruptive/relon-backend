import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [
    DatabaseModule,
    EmailModule,
    OrganizationsModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET environment variable is required');
        return {
          secret,
          // Access tokens are short-lived; refresh tokens extend sessions via /auth/refresh
          signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN') || '15m' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, JwtStrategy, LocalStrategy, GoogleStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
