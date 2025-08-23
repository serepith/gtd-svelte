import { Timestamp } from 'firebase/firestore';
import { vi } from 'vitest';

/**
 * Utility functions for testing
 */

export function createMockTask(overrides: Partial<Task> = {}): Task {
	return {
		id: 'mock-task-id',
		name: 'Mock Task',
		type: 'task',
		createdAt: Timestamp.fromMillis(Date.now()),
		updatedAt: Timestamp.fromMillis(Date.now()),
		completed: false,
		archived: false,
		...overrides
	};
}

export function createMockTag(overrides: Partial<Tag> = {}): Tag {
	return {
		id: 'mock-tag-id',
		name: 'mock-tag',
		type: 'tag',
		createdAt: Timestamp.fromMillis(Date.now()),
		updatedAt: Timestamp.fromMillis(Date.now()),
		...overrides
	};
}

export function createMockJunction(overrides: Partial<Junction> = {}): Junction {
	return {
		id: 'mock-junction-id',
		parentId: 'parent-id',
		childId: 'child-id',
		parentType: 'tag',
		childType: 'task',
		createdAt: Timestamp.fromMillis(Date.now()),
		...overrides
	};
}

/**
 * Mock Firebase Firestore collection reference
 */
export function createMockCollectionRef() {
	return {
		withConverter: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		add: vi.fn(),
		doc: vi.fn()
	};
}

/**
 * Mock Firebase Firestore query snapshot
 */
export function createMockQuerySnapshot(docs: any[] = []) {
	return {
		empty: docs.length === 0,
		docs: docs.map((data) => ({
			id: data.id || 'mock-id',
			data: () => data,
			ref: { id: data.id || 'mock-id' }
		})),
		size: docs.length
	};
}

/**
 * Create a mock user for Firebase Auth
 */
export function createMockUser(overrides: any = {}) {
	return {
		uid: 'mock-user-id',
		email: 'test@example.com',
		displayName: 'Test User',
		...overrides
	};
}

/**
 * Wait for async operations to complete in tests
 */
export function waitFor(ms: number = 0): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
