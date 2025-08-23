import {
	data,
	// getJunctionsCollection,
	graphNodeConverter,
	// getNodesCollection,
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

import { similarity } from '@nlpjs/similarity';
import { diceCoefficient } from 'dice-coefficient';

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

	task = task.trim();

	console.log('Adding task:', chunks, 'with tags:', tags);

	const nodes = data.nodesCollection;
	const junctions = data.junctionsCollection;

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

	const nodes = data.nodesCollection;

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
	const junctions = data.junctionsCollection;
	const nodes = data.nodesCollection;

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

export async function getSimilar(searchText: string, count?: number) {
	const nodes = await getAllTasks();

	const similarities = [];

	for (const n of nodes) {
		similarities.push({ node: n, similarity: diceCoefficient(searchText, n.name) });
	}

	similarities.sort((a, b) => a.similarity - b.similarity);

	console.log(similarities.slice(0, 3));

	if (count) return similarities.slice(0, Math.min(similarities.length, count)).map((i) => i.node);
	return similarities.slice(0, 3).map((i) => i.node);
}

export async function getTasksInTag(tagId: string) {
	return (await getRelations(tagId, 'child', 'task')).map((doc) => doc as Task);
}

export async function getTasksInTagWithEquivalents(
	tagId: string
): Promise<Array<Task & { sourceTagId: string; sourceTagName: string; isEquivalent: boolean }>> {
	const nodes = data.nodesCollection;
	if (!nodes) {
		console.error('No nodes collection found');
		return [];
	}

	// Get the current tag info
	const currentTagQuery = query(nodes, where('__name__', '==', tagId)).withConverter(tagConverter);
	const currentTagSnapshot = await getDocsFromCache(currentTagQuery);
	const currentTag = currentTagSnapshot.docs[0]?.data();

	if (!currentTag) {
		console.error('Current tag not found');
		return [];
	}

	// Get tasks directly associated with this tag
	const directTasks = await getTasksInTag(tagId);
	const tasksWithSource = directTasks.map((task) => ({
		...task,
		sourceTagId: tagId,
		sourceTagName: currentTag.name,
		isEquivalent: false
	}));

	// Get all equivalent tags
	const equivalencies = await getTagEquivalencies(tagId);

	// Get tasks from equivalent tags
	for (const equivalency of equivalencies) {
		// Determine which tag is the "other" tag (not the current one)
		const otherTagId = equivalency.parentId === tagId ? equivalency.childId : equivalency.parentId;

		// Get the other tag's info
		const otherTagQuery = query(nodes, where('__name__', '==', otherTagId)).withConverter(
			tagConverter
		);
		const otherTagSnapshot = await getDocsFromCache(otherTagQuery);
		const otherTag = otherTagSnapshot.docs[0]?.data();

		if (!otherTag) continue;

		// Get tasks from the other tag
		const otherTasks = await getTasksInTag(otherTagId);

		// Add tasks with source info, but only if they aren't already in our list
		for (const task of otherTasks) {
			const existingTask = tasksWithSource.find((t) => t.id === task.id);
			if (!existingTask) {
				tasksWithSource.push({
					...task,
					sourceTagId: otherTagId,
					sourceTagName: otherTag.name,
					isEquivalent: true
				});
			}
		}
	}

	// Sort by creation date (newest first)
	return tasksWithSource.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
}

export async function getTagsForTask(taskId: string): Promise<Tag[]> {
	return (await getRelations(taskId, 'parent', 'tag')).map((doc) => doc as Tag);
}

export async function getTagId(tagName: string) {
	let nodes = data.nodesCollection;
	if (nodes)
		return (
			await getDocsFromCache(query(nodes, where('name', '==', tagName)).withConverter(tagConverter))
		).docs[0].data() as Tag;
	return null;
}

export async function getAllTags(): Promise<Tag[]> {
	const nodes = data.nodesCollection;
	if (!nodes) {
		console.error('No nodes collection found');
		return [];
	}

	const q = query(nodes, where('type', '==', 'tag')).withConverter(tagConverter);
	const querySnapshot = await getDocsFromCache(q);
	return querySnapshot.docs.map((doc) => doc.data());
}

export async function getAllTasks(): Promise<Task[]> {
	const nodes = data.nodesCollection;
	if (!nodes) {
		console.error('No nodes collection found');
		return [];
	}

	const q = query(nodes, where('type', '==', 'task')).withConverter(taskConverter);
	const querySnapshot = await getDocsFromCache(q);
	return querySnapshot.docs.map((doc) => doc.data());
}

export async function getAllNodes(): Promise<GraphNode[]> {
	const nodes = data.nodesCollection;
	if (!nodes) {
		console.error('No nodes collection found');
		return [];
	}

	const q = query(nodes).withConverter(graphNodeConverter);
	const querySnapshot = await getDocsFromCache(q);
	return querySnapshot.docs.map((doc) => doc.data());
}

export function filterTagsByName(tags: Tag[], searchTerm: string): Tag[] {
	if (!searchTerm.trim()) return tags;
	const term = searchTerm.toLowerCase();
	return tags
		.filter((tag) => tag.name.toLowerCase().includes(term))
		.sort((a, b) => {
			// Sort by relevance: exact matches first, then starts with, then contains
			const aName = a.name.toLowerCase();
			const bName = b.name.toLowerCase();

			if (aName === term) return -1;
			if (bName === term) return 1;
			if (aName.startsWith(term) && !bName.startsWith(term)) return -1;
			if (bName.startsWith(term) && !aName.startsWith(term)) return 1;

			return aName.localeCompare(bName);
		});
}

export async function createTagEquivalency(
	masterTagId: string,
	linkedTagId: string,
	displayName: string,
	useOriginalName: boolean = false
) {
	const junctions = data.junctionsCollection;

	if (!junctions) {
		console.error('No junctions collection found');
		return;
	}

	const equivalencyJunction: Omit<Junction, 'id'> = {
		parentId: masterTagId,
		childId: linkedTagId,
		parentType: 'tag',
		childType: 'tag',
		createdAt: Timestamp.now(),
		junctionType: {
			type: 'equivalency',
			details: {
				displayName,
				useOriginalName
			}
		}
	};

	const junctionRef = await addDoc(junctions, equivalencyJunction);
	console.log('Created tag equivalency:', masterTagId, linkedTagId, junctionRef.id);
	return junctionRef.id;
}

export async function getTagEquivalencies(tagId: string): Promise<Junction[]> {
	const junctions = data.junctionsCollection;

	if (!junctions) {
		console.error('No junctions collection found');
		return [];
	}

	// Get equivalencies where this tag is the master (parent)
	const masterQuery = query(
		junctions,
		where('parentId', '==', tagId),
		where('parentType', '==', 'tag'),
		where('childType', '==', 'tag'),
		where('junctionType.type', '==', 'equivalency')
	);

	// Get equivalencies where this tag is the linked tag (child)
	const linkedQuery = query(
		junctions,
		where('childId', '==', tagId),
		where('parentType', '==', 'tag'),
		where('childType', '==', 'tag'),
		where('junctionType.type', '==', 'equivalency')
	);

	const [masterSnapshot, linkedSnapshot] = await Promise.all([
		getDocsFromCache(masterQuery),
		getDocsFromCache(linkedQuery)
	]);

	const allEquivalencies = [...masterSnapshot.docs, ...linkedSnapshot.docs].map((doc) => {
		const data = doc.data();
		return {
			id: doc.id,
			parentId: data.parentId,
			childId: data.childId,
			parentType: data.parentType,
			childType: data.childType,
			createdAt: data.createdAt,
			junctionType: data.junctionType
		} as Junction;
	});

	return allEquivalencies;
}

export async function removeTagEquivalency(junctionId: string) {
	const junctions = data.junctionsCollection;

	if (!junctions) {
		console.error('No junctions collection found');
		return;
	}

	const docRef = doc(junctions, junctionId);
	await updateDoc(docRef, { archived: true });
	console.log('Removed tag equivalency:', junctionId);
}
