import { Test, TestingModule } from '@nestjs/testing';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockTeamsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  addMember: jest.fn(),
  removeMember: jest.fn(),
};

const mockUser = { id: 'user-1', organizationId: 'org-1', role: 'CEO' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TeamsController', () => {
  let controller: TeamsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamsController],
      providers: [{ provide: TeamsService, useValue: mockTeamsService }],
    }).compile();
    controller = module.get(TeamsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('passes organizationId from the current user to the service', async () => {
      mockTeamsService.findAll.mockResolvedValueOnce([]);
      await controller.findAll(mockUser);
      expect(mockTeamsService.findAll).toHaveBeenCalledWith('org-1');
    });

    it('returns the list from the service', async () => {
      const teams = [{ id: 't1', name: 'Alpha' }];
      mockTeamsService.findAll.mockResolvedValueOnce(teams);
      const result = await controller.findAll(mockUser);
      expect(result).toEqual(teams);
    });
  });

  describe('findOne', () => {
    it('passes id and organizationId to the service', async () => {
      const team = { id: 'team-1', name: 'Alpha' };
      mockTeamsService.findOne.mockResolvedValueOnce(team);
      const result = await controller.findOne('team-1', mockUser);
      expect(mockTeamsService.findOne).toHaveBeenCalledWith('team-1', 'org-1');
      expect(result).toEqual(team);
    });
  });

  describe('create', () => {
    it('passes the DTO and organizationId to the service', async () => {
      const dto = { name: 'Beta' };
      const created = { id: 'team-2', name: 'Beta', organizationId: 'org-1' };
      mockTeamsService.create.mockResolvedValueOnce(created);

      const result = await controller.create(dto as any, mockUser);
      expect(mockTeamsService.create).toHaveBeenCalledWith(dto, 'org-1');
      expect(result).toEqual(created);
    });
  });

  describe('update', () => {
    it('passes id, dto and organizationId to the service', async () => {
      const dto = { name: 'Updated' };
      const updated = { id: 'team-1', name: 'Updated' };
      mockTeamsService.update.mockResolvedValueOnce(updated);

      const result = await controller.update('team-1', dto as any, mockUser);
      expect(mockTeamsService.update).toHaveBeenCalledWith('team-1', dto, 'org-1');
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('passes id and organizationId to the service', async () => {
      mockTeamsService.remove.mockResolvedValueOnce({ id: 'team-1' });
      await controller.remove('team-1', mockUser);
      expect(mockTeamsService.remove).toHaveBeenCalledWith('team-1', 'org-1');
    });
  });

  describe('addMember', () => {
    it('passes teamId, userId and organizationId to the service', async () => {
      mockTeamsService.addMember.mockResolvedValueOnce({ id: 'user-2', teamId: 'team-1' });
      await controller.addMember('team-1', 'user-2', mockUser);
      expect(mockTeamsService.addMember).toHaveBeenCalledWith('team-1', 'user-2', 'org-1');
    });
  });

  describe('removeMember', () => {
    it('passes userId and organizationId to the service', async () => {
      mockTeamsService.removeMember.mockResolvedValueOnce({ id: 'user-2', teamId: null });
      await controller.removeMember('user-2', mockUser);
      expect(mockTeamsService.removeMember).toHaveBeenCalledWith('user-2', 'org-1');
    });
  });
});
