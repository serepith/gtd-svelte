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
		completed: boolean = false;
		archived: boolean = false;
	}
	type Tag = {
		id?: string;
		name: string;
		createdAt: Timestamp;
		updatedAt: Timestamp;
	}
	type GraphNode = Task | Tag;
	interface Junction {
		parentId: string;
		childId: string;
		createdAt: Timestamp;
	}
}


export {};
