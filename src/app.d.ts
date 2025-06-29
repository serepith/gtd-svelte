// See https://svelte.dev/docs/kit/types#app.d.ts

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
	type Task = {
		id?: string;
		name: string;
		createdAt: Timestamp;
		updatedAt: Timestamp;
		completed: boolean;
		archived: boolean;
	};
	type Tag = {
		id?: string;
		name: string;
		createdAt: Timestamp;
		updatedAt: Timestamp;
	};
	type GraphNode = Task | Tag;
	interface Junction {
		parentId: string;
		childId: string;
		type: 'task-tag' | 'tag-task' | 'task-task' | 'tag-tag';
		createdAt: Timestamp;
	}
}

export {};
