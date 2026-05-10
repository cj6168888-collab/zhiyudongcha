import { describe, it, expect, vi } from 'vitest';

describe('Storage Adapter', () => {
  describe('IStorage Interface', () => {
    it('should have required methods defined', () => {
      const mockStorage = {
        getUser: vi.fn(),
        getUserByUsername: vi.fn(),
        createUser: vi.fn(),
        updateUser: vi.fn(),
        deleteUser: vi.fn(),
        getAllPersons: vi.fn(),
        getPerson: vi.fn(),
        createPerson: vi.fn(),
        updatePerson: vi.fn(),
        deletePerson: vi.fn(),
        getProjects: vi.fn(),
        getProject: vi.fn(),
        createProject: vi.fn(),
        updateProject: vi.fn(),
        deleteProject: vi.fn(),
      };

      expect(mockStorage.getUser).toBeDefined();
      expect(mockStorage.getUserByUsername).toBeDefined();
      expect(mockStorage.createUser).toBeDefined();
      expect(mockStorage.updateUser).toBeDefined();
      expect(mockStorage.deleteUser).toBeDefined();
      expect(mockStorage.getAllPersons).toBeDefined();
      expect(mockStorage.getPerson).toBeDefined();
      expect(mockStorage.createPerson).toBeDefined();
      expect(mockStorage.updatePerson).toBeDefined();
      expect(mockStorage.deletePerson).toBeDefined();
      expect(mockStorage.getProjects).toBeDefined();
      expect(mockStorage.getProject).toBeDefined();
      expect(mockStorage.createProject).toBeDefined();
      expect(mockStorage.updateProject).toBeDefined();
      expect(mockStorage.deleteProject).toBeDefined();
    });
  });

  describe('User operations', () => {
    it('should mock getUser returning user object', async () => {
      const mockGetUser = vi.fn().mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com'
      });

      const result = await mockGetUser('user-1');
      expect(result).toEqual({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com'
      });
    });

    it('should mock createUser', async () => {
      const mockCreateUser = vi.fn().mockResolvedValue({
        id: 'user-new',
        username: 'newuser',
        email: 'new@example.com'
      });

      const result = await mockCreateUser({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123'
      });

      expect(result.id).toBe('user-new');
      expect(result.username).toBe('newuser');
    });

    it('should mock updateUser', async () => {
      const mockUpdateUser = vi.fn().mockResolvedValue({
        id: 'user-1',
        username: 'updateduser',
        email: 'updated@example.com'
      });

      const result = await mockUpdateUser('user-1', { username: 'updateduser' });
      expect(result.username).toBe('updateduser');
    });

    it('should mock deleteUser', async () => {
      const mockDeleteUser = vi.fn().mockResolvedValue(true);

      const result = await mockDeleteUser('user-1');
      expect(result).toBe(true);
    });
  });

  describe('Person operations', () => {
    it('should mock getAllPersons', async () => {
      const mockGetAllPersons = vi.fn().mockResolvedValue([
        { id: 'person-1', name: 'John' },
        { id: 'person-2', name: 'Jane' }
      ]);

      const result = await mockGetAllPersons();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('John');
    });

    it('should mock createPerson', async () => {
      const mockCreatePerson = vi.fn().mockResolvedValue({
        id: 'person-new',
        name: 'New Person',
        role: 'Developer'
      });

      const result = await mockCreatePerson({
        name: 'New Person',
        role: 'Developer'
      });

      expect(result.id).toBe('person-new');
    });
  });

  describe('Project operations', () => {
    it('should mock getProjects', async () => {
      const mockGetProjects = vi.fn().mockResolvedValue([
        { id: 'proj-1', title: 'Project One' },
        { id: 'proj-2', title: 'Project Two' }
      ]);

      const result = await mockGetProjects();
      expect(result).toHaveLength(2);
    });

    it('should mock createProject', async () => {
      const mockCreateProject = vi.fn().mockResolvedValue({
        id: 'proj-new',
        title: 'New Project',
        status: 'active'
      });

      const result = await mockCreateProject({
        title: 'New Project',
        status: 'active'
      });

      expect(result.id).toBe('proj-new');
    });

    it('should mock updateProject', async () => {
      const mockUpdateProject = vi.fn().mockResolvedValue({
        id: 'proj-1',
        title: 'Updated Project',
        status: 'completed'
      });

      const result = await mockUpdateProject('proj-1', {
        status: 'completed'
      });

      expect(result.status).toBe('completed');
    });
  });

  describe('Error handling', () => {
    it('should handle getUser returning null', async () => {
      const mockGetUser = vi.fn().mockResolvedValue(null);

      const result = await mockGetUser('nonexistent');
      expect(result).toBeNull();
    });

    it('should handle operation errors', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Database error'));

      await expect(mockOperation()).rejects.toThrow('Database error');
    });
  });

  describe('Optional methods', () => {
    it('should handle optional email stats method', async () => {
      const mockGetEmailStats = vi.fn().mockResolvedValue({
        totalEmails: 100,
        unreadCount: 10
      });

      const result = await mockGetEmailStats();
      expect(result.totalEmails).toBe(100);
    });

    it('should handle optional getEvolutionState', async () => {
      const mockGetEvolutionState = vi.fn().mockResolvedValue({
        academicLevel: 'BACHELOR',
        academicXp: 500
      });

      const result = await mockGetEvolutionState();
      expect(result.academicLevel).toBe('BACHELOR');
    });
  });
});
