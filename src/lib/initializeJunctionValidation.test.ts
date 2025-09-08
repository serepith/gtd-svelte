import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
	testJunctionValidation, 
	getJunctionStatus, 
	validateJunctions,
	junctionValidationHelp
} from './initializeJunctionValidation';

// Mock the database functions
vi.mock('./database', () => ({
	getAllJunctions: vi.fn(),
	getAllNodes: vi.fn()
}));

// Mock the junction validator
vi.mock('./junctionValidator', () => ({
	validateAllJunctions: vi.fn(),
	runJunctionHealthCheck: vi.fn()
}));

// Mock console methods
const consoleMethods = {
	log: vi.fn(),
	error: vi.fn(),
	group: vi.fn(),
	groupEnd: vi.fn()
};

Object.assign(console, consoleMethods);

describe('Junction Validation Browser Functions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('testJunctionValidation', () => {
		it('should test junction validation successfully', async () => {
			const { getAllJunctions, getAllNodes } = await import('./database');
			
			vi.mocked(getAllJunctions).mockResolvedValue([
				{
					id: 'junction-1',
					parentId: 'tag-1',
					childId: 'task-1',
					parentType: 'tag',
					childType: 'task',
					createdAt: { toDate: () => new Date() } as any
				}
			]);
			
			vi.mocked(getAllNodes).mockResolvedValue([
				{
					id: 'tag-1',
					name: 'Test Tag',
					type: 'tag',
					createdAt: { toDate: () => new Date() } as any,
					updatedAt: { toDate: () => new Date() } as any
				} as Tag,
				{
					id: 'task-1',
					name: 'Test Task',
					type: 'task',
					createdAt: { toDate: () => new Date() } as any,
					updatedAt: { toDate: () => new Date() } as any,
					completed: false,
					archived: false
				} as Task
			]);

			await testJunctionValidation();

			expect(consoleMethods.log).toHaveBeenCalledWith('🧪 Testing junction validation...');
			expect(consoleMethods.log).toHaveBeenCalledWith('✅ Junction validation works!', expect.any(Object));
		});

		it('should handle errors gracefully', async () => {
			const { getAllJunctions } = await import('./database');
			vi.mocked(getAllJunctions).mockRejectedValue(new Error('Database error'));

			await expect(testJunctionValidation()).rejects.toThrow('Database error');
			expect(consoleMethods.error).toHaveBeenCalled();
		});
	});

	describe('getJunctionStatus', () => {
		it('should display junction statistics', async () => {
			const { getAllJunctions, getAllNodes } = await import('./database');
			
			vi.mocked(getAllJunctions).mockResolvedValue([
				{
					id: 'junction-1',
					parentId: 'tag-1',
					childId: 'task-1',
					parentType: 'tag',
					childType: 'task',
					createdAt: { toDate: () => new Date() } as any
				},
				{
					id: 'junction-2',
					parentId: 'tag-1',
					childId: 'tag-2',
					parentType: 'tag',
					childType: 'tag',
					createdAt: { toDate: () => new Date() } as any,
					junctionType: {
						type: 'equivalency',
						details: { displayName: 'Test', useOriginalName: false }
					}
				}
			]);
			
			vi.mocked(getAllNodes).mockResolvedValue([]);

			await getJunctionStatus();

			expect(consoleMethods.log).toHaveBeenCalledWith('📊 Checking junction status...');
			expect(consoleMethods.log).toHaveBeenCalledWith('📈 Junction Status:', expect.objectContaining({
				totalJunctions: 2,
				totalNodes: 0,
				withJunctionType: 1,
				equivalencyJunctions: 1,
				byRelationType: expect.objectContaining({
					'tag->task': 1,
					'tag->tag': 1
				})
			}));
		});
	});

	describe('validateJunctions', () => {
		it('should run validation and display results', async () => {
			const { validateAllJunctions } = await import('./junctionValidator');
			
			vi.mocked(validateAllJunctions).mockResolvedValue({
				isValid: true,
				errors: [],
				warnings: [],
				statistics: {
					totalJunctions: 5,
					byParentType: { tag: 5 },
					byChildType: { task: 3, tag: 2 },
					byRelationType: { 'tag->task': 3, 'tag->tag': 2 },
					withJunctionType: 2,
					equivalencyJunctions: 2,
					healthScore: 95
				}
			});

			await validateJunctions();

			expect(consoleMethods.log).toHaveBeenCalledWith('🔍 Running comprehensive junction validation...');
			expect(consoleMethods.log).toHaveBeenCalledWith('📋 Validation Summary:');
			expect(consoleMethods.log).toHaveBeenCalledWith('  Valid: ✅ YES');
			expect(consoleMethods.log).toHaveBeenCalledWith('  Health Score: 95/100');
		});

		it('should display errors and warnings when present', async () => {
			const { validateAllJunctions } = await import('./junctionValidator');
			
			vi.mocked(validateAllJunctions).mockResolvedValue({
				isValid: false,
				errors: [
					{
						type: 'missing_field',
						junctionId: 'junction-1',
						message: 'Missing parentId'
					}
				],
				warnings: [
					{
						type: 'duplicate_junction',
						junctionId: 'junction-2',
						message: 'Duplicate relationship found'
					}
				],
				statistics: {
					totalJunctions: 2,
					byParentType: {},
					byChildType: {},
					byRelationType: {},
					withJunctionType: 0,
					equivalencyJunctions: 0,
					healthScore: 60
				}
			});

			await validateJunctions();

			expect(consoleMethods.group).toHaveBeenCalledWith('❌ Errors:');
			expect(consoleMethods.group).toHaveBeenCalledWith('⚠️ Warnings:');
			expect(consoleMethods.log).toHaveBeenCalledWith('  Valid: ❌ NO');
			expect(consoleMethods.log).toHaveBeenCalledWith('  Health Score: 60/100');
		});
	});

	describe('junctionValidationHelp', () => {
		it('should display help information', () => {
			junctionValidationHelp();

			expect(consoleMethods.log).toHaveBeenCalledWith('🆘 Junction Validation Help:');
			expect(consoleMethods.log).toHaveBeenCalledWith('Available Commands:');
			expect(consoleMethods.log).toHaveBeenCalledWith('What each validation checks:');
			expect(consoleMethods.log).toHaveBeenCalledWith('Health Score (0-100):');
		});
	});

	describe('Browser Integration', () => {
		it('should have browser console functions available', () => {
			// Test that the functions exist and are callable
			expect(typeof testJunctionValidation).toBe('function');
			expect(typeof getJunctionStatus).toBe('function');
			expect(typeof validateJunctions).toBe('function');
			expect(typeof junctionValidationHelp).toBe('function');
		});
	});
});