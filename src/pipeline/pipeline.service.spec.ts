import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { PrismaService } from '../database/prisma.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  pipelineStage: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: null } }),
  },
  lead: {
    count: jest.fn().mockResolvedValue(0),
  },
  project: {
    count: jest.fn().mockResolvedValue(0),
  },
  $transaction: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PipelineService — getStages tenant isolation', () => {
  let service: PipelineService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(PipelineService);
  });

  it('findAll always filters stages by organizationId', async () => {
    mockPrisma.pipelineStage.findMany.mockResolvedValueOnce([]);
    await service.findAll('org-1');

    expect(mockPrisma.pipelineStage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1' }),
      }),
    );
  });

  it('findAll with type filter includes both organizationId and pipelineType', async () => {
    mockPrisma.pipelineStage.findMany.mockResolvedValueOnce([]);
    await service.findAll('org-1', 'project');

    expect(mockPrisma.pipelineStage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          pipelineType: 'project',
        }),
      }),
    );
  });

  it('findAll returns stages ordered by sortOrder ascending', async () => {
    mockPrisma.pipelineStage.findMany.mockResolvedValueOnce([]);
    await service.findAll('org-1');

    expect(mockPrisma.pipelineStage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { sortOrder: 'asc' },
      }),
    );
  });
});

describe('PipelineService — remove stage org-scoping', () => {
  let service: PipelineService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(PipelineService);
  });

  it('remove throws BadRequestException when stage belongs to a different org (findFirst returns null)', async () => {
    mockPrisma.pipelineStage.findFirst.mockResolvedValueOnce(null);

    await expect(service.remove('stage-x', 'org-other')).rejects.toThrow(BadRequestException);
    expect(mockPrisma.pipelineStage.delete).not.toHaveBeenCalled();
  });

  it('remove verifies stage belongs to same org before deleting', async () => {
    const stage = {
      id: 'stage-1',
      name: 'Prospecting',
      organizationId: 'org-1',
      isSystem: false,
      pipelineType: 'prospective_project',
    };
    mockPrisma.pipelineStage.findFirst.mockResolvedValueOnce(stage);
    mockPrisma.lead.count.mockResolvedValueOnce(0);
    mockPrisma.pipelineStage.delete.mockResolvedValueOnce(stage);

    await service.remove('stage-1', 'org-1');

    expect(mockPrisma.pipelineStage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'stage-1', organizationId: 'org-1' }),
      }),
    );
    expect(mockPrisma.pipelineStage.delete).toHaveBeenCalled();
  });

  it('remove throws BadRequestException when trying to delete a system stage', async () => {
    const stage = {
      id: 'stage-sys',
      name: 'Won',
      organizationId: 'org-1',
      isSystem: true,
      pipelineType: 'prospective_project',
    };
    mockPrisma.pipelineStage.findFirst.mockResolvedValueOnce(stage);

    await expect(service.remove('stage-sys', 'org-1')).rejects.toThrow(BadRequestException);
    expect(mockPrisma.pipelineStage.delete).not.toHaveBeenCalled();
  });

  it('remove throws BadRequestException when leads exist in the stage', async () => {
    const stage = {
      id: 'stage-1',
      name: 'Qualified',
      organizationId: 'org-1',
      isSystem: false,
      pipelineType: 'prospective_project',
    };
    mockPrisma.pipelineStage.findFirst.mockResolvedValueOnce(stage);
    mockPrisma.lead.count.mockResolvedValueOnce(3); // 3 leads in this stage

    await expect(service.remove('stage-1', 'org-1')).rejects.toThrow(BadRequestException);
    expect(mockPrisma.pipelineStage.delete).not.toHaveBeenCalled();
  });
});

describe('PipelineService — update stage org-scoping', () => {
  let service: PipelineService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(PipelineService);
  });

  it('update verifies stage belongs to same org before updating', async () => {
    const stage = {
      id: 'stage-1',
      name: 'Prospecting',
      organizationId: 'org-1',
      isSystem: false,
    };
    mockPrisma.pipelineStage.findFirst.mockResolvedValueOnce(stage);
    mockPrisma.pipelineStage.update.mockResolvedValueOnce({ ...stage, name: 'Outreach' });

    await service.update('stage-1', { name: 'Outreach' }, 'org-1');

    expect(mockPrisma.pipelineStage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'stage-1', organizationId: 'org-1' }),
      }),
    );
    expect(mockPrisma.pipelineStage.update).toHaveBeenCalled();
  });

  it('update throws BadRequestException when stage not found in org', async () => {
    mockPrisma.pipelineStage.findFirst.mockResolvedValueOnce(null);

    await expect(service.update('stage-x', { name: 'X' }, 'org-other')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockPrisma.pipelineStage.update).not.toHaveBeenCalled();
  });

  it('update throws BadRequestException when trying to modify a system stage', async () => {
    const stage = {
      id: 'stage-sys',
      name: 'Won',
      organizationId: 'org-1',
      isSystem: true,
    };
    mockPrisma.pipelineStage.findFirst.mockResolvedValueOnce(stage);

    await expect(service.update('stage-sys', { name: 'Closed' }, 'org-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockPrisma.pipelineStage.update).not.toHaveBeenCalled();
  });
});
