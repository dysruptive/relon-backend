import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { UserStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private auditService: AuditService,
    private billingService: BillingService,
  ) {}

  // ==================== Permission Validation Methods ====================

  /**
   * Check if current user can manage a user with the target role
   */
  private canManageUser(
    currentUserRole: string,
    targetUserRole: string
  ): boolean {
    // CEO can manage all roles
    if (currentUserRole === 'CEO') return true;

    // ADMIN can manage any role except CEO (includes other ADMINs and custom roles)
    if (currentUserRole === 'ADMIN') {
      return targetUserRole !== 'CEO';
    }

    // BDM can manage: SALES only (not CEO, ADMIN, or other BDM)
    if (currentUserRole === 'BDM') {
      return targetUserRole === 'SALES';
    }

    return false; // SALES cannot manage anyone
  }

  /**
   * Validate user creation permissions and requirements
   */
  private async validateUserCreation(
    currentUserId: string,
    currentUserRole: string,
    createDto: CreateUserDto,
    organizationId: string,
  ): Promise<void> {
    // Check plan limit for users
    const planCheck = await this.billingService.checkPlanLimit(organizationId, 'users');
    if (!planCheck.allowed) {
      throw new BadRequestException(
        `User limit reached for your plan (${planCheck.current}/${planCheck.limit}). Please upgrade to add more users.`
      );
    }

    // Check if user can create this role
    if (!this.canManageUser(currentUserRole, createDto.role)) {
      throw new ForbiddenException(
        `${currentUserRole} users cannot create ${createDto.role} users`
      );
    }

    // Check if email is already taken within this organization
    const existingUser = await this.prisma.user.findFirst({
      where: { organizationId, email: createDto.email },
    });
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    // If managerId provided, validate it exists in same org
    if (createDto.managerId) {
      const manager = await this.prisma.user.findFirst({
        where: { id: createDto.managerId, organizationId },
      });
      if (!manager) {
        throw new BadRequestException('Invalid manager ID');
      }
    }

    // If teamId provided, validate it exists in same org
    if (createDto.teamId) {
      const team = await this.prisma.team.findFirst({
        where: { id: createDto.teamId, organizationId },
      });
      if (!team) {
        throw new NotFoundException('Team not found');
      }
    }
  }

  /**
   * Validate user update permissions
   */
  private async validateUserUpdate(
    currentUserId: string,
    currentUserRole: string,
    targetUserId: string,
    updateDto: UpdateUserDto,
    organizationId: string,
  ): Promise<any> {
    // Fetch target user — must be in same org
    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Users cannot modify themselves through this endpoint
    if (currentUserId === targetUserId) {
      throw new ForbiddenException(
        'Use profile settings to update your own account'
      );
    }

    // Check permission to modify this user
    if (!this.canManageUser(currentUserRole, targetUser.role)) {
      throw new ForbiddenException(
        `You don't have permission to modify ${targetUser.role} users`
      );
    }

    // If role is being changed, validate new role
    if (updateDto.role && updateDto.role !== targetUser.role) {
      if (!this.canManageUser(currentUserRole, updateDto.role)) {
        throw new ForbiddenException(
          `You don't have permission to change users to ${updateDto.role} role`
        );
      }
    }

    // BDM can only modify their own team members
    if (currentUserRole === 'BDM') {
      if (targetUser.managerId !== currentUserId) {
        throw new ForbiddenException(
          'You can only modify your own team members'
        );
      }
    }

    // If teamId is being updated, validate it exists within same org
    if (updateDto.teamId) {
      const team = await this.prisma.team.findFirst({
        where: { id: updateDto.teamId, organizationId },
      });
      if (!team) {
        throw new NotFoundException('Team not found');
      }
    }

    return targetUser;
  }

  /**
   * Generate secure temporary password
   */
  private generateTempPassword(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const bytes = randomBytes(12);
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(bytes[i] % chars.length);
    }
    return password;
  }

  // ==================== User Management Methods ====================

  /**
   * Get all users (filtered by role hierarchy, scoped to organization)
   */
  async getAllUsers(currentUserId: string, currentUserRole: string, organizationId: string) {
    const where: any = {
      organizationId,
    };

    // CEO/ADMIN see all users
    if (currentUserRole === 'CEO' || currentUserRole === 'ADMIN') {
      // No further filter
    }
    // BDM sees only their team
    else if (currentUserRole === 'BDM') {
      where.OR = [
        { managerId: currentUserId },
        { id: currentUserId },
      ];
    }
    // SALES sees only themselves
    else if (currentUserRole === 'SALES') {
      where.id = currentUserId;
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        teamName: true,
        managerId: true,
        createdAt: true,
        updatedAt: true,
        manager: {
          select: { name: true, email: true },
        },
        teamMembers: {
          select: { id: true, name: true, email: true },
        },
        team: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform result to include team name from relation if available, fallback to legacy teamName
    const usersWithTeam = users.map((user) => ({
      ...user,
      teamName: user.team?.name || user.teamName,
    }));

    return { users: usersWithTeam };
  }

  /**
   * Create a new user with hierarchical validation (scoped to organization)
   */
  async createUser(
    currentUserId: string,
    createUserDto: CreateUserDto,
    organizationId: string,
  ) {
    const currentUser = await this.prisma.user.findFirst({
      where: { id: currentUserId, organizationId },
    });

    if (!currentUser) {
      throw new NotFoundException('Current user not found');
    }

    // Validate permissions
    await this.validateUserCreation(
      currentUserId,
      currentUser.role,
      createUserDto,
      organizationId,
    );

    // Generate secure temporary password
    const tempPassword = this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        name: createUserDto.name,
        password: hashedPassword,
        role: createUserDto.role,
        teamName: createUserDto.teamName, // Keep for backward compatibility if provided
        teamId: createUserDto.teamId || null,
        managerId: createUserDto.managerId || null,
        status: UserStatus.Active,
        isEmailVerified: false,
        organizationId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        teamName: true,
        teamId: true,
        team: {
          select: { id: true, name: true },
        },
        managerId: true,
        manager: {
          select: { name: true, email: true },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    // Auto-set onboarding invite flag (non-blocking)
    this.prisma.organization.update({
      where: { id: organizationId },
      data: { onboardingInvitedTeam: true },
    }).catch(() => {});

    // Send welcome email with temp password (non-blocking)
    try {
      await this.emailService.sendWelcomeEmail(
        user.email,
        user.name,
        tempPassword
      );
    } catch (error) {
      // Email failure should not block user creation
      console.error('Failed to send welcome email:', error);
    }

    // Log audit trail
    try {
      await this.auditService.log({
        userId: currentUserId,
        organizationId,
        action: 'CREATE_USER',
        targetUserId: user.id,
        details: {
          role: user.role,
          email: user.email,
          teamName: user.teamName,
        },
      });
    } catch (error) {
      console.error('Failed to log audit:', error);
    }

    return {
      user,
      tempPassword, // Return for display
    };
  }

  /**
   * Update a user with hierarchical validation (scoped to organization)
   */
  async updateUser(
    currentUserId: string,
    targetUserId: string,
    updateUserDto: UpdateUserDto,
    organizationId: string,
  ) {
    const currentUser = await this.prisma.user.findFirst({
      where: { id: currentUserId, organizationId },
    });

    if (!currentUser) {
      throw new NotFoundException('Current user not found');
    }

    // Validate permissions
    await this.validateUserUpdate(
      currentUserId,
      currentUser.role,
      targetUserId,
      updateUserDto,
      organizationId,
    );

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        teamName: true,
        teamId: true,
        team: {
          select: { id: true, name: true },
        },
        managerId: true,
        manager: {
          select: { name: true, email: true },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    // Log audit trail
    try {
      await this.auditService.log({
        userId: currentUserId,
        organizationId,
        action: 'UPDATE_USER',
        targetUserId: updatedUser.id,
        details: { updates: updateUserDto },
      });
    } catch (error) {
      console.error('Failed to log audit:', error);
    }

    return { user: updatedUser };
  }

  /**
   * Delete a user (CEO and ADMIN only, scoped to organization)
   */
  async deleteUser(currentUserId: string, targetUserId: string, organizationId: string) {
    const currentUser = await this.prisma.user.findFirst({
      where: { id: currentUserId, organizationId },
    });

    if (!currentUser) {
      throw new NotFoundException('Current user not found');
    }

    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Cannot delete yourself
    if (currentUserId === targetUserId) {
      throw new ForbiddenException(
        'You cannot delete your own account'
      );
    }

    // Only CEO can delete ADMIN users
    if (targetUser.role === 'CEO') {
      throw new ForbiddenException('CEO users cannot be deleted');
    }

    if (targetUser.role === 'ADMIN' && currentUser.role !== 'CEO') {
      throw new ForbiddenException('Only CEO can delete ADMIN users');
    }

    // Check if user has team members within same org
    if (targetUser.role === 'BDM') {
      const teamMembers = await this.prisma.user.count({
        where: { managerId: targetUserId, organizationId },
      });
      if (teamMembers > 0) {
        throw new BadRequestException(
          'Cannot delete manager with active team members. Please reassign team members first.'
        );
      }
    }

    await this.prisma.user.delete({
      where: { id: targetUserId },
    });

    // Log audit trail
    try {
      await this.auditService.log({
        userId: currentUserId,
        organizationId,
        action: 'DELETE_USER',
        targetUserId: targetUserId,
        details: {
          deletedEmail: targetUser.email,
          deletedRole: targetUser.role,
          deletedName: targetUser.name,
        },
      });
    } catch (error) {
      console.error('Failed to log audit:', error);
    }

    return { message: 'User deleted successfully' };
  }

  // ==================== Tenant Settings Methods ====================

  async getTenantSettings(organizationId: string) {
    const settings = await this.prisma.tenantSettings.findUnique({
      where: { organizationId },
    });
    if (!settings) {
      return { clientDisplayMode: 'COMPANY' };
    }
    return settings;
  }

  async updateTenantSettings(
    organizationId: string,
    dto: { clientDisplayMode?: string },
  ) {
    return this.prisma.tenantSettings.upsert({
      where: { organizationId },
      update: dto,
      create: { organizationId, ...dto },
    });
  }
}
