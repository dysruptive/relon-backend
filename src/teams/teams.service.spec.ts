import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { PrismaService } from '../database/prisma.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  team: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TeamsService — tenant isolation', () => {
  let service: TeamsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(TeamsService);
  });

  it('findAll always includes organizationId in the where clause', async () => {
    mockPrisma.team.findMany.mockResolvedValueOnce([]);
    await service.findAll('org-1');
    expect(mockPrisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1' }),
      }),
    );
  });

  it('findOne throws NotFoundException if team belongs to a different org', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(null);
    await expect(service.findOne('team-x', 'org-other')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('findOne returns team when org matches', async () => {
    const team = {
      id: 'team-1',
      name: 'Alpha',
      organizationId: 'org-1',
      manager: null,
      members: [],
    };
    mockPrisma.team.findFirst.mockResolvedValueOnce(team);
    const result = await service.findOne('team-1', 'org-1');
    expect(result).toEqual(team);
    expect(mockPrisma.team.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'team-1', organizationId: 'org-1' }),
      }),
    );
  });
});

describe('TeamsService — create', () => {
  let service: TeamsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(TeamsService);
  });

  it('creates a team with defaults when managerId is not provided', async () => {
    const created = { id: 'team-new', name: 'Delta', type: 'SALES', organizationId: 'org-1' };
    mockPrisma.team.create.mockResolvedValueOnce(created);

    const result = await service.create({ name: 'Delta' }, 'org-1');

    expect(result).toEqual(created);
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.team.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Delta', organizationId: 'org-1', type: 'SALES' }),
      }),
    );
  });

  it('throws NotFoundException when managerId refers to a user not in the org', async () => {
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.create({ name: 'Beta', managerId: 'user-x' }, 'org-1'),
    ).rejects.toThrow(NotFoundException);

    expect(mockPrisma.team.create).not.toHaveBeenCalled();
  });

  it('creates a team with a valid managerId scoped to org', async () => {
    const manager = { id: 'user-1', name: 'Alice', organizationId: 'org-1' };
    const created = { id: 'team-2', name: 'Beta', managerId: 'user-1', organizationId: 'org-1' };
    mockPrisma.user.findFirst.mockResolvedValueOnce(manager);
    mockPrisma.team.create.mockResolvedValueOnce(created);

    const result = await service.create({ name: 'Beta', managerId: 'user-1' }, 'org-1');
    expect(result).toEqual(created);
    // Manager lookup must be org-scoped
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'user-1', organizationId: 'org-1' }),
      }),
    );
  });
});

describe('TeamsService — remove', () => {
  let service: TeamsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(TeamsService);
  });

  it('throws BadRequestException when team has existing members', async () => {
    const team = { id: 'team-1', name: 'Alpha', organizationId: 'org-1', manager: null, members: [] };
    mockPrisma.team.findFirst.mockResolvedValueOnce(team);
    mockPrisma.user.count.mockResolvedValueOnce(3);

    await expect(service.remove('team-1', 'org-1')).rejects.toThrow(BadRequestException);
    expect(mockPrisma.team.delete).not.toHaveBeenCalled();
  });

  it('deletes team when member count is zero', async () => {
    const team = { id: 'team-1', name: 'Alpha', organizationId: 'org-1', manager: null, members: [] };
    mockPrisma.team.findFirst.mockResolvedValueOnce(team);
    mockPrisma.user.count.mockResolvedValueOnce(0);
    mockPrisma.team.delete.mockResolvedValueOnce(team);

    const result = await service.remove('team-1', 'org-1');
    expect(result).toEqual(team);
    expect(mockPrisma.team.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'team-1' } }),
    );
  });

  it('member count check is org-scoped', async () => {
    const team = { id: 'team-1', name: 'Alpha', organizationId: 'org-1', manager: null, members: [] };
    mockPrisma.team.findFirst.mockResolvedValueOnce(team);
    mockPrisma.user.count.mockResolvedValueOnce(0);
    mockPrisma.team.delete.mockResolvedValueOnce(team);

    await service.remove('team-1', 'org-1');

    expect(mockPrisma.user.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ teamId: 'team-1', organizationId: 'org-1' }),
      }),
    );
  });
});

describe('TeamsService — member management', () => {
  let service: TeamsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(TeamsService);
  });

  it('addMember throws NotFoundException when user not in org', async () => {
    const team = { id: 'team-1', organizationId: 'org-1', manager: null, members: [] };
    mockPrisma.team.findFirst.mockResolvedValueOnce(team);
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);

    await expect(service.addMember('team-1', 'user-x', 'org-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('addMember sets teamId on the user', async () => {
    const team = { id: 'team-1', organizationId: 'org-1', manager: null, members: [] };
    const user = { id: 'user-1', organizationId: 'org-1' };
    mockPrisma.team.findFirst.mockResolvedValueOnce(team);
    mockPrisma.user.findFirst.mockResolvedValueOnce(user);
    mockPrisma.user.update.mockResolvedValueOnce({ ...user, teamId: 'team-1' });

    await service.addMember('team-1', 'user-1', 'org-1');

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { teamId: 'team-1' },
      }),
    );
  });

  it('removeMember sets teamId to null', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' };
    mockPrisma.user.findFirst.mockResolvedValueOnce(user);
    mockPrisma.user.update.mockResolvedValueOnce({ ...user, teamId: null });

    await service.removeMember('user-1', 'org-1');

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { teamId: null },
      }),
    );
  });

  it('removeMember throws NotFoundException when user not in org', async () => {
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);
    await expect(service.removeMember('user-x', 'org-1')).rejects.toThrow(NotFoundException);
  });
});
