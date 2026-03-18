import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import { EmailService } from '../email/email.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  project: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  client: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  lead: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  projectStatusHistory: {
    create: jest.fn().mockResolvedValue(undefined),
  },
  costLog: {
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    findMany: jest.fn().mockResolvedValue([]),
  },
  projectAssignment: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
const mockBilling = {
  checkPlanLimit: jest.fn().mockResolvedValue({ allowed: true, current: 0, limit: 100 }),
};
const mockEmail = {};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function buildModule(): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      ProjectsService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: AuditService, useValue: mockAudit },
      { provide: BillingService, useValue: mockBilling },
      { provide: EmailService, useValue: mockEmail },
    ],
  }).compile();
}

// ---------------------------------------------------------------------------
// Tests — findAll tenant isolation
// ---------------------------------------------------------------------------

describe('ProjectsService — findAll tenant isolation', () => {
  let service: ProjectsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = (await buildModule()).get(ProjectsService);
  });

  it('findAll always includes organizationId in the where clause', async () => {
    mockPrisma.project.findMany.mockResolvedValueOnce([]);
    await service.findAll('user-1', 'CEO', 'org-1');

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1' }),
      }),
    );
  });

  it('findAll with SALES role restricts to projectManagerId', async () => {
    mockPrisma.project.findMany.mockResolvedValueOnce([]);
    await service.findAll('user-1', 'SALES', 'org-1');

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          projectManagerId: 'user-1',
        }),
      }),
    );
  });

  it('findAll with DESIGNER role restricts via assignments', async () => {
    mockPrisma.project.findMany.mockResolvedValueOnce([]);
    await service.findAll('user-1', 'DESIGNER', 'org-1');

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          assignments: { some: { userId: 'user-1' } },
        }),
      }),
    );
  });

  it('findAll with QS role restricts via assignments', async () => {
    mockPrisma.project.findMany.mockResolvedValueOnce([]);
    await service.findAll('user-1', 'QS', 'org-1');

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          assignments: { some: { userId: 'user-1' } },
        }),
      }),
    );
  });

  it('findAll with CEO role applies no extra filter beyond org', async () => {
    mockPrisma.project.findMany.mockResolvedValueOnce([]);
    await service.findAll('user-1', 'CEO', 'org-1');

    const callArg = mockPrisma.project.findMany.mock.calls[0][0];
    expect(callArg.where).not.toHaveProperty('projectManagerId');
    expect(callArg.where).not.toHaveProperty('assignments');
  });
});

// ---------------------------------------------------------------------------
// Tests — create
// ---------------------------------------------------------------------------

describe('ProjectsService — create', () => {
  let service: ProjectsService;

  const baseDto = {
    name: 'Alpha Build',
    clientId: 'client-1',
    status: 'ACTIVE',
    contractedValue: 50000,
  };

  const mockProject = {
    id: 'proj-new',
    ...baseDto,
    organizationId: 'org-1',
    leadId: null,
    client: { id: 'client-1', name: 'ACME' },
    lead: null,
    projectManager: null,
    assignments: [],
    statusHistory: [],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    service = (await buildModule()).get(ProjectsService);
  });

  it('throws BadRequestException when plan limit is reached', async () => {
    mockBilling.checkPlanLimit.mockResolvedValueOnce({ allowed: false, current: 5, limit: 5 });

    await expect(service.create(baseDto as any, 'user-1', 'org-1')).rejects.toThrow(BadRequestException);
    expect(mockPrisma.project.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when client does not belong to the org', async () => {
    mockPrisma.client.findFirst.mockResolvedValueOnce(null);

    await expect(service.create(baseDto as any, 'user-1', 'org-1')).rejects.toThrow(NotFoundException);
    expect(mockPrisma.project.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when leadId is provided but lead not found in org', async () => {
    mockPrisma.client.findFirst.mockResolvedValueOnce({ id: 'client-1', name: 'ACME' });
    mockPrisma.lead.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.create({ ...baseDto, leadId: 'lead-x' } as any, 'user-1', 'org-1'),
    ).rejects.toThrow(NotFoundException);
    expect(mockPrisma.project.create).not.toHaveBeenCalled();
  });

  it('creates project with organizationId and calls audit log', async () => {
    mockPrisma.client.findFirst.mockResolvedValueOnce({ id: 'client-1', name: 'ACME' });
    mockPrisma.project.create.mockResolvedValueOnce(mockProject);
    mockPrisma.project.findMany.mockResolvedValueOnce([mockProject]);
    mockPrisma.client.update.mockResolvedValueOnce({});

    const result = await service.create(baseDto as any, 'user-1', 'org-1');

    expect(mockPrisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'org-1' }),
      }),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE_PROJECT', organizationId: 'org-1' }),
    );
    expect(result.id).toBe('proj-new');
  });
});

// ---------------------------------------------------------------------------
// Tests — remove (soft-delete)
// ---------------------------------------------------------------------------

describe('ProjectsService — remove (soft-delete)', () => {
  let service: ProjectsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = (await buildModule()).get(ProjectsService);
  });

  it('remove soft-deletes via update with deletedAt — never calls prisma.project.delete()', async () => {
    const project = {
      id: 'proj-1',
      name: 'Alpha Build',
      clientId: 'client-1',
      organizationId: 'org-1',
      contractedValue: 50000,
      client: { name: 'ACME' },
    };
    mockPrisma.project.findFirst.mockResolvedValueOnce(project);
    mockPrisma.project.update.mockResolvedValueOnce({ ...project, deletedAt: new Date() });
    mockPrisma.project.findMany.mockResolvedValueOnce([]);
    mockPrisma.client.update.mockResolvedValueOnce({});

    await service.remove('proj-1', 'user-1', 'org-1');

    expect((mockPrisma.project as any).delete).toBeUndefined();
    expect(mockPrisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('remove is org-scoped — uses { id, organizationId } in both findFirst and update', async () => {
    const project = {
      id: 'proj-1',
      name: 'Alpha Build',
      clientId: 'client-1',
      organizationId: 'org-1',
      contractedValue: 50000,
      client: { name: 'ACME' },
    };
    mockPrisma.project.findFirst.mockResolvedValueOnce(project);
    mockPrisma.project.update.mockResolvedValueOnce({ ...project, deletedAt: new Date() });
    mockPrisma.project.findMany.mockResolvedValueOnce([]);
    mockPrisma.client.update.mockResolvedValueOnce({});

    await service.remove('proj-1', 'user-1', 'org-1');

    expect(mockPrisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'proj-1', organizationId: 'org-1' }),
      }),
    );
    expect(mockPrisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'proj-1', organizationId: 'org-1' }),
      }),
    );
  });

  it('remove throws NotFoundException when project belongs to a different org', async () => {
    mockPrisma.project.findFirst.mockResolvedValueOnce(null);

    await expect(service.remove('proj-1', 'user-1', 'org-other')).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.project.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — findOne cross-org isolation
// ---------------------------------------------------------------------------

describe('ProjectsService — findOne cross-org isolation', () => {
  let service: ProjectsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = (await buildModule()).get(ProjectsService);
  });

  it('findOne throws NotFoundException when project belongs to a different org', async () => {
    mockPrisma.project.findFirst.mockResolvedValueOnce(null);

    await expect(service.findOne('proj-1', 'org-other')).rejects.toThrow(NotFoundException);
  });

  it('findOne includes organizationId in the where clause', async () => {
    const project = {
      id: 'proj-1',
      name: 'Alpha',
      organizationId: 'org-1',
      client: {},
      lead: null,
      projectManager: null,
      assignments: [],
      costLogs: [],
      statusHistory: [],
    };
    mockPrisma.project.findFirst.mockResolvedValueOnce(project);

    await service.findOne('proj-1', 'org-1');

    expect(mockPrisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'proj-1', organizationId: 'org-1' }),
      }),
    );
  });
});
