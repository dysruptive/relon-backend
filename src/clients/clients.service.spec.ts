import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { PrismaService } from '../database/prisma.service';
import { AiService } from '../ai/ai.service';
import { ClientMetricsService } from './client-metrics.service';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  client: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
const mockBilling = {
  checkPlanLimit: jest.fn().mockResolvedValue({ allowed: true, current: 0, limit: 100 }),
};
const mockAi = {};
const mockMetrics = {
  calculateBatchMetrics: jest.fn().mockResolvedValue(new Map()),
  calculateMetrics: jest.fn().mockResolvedValue({}),
  detectHealthFlags: jest.fn().mockReturnValue([]),
  generateSuggestedActions: jest.fn().mockReturnValue([]),
  determineHealthStatus: jest.fn().mockReturnValue('Healthy'),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClientsService — findAll tenant isolation', () => {
  let service: ClientsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiService, useValue: mockAi },
        { provide: ClientMetricsService, useValue: mockMetrics },
        { provide: AuditService, useValue: mockAudit },
        { provide: BillingService, useValue: mockBilling },
      ],
    }).compile();
    service = module.get(ClientsService);
  });

  it('findAll always includes organizationId in the where clause', async () => {
    mockPrisma.client.findMany.mockResolvedValueOnce([]);
    await service.findAll('user-1', 'CEO', 'org-1');

    expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1' }),
      }),
    );
  });

  it('findAll with SALES role restricts to accountManagerId', async () => {
    mockPrisma.client.findMany.mockResolvedValueOnce([]);
    await service.findAll('user-1', 'SALES', 'org-1');

    expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          accountManagerId: 'user-1',
        }),
      }),
    );
  });

  it('findAll for CEO does not add accountManagerId filter', async () => {
    mockPrisma.client.findMany.mockResolvedValueOnce([]);
    await service.findAll('user-1', 'CEO', 'org-1');

    const call = mockPrisma.client.findMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty('accountManagerId');
  });
});

describe('ClientsService — remove (soft-delete)', () => {
  let service: ClientsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiService, useValue: mockAi },
        { provide: ClientMetricsService, useValue: mockMetrics },
        { provide: AuditService, useValue: mockAudit },
        { provide: BillingService, useValue: mockBilling },
      ],
    }).compile();
    service = module.get(ClientsService);
  });

  it('remove uses update with deletedAt — never calls prisma.client.delete()', async () => {
    const client = {
      id: 'client-1',
      name: 'ACME',
      segment: 'SME',
      industry: 'Construction',
      organizationId: 'org-1',
    };
    mockPrisma.client.findFirst.mockResolvedValueOnce(client);
    mockPrisma.client.update.mockResolvedValueOnce({ ...client, deletedAt: new Date() });

    await service.remove('client-1', 'user-1', 'org-1');

    // Hard delete must never be called
    expect((mockPrisma.client as any).delete).toBeUndefined();
    // Soft-delete via update
    expect(mockPrisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('remove scopes both findFirst and update with { id, organizationId }', async () => {
    const client = {
      id: 'client-1',
      name: 'ACME',
      segment: 'SME',
      industry: 'Construction',
      organizationId: 'org-1',
    };
    mockPrisma.client.findFirst.mockResolvedValueOnce(client);
    mockPrisma.client.update.mockResolvedValueOnce({ ...client, deletedAt: new Date() });

    await service.remove('client-1', 'user-1', 'org-1');

    // findFirst is org-scoped
    expect(mockPrisma.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'client-1', organizationId: 'org-1' }),
      }),
    );
    // update is also org-scoped
    expect(mockPrisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'client-1', organizationId: 'org-1' }),
      }),
    );
  });

  it('remove throws when client belongs to a different org (findFirst returns null)', async () => {
    mockPrisma.client.findFirst.mockResolvedValueOnce(null);

    await expect(service.remove('client-1', 'user-1', 'org-other')).rejects.toThrow();
    expect(mockPrisma.client.update).not.toHaveBeenCalled();
  });
});

describe('ClientsService — create plan limits', () => {
  let service: ClientsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiService, useValue: mockAi },
        { provide: ClientMetricsService, useValue: mockMetrics },
        { provide: AuditService, useValue: mockAudit },
        { provide: BillingService, useValue: mockBilling },
      ],
    }).compile();
    service = module.get(ClientsService);
  });

  it('create throws BadRequestException when plan limit is reached', async () => {
    mockBilling.checkPlanLimit.mockResolvedValueOnce({
      allowed: false,
      current: 10,
      limit: 10,
    });

    await expect(
      service.create({ organizationId: 'org-1', name: 'NewCo' }, 'user-1'),
    ).rejects.toThrow(BadRequestException);

    expect(mockPrisma.client.create).not.toHaveBeenCalled();
  });

  it('create proceeds when plan limit is not reached', async () => {
    mockBilling.checkPlanLimit.mockResolvedValueOnce({
      allowed: true,
      current: 5,
      limit: 100,
    });
    const created = { id: 'client-new', name: 'NewCo', organizationId: 'org-1' };
    mockPrisma.client.create.mockResolvedValueOnce(created);

    const result = await service.create({ organizationId: 'org-1', name: 'NewCo' }, 'user-1');
    expect(result).toEqual(created);
    expect(mockPrisma.client.create).toHaveBeenCalledTimes(1);
  });
});

describe('ClientsService — findOne cross-org isolation', () => {
  let service: ClientsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiService, useValue: mockAi },
        { provide: ClientMetricsService, useValue: mockMetrics },
        { provide: AuditService, useValue: mockAudit },
        { provide: BillingService, useValue: mockBilling },
      ],
    }).compile();
    service = module.get(ClientsService);
  });

  it('findOne returns null when client belongs to a different org', async () => {
    // findFirst returns null because the org filter won't match
    mockPrisma.client.findFirst.mockResolvedValueOnce(null);

    const result = await service.findOne('client-1', 'user-1', 'CEO', 'org-other');
    expect(result).toBeNull();
  });

  it('findOne includes organizationId in the where clause', async () => {
    mockPrisma.client.findFirst.mockResolvedValueOnce(null);

    await service.findOne('client-1', 'user-1', 'CEO', 'org-1');

    expect(mockPrisma.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'client-1', organizationId: 'org-1' }),
      }),
    );
  });

  it('findOne returns enriched client when found in org', async () => {
    const client = {
      id: 'client-1',
      name: 'ACME',
      organizationId: 'org-1',
      accountManagerId: 'user-1',
      lifetimeRevenue: 50000,
      statusOverride: false,
      createdAt: new Date(),
      projects: [],
      activities: [],
      convertedFromLeads: [],
    };
    mockPrisma.client.findFirst.mockResolvedValueOnce(client);
    mockMetrics.calculateMetrics.mockResolvedValueOnce({ engagementScore: 80, activeProjectCount: 2 });

    const result = await service.findOne('client-1', 'user-1', 'CEO', 'org-1');
    expect(result).toMatchObject({ id: 'client-1', name: 'ACME' });
  });
});
