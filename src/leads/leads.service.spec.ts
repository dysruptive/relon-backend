import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { PrismaService } from '../database/prisma.service';
import { LeadMetricsService } from './lead-metrics.service';
import { LeadsStageService } from './leads-stage.service';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { EmailService } from '../email/email.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  lead: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  user: { findMany: jest.fn().mockResolvedValue([]) },
  pipelineStage: {
    count: jest.fn().mockResolvedValue(0),
    findFirst: jest.fn(),
  },
  stageHistory: { create: jest.fn() },
  leadRep: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  organization: {
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
const mockBilling = {
  checkPlanLimit: jest.fn().mockResolvedValue({ allowed: true, current: 0, limit: 100 }),
};
const mockMetrics = {
  calculateBatchMetrics: jest.fn().mockResolvedValue(new Map()),
  calculateMetrics: jest.fn().mockResolvedValue({
    daysInPipeline: 0,
    daysSinceLastContact: 0,
    activityCount: 0,
    fileCount: 0,
  }),
  detectRiskFlags: jest.fn().mockReturnValue([]),
  generateSuggestedActions: jest.fn().mockReturnValue([]),
};
const mockWorkflows = { triggerForEntity: jest.fn() };
const mockLeadsStage = {
  validateStage: jest.fn().mockResolvedValue(undefined),
  recordStageChange: jest.fn().mockResolvedValue(undefined),
};
const mockEmail = {};

// ---------------------------------------------------------------------------
// Helper to build a test module
// ---------------------------------------------------------------------------

async function buildModule(): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      LeadsService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: LeadMetricsService, useValue: mockMetrics },
      { provide: LeadsStageService, useValue: mockLeadsStage },
      { provide: AuditService, useValue: mockAudit },
      { provide: BillingService, useValue: mockBilling },
      { provide: WorkflowsService, useValue: mockWorkflows },
      { provide: EmailService, useValue: mockEmail },
    ],
  }).compile();
}

// ---------------------------------------------------------------------------
// Tests — tenant isolation
// ---------------------------------------------------------------------------

describe('LeadsService — tenant isolation', () => {
  let service: LeadsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = (await buildModule()).get(LeadsService);
  });

  it('findAll always includes organizationId in the where clause', async () => {
    mockPrisma.lead.findMany.mockResolvedValueOnce([]);
    await service.findAll('user-1', 'CEO', 'org-1');

    expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1' }),
      }),
    );
  });

  it('findAll with SALES role restricts to assignedToId', async () => {
    mockPrisma.lead.findMany.mockResolvedValueOnce([]);
    await service.findAll('user-1', 'SALES', 'org-1');

    expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          assignedToId: 'user-1',
        }),
      }),
    );
  });

  it('findAll with BDM role includes team members in assignedToId filter', async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'member-1' }, { id: 'member-2' }]);
    mockPrisma.lead.findMany.mockResolvedValueOnce([]);
    await service.findAll('bdm-1', 'BDM', 'org-1');

    expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          assignedToId: { in: ['member-1', 'member-2', 'bdm-1'] },
        }),
      }),
    );
  });

  it('findAll with DESIGNER role restricts via teamMembers', async () => {
    mockPrisma.lead.findMany.mockResolvedValueOnce([]);
    await service.findAll('user-1', 'DESIGNER', 'org-1');

    expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          teamMembers: { some: { userId: 'user-1' } },
        }),
      }),
    );
  });

  it('remove uses scoped delete (org-scoped update)', async () => {
    mockPrisma.lead.findFirst.mockResolvedValueOnce({
      id: 'lead-1',
      company: 'ACME',
      contactName: 'Alice',
      expectedValue: 1000,
      organizationId: 'org-1',
    });
    mockPrisma.lead.update.mockResolvedValueOnce({ id: 'lead-1' });

    await service.remove('lead-1', 'user-1', 'org-1');

    expect(mockPrisma.lead.delete).not.toHaveBeenCalled();
    expect(mockPrisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-1', organizationId: 'org-1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('remove throws NotFoundException if lead belongs to a different org', async () => {
    mockPrisma.lead.findFirst.mockResolvedValueOnce(null);

    const { NotFoundException } = await import('@nestjs/common');
    await expect(service.remove('lead-1', 'user-1', 'org-2')).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.lead.delete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — create
// ---------------------------------------------------------------------------

describe('LeadsService — create', () => {
  let service: LeadsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = (await buildModule()).get(LeadsService);
  });

  it('throws BadRequestException when plan limit is reached', async () => {
    mockBilling.checkPlanLimit.mockResolvedValueOnce({ allowed: false, current: 10, limit: 10 });

    await expect(
      service.create({ organizationId: 'org-1', company: 'ACME' }),
    ).rejects.toThrow(BadRequestException);

    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
  });

  it('creates a lead and always includes organizationId in the data', async () => {
    const leadData = { organizationId: 'org-1', company: 'ACME', contactName: 'Alice' };
    const createdLead = {
      id: 'lead-new',
      ...leadData,
      stage: 'New',
      assignedTo: null,
      teamMembers: [],
      serviceType: null,
      client: null,
      reps: [],
    };
    mockPrisma.lead.create.mockResolvedValueOnce(createdLead);

    const result = await service.create(leadData, 'user-1');

    expect(mockPrisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'org-1' }),
      }),
    );
    expect(result.id).toBe('lead-new');
  });

  it('validates stage before creating when stage is provided', async () => {
    const leadData = { organizationId: 'org-1', company: 'ACME', stage: 'Qualified' };
    const createdLead = { id: 'lead-new', ...leadData, stage: 'Qualified', teamMembers: [], reps: [] };
    mockPrisma.lead.create.mockResolvedValueOnce(createdLead);

    await service.create(leadData, 'user-1');

    expect(mockLeadsStage.validateStage).toHaveBeenCalledWith('Qualified', 'org-1');
    expect(mockLeadsStage.recordStageChange).toHaveBeenCalledWith(
      'lead-new', null, 'Qualified', 'user-1', 'org-1',
    );
  });

  it('does not call validateStage when no stage provided', async () => {
    const leadData = { organizationId: 'org-1', company: 'ACME' };
    mockPrisma.lead.create.mockResolvedValueOnce({
      id: 'lead-new', ...leadData, stage: null, teamMembers: [], reps: [],
    });

    await service.create(leadData);

    expect(mockLeadsStage.validateStage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — findOne access control
// ---------------------------------------------------------------------------

describe('LeadsService — findOne access control', () => {
  let service: LeadsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = (await buildModule()).get(LeadsService);
  });

  const baseLead = {
    id: 'lead-1',
    company: 'ACME',
    contactName: 'Alice',
    expectedValue: 1000,
    organizationId: 'org-1',
    stage: 'New',
    createdAt: new Date(),
    assignedToId: 'user-1',
    teamMembers: [],
    stageHistory: [],
    reps: [],
  };

  it('includes organizationId in the findFirst where clause', async () => {
    mockPrisma.lead.findFirst.mockResolvedValueOnce(baseLead);
    await service.findOne('lead-1', 'user-1', 'CEO', 'org-1');

    expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'lead-1', organizationId: 'org-1' }),
      }),
    );
  });

  it('returns null when lead not found', async () => {
    mockPrisma.lead.findFirst.mockResolvedValueOnce(null);
    const result = await service.findOne('lead-x', 'user-1', 'CEO', 'org-1');
    expect(result).toBeNull();
  });

  it('SALES role can access their own assigned lead', async () => {
    mockPrisma.lead.findFirst.mockResolvedValueOnce({ ...baseLead, assignedToId: 'user-1' });
    const result = await service.findOne('lead-1', 'user-1', 'SALES', 'org-1');
    expect(result).toBeTruthy();
  });

  it('SALES role cannot access a lead assigned to someone else', async () => {
    mockPrisma.lead.findFirst.mockResolvedValueOnce({ ...baseLead, assignedToId: 'other-user' });
    await expect(service.findOne('lead-1', 'user-1', 'SALES', 'org-1')).rejects.toThrow();
  });
});
