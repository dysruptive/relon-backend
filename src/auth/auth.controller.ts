import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Patch,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { CompleteOAuthDto } from './dto/complete-oauth.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(registerDto);
    this.setAuthCookie(res, result.access_token);
    this.setRefreshCookie(res, result.refresh_token);
    return result;
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Request() req, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(req.user);
    this.setAuthCookie(res, result.access_token);
    this.setRefreshCookie(res, result.refresh_token);
    return result;
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    // Accept refresh token from httpOnly cookie (same-site) or request body (cross-site fallback)
    const refreshToken = req.cookies?.refresh_token || req.body?.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }
    const result = await this.authService.refreshAccessTokenFromJwt(refreshToken);
    this.setAuthCookie(res, result.access_token);
    this.setRefreshCookie(res, result.refresh_token);
    return { access_token: result.access_token, refresh_token: result.refresh_token, user: result.user };
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, changePasswordDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@CurrentUser() user: any, @Body() updateData: { name?: string }) {
    return this.authService.updateProfile(user.id, updateData);
  }

  @UseGuards(JwtAuthGuard)
  @Post('complete-onboarding')
  @HttpCode(HttpStatus.OK)
  async completeOnboarding(@CurrentUser() user: any) {
    await this.authService.completeOnboarding(user.id);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: any, @Res({ passthrough: true }) res: Response) {
    // Invalidate the stored refresh token hash
    await this.authService['database'].user.update({
      where: { id: user.id },
      data: { refreshTokenHash: null },
    }).catch(() => {});
    this.clearAuthCookie(res);
    this.clearRefreshCookie(res);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('verify')
  async verifyToken(@CurrentUser() user: any) {
    return { valid: true, user };
  }

  @UseGuards(JwtAuthGuard)
  @Get('permissions')
  async getPermissions(@CurrentUser() user: any) {
    const permissions = await this.authService.getUserPermissions(user.id);
    return { permissions };
  }

  // ── Email Verification ─────────────────────────────────────────────────────

  @Public()
  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@CurrentUser() user: any) {
    await this.authService.sendVerificationEmail(user.id);
    return { message: 'Verification email sent' };
  }

  // ── Google OAuth ───────────────────────────────────────────────────────────

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Passport redirects to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const result = await this.authService.handleOAuthLogin(req.user);
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    if (result.isNewUser) {
      // Short-lived pending token (15min, not full access) — ok to send via cookie
      (res as any).cookie('oauth_pending', result.token, {
        httpOnly: true,
        secure: this.isProd,
        sameSite: this.isProd ? 'none' : 'lax',
        maxAge: 15 * 60 * 1000,
      });
      return (res as any).redirect(`${frontendUrl}/oauth-complete`);
    }
    this.setAuthCookie(res, result.token);
    if (result.refreshToken) this.setRefreshCookie(res, result.refreshToken);
    return (res as any).redirect(`${frontendUrl}/callback`);
  }

  @Public()
  @Post('oauth/complete')
  @HttpCode(HttpStatus.CREATED)
  async completeOAuthRegistration(
    @Req() req: any,
    @Body() body: CompleteOAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Support pending token from httpOnly cookie (preferred) or body (legacy)
    const pendingToken = req.cookies?.oauth_pending || body.pendingToken || '';
    const result = await this.authService.completeOAuthRegistration(pendingToken, body.organizationName, body.country, body.sector);
    this.setAuthCookie(res, result.access_token);
    this.setRefreshCookie(res, result.refresh_token);
    // Clear the pending token cookie
    (res as any).cookie('oauth_pending', '', { maxAge: 0, httpOnly: true, secure: this.isProd, sameSite: this.isProd ? 'none' : 'lax' });
    return result;
  }

  // ── Cookie helpers ─────────────────────────────────────────────────────────

  private get isProd() {
    return process.env.NODE_ENV === 'production';
  }

  private setAuthCookie(res: Response, token: string) {
    (res as any).cookie('token', token, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });
  }

  private clearAuthCookie(res: Response) {
    (res as any).cookie('token', '', {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? 'none' : 'lax',
      maxAge: 0,
      path: '/',
    });
  }

  private setRefreshCookie(res: Response, token: string) {
    (res as any).cookie('refresh_token', token, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth/refresh', // Only sent to the refresh endpoint
    });
  }

  private clearRefreshCookie(res: Response) {
    (res as any).cookie('refresh_token', '', {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? 'none' : 'lax',
      maxAge: 0,
      path: '/api/auth/refresh',
    });
  }
}
