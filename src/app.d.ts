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
		type: 'task';
		createdAt: Timestamp;
		updatedAt: Timestamp;
		completed: boolean;
		archived: boolean;
	};
	type Tag = {
		id?: string;
		name: string;
		type: 'tag';
		createdAt: Timestamp;
		updatedAt: Timestamp;
	};
	type GraphNode = Task | Tag;
	type Junction = {
		parentId: string;
		childId: string;
		parentType: 'task' | 'tag';
		childType: 'task' | 'tag';
		createdAt: Timestamp;
	};
}

export {};
