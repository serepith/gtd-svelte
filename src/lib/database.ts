import {
	getJunctionsCollection,
	getNodesCollection,
	graphNodeConverter,
	tagConverter,
	taskConverter
} from '$lib/globalState.svelte';
import {
	addDoc,
	doc,
	DocumentReference,
	getDocs,
	getDocsFromCache,
	query,
	Timestamp,
	updateDoc,
	where
} from 'firebase/firestore';

export async function addTask(
	chunks: {
		content: string;
		type: () => 'text' | 'tag';
	}[]
) {
	let task = '' as string;
	let tags = [] as string[];

	for (const chunk of chunks) {
		console.log(chunk.type, chunk.content);
		if (chunk.type() === 'tag') {
			// if(chunk.type === 'tag') {
			//   task += chunk.content;
			// }
			tags.push(chunk.content.substring(1)); // Remove the leading '#' or '/'
			console.log('Found tag:', chunk.content);
		} else if (chunk.type() === 'text') {
			task += chunk.content;
		}
	}

	console.log('Adding task:', chunks, 'with tags:', tags);

	const nodes = getNodesCollection();
	const junctions = getJunctionsCollection();

	if (nodes && junctions) {
		const taskRef = await addDoc(nodes, {
			name: task,
			createdAt: Timestamp.now(),
			updatedAt: Timestamp.now(),
			completed: false,
			archived: false,
			type: 'task'
		});
		console.log('Task added to collection:', task, taskRef.id);

		for (const tag of tags) {
			const q = query(nodes, where('name', '==', tag));
			const querySnapshot = await getDocs(q);
			let tagRef = null as DocumentReference<Tag> | null;

			// there should NOT be more than one tag with the same name
			// but there might be no tag at all
			if (querySnapshot.empty) {
				// If no tag exists, create a new tag
				tagRef = (await addDoc(nodes, {
					name: tag,
					createdAt: Timestamp.now(),
					updatedAt: Timestamp.now(),
					type: 'tag'
				})) as DocumentReference<Tag>;
				console.log('Created new tag:', tag, tagRef.id);
			} else {
				// If a tag already exists, use the first one found
				const doc = querySnapshot.docs[0];
				tagRef = doc.ref as DocumentReference<Tag>;
				console.log('Using existing tag:', tag, tagRef.id);
			}

			// Create a junction between task and tag
			const junctionRef = await addDoc(junctions, {
				parentId: tagRef.id,
				childId: taskRef.id,
				createdAt: Timestamp.now(),
				parentType: 'tag',
				childType: 'task'
			});

			console.log('Created junction:', tag, task, junctionRef.id);
		}
	} else {
		console.error('Missing nodes or junctions collection');
	}
}

export async function updateTask(id: string, update: Partial<Task>) {
	console.log('Updating task:', id, update);

	const nodes = getNodesCollection();

	if (nodes) {
		const docRef = doc(nodes, id);
		await updateDoc(docRef, { ...update, updatedAt: Timestamp.now() });
		console.log('Task updated:', id);
	} else {
		console.error('No nodes collection found');
	}
}

export async function archiveTask(id: string) {
	updateTask(id, { archived: true });
}

export async function completeTask(id: string) {
	updateTask(id, { completed: true });
}

// Everything below this point is *local only* and does not call Firestore

async function getRelations(
	nodeId: string,
	searchFor: 'parent' | 'child',
	targetType?: 'task' | 'tag'
) {
	let t1 = performance.now();
	const junctions = getJunctionsCollection();
	const nodes = getNodesCollection();

	let nodeIs;

	if (searchFor === 'parent') nodeIs = 'child';
	else nodeIs = 'parent';

	console.log('searching for ', searchFor, ' of type ', targetType);

	if (!junctions || !nodes) {
		console.error('Missing junctions or nodes collection');
		return [];
	}

	if (!nodeId) {
		console.error('No node ID provided');
		return [];
	}

	// find all junctions where childId is the child id
	let q;
	if (!targetType) q = query(junctions, where(nodeIs + 'Id', '==', nodeId));
	else
		q = query(
			junctions,
			where(nodeIs + 'Id', '==', nodeId),
			where(searchFor + 'Type', '==', targetType)
		);

	const junctionQuerySnapshot = await getDocsFromCache(q);

	//console.log(junctionQuerySnapshot);

	const targetIds = junctionQuerySnapshot.docs.map((doc) => {
		const junction = doc.data() as Junction;
		return junction[(searchFor + 'Id') as keyof Junction];
	});

	if (targetIds.length > 0) {
		console.log('Found relations for node:', nodeId, targetIds);

		let converter;
		if (targetType === 'tag') converter = tagConverter;
		else if (targetType === 'task') converter = taskConverter;
		else converter = graphNodeConverter;

		const q2 = query(nodes, where('__name__', 'in', targetIds)).withConverter(converter);
		const parentQuerySnapshot = await getDocsFromCache(q2);

		let t2 = performance.now();
		console.log(`getRelations took ${t2 - t1} milliseconds`);

		return parentQuerySnapshot.docs.map((doc) => doc.data());
	} else {
		console.log('No ', targetType, ' relations found for node:', nodeId);
		return [];
	}
}

export async function getTasksInTag(tagId: string) {
	return (await getRelations(tagId, 'child', 'task')).map((doc) => doc as Task);
}

export async function getTagsForTask(taskId: string): Promise<Tag[]> {
	return (await getRelations(taskId, 'parent', 'tag')).map((doc) => doc as Tag);
}

export async function getTagId(tagName: string) {
	let nodes = getNodesCollection();
	if (nodes)
		return (
			await getDocsFromCache(query(nodes, where('name', '==', tagName)).withConverter(tagConverter))
		).docs[0].data() as Tag;
	return null;
}
