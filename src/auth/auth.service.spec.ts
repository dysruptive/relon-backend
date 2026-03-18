import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { PermissionsService } from '../permissions/permissions.service';
import { OrganizationsService } from '../organizations/organizations.service';
import * as bcrypt from 'bcrypt';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('bcrypt');
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  organization: {
    create: jest.fn(),
  },
  pipelineStage: {
    count: jest.fn().mockResolvedValue(0),
    createMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockJwt = { sign: jest.fn().mockReturnValue('signed-token'), verify: jest.fn() };
const mockEmail = {
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendEmailVerificationEmail: jest.fn().mockResolvedValue(undefined),
};
const mockPermissions = {
  getPermissionsForRole: jest.fn().mockResolvedValue(['leads:read']),
  seedDefaultsForOrg: jest.fn().mockResolvedValue(undefined),
};
const mockOrganizations = {
  generateSlug: jest.fn().mockReturnValue('test-org'),
  ensureUniqueSlug: jest.fn().mockResolvedValue('test-org'),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthService — validateUser', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: EmailService, useValue: mockEmail },
        { provide: PermissionsService, useValue: mockPermissions },
        { provide: OrganizationsService, useValue: mockOrganizations },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('returns null if user does not exist', async () => {
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);
    expect(await service.validateUser('x@x.com', 'pass')).toBeNull();
  });

  it('throws BadRequest if user has no password (OAuth account)', async () => {
    mockPrisma.user.findFirst.mockResolvedValueOnce({ id: '1', password: null, lockedUntil: null });
    await expect(service.validateUser('x@x.com', 'pass')).rejects.toThrow(BadRequestException);
  });

  it('throws UnauthorizedException if account is locked', async () => {
    const lockedUntil = new Date(Date.now() + 60_000);
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      id: '1',
      password: 'hashed',
      lockedUntil,
      failedLoginAttempts: 10,
    });
    await expect(service.validateUser('x@x.com', 'wrongpass')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('returns null and increments failed attempts on wrong password', async () => {
    const user = {
      id: '1',
      password: 'hashed',
      lockedUntil: null,
      failedLoginAttempts: 2,
      status: 'Active',
    };
    mockPrisma.user.findFirst.mockResolvedValueOnce(user);
    (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

    const result = await service.validateUser('x@x.com', 'wrong');
    expect(result).toBeNull();
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failedLoginAttempts: 3 }),
      }),
    );
  });

  it('locks account after 10 failed attempts', async () => {
    const user = {
      id: '1',
      password: 'hashed',
      lockedUntil: null,
      failedLoginAttempts: 9,
      status: 'Active',
    };
    mockPrisma.user.findFirst.mockResolvedValueOnce(user);
    (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

    await service.validateUser('x@x.com', 'wrong');

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedLoginAttempts: 10,
          lockedUntil: expect.any(Date),
        }),
      }),
    );
  });

  it('resets failed attempts on successful login', async () => {
    const user = {
      id: '1',
      password: 'hashed',
      lockedUntil: null,
      failedLoginAttempts: 3,
      status: 'Active',
    };
    mockPrisma.user.findFirst.mockResolvedValueOnce(user);
    (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

    await service.validateUser('x@x.com', 'correct');

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { failedLoginAttempts: 0, lockedUntil: null },
      }),
    );
  });

  it('throws UnauthorizedException if user is inactive', async () => {
    const user = {
      id: '1',
      password: 'hashed',
      lockedUntil: null,
      failedLoginAttempts: 0,
      status: 'Inactive',
    };
    mockPrisma.user.findFirst.mockResolvedValueOnce(user);
    (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

    await expect(service.validateUser('x@x.com', 'correct')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe('AuthService — tenant isolation', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: EmailService, useValue: mockEmail },
        { provide: PermissionsService, useValue: mockPermissions },
        { provide: OrganizationsService, useValue: mockOrganizations },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('getProfile only queries by userId — no cross-org leakage', async () => {
    const user = {
      id: 'u1',
      email: 'a@a.com',
      name: 'Alice',
      role: 'CEO',
      status: 'Active',
      isEmailVerified: true,
      lastLogin: null,
      createdAt: new Date(),
      organizationId: 'org-1',
    };
    mockPrisma.user.findUnique.mockResolvedValueOnce(user);

    await service.getProfile('u1');

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' } }),
    );
  });
});
