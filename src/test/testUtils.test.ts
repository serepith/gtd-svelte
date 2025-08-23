import { describe, it, expect, vi } from 'vitest';
import {
	createMockTask,
	createMockTag,
	createMockJunction,
	createMockQuerySnapshot,
	createMockUser,
	waitFor
} from './testUtils';

describe('Test Utilities', () => {
	describe('createMockTask', () => {
		it('creates a task with default values', () => {
			const task = createMockTask();

			expect(task).toMatchObject({
				id: 'mock-task-id',
				name: 'Mock Task',
				type: 'task',
				completed: false,
				archived: false
			});
			expect(task.createdAt).toBeDefined();
			expect(task.updatedAt).toBeDefined();
		});

		it('allows overriding default values', () => {
			const task = createMockTask({
				name: 'Custom Task',
				completed: true
			});

			expect(task.name).toBe('Custom Task');
			expect(task.completed).toBe(true);
			expect(task.archived).toBe(false); // unchanged
		});
	});

	describe('createMockTag', () => {
		it('creates a tag with default values', () => {
			const tag = createMockTag();

			expect(tag).toMatchObject({
				id: 'mock-tag-id',
				name: 'mock-tag',
				type: 'tag'
			});
			expect(tag.createdAt).toBeDefined();
			expect(tag.updatedAt).toBeDefined();
		});

		it('allows overriding default values', () => {
			const tag = createMockTag({
				name: 'custom-tag',
				id: 'custom-id'
			});

			expect(tag.name).toBe('custom-tag');
			expect(tag.id).toBe('custom-id');
		});
	});

	describe('createMockJunction', () => {
		it('creates a junction with default values', () => {
			const junction = createMockJunction();

			expect(junction).toMatchObject({
				id: 'mock-junction-id',
				parentId: 'parent-id',
				childId: 'child-id',
				parentType: 'tag',
				childType: 'task'
			});
			expect(junction.createdAt).toBeDefined();
		});

		it('allows overriding junction types', () => {
			const junction = createMockJunction({
				parentType: 'task',
				childType: 'tag',
				junctionType: {
					type: 'equivalency',
					details: { displayName: 'test' }
				}
			});

			expect(junction.parentType).toBe('task');
			expect(junction.childType).toBe('tag');
			expect(junction.junctionType?.type).toBe('equivalency');
		});
	});

	describe('createMockQuerySnapshot', () => {
		it('creates empty snapshot when no docs provided', () => {
			const snapshot = createMockQuerySnapshot();

			expect(snapshot.empty).toBe(true);
			expect(snapshot.docs).toHaveLength(0);
			expect(snapshot.size).toBe(0);
		});

		it('creates snapshot with provided docs', () => {
			const mockDocs = [
				{ id: 'doc1', name: 'First Doc' },
				{ id: 'doc2', name: 'Second Doc' }
			];
			const snapshot = createMockQuerySnapshot(mockDocs);

			expect(snapshot.empty).toBe(false);
			expect(snapshot.docs).toHaveLength(2);
			expect(snapshot.size).toBe(2);
			expect(snapshot.docs[0].data()).toEqual(mockDocs[0]);
		});
	});

	describe('createMockUser', () => {
		it('creates a user with default values', () => {
			const user = createMockUser();

			expect(user).toEqual({
				uid: 'mock-user-id',
				email: 'test@example.com',
				displayName: 'Test User'
			});
		});

		it('allows overriding user properties', () => {
			const user = createMockUser({
				uid: 'custom-uid',
				email: 'custom@example.com'
			});

			expect(user.uid).toBe('custom-uid');
			expect(user.email).toBe('custom@example.com');
			expect(user.displayName).toBe('Test User'); // unchanged
		});
	});

	describe('waitFor', () => {
		it('waits for specified time', async () => {
			const start = Date.now();
			await waitFor(50);
			const elapsed = Date.now() - start;

			// Allow some variance for timing
			expect(elapsed).toBeGreaterThanOrEqual(45);
		});

		it('waits for 0ms by default', async () => {
			const start = Date.now();
			await waitFor();
			const elapsed = Date.now() - start;

			expect(elapsed).toBeLessThan(10);
		});
	});
});
