import {
	PUBLIC_FIREBASE_API_KEY,
	PUBLIC_FIREBASE_APP_ID,
	PUBLIC_FIREBASE_AUTH_DOMAIN,
	PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	PUBLIC_FIREBASE_PROJECT_ID,
	PUBLIC_FIREBASE_STORAGE_BUCKET
} from '$env/static/public';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth, type User } from 'firebase/auth';
import firebase from 'firebase/compat/app';
import {
	CACHE_SIZE_UNLIMITED,
	// CACHE_SIZE_UNLIMITED,
	collection,
	connectFirestoreEmulator,
	getDocsFromCache,
	getFirestore,
	onSnapshot,
	persistentLocalCache,
	persistentMultipleTabManager,
	query,
	// persistentLocalCache,
	// persistentMultipleTabManager,
	QueryDocumentSnapshot,
	where,
	type DocumentData,
	type Firestore,
	type FirestoreDataConverter,
	type SnapshotOptions
} from 'firebase/firestore';
import { getAllNodes } from './database';

export class DataManager {
	firebaseConfig = {
		apiKey: PUBLIC_FIREBASE_API_KEY,
		authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
		projectId: PUBLIC_FIREBASE_PROJECT_ID,
		storageBucket: PUBLIC_FIREBASE_STORAGE_BUCKET,
		messagingSenderId: PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
		appId: PUBLIC_FIREBASE_APP_ID,
		ignoreUndefinedProperties: true,
		localCache: persistentLocalCache({
			tabManager: persistentMultipleTabManager()
		}),
		persistence: true,
		persistenceSettings: {
			synchronizeTabs: true,
			cacheSizeBytes: CACHE_SIZE_UNLIMITED
		}
	};

	app: FirebaseApp | null = $state(null);
	db: Firestore | null = $state(null);
	auth: Auth | null = $state(null);
	user: User | null = $state(null);

	nodesCollection = $derived(
		this.user?.uid && this.db ? collection(this.db, 'users', this.user?.uid, 'nodes') : null
	);
	junctionsCollection = $derived(
		this.user && this.db ? collection(this.db, 'users', this.user?.uid, 'junctions') : null
	);

	nodes: GraphNode[] = $state([]);
	junctions: Junction[] = $state([]);

	// tasks = $derived.by(async () => {
	// 	if(this.nodesCollection) {
	// 		console.log("NODES COLLECTION HAVE ***");
	// 		const q = query(this.nodesCollection, where('type', '==', 'task')).withConverter(taskConverter);
	// 		const querySnapshot = await getDocsFromCache(q);
	// 		return querySnapshot.docs.map((doc) => doc.data()).sort((a,b) => a.createdAt - b.createdAt);
	// 	}
	// 	else [];
	// });

	tasks = $derived(this.nodes.filter((node) => node.type === 'task'));

	// constructor() {
	//   this.initFirebase();
	// }

	initFirebase() {
		console.log('Initializing Firebase...');

		if (firebase.apps.length === 0) {
			// Initialize Firebase, auth, analytics, etc.
			this.app = initializeApp(this.firebaseConfig);
			this.db = getFirestore(this.app);
			this.auth = getAuth(this.app);
		} else {
			this.app = firebase.app();
			this.db = getFirestore(this.app);
			this.auth = getAuth(this.app);
		}

		if (location.hostname === 'localhost' || location.hostname.includes('192.168')) {
			const emulatorHost = location.hostname;

			connectAuthEmulator(this.auth, `http://${emulatorHost}:9099`);
			connectFirestoreEmulator(this.db, emulatorHost, 8080);
		}

		console.log('Firebase initialized:', this.app.name);

		// Set up auth state listener
		if (this.auth) {
			this.auth.onAuthStateChanged((currentUser) => {
				// when auth state changes, set 'user' to reflect the new state
				this.user = currentUser;

				// run unsubscribe if it exists
				if (unsubscribe) {
					unsubscribe();
					unsubscribe = null;
				}

				// nodesCollection will update automatically when 'user' changes
				// all we need to do is set up a new listener
				if (this.nodesCollection) {
					unsubscribe = onSnapshot(
						this.nodesCollection.withConverter(taskConverter),
						(snapshot) => {
							this.nodes = snapshot.docs.map((doc) => {
								//console.log("LISTENER FIRED ON " + doc.data().name);
								return doc.data() as Task; // Adjust type as needed
							});
							console.log('this.nodes: ' + this.nodes);
						},
						(error) => {
							console.error('Error fetching nodes:', error);
						}
					);
				}

				if (this.junctionsCollection) {
					unsubscribe = onSnapshot(
						this.junctionsCollection.withConverter(junctionConverter),
						(snapshot) => {
							this.junctions = snapshot.docs.map((doc) => {
								return doc.data() as Junction;
							});
						},
						(error) => {
							console.error('Error fetching junctions:', error);
						}
					);
				}
			});

			console.log('Firebase Auth initialized');
			console.log('Current user:', this.user);

			// TODO clean this shit up
			getAllNodes().then((n) => (this.nodes = n));
		} else {
			console.error('Firebase Auth not initialized');
			console.log(this.auth);
		}
	}
}

export const data = new DataManager();

// if(firebase.apps.length === 0)

// Globals
// let firebase: {
// 	app: FirebaseApp | null;
// 	db: Firestore | null;
// 	auth: Auth | null;
// 	user: User | null;
// } = $state({ app: null, db: null, auth: null, user: null });

// UI State
let uiState = $state({
	sidebarVisible: false,
	transitioningToTasks: false
});

// let nodesCollection = $derived(
// 	firebase.user && firebase.db
// 		? collection(firebase.db, 'users', firebase.user?.uid, 'nodes')
// 		: null
// );

// let junctionsCollection = $derived(
// 	firebase.user && firebase.db
// 		? collection(firebase.db, 'users', firebase.user?.uid, 'junctions')
// 		: null
// );

//const collections = $state({ nodes: [] as GraphNode[], junctions: [] as Junction[] });

let unsubscribe = $state<null | (() => void)>(null);

// Getters for global state
// const getNodesCollection = () => {
// 	if (nodesCollection) return nodesCollection;
// 	return null;
// };

// const getJunctionsCollection = () => {
// 	if (junctionsCollection) return junctionsCollection;
// 	return null;
// };

export {
	// collections,
	// firebase,
	uiState,
	// nodesCollection,
	// junctionsCollection,
	// getJunctionsCollection,
	// getNodesCollection,
	graphNodeConverter,
	tagConverter,
	taskConverter
};

// pull config from environment variables
const firebaseConfig = {
	apiKey: PUBLIC_FIREBASE_API_KEY,
	authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: PUBLIC_FIREBASE_PROJECT_ID,
	storageBucket: PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: PUBLIC_FIREBASE_APP_ID,
	ignoreUndefinedProperties: true,
	localCache: persistentLocalCache({
		tabManager: persistentMultipleTabManager()
	}),
	persistence: true,
	persistenceSettings: {
		synchronizeTabs: true,
		cacheSizeBytes: CACHE_SIZE_UNLIMITED
	}
};

const taskConverter: FirestoreDataConverter<Task> = {
	toFirestore: (node: Task): DocumentData => {
		const doc: DocumentData = {
			name: node.name,
			createdAt: node.createdAt,
			updatedAt: node.updatedAt,
			completed: node.completed,
			archived: node.archived,
			type: node.type
		};

		if (node.embedding) {
			doc.embedding = node.embedding;
		}
		if (node.embeddingModelVersion) {
			doc.embeddingModelVersion = node.embeddingModelVersion;
		}

		return doc;
	},
	fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Task => {
		const data = snapshot.data(options);
		// console.log('🔄 Loading task from Firestore:', {
		// 	name: data.name,
		// 	hasEmbedding: !!data.embedding,
		// 	embeddingLength: data.embedding?.length,
		// 	embeddingType: typeof data.embedding,
		// 	hasModelVersion: !!data.embeddingModelVersion,
		// 	modelVersion: data.embeddingModelVersion
		// });
		return {
			id: snapshot.id,
			name: data.name,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt,
			completed: data.completed || false,
			archived: data.archived || false,
			type: data.type,
			embedding: data.embedding,
			embeddingModelVersion: data.embeddingModelVersion
		};
	}
};

const tagConverter: FirestoreDataConverter<Tag> = {
	toFirestore: (tag: Tag): DocumentData => {
		const doc: DocumentData = {
			name: tag.name,
			createdAt: tag.createdAt,
			updatedAt: tag.updatedAt,
			type: tag.type
		};

		if (tag.embedding) {
			doc.embedding = tag.embedding;
		}
		if (tag.embeddingModelVersion) {
			doc.embeddingModelVersion = tag.embeddingModelVersion;
		}

		return doc;
	},
	fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Tag => {
		const data = snapshot.data(options);
		// console.log('🔄 Loading tag from Firestore:', {
		// 	name: data.name,
		// 	hasEmbedding: !!data.embedding,
		// 	embeddingLength: data.embedding?.length,
		// 	embeddingType: typeof data.embedding,
		// 	hasModelVersion: !!data.embeddingModelVersion,
		// 	modelVersion: data.embeddingModelVersion
		// });
		return {
			id: snapshot.id,
			name: data.name,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt,
			type: data.type,
			embedding: data.embedding,
			embeddingModelVersion: data.embeddingModelVersion
		} as Tag;
	}
};

const junctionConverter: FirestoreDataConverter<Junction> = {
	toFirestore: (junction: Junction): DocumentData => {
		const data: DocumentData = {
			parentId: junction.parentId,
			childId: junction.childId,
			parentType: junction.parentType,
			childType: junction.childType,
			createdAt: junction.createdAt
		};
		if (junction.junctionType) {
			data.junctionType = junction.junctionType;
		}
		return data;
	},
	fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Junction => {
		const data = snapshot.data(options);
		const junction: Junction = {
			id: snapshot.id,
			parentId: data.parentId,
			childId: data.childId,
			parentType: data.parentType,
			childType: data.childType,
			createdAt: data.createdAt
		};
		if (data.junctionType) {
			junction.junctionType = data.junctionType;
		}
		return junction;
	}
};

// TODO implement this
const graphNodeConverter: FirestoreDataConverter<GraphNode> = {
	toFirestore: (node: GraphNode): DocumentData => {
		const doc: DocumentData = {
			name: node.name,
			createdAt: node.createdAt,
			updatedAt: node.updatedAt,
			type: node.type
		};
		
		// Add task-specific fields if it's a task
		if (node.type === 'task') {
			const task = node as Task;
			doc.completed = task.completed;
			doc.archived = task.archived;
		}
		
		// Add embedding fields if present
		if (node.embedding) {
			doc.embedding = node.embedding;
		}
		if (node.embeddingModelVersion) {
			doc.embeddingModelVersion = node.embeddingModelVersion;
		}
		
		return doc;
	},
	fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): GraphNode => {
		const data = snapshot.data(options);
		console.log('🔄 Loading GraphNode from Firestore:', {
			name: data.name,
			type: data.type,
			hasEmbedding: !!data.embedding,
			embeddingLength: data.embedding?.length,
			embeddingType: typeof data.embedding,
			hasModelVersion: !!data.embeddingModelVersion,
			modelVersion: data.embeddingModelVersion
		});
		
		// Create base node structure
		const baseNode = {
			id: snapshot.id,
			name: data.name,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt,
			type: data.type,
			embedding: data.embedding,
			embeddingModelVersion: data.embeddingModelVersion
		};
		
		// Return appropriate type based on node type
		if (data.type === 'task') {
			return {
				...baseNode,
				type: 'task',
				completed: data.completed || false,
				archived: data.archived || false
			} as Task;
		} else {
			return {
				...baseNode,
				type: 'tag'
			} as Tag;
		}
	}
};

// export function initFirebase() {
// 	console.log('Initializing Firebase...');

// 	// Initialize Firebase, auth, analytics, etc.
// 	firebase.app = initializeApp(firebaseConfig);
// 	firebase.db = getFirestore(firebase.app);
// 	firebase.auth = getAuth(firebase.app);

// 	if (location.hostname === 'localhost' || location.hostname.includes('192.168')) {
// 		const emulatorHost = location.hostname;

// 		connectAuthEmulator(firebase.auth, `http://${emulatorHost}:9099`);
// 		connectFirestoreEmulator(firebase.db, emulatorHost, 8080);
// 	}

// 	console.log('Firebase initialized:', firebase.app.name);

// 	// Set up auth state listener
// 	if (firebase.auth) {
// 		firebase.auth.onAuthStateChanged((currentUser) => {
// 			// when auth state changes, set 'user' to reflect the new state
// 			firebase.user = currentUser;

// 			// run unsubscribe if it exists
// 			if (unsubscribe) {
// 				unsubscribe();
// 				unsubscribe = null;
// 			}

// 			// nodesCollection will update automatically when 'user' changes
// 			// all we need to do is set up a new listener
// 			if (nodesCollection) {
// 				unsubscribe = onSnapshot(
// 					nodesCollection.withConverter(taskConverter),
// 					(snapshot) => {
// 						collections.nodes = snapshot.docs.map((doc) => {
// 							return doc.data() as Task; // Adjust type as needed
// 						});
// 					},
// 					(error) => {
// 						console.error('Error fetching nodes:', error);
// 					}
// 				);
// 			}

// 			if (junctionsCollection) {
// 				unsubscribe = onSnapshot(
// 					junctionsCollection.withConverter(junctionConverter),
// 					(snapshot) => {
// 						collections.junctions = snapshot.docs.map((doc) => {
// 							return doc.data() as Junction;
// 						});
// 					},
// 					(error) => {
// 						console.error('Error fetching junctions:', error);
// 					}
// 				);
// 			}
// 		});

// 		console.log('Firebase Auth initialized');
// 		console.log('Current user:', firebase.user);
// 	} else {
// 		console.error('Firebase Auth not initialized');
// 		console.log(firebase, firebase.auth);
// 	}
// }
