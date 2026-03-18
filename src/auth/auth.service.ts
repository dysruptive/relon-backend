import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PermissionsService } from '../permissions/permissions.service';
import { OrganizationsService } from '../organizations/organizations.service';

@Injectable()
export class AuthService {
  constructor(
    private database: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private permissionsService: PermissionsService,
    private organizationsService: OrganizationsService,
  ) {}

  private readonly MAX_FAILED_ATTEMPTS = 10;
  private readonly LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

  async validateUser(email: string, password: string, organizationId?: string): Promise<any> {
    const user = await this.database.user.findFirst({
      where: { email },
    });

    if (!user) {
      return null;
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(
        `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      );
    }

    if (!user.password) {
      throw new BadRequestException(
        'Please set your password first. Contact your administrator.'
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Increment failed attempts and possibly lock the account
      const newAttempts = (user.failedLoginAttempts || 0) + 1;
      const lockedUntil =
        newAttempts >= this.MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + this.LOCKOUT_DURATION_MS)
          : null;

      await this.database.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: newAttempts, lockedUntil },
      });

      return null;
    }

    if (user.status !== 'Active') {
      throw new UnauthorizedException('Your account is inactive');
    }

    // Reset lockout counters on successful login
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.database.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const { password: _, ...result } = user;
    return result;
  }

  async login(user: any) {
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      organizationId: user.organizationId,
    };

    // Update last login time
    await this.database.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const permissions = await this.permissionsService.getPermissionsForRole(
      user.role,
      user.organizationId,
    );

    const { refreshToken } = await this.generateAndStoreRefreshToken(user.id);

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      },
      permissions,
    };
  }

  async generateAndStoreRefreshToken(userId: string): Promise<{ refreshToken: string }> {
    // Raw random token stored as hash; wrapped in a signed JWT so the controller can
    // extract userId without a DB lookup on every refresh attempt.
    const rawToken = randomBytes(40).toString('hex');
    const hashedToken = await bcrypt.hash(rawToken, 10);
    await this.database.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hashedToken },
    });
    // Sign the raw token as a JWT with type: 'refresh' and longer expiry
    const refreshToken = this.jwtService.sign(
      { sub: userId, type: 'refresh', token: rawToken },
      { expiresIn: '7d' },
    );
    return { refreshToken };
  }

  async refreshAccessTokenFromJwt(refreshJwt: string): Promise<{
    access_token: string;
    refresh_token: string;
    user: { id: string; email: string; name: string; role: string; organizationId: string };
  }> {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshJwt);
    } catch {
      throw new UnauthorizedException('Refresh token expired or invalid — please log in again');
    }

    if (payload.type !== 'refresh' || !payload.sub || !payload.token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.refreshAccessTokenForUser(payload.sub, payload.token);
  }

  async refreshAccessTokenForUser(userId: string, refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    user: { id: string; email: string; name: string; role: string; organizationId: string };
  }> {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, role: true,
        organizationId: true, status: true, refreshTokenHash: true,
      },
    });

    if (!user || user.status !== 'Active') {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (!user.refreshTokenHash) {
      throw new UnauthorizedException('No refresh token on file — please log in again');
    }

    const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isValid) {
      // Token mismatch — possible replay attack; invalidate all refresh tokens
      await this.database.user.update({ where: { id: userId }, data: { refreshTokenHash: null } });
      throw new UnauthorizedException('Invalid refresh token — please log in again');
    }

    // Rotate: generate a new refresh token and store it
    const { refreshToken: newRefreshToken } = await this.generateAndStoreRefreshToken(userId);

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      organizationId: user.organizationId,
    };

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      },
    };
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: { role: true, organizationId: true },
    });
    if (!user) return [];
    return this.permissionsService.getPermissionsForRole(user.role, user.organizationId);
  }

  private readonly EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  async sendVerificationEmail(userId: string): Promise<void> {
    const user = await this.database.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const token = randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + this.EMAIL_VERIFICATION_TOKEN_TTL_MS);

    await this.database.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: token,
        emailVerificationTokenExpiry: expiry,
      },
    });

    await this.emailService.sendEmailVerificationEmail(user.email, token, user.name);
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.database.user.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (user.emailVerificationTokenExpiry && user.emailVerificationTokenExpiry < new Date()) {
      // Clear the expired token so the user must request a new one
      await this.database.user.update({
        where: { id: user.id },
        data: { emailVerificationToken: null, emailVerificationTokenExpiry: null },
      });
      throw new BadRequestException('Verification link has expired. Please request a new one.');
    }

    await this.database.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,
      },
    });

    return { message: 'Email verified successfully' };
  }

  async register(registerDto: RegisterDto) {
    // Create organization and first CEO user atomically
    const baseSlug = this.organizationsService.generateSlug(registerDto.organizationName);
    const slug = await this.organizationsService.ensureUniqueSlug(baseSlug);

    const result = await this.database.$transaction(async (tx) => {
      // Check if this email has already registered too many orgs (trial abuse guard)
      const existingOrgCount = await tx.user.count({
        where: { email: registerDto.email, role: 'CEO' },
      });
      if (existingOrgCount >= 3) {
        throw new BadRequestException('This email has reached the maximum number of organizations. Please contact support.');
      }

      // Resolve currency from country
      const PAYSTACK_CURRENCY_MAP: Record<string, string> = {
        GH: 'GHS', NG: 'NGN', KE: 'KES', ZA: 'ZAR',
      };
      const country = registerDto.country === 'OTHER' ? null : (registerDto.country || null);
      const currency = country ? (PAYSTACK_CURRENCY_MAP[country] || 'USD') : 'USD';

      // Create the organization
      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
      const organization = await tx.organization.create({
        data: {
          name: registerDto.organizationName,
          slug,
          ...(country && { country }),
          currency,
          trialEndsAt,
          industry: registerDto.sector ?? null,
          timezone: registerDto.timezone ?? null,
        },
      });

      // Check if email is taken within this org (shouldn't matter for first user but be safe)
      const existingUser = await tx.user.findFirst({
        where: { organizationId: organization.id, email: registerDto.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists in this organization');
      }

      const hashedPassword = await bcrypt.hash(registerDto.password, 10);

      const user = await tx.user.create({
        data: {
          email: registerDto.email,
          password: hashedPassword,
          name: registerDto.name,
          role: 'CEO',
          status: 'Active',
          organizationId: organization.id,
        },
      });

      return { organization, user };
    });

    // Seed default permissions for new org
    await this.permissionsService.seedDefaultsForOrg(result.organization.id);

    // Seed default pipeline stages for new org
    await this.seedDefaultPipelineStages(result.organization.id, registerDto.sector);

    // Seed default dropdown options for new org
    await this.seedDefaultDropdownOptions(result.organization.id, registerDto.sector);

    // Send welcome email (non-blocking — email outage must not fail registration)
    this.emailService.sendWelcomeEmail(result.user.email, result.user.name).catch(() => {});

    // Send email verification (non-blocking — don't block login)
    this.sendVerificationEmail(result.user.id).catch(() => {});

    const { password: _, ...userWithoutPassword } = result.user;

    const payload = {
      email: result.user.email,
      sub: result.user.id,
      role: result.user.role,
      organizationId: result.organization.id,
    };

    const { refreshToken } = await this.generateAndStoreRefreshToken(result.user.id);

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: refreshToken,
      user: {
        id: userWithoutPassword.id,
        email: userWithoutPassword.email,
        name: userWithoutPassword.name,
        role: userWithoutPassword.role,
        organizationId: userWithoutPassword.organizationId,
      },
    };
  }

  async forgotPassword(email: string) {
    const user = await this.database.user.findFirst({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists - security best practice
      return { message: 'If an account exists, a password reset email has been sent' };
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);
    const tokenPrefix = resetToken.slice(0, 8); // first 8 chars as lookup key

    // Token expires in 1 hour
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.database.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: `${tokenPrefix}:${hashedToken}`,
        resetPasswordExpires: expiresAt,
      },
    });

    // Send reset email
    await this.emailService.sendPasswordResetEmail(
      user.email,
      resetToken,
      user.name,
    );

    return { message: 'If an account exists, a password reset email has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenPrefix = token.slice(0, 8);

    // Find candidates by prefix (tiny subset instead of all pending resets)
    const candidates = await this.database.user.findMany({
      where: {
        resetPasswordToken: { startsWith: `${tokenPrefix}:` },
        resetPasswordExpires: { gt: new Date() },
      },
    });

    let matchedUser = null;
    for (const user of candidates) {
      if (user.resetPasswordToken) {
        const storedHash = user.resetPasswordToken.split(':').slice(1).join(':');
        const isTokenValid = await bcrypt.compare(token, storedHash);
        if (isTokenValid) {
          matchedUser = user;
          break;
        }
      }
    }

    if (!matchedUser) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.database.user.update({
      where: { id: matchedUser.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    await this.emailService.sendPasswordChangedEmail(matchedUser.email, matchedUser.name);
    return { message: 'Password has been reset successfully' };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.database.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      throw new BadRequestException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

    // Update password
    await this.database.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Send confirmation email
    await this.emailService.sendPasswordChangedEmail(user.email, user.name);

    return { message: 'Password changed successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        isEmailVerified: true,
        isOnboarded: true,
        lastLogin: true,
        createdAt: true,
        organizationId: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return user;
  }

  async completeOnboarding(userId: string): Promise<void> {
    await this.database.user.update({
      where: { id: userId },
      data: { isOnboarded: true },
    });
  }

  async updateProfile(userId: string, updateData: { name?: string }) {
    const user = await this.database.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        isEmailVerified: true,
        lastLogin: true,
        createdAt: true,
        organizationId: true,
      },
    });

    return user;
  }

  async handleOAuthLogin(profile: {
    email: string;
    name: string;
    avatarUrl?: string;
    oauthProvider: string;
    oauthProviderId: string;
  }) {
    // Find existing user by email (any org) — first match wins
    const existingUser = await this.database.user.findFirst({
      where: { email: profile.email },
      include: { organization: true },
    });

    if (existingUser) {
      // Update OAuth fields if not set
      if (!existingUser.oauthProvider) {
        await this.database.user.update({
          where: { id: existingUser.id },
          data: {
            oauthProvider: profile.oauthProvider,
            oauthProviderId: profile.oauthProviderId,
            avatarUrl: profile.avatarUrl,
            isEmailVerified: true,
            lastLogin: new Date(),
          },
        });
      } else {
        await this.database.user.update({
          where: { id: existingUser.id },
          data: { lastLogin: new Date() },
        });
      }
      // Issue JWT + refresh token
      const payload = {
        email: existingUser.email,
        sub: existingUser.id,
        role: existingUser.role,
        organizationId: existingUser.organizationId,
      };
      const { refreshToken } = await this.generateAndStoreRefreshToken(existingUser.id);
      return { token: this.jwtService.sign(payload), refreshToken, isNewUser: false };
    }

    // New user — return a signed short-lived "OAuth pending" token with their profile
    // Frontend will redirect them to /register with pre-filled data
    const pendingPayload = {
      oauthPending: true,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      oauthProvider: profile.oauthProvider,
      oauthProviderId: profile.oauthProviderId,
    };
    const pendingToken = this.jwtService.sign(pendingPayload, { expiresIn: '15m' });
    return { token: pendingToken, isNewUser: true };
  }

  async completeOAuthRegistration(pendingToken: string, organizationName: string, country?: string, sector?: string) {
    let pendingPayload: any;
    try {
      pendingPayload = this.jwtService.verify(pendingToken);
    } catch {
      throw new BadRequestException('Invalid or expired OAuth token');
    }

    if (!pendingPayload.oauthPending) {
      throw new BadRequestException('Invalid OAuth token');
    }

    const baseSlug = this.organizationsService.generateSlug(organizationName);
    const slug = await this.organizationsService.ensureUniqueSlug(baseSlug);

    const result = await this.database.$transaction(async (tx) => {
      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const PAYSTACK_CURRENCY_MAP: Record<string, string> = { GH: 'GHS', NG: 'NGN', KE: 'KES', ZA: 'ZAR' };
      const resolvedCountry = country === 'OTHER' ? null : (country || null);
      const currency = resolvedCountry ? (PAYSTACK_CURRENCY_MAP[resolvedCountry] || 'USD') : 'USD';

      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          slug,
          trialEndsAt,
          ...(resolvedCountry && { country: resolvedCountry }),
          currency,
          industry: sector ?? null,
        },
      });

      const existingUser = await tx.user.findFirst({
        where: { organizationId: organization.id, email: pendingPayload.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists in this organization');
      }

      const user = await tx.user.create({
        data: {
          email: pendingPayload.email,
          password: null,
          name: pendingPayload.name,
          role: 'CEO',
          status: 'Active',
          organizationId: organization.id,
          oauthProvider: pendingPayload.oauthProvider,
          oauthProviderId: pendingPayload.oauthProviderId,
          avatarUrl: pendingPayload.avatarUrl ?? null,
          isEmailVerified: true,
          isOnboarded: true,
        },
      });

      return { organization, user };
    });

    // Seed default permissions for new org
    await this.permissionsService.seedDefaultsForOrg(result.organization.id);

    // Seed default pipeline stages for new org
    await this.seedDefaultPipelineStages(result.organization.id, sector);

    // Seed default dropdown options for new org
    await this.seedDefaultDropdownOptions(result.organization.id, sector);

    // Send welcome email (non-blocking)
    this.emailService.sendWelcomeEmail(result.user.email, result.user.name).catch(() => {});

    const { password: _, ...userWithoutPassword } = result.user;

    const payload = {
      email: result.user.email,
      sub: result.user.id,
      role: result.user.role,
      organizationId: result.organization.id,
    };

    const { refreshToken } = await this.generateAndStoreRefreshToken(result.user.id);

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: refreshToken,
      user: {
        id: userWithoutPassword.id,
        email: userWithoutPassword.email,
        name: userWithoutPassword.name,
        role: userWithoutPassword.role,
        organizationId: userWithoutPassword.organizationId,
        isOnboarded: true,
      },
    };
  }

  private async seedDefaultPipelineStages(organizationId: string, sector?: string): Promise<void> {
    const existing = await this.database.pipelineStage.count({ where: { organizationId } });
    if (existing > 0) return;

    type ProspectiveStage = { name: string; color: string; lightColor: string; border: string; probability: number };

    const SECTOR_STAGES: Record<string, ProspectiveStage[]> = {
      construction: [
        { name: 'New Lead',         color: 'bg-slate-500',  lightColor: 'bg-slate-50',  border: 'border-slate-200',  probability: 5   },
        { name: 'Site Visit',       color: 'bg-blue-500',   lightColor: 'bg-blue-50',   border: 'border-blue-200',   probability: 20  },
        { name: 'Tender Submitted', color: 'bg-yellow-500', lightColor: 'bg-yellow-50', border: 'border-yellow-200', probability: 40  },
        { name: 'Awarded',          color: 'bg-orange-500', lightColor: 'bg-orange-50', border: 'border-orange-200', probability: 75  },
        { name: 'Won',              color: 'bg-green-500',  lightColor: 'bg-green-50',  border: 'border-green-200',  probability: 100 },
        { name: 'Lost',             color: 'bg-red-500',    lightColor: 'bg-red-50',    border: 'border-red-200',    probability: 0   },
      ],
      architecture: [
        { name: 'Enquiry',            color: 'bg-slate-500',  lightColor: 'bg-slate-50',  border: 'border-slate-200',  probability: 5   },
        { name: 'Brief',              color: 'bg-blue-500',   lightColor: 'bg-blue-50',   border: 'border-blue-200',   probability: 20  },
        { name: 'Concept',            color: 'bg-purple-500', lightColor: 'bg-purple-50', border: 'border-purple-200', probability: 40  },
        { name: 'Design Development', color: 'bg-yellow-500', lightColor: 'bg-yellow-50', border: 'border-yellow-200', probability: 65  },
        { name: 'Won',                color: 'bg-green-500',  lightColor: 'bg-green-50',  border: 'border-green-200',  probability: 100 },
        { name: 'Declined',           color: 'bg-red-500',    lightColor: 'bg-red-50',    border: 'border-red-200',    probability: 0   },
      ],
      real_estate: [
        { name: 'Enquiry',      color: 'bg-slate-500',  lightColor: 'bg-slate-50',  border: 'border-slate-200',  probability: 5   },
        { name: 'Viewing',      color: 'bg-blue-500',   lightColor: 'bg-blue-50',   border: 'border-blue-200',   probability: 20  },
        { name: 'Offer Made',   color: 'bg-yellow-500', lightColor: 'bg-yellow-50', border: 'border-yellow-200', probability: 40  },
        { name: 'Due Diligence',color: 'bg-orange-500', lightColor: 'bg-orange-50', border: 'border-orange-200', probability: 70  },
        { name: 'Won',          color: 'bg-green-500',  lightColor: 'bg-green-50',  border: 'border-green-200',  probability: 100 },
        { name: 'Lost',         color: 'bg-red-500',    lightColor: 'bg-red-50',    border: 'border-red-200',    probability: 0   },
      ],
      facilities: [
        { name: 'Enquiry',      color: 'bg-slate-500',  lightColor: 'bg-slate-50',  border: 'border-slate-200',  probability: 5   },
        { name: 'Assessment',   color: 'bg-blue-500',   lightColor: 'bg-blue-50',   border: 'border-blue-200',   probability: 20  },
        { name: 'Proposal Sent',color: 'bg-yellow-500', lightColor: 'bg-yellow-50', border: 'border-yellow-200', probability: 40  },
        { name: 'Approval',     color: 'bg-orange-500', lightColor: 'bg-orange-50', border: 'border-orange-200', probability: 70  },
        { name: 'Won',          color: 'bg-green-500',  lightColor: 'bg-green-50',  border: 'border-green-200',  probability: 100 },
        { name: 'Lost',         color: 'bg-red-500',    lightColor: 'bg-red-50',    border: 'border-red-200',    probability: 0   },
      ],
      professional_services: [
        { name: 'Discovery',     color: 'bg-slate-500',  lightColor: 'bg-slate-50',  border: 'border-slate-200',  probability: 10  },
        { name: 'Proposal',      color: 'bg-blue-500',   lightColor: 'bg-blue-50',   border: 'border-blue-200',   probability: 25  },
        { name: 'Negotiation',   color: 'bg-yellow-500', lightColor: 'bg-yellow-50', border: 'border-yellow-200', probability: 50  },
        { name: 'Contract Sent', color: 'bg-orange-500', lightColor: 'bg-orange-50', border: 'border-orange-200', probability: 75  },
        { name: 'Won',           color: 'bg-green-500',  lightColor: 'bg-green-50',  border: 'border-green-200',  probability: 100 },
        { name: 'Lost',          color: 'bg-red-500',    lightColor: 'bg-red-50',    border: 'border-red-200',    probability: 0   },
      ],
      manufacturing: [
        { name: 'Enquiry',        color: 'bg-slate-500',  lightColor: 'bg-slate-50',  border: 'border-slate-200',  probability: 5   },
        { name: 'Specification',  color: 'bg-blue-500',   lightColor: 'bg-blue-50',   border: 'border-blue-200',   probability: 15  },
        { name: 'Quote Sent',     color: 'bg-yellow-500', lightColor: 'bg-yellow-50', border: 'border-yellow-200', probability: 35  },
        { name: 'Order Confirmed',color: 'bg-orange-500', lightColor: 'bg-orange-50', border: 'border-orange-200', probability: 80  },
        { name: 'Won',            color: 'bg-green-500',  lightColor: 'bg-green-50',  border: 'border-green-200',  probability: 100 },
        { name: 'Lost',           color: 'bg-red-500',    lightColor: 'bg-red-50',    border: 'border-red-200',    probability: 0   },
      ],
    };

    const DEFAULT_PROSPECTIVE_STAGES: ProspectiveStage[] = [
      { name: 'New',         color: 'bg-slate-500',  lightColor: 'bg-slate-50',  border: 'border-slate-200',  probability: 10  },
      { name: 'Contacted',   color: 'bg-blue-500',   lightColor: 'bg-blue-50',   border: 'border-blue-200',   probability: 25  },
      { name: 'Quoted',      color: 'bg-yellow-500', lightColor: 'bg-yellow-50', border: 'border-yellow-200', probability: 50  },
      { name: 'Negotiation', color: 'bg-orange-500', lightColor: 'bg-orange-50', border: 'border-orange-200', probability: 75  },
      { name: 'Won',         color: 'bg-green-500',  lightColor: 'bg-green-50',  border: 'border-green-200',  probability: 100 },
      { name: 'Lost',        color: 'bg-red-500',    lightColor: 'bg-red-50',    border: 'border-red-200',    probability: 0   },
    ];

    const prospectiveTemplate = (sector && SECTOR_STAGES[sector]) ? SECTOR_STAGES[sector] : DEFAULT_PROSPECTIVE_STAGES;

    const prospectiveStages = prospectiveTemplate.map((s, i) => ({
      name: s.name,
      pipelineType: 'prospective_project',
      color: s.color,
      lightColor: s.lightColor,
      border: s.border,
      probability: s.probability,
      sortOrder: i,
      isSystem: s.name === 'Won' || s.name === 'Lost' || s.name === 'Declined',
      organizationId,
    }));

    const projectStages = [
      { name: 'Planning',  color: 'bg-blue-500',   lightColor: 'bg-blue-50',   border: 'border-blue-200',   probability: 0,   sortOrder: 0, isSystem: true  },
      { name: 'Active',    color: 'bg-green-500',  lightColor: 'bg-green-50',  border: 'border-green-200',  probability: 50,  sortOrder: 1, isSystem: true  },
      { name: 'On Hold',   color: 'bg-yellow-500', lightColor: 'bg-yellow-50', border: 'border-yellow-200', probability: 0,   sortOrder: 2, isSystem: false },
      { name: 'Completed', color: 'bg-gray-400',   lightColor: 'bg-gray-50',   border: 'border-gray-200',   probability: 100, sortOrder: 3, isSystem: true  },
      { name: 'Cancelled', color: 'bg-red-500',    lightColor: 'bg-red-50',    border: 'border-red-200',    probability: 0,   sortOrder: 4, isSystem: false },
    ].map(s => ({ ...s, pipelineType: 'project', organizationId }));

    await this.database.pipelineStage.createMany({
      data: [...prospectiveStages, ...projectStages],
      skipDuplicates: true,
    });
  }

  private async seedDefaultDropdownOptions(organizationId: string, sector?: string): Promise<void> {
    const existing = await this.database.dropdownOption.count({ where: { organizationId } });
    if (existing > 0) return;

    type DropdownSeed = { value: string; label: string; metadata?: object; sortOrder: number; isSystem?: boolean };

    // Universal: urgency
    const urgencyOptions: DropdownSeed[] = [
      { value: 'low',      label: 'Low',      metadata: { color: '#22c55e' }, sortOrder: 0, isSystem: true },
      { value: 'medium',   label: 'Medium',   metadata: { color: '#f59e0b' }, sortOrder: 1, isSystem: true },
      { value: 'high',     label: 'High',     metadata: { color: '#f97316' }, sortOrder: 2, isSystem: true },
      { value: 'critical', label: 'Critical', metadata: { color: '#ef4444' }, sortOrder: 3, isSystem: true },
    ];

    // Universal: project_risk_status
    const riskOptions: DropdownSeed[] = [
      { value: 'low',      label: 'Low Risk',    metadata: { color: '#22c55e' }, sortOrder: 0, isSystem: true },
      { value: 'medium',   label: 'Medium Risk', metadata: { color: '#f59e0b' }, sortOrder: 1, isSystem: true },
      { value: 'high',     label: 'High Risk',   metadata: { color: '#f97316' }, sortOrder: 2, isSystem: true },
      { value: 'critical', label: 'Critical',    metadata: { color: '#ef4444' }, sortOrder: 3, isSystem: true },
    ];

    // Universal: individual_type (contractors / external people)
    const individualTypeOptions: DropdownSeed[] = [
      { value: 'contractor',    label: 'Contractor',     sortOrder: 0 },
      { value: 'consultant',    label: 'Consultant',     sortOrder: 1 },
      { value: 'subcontractor', label: 'Sub-contractor', sortOrder: 2 },
      { value: 'freelancer',    label: 'Freelancer',     sortOrder: 3 },
      { value: 'advisor',       label: 'Advisor',        sortOrder: 4 },
    ];

    // Universal: meeting_type
    const meetingTypeOptions: DropdownSeed[] = [
      { value: 'in-person', label: 'In-Person', sortOrder: 0 },
      { value: 'video',     label: 'Video Call', sortOrder: 1 },
      { value: 'phone',     label: 'Phone Call', sortOrder: 2 },
    ];

    // Sector-specific definitions
    const SECTOR_ACTIVITY_TYPES: Record<string, DropdownSeed[]> = {
      construction: [
        { value: 'site_visit',        label: 'Site Visit',       sortOrder: 0 },
        { value: 'client_meeting',    label: 'Client Meeting',   sortOrder: 1 },
        { value: 'tender_review',     label: 'Tender Review',    sortOrder: 2 },
        { value: 'progress_meeting',  label: 'Progress Meeting', sortOrder: 3 },
        { value: 'handover',          label: 'Handover',         sortOrder: 4 },
        { value: 'follow_up',         label: 'Follow-up',        sortOrder: 5 },
      ],
      architecture: [
        { value: 'design_review',       label: 'Design Review',       sortOrder: 0 },
        { value: 'client_presentation', label: 'Client Presentation', sortOrder: 1 },
        { value: 'site_inspection',     label: 'Site Inspection',     sortOrder: 2 },
        { value: 'workshop',            label: 'Workshop',            sortOrder: 3 },
        { value: 'concept_meeting',     label: 'Concept Meeting',     sortOrder: 4 },
        { value: 'follow_up',           label: 'Follow-up',           sortOrder: 5 },
      ],
      real_estate: [
        { value: 'property_viewing',   label: 'Property Viewing',    sortOrder: 0 },
        { value: 'offer_negotiation',  label: 'Offer Negotiation',   sortOrder: 1 },
        { value: 'contract_review',    label: 'Contract Review',     sortOrder: 2 },
        { value: 'inspection',         label: 'Inspection',          sortOrder: 3 },
        { value: 'closing_meeting',    label: 'Closing Meeting',     sortOrder: 4 },
        { value: 'follow_up',          label: 'Follow-up',           sortOrder: 5 },
      ],
      facilities: [
        { value: 'site_assessment',   label: 'Site Assessment',   sortOrder: 0 },
        { value: 'maintenance_review',label: 'Maintenance Review', sortOrder: 1 },
        { value: 'emergency_call',    label: 'Emergency Call',    sortOrder: 2 },
        { value: 'compliance_audit',  label: 'Compliance Audit',  sortOrder: 3 },
        { value: 'walkthrough',       label: 'Walkthrough',       sortOrder: 4 },
        { value: 'follow_up',         label: 'Follow-up',         sortOrder: 5 },
      ],
      professional_services: [
        { value: 'discovery_call',   label: 'Discovery Call',   sortOrder: 0 },
        { value: 'strategy_session', label: 'Strategy Session', sortOrder: 1 },
        { value: 'review_meeting',   label: 'Review Meeting',   sortOrder: 2 },
        { value: 'workshop',         label: 'Workshop',         sortOrder: 3 },
        { value: 'presentation',     label: 'Presentation',     sortOrder: 4 },
        { value: 'follow_up',        label: 'Follow-up',        sortOrder: 5 },
      ],
      manufacturing: [
        { value: 'factory_visit',    label: 'Factory Visit',    sortOrder: 0 },
        { value: 'technical_review', label: 'Technical Review', sortOrder: 1 },
        { value: 'order_review',     label: 'Order Review',     sortOrder: 2 },
        { value: 'quality_meeting',  label: 'Quality Meeting',  sortOrder: 3 },
        { value: 'delivery_meeting', label: 'Delivery Meeting', sortOrder: 4 },
        { value: 'follow_up',        label: 'Follow-up',        sortOrder: 5 },
      ],
    };

    const DEFAULT_ACTIVITY_TYPES: DropdownSeed[] = [
      { value: 'call',         label: 'Call',         sortOrder: 0 },
      { value: 'meeting',      label: 'Meeting',      sortOrder: 1 },
      { value: 'follow_up',    label: 'Follow-up',    sortOrder: 2 },
      { value: 'presentation', label: 'Presentation', sortOrder: 3 },
      { value: 'review',       label: 'Review',       sortOrder: 4 },
    ];

    const SECTOR_FILE_CATEGORIES: Record<string, DropdownSeed[]> = {
      construction: [
        { value: 'contract',     label: 'Contract',      sortOrder: 0 },
        { value: 'drawing',      label: 'Drawing',       sortOrder: 1 },
        { value: 'specification',label: 'Specification', sortOrder: 2 },
        { value: 'site_photo',   label: 'Site Photo',    sortOrder: 3 },
        { value: 'invoice',      label: 'Invoice',       sortOrder: 4 },
        { value: 'boq',          label: 'BOQ',           sortOrder: 5 },
        { value: 'permit',       label: 'Permit',        sortOrder: 6 },
        { value: 'other',        label: 'Other',         sortOrder: 7 },
      ],
      architecture: [
        { value: 'drawing',          label: 'Drawing',          sortOrder: 0 },
        { value: 'concept_design',   label: 'Concept Design',   sortOrder: 1 },
        { value: 'spec_sheet',       label: 'Spec Sheet',       sortOrder: 2 },
        { value: 'client_brief',     label: 'Client Brief',     sortOrder: 3 },
        { value: 'invoice',          label: 'Invoice',          sortOrder: 4 },
        { value: 'planning_permit',  label: 'Planning Permit',  sortOrder: 5 },
        { value: 'other',            label: 'Other',            sortOrder: 6 },
      ],
      real_estate: [
        { value: 'title_deed',        label: 'Title Deed',        sortOrder: 0 },
        { value: 'offer_letter',      label: 'Offer Letter',      sortOrder: 1 },
        { value: 'sale_agreement',    label: 'Sale Agreement',    sortOrder: 2 },
        { value: 'inspection_report', label: 'Inspection Report', sortOrder: 3 },
        { value: 'invoice',           label: 'Invoice',           sortOrder: 4 },
        { value: 'other',             label: 'Other',             sortOrder: 5 },
      ],
      facilities: [
        { value: 'maintenance_report',     label: 'Maintenance Report',     sortOrder: 0 },
        { value: 'service_agreement',      label: 'Service Agreement',      sortOrder: 1 },
        { value: 'compliance_certificate', label: 'Compliance Certificate', sortOrder: 2 },
        { value: 'invoice',                label: 'Invoice',                sortOrder: 3 },
        { value: 'site_plan',              label: 'Site Plan',              sortOrder: 4 },
        { value: 'other',                  label: 'Other',                  sortOrder: 5 },
      ],
      professional_services: [
        { value: 'proposal',    label: 'Proposal',    sortOrder: 0 },
        { value: 'contract',    label: 'Contract',    sortOrder: 1 },
        { value: 'report',      label: 'Report',      sortOrder: 2 },
        { value: 'invoice',     label: 'Invoice',     sortOrder: 3 },
        { value: 'presentation',label: 'Presentation',sortOrder: 4 },
        { value: 'other',       label: 'Other',       sortOrder: 5 },
      ],
      manufacturing: [
        { value: 'technical_spec',  label: 'Technical Spec',  sortOrder: 0 },
        { value: 'purchase_order',  label: 'Purchase Order',  sortOrder: 1 },
        { value: 'quality_report',  label: 'Quality Report',  sortOrder: 2 },
        { value: 'invoice',         label: 'Invoice',         sortOrder: 3 },
        { value: 'drawing',         label: 'Drawing',         sortOrder: 4 },
        { value: 'other',           label: 'Other',           sortOrder: 5 },
      ],
    };

    const DEFAULT_FILE_CATEGORIES: DropdownSeed[] = [
      { value: 'contract',  label: 'Contract',  sortOrder: 0 },
      { value: 'invoice',   label: 'Invoice',   sortOrder: 1 },
      { value: 'proposal',  label: 'Proposal',  sortOrder: 2 },
      { value: 'report',    label: 'Report',    sortOrder: 3 },
      { value: 'other',     label: 'Other',     sortOrder: 4 },
    ];

    const SECTOR_COST_CATEGORIES: Record<string, DropdownSeed[]> = {
      construction: [
        { value: 'materials',     label: 'Materials',     sortOrder: 0 },
        { value: 'labour',        label: 'Labour',        sortOrder: 1 },
        { value: 'equipment',     label: 'Equipment',     sortOrder: 2 },
        { value: 'subcontractor', label: 'Subcontractor', sortOrder: 3 },
        { value: 'overhead',      label: 'Overhead',      sortOrder: 4 },
        { value: 'transport',     label: 'Transport',     sortOrder: 5 },
      ],
      architecture: [
        { value: 'consultancy_fees', label: 'Consultancy Fees', sortOrder: 0 },
        { value: 'travel',           label: 'Travel',           sortOrder: 1 },
        { value: 'software',         label: 'Software',         sortOrder: 2 },
        { value: 'printing',         label: 'Printing',         sortOrder: 3 },
        { value: 'model_making',     label: 'Model Making',     sortOrder: 4 },
        { value: 'other',            label: 'Other',            sortOrder: 5 },
      ],
      real_estate: [
        { value: 'agent_commission', label: 'Agent Commission', sortOrder: 0 },
        { value: 'legal_fees',       label: 'Legal Fees',       sortOrder: 1 },
        { value: 'transfer_tax',     label: 'Transfer Tax',     sortOrder: 2 },
        { value: 'survey',           label: 'Survey',           sortOrder: 3 },
        { value: 'renovations',      label: 'Renovations',      sortOrder: 4 },
        { value: 'other',            label: 'Other',            sortOrder: 5 },
      ],
      facilities: [
        { value: 'parts_materials',    label: 'Parts & Materials', sortOrder: 0 },
        { value: 'labour',             label: 'Labour',            sortOrder: 1 },
        { value: 'equipment_rental',   label: 'Equipment Rental',  sortOrder: 2 },
        { value: 'transport',          label: 'Transport',         sortOrder: 3 },
        { value: 'admin',              label: 'Admin',             sortOrder: 4 },
        { value: 'other',              label: 'Other',             sortOrder: 5 },
      ],
      professional_services: [
        { value: 'consultancy_fees', label: 'Consultancy Fees', sortOrder: 0 },
        { value: 'travel',           label: 'Travel',           sortOrder: 1 },
        { value: 'software',         label: 'Software',         sortOrder: 2 },
        { value: 'admin',            label: 'Admin',            sortOrder: 3 },
        { value: 'training',         label: 'Training',         sortOrder: 4 },
        { value: 'other',            label: 'Other',            sortOrder: 5 },
      ],
      manufacturing: [
        { value: 'raw_materials', label: 'Raw Materials', sortOrder: 0 },
        { value: 'labour',        label: 'Labour',        sortOrder: 1 },
        { value: 'machinery',     label: 'Machinery',     sortOrder: 2 },
        { value: 'logistics',     label: 'Logistics',     sortOrder: 3 },
        { value: 'overheads',     label: 'Overheads',     sortOrder: 4 },
        { value: 'other',         label: 'Other',         sortOrder: 5 },
      ],
    };

    const DEFAULT_COST_CATEGORIES: DropdownSeed[] = [
      { value: 'materials',  label: 'Materials',  sortOrder: 0 },
      { value: 'labour',     label: 'Labour',     sortOrder: 1 },
      { value: 'equipment',  label: 'Equipment',  sortOrder: 2 },
      { value: 'overheads',  label: 'Overheads',  sortOrder: 3 },
      { value: 'other',      label: 'Other',      sortOrder: 4 },
    ];

    const SECTOR_CLIENT_SEGMENTS: Record<string, DropdownSeed[]> = {
      construction: [
        { value: 'residential', label: 'Residential', sortOrder: 0 },
        { value: 'commercial',  label: 'Commercial',  sortOrder: 1 },
        { value: 'industrial',  label: 'Industrial',  sortOrder: 2 },
        { value: 'government',  label: 'Government',  sortOrder: 3 },
        { value: 'developer',   label: 'Developer',   sortOrder: 4 },
      ],
      architecture: [
        { value: 'residential',  label: 'Residential',  sortOrder: 0 },
        { value: 'commercial',   label: 'Commercial',   sortOrder: 1 },
        { value: 'hospitality',  label: 'Hospitality',  sortOrder: 2 },
        { value: 'healthcare',   label: 'Healthcare',   sortOrder: 3 },
        { value: 'education',    label: 'Education',    sortOrder: 4 },
      ],
      real_estate: [
        { value: 'residential_buyer',  label: 'Residential Buyer',  sortOrder: 0 },
        { value: 'commercial_investor',label: 'Commercial Investor', sortOrder: 1 },
        { value: 'developer',          label: 'Developer',          sortOrder: 2 },
        { value: 'government',         label: 'Government',         sortOrder: 3 },
      ],
      facilities: [
        { value: 'commercial',         label: 'Commercial',         sortOrder: 0 },
        { value: 'industrial',         label: 'Industrial',         sortOrder: 1 },
        { value: 'residential_complex',label: 'Residential Complex',sortOrder: 2 },
        { value: 'healthcare',         label: 'Healthcare',         sortOrder: 3 },
        { value: 'education',          label: 'Education',          sortOrder: 4 },
      ],
      professional_services: [
        { value: 'smb',        label: 'SMB',        sortOrder: 0 },
        { value: 'mid_market', label: 'Mid-Market', sortOrder: 1 },
        { value: 'enterprise', label: 'Enterprise', sortOrder: 2 },
        { value: 'government', label: 'Government', sortOrder: 3 },
        { value: 'non_profit', label: 'Non-Profit', sortOrder: 4 },
      ],
      manufacturing: [
        { value: 'oem',              label: 'OEM',            sortOrder: 0 },
        { value: 'distributor',      label: 'Distributor',    sortOrder: 1 },
        { value: 'direct_customer',  label: 'Direct Customer',sortOrder: 2 },
        { value: 'government',       label: 'Government',     sortOrder: 3 },
      ],
    };

    const DEFAULT_CLIENT_SEGMENTS: DropdownSeed[] = [
      { value: 'smb',        label: 'SMB',        sortOrder: 0 },
      { value: 'mid_market', label: 'Mid-Market', sortOrder: 1 },
      { value: 'enterprise', label: 'Enterprise', sortOrder: 2 },
      { value: 'government', label: 'Government', sortOrder: 3 },
    ];

    const SECTOR_TEAM_TYPES: Record<string, DropdownSeed[]> = {
      construction: [
        { value: 'site_team',   label: 'Site Team',   sortOrder: 0 },
        { value: 'estimating',  label: 'Estimating',  sortOrder: 1 },
        { value: 'design',      label: 'Design',      sortOrder: 2 },
        { value: 'procurement', label: 'Procurement', sortOrder: 3 },
        { value: 'safety',      label: 'Safety',      sortOrder: 4 },
      ],
      architecture: [
        { value: 'design',              label: 'Design',              sortOrder: 0 },
        { value: 'project_management',  label: 'Project Management',  sortOrder: 1 },
        { value: 'administration',      label: 'Administration',      sortOrder: 2 },
        { value: 'technical',           label: 'Technical',           sortOrder: 3 },
      ],
      real_estate: [
        { value: 'sales',              label: 'Sales',              sortOrder: 0 },
        { value: 'property_management',label: 'Property Management',sortOrder: 1 },
        { value: 'legal',              label: 'Legal',              sortOrder: 2 },
        { value: 'finance',            label: 'Finance',            sortOrder: 3 },
      ],
      facilities: [
        { value: 'maintenance', label: 'Maintenance', sortOrder: 0 },
        { value: 'operations',  label: 'Operations',  sortOrder: 1 },
        { value: 'management',  label: 'Management',  sortOrder: 2 },
        { value: 'safety',      label: 'Safety',      sortOrder: 3 },
      ],
      professional_services: [
        { value: 'delivery',    label: 'Delivery',    sortOrder: 0 },
        { value: 'sales',       label: 'Sales',       sortOrder: 1 },
        { value: 'operations',  label: 'Operations',  sortOrder: 2 },
        { value: 'management',  label: 'Management',  sortOrder: 3 },
      ],
      manufacturing: [
        { value: 'production',  label: 'Production',  sortOrder: 0 },
        { value: 'quality',     label: 'Quality',     sortOrder: 1 },
        { value: 'sales',       label: 'Sales',       sortOrder: 2 },
        { value: 'logistics',   label: 'Logistics',   sortOrder: 3 },
        { value: 'engineering', label: 'Engineering', sortOrder: 4 },
      ],
    };

    const DEFAULT_TEAM_TYPES: DropdownSeed[] = [
      { value: 'sales',       label: 'Sales',       sortOrder: 0 },
      { value: 'operations',  label: 'Operations',  sortOrder: 1 },
      { value: 'management',  label: 'Management',  sortOrder: 2 },
      { value: 'support',     label: 'Support',     sortOrder: 3 },
    ];

    const pick = <T>(map: Record<string, T[]>, fallback: T[]): T[] =>
      (sector && map[sector]) ? map[sector] : fallback;

    type CategoryRow = DropdownSeed & { category: string; organizationId: string };

    const toRows = (category: string, seeds: DropdownSeed[]): CategoryRow[] =>
      seeds.map(s => ({ ...s, category, organizationId }));

    const rows: CategoryRow[] = [
      ...toRows('urgency',             urgencyOptions),
      ...toRows('project_risk_status', riskOptions),
      ...toRows('individual_type',     individualTypeOptions),
      ...toRows('meeting_type',        meetingTypeOptions),
      ...toRows('activity_type',       pick(SECTOR_ACTIVITY_TYPES,   DEFAULT_ACTIVITY_TYPES)),
      ...toRows('file_category',       pick(SECTOR_FILE_CATEGORIES,  DEFAULT_FILE_CATEGORIES)),
      ...toRows('cost_category',       pick(SECTOR_COST_CATEGORIES,  DEFAULT_COST_CATEGORIES)),
      ...toRows('client_segment',      pick(SECTOR_CLIENT_SEGMENTS,  DEFAULT_CLIENT_SEGMENTS)),
      ...toRows('team_type',           pick(SECTOR_TEAM_TYPES,       DEFAULT_TEAM_TYPES)),
    ];

    await this.database.dropdownOption.createMany({
      data: rows.map(r => ({
        category:       r.category,
        value:          r.value,
        label:          r.label,
        metadata:       r.metadata ?? undefined,
        sortOrder:      r.sortOrder,
        isSystem:       r.isSystem ?? false,
        isActive:       true,
        organizationId: r.organizationId,
      })),
      skipDuplicates: true,
    });
  }
}
