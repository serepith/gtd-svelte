import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, type User } from 'firebase/auth';
import {
	// CACHE_SIZE_UNLIMITED,
	collection,
	CollectionReference,
	getFirestore,
	onSnapshot,
	// persistentLocalCache,
	// persistentMultipleTabManager,
	QueryDocumentSnapshot,
	Timestamp,
	type DocumentData,
	type Firestore,
	type FirestoreDataConverter,
	type SnapshotOptions
} from 'firebase/firestore';

// Globals
let firebase: {
	app: FirebaseApp | null;
	db: Firestore | null;
	auth: Auth | null;
	user: User | null;
} = $state({ app: null, db: null, auth: null, user: null });

let nodesCollection = $derived(
	firebase.user && firebase.db
		? collection(firebase.db, 'users', firebase.user?.uid, 'nodes')
		: null
);
let junctionsCollection = $derived(
	firebase.user && firebase.db
		? collection(firebase.db, 'users', firebase.user?.uid, 'junctions')
		: null
);

let collections = $state({ nodes: [] as GraphNode[], junctions: [] as Junction[] });

let unsubscribe = $state<null | (() => void)>(null);

// Getters for global state
const getNodesCollection = () => {
	if (nodesCollection) return nodesCollection;
	return null;
};

const getJunctionsCollection = () => {
  if (junctionsCollection) return junctionsCollection; 
  return null;
};

export { firebase, collections, getNodesCollection, getJunctionsCollection, 
  taskConverter, tagConverter, graphNodeConverter };

// pull config from environment variables
const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
	ignoreUndefinedProperties: true,
	// localCache: persistentLocalCache({
	// 	tabManager: persistentMultipleTabManager()
	// }),
	// persistence: true,
	// persistenceSettings: {
	// 	synchronizeTabs: true,
	// 	cacheSizeBytes: CACHE_SIZE_UNLIMITED
	// }
};

const taskConverter: FirestoreDataConverter<Task> = {
	toFirestore: (node: Task): DocumentData => {
		return {
			name: node.name,
			createdAt: node.createdAt,
			updatedAt: node.updatedAt,
			completed: node.completed,
			archived: node.archived,
      type: node.type
		};
	},
	fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Task => {
		const data = snapshot.data(options);
		console.log(data);
		return {
			id: snapshot.id,
			name: data.name,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt,
			completed: data.completed || false,
			archived: data.archived || false,
      type: data.type
		};
	}
};

const tagConverter: FirestoreDataConverter<Tag> = {
  toFirestore: (tag: Tag): DocumentData => {
    return {
      name: tag.name,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
      type: tag.type
    };
  },
  fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Tag => {
	const data = snapshot.data(options);
	return {
	  id: snapshot.id,
	  name: data.name,
	  createdAt: data.createdAt,
	  updatedAt: data.updatedAt,
    type: data.type
	} as Tag;  
}
}

// TODO implement this
const graphNodeConverter: FirestoreDataConverter<GraphNode> = {
  toFirestore: (tag: Tag): DocumentData => {
    return {
      name: tag.name,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
      type: tag.type
    };
  },
  fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Tag => {
	const data = snapshot.data(options);
	return {
	  id: snapshot.id,
	  name: data.name,
	  createdAt: data.createdAt,
	  updatedAt: data.updatedAt,
    type: data.type
	};
  }
}

export function initFirebase() {
	// Initialize Firebase, auth, analytics, etc.
	firebase.app = initializeApp(firebaseConfig);
	firebase.db = getFirestore(firebase.app);
	firebase.auth = getAuth(firebase.app);

	// Set up auth state listener
	if (firebase.auth) {
		firebase.auth.onAuthStateChanged((currentUser) => {
			// when auth state changes, set 'user' to reflect the new state
			firebase.user = currentUser;

			// run unsubscribe if it exists
			if (unsubscribe) {
				unsubscribe();
				unsubscribe = null;
			}

			// nodesCollection will update automatically when 'user' changes
			// all we need to do is set up a new listener
			if (nodesCollection) {
				unsubscribe = onSnapshot(
					nodesCollection.withConverter(taskConverter),
					(snapshot) => {
						collections.nodes = snapshot.docs.map((doc) => {
							return doc.data() as Task; // Adjust type as needed
						});
					},
					(error) => {
						console.error('Error fetching nodes:', error);
					}
				);
			}
		});

		console.log('Firebase Auth initialized');
		console.log('Current user:', firebase.user);
	} else {
		console.error('Firebase Auth not initialized');
		console.log(firebase, firebase.auth);
	}
}
