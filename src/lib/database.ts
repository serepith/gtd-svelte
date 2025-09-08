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
	CollectionReference,
	doc,
	DocumentReference,
	getDoc,
	getDocs,
	getDocsFromCache,
	query,
	Timestamp,
	updateDoc,
	where,
	type DocumentData
} from 'firebase/firestore';

import { similarity } from '@nlpjs/similarity';
import { diceCoefficient } from 'dice-coefficient';
import { generateEmbedding, needsEmbedding, getModelVersion, runEmbedding } from './embeddings';
import { fi } from 'zod/v4/locales';

async function makeNode(nodeText: string, nodeType: 'task' | 'tag', nodes: CollectionReference<DocumentData, DocumentData>) {
	const startTime = performance.now();
	
	if(nodeText.trim()) {
		let nodeData: Task | Tag;

		if(nodeType === 'task') 
			nodeData = { 
			name: nodeText,
			createdAt: Timestamp.now(),
			updatedAt: Timestamp.now(),
			type: 'task', 
			completed: false, 
			archived: false };
		else nodeData = { 
			name: nodeText,
			createdAt: Timestamp.now(),
			updatedAt: Timestamp.now(),
			type: 'tag' };

		const nodeRef = await addDoc(nodes, nodeData);

		console.log(`${nodeType} added to collection:`, nodeData, nodeRef.id);

		const endTime = performance.now();

		console.log(`Node creation took ${endTime - startTime} ms.`);

		// Generate embedding for the new task in the background
		generateAndStoreEmbedding({ id: nodeRef.id, ...nodeData }).catch((error) => {
			console.warn(`Failed to generate embedding for new ${nodeType}:`, error);
		});

		if(nodeType === 'task')
			return nodeRef as DocumentReference<Task>;
		else return nodeRef as DocumentReference<Tag>;
	}

	console.log("Node text empty!");
	return null;
}

// async function getNodeById(docId: string, nodes: CollectionReference) {
// 	const docRef = doc(nodes, docId);
// 	const document = await getDoc(docRef);
// 	if(document.exists()) return document;
// 	return null;
// }

async function getNodeByName(docName: string, nodes: CollectionReference) {
	const q = query(nodes, where('name', '==', docName));
	const querySnapshot = await getDocs(q);
	return querySnapshot;
	return null;
}

async function makeJunction(parent: string | DocumentReference, child: string | DocumentReference, 
	parentType: 'tag' | 'task', childType: 'tag' | 'task', checkExistence = false, nodes: CollectionReference, junctions: CollectionReference
) {
	console.log("Child is: " + child.toString());
		const [parentRef, childRef] = [parent instanceof DocumentReference ? parent : doc(nodes, parent), 
																	child instanceof DocumentReference ? child : doc(nodes, child)];

		if(checkExistence) {
			const [parentDoc, childDoc] = [await(getDoc(parentRef)), await(getDoc(childRef))];

			if(parentDoc.exists() && childDoc.exists()) {
				const junctionRef = await addDoc(junctions, {
					parentId: parentRef.id,
					childId: childRef.id,
					createdAt: Timestamp.now(),
					parentType: parentType,
					childType: childType
				});
					
				console.log('✅ Created junction:', parentRef.id, childRef.id, junctionRef.id);

				return junctionRef;
			} else {
				console.error(`❌ Parent: ${parentDoc.exists() ? parentDoc.data.name : "does not exist"}    Child: ${childDoc.exists() ? childDoc.data.name : "does not exist"}!`)
			}
		} else {
			const junctionRef = await addDoc(junctions, {
					parentId: parentRef.id,
					childId: childRef.id,
					createdAt: Timestamp.now(),
					parentType: parentType,
					childType: childType
				});
					
				console.log('✅ Created junction:', parentRef.id, childRef.id, junctionRef.id);

				return junctionRef;
		}
}

export async function addTask(
	chunks: {
		content: string;
		type: () => 'text' | 'tag';
	}[]
) {
	let task = '' as string;
	let tags = [] as string[];

	for (const chunk of chunks) {
		if (chunk.type() === 'tag') {
			tags.push(chunk.content.substring(1)); // Remove the leading '#' or '/'
		} else if (chunk.type() === 'text') {
			task += chunk.content;
		}
	}

	task = task.trim();

	const nodes = data.nodesCollection;
	const junctions = data.junctionsCollection;

	if (nodes && junctions && task) {
		const taskRef = await makeNode(task, 'task', nodes);

		if(taskRef) {
			for (const tag of tags) {
				addTagToTask(tag, taskRef.id, false);
			}
		} else {
			console.error('❌ Failed to create task!');
		}
	} else {
		console.error('❌ Missing nodes or junctions collection!');
	}
}

export async function addTagToTask(tagName: string, taskId: string, checkTaskExistence = false) {
	const nodes = data.nodesCollection;
	const junctions = data.junctionsCollection;

	if (nodes && junctions) {
			const querySnapshot = await getNodeByName(tagName, nodes);
			let tagRef = null as DocumentReference<Tag> | null;

			// there should NOT be more than one tag with the same name
			// but there might be no tag at all
			if(querySnapshot) {
				if (querySnapshot.empty) {
					tagRef = await makeNode(tagName, 'tag', nodes) as DocumentReference<Tag>;
					if(tagRef)
						console.log('✅ Created new tag:', tagName, tagRef.id);
					else console.log("❌ Failed to create new tag " + tagName + "!");
				} else {
					if(querySnapshot.docs.length > 1)
						console.log(`‼️ More than one identical tag "${tagName}" found!`);
					const doc = querySnapshot.docs[0];
					tagRef = doc.ref as DocumentReference<Tag>;
					console.log('🏷️ Using existing tag:', tagName, tagRef.id);
				}
			}

			if(tagRef) {
				// We know the tag exists, given that we just made it; if we're assured of task existence, don't check again
				const junctionRef = await makeJunction(tagRef, taskId, 'tag', 'task', checkTaskExistence, nodes, junctions);

				if(junctionRef) console.log('✅ Created junction:', tagName, taskId, junctionRef.id);
				else console.log('❌ Error creatng junction!');
			}
	} else {
		console.error('❌ Missing nodes or junctions collection!');
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

export async function getRelations(
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
		//console.log('Found relations for node:', nodeId, targetIds);

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

// export async function getSimilar(searchText: string, count?: number) {
// 	const nodes = await getAllTasks();

// 	const similarities = [];

// 	for (const n of nodes) {
// 		similarities.push({ node: n, similarity: diceCoefficient(searchText, n.name) });
// 	}

// 	similarities.sort((a, b) => a.similarity - b.similarity);

// 	console.log(similarities.slice(0, 3));

// 	if (count) return similarities.slice(0, Math.min(similarities.length, count)).map((i) => i.node);
// 	return similarities.slice(0, 3).map((i) => i.node);
// }

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

	console.log(`Tag id: ${tagId}`)

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

		console.log("made it so far...");

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
	let startTime = performance.now();
	let nodes = data.nodesCollection;
	if (nodes)
		return (
			await getDocsFromCache(query(nodes, where('name', '==', tagName)).withConverter(tagConverter))
		).docs[0].data() as Tag;
	let endTime = performance.now();
	console.log(`Get tag id took ${endTime - startTime} ms.`);
	return null;
}

export async function getNodeId(nodeName: string) {
	let startTime = performance.now();
	let nodes = data.nodesCollection;
	if (nodes)
		return (
			await getDocsFromCache(query(nodes, where('name', '==', nodeName)).withConverter(graphNodeConverter))
		).docs[0].data();
	let endTime = performance.now();
	console.log(`Get node id took ${endTime - startTime} ms.`);
	return null;

}

export async function getAllTags(): Promise<Tag[]> {
	let startTime = performance.now();
	const nodes = data.nodesCollection;
	if (!nodes) {
		console.error('No nodes collection found');
		return [];
	}

	const q = query(nodes, where('type', '==', 'tag')).withConverter(tagConverter);
	const querySnapshot = await getDocsFromCache(q);
	let endTime = performance.now();
	console.log(`Get all tags took ${endTime - startTime} ms.`);
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

/**
 * Generate and store embedding for a task or tag
 */
export async function generateAndStoreEmbedding(item: Task | Tag): Promise<void> {
	const startTime = performance.now();

	if (!item.id) {
		console.error('Cannot generate embedding for item without ID');
		return;
	}

	try {
		console.log(`🔄 Generating embedding for "${item.name}"...`);
		const embedding = await runEmbedding(item.name);
		const modelVersion = getModelVersion();

		console.log(`📊 Generated embedding:`, {
			modelVersion,
			sample: embedding.slice(0, 5),
			isArray: Array.isArray(embedding)
		});

		const nodes = data.nodesCollection;
		if (!nodes) {
			console.error('No nodes collection found');
			return;
		}

		const docRef = doc(nodes, item.id);
		
		// Convert embedding to plain array to ensure Firestore compatibility
		const embeddingArray = Array.from(embedding);
		
		console.log(`💾 Storing to Firestore:`, {
			embedding: embeddingArray.slice(0, 3) + '...',
			embeddingModelVersion: modelVersion,
			isArrayFromEmbedding: Array.isArray(embeddingArray)
		});

		await updateDoc(docRef, {
			embedding: embeddingArray,
			embeddingModelVersion: modelVersion,
			updatedAt: Timestamp.now()
		});

		
		const endTime = performance.now();

		console.log(`✅ Generated and stored embedding for "${item.name}"; took ${endTime - startTime} ms.`);
		
		// Verify it was saved by reading it back
		const updatedDoc = await getDoc(docRef);
		const savedData = updatedDoc.data();
		console.log(`🔍 Verification - saved data:`, {
			hasEmbedding: !!savedData?.embedding,
			embeddingLength: savedData?.embedding?.length,
			hasModelVersion: !!savedData?.embeddingModelVersion,
			modelVersion: savedData?.embeddingModelVersion
		});


		
	} catch (error) {
		console.error(`❌ Error generating embedding for "${item.name}":`, error);
	}
}

/**
 * Ensure all tasks and tags have current embeddings
 * This function can be called to backfill embeddings for existing data
 */
export async function ensureAllEmbeddings(): Promise<void> {
	console.log('Starting embedding generation for all items...');

	const allNodes = await getAllNodes();
	const itemsNeedingEmbeddings = allNodes.filter(needsEmbedding);

	if (itemsNeedingEmbeddings.length === 0) {
		console.log('All items already have current embeddings');
		return;
	}

	console.log(`Generating embeddings for ${itemsNeedingEmbeddings.length} items...`);

	// Process in batches to avoid overwhelming the system
	const BATCH_SIZE = 5;
	for (let i = 0; i < itemsNeedingEmbeddings.length; i += BATCH_SIZE) {
		const batch = itemsNeedingEmbeddings.slice(i, i + BATCH_SIZE);

		// Process batch in parallel
		const promises = batch.map((item) => generateAndStoreEmbedding(item));
		await Promise.all(promises);

		console.log(
			`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(itemsNeedingEmbeddings.length / BATCH_SIZE)}`
		);

		// Small delay between batches to be respectful
		if (i + BATCH_SIZE < itemsNeedingEmbeddings.length) {
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}

	console.log('Embedding generation complete!');
}

/**
 * Get all tasks and tags that have embeddings (for search)
 */
export async function getAllItemsWithEmbeddings(): Promise<(Task | Tag)[]> {
	console.log('🗄️ Getting all items with embeddings...');
	const allNodes = await getAllNodes();
	console.log('📋 Total nodes from database:', allNodes.length);
	
	const itemsWithEmbeddings = allNodes.filter((item) => {
		const hasEmbedding = !!item.embedding;
		const hasModelVersion = !!item.embeddingModelVersion;
		console.log(`Item "${item.name}":`, { 
			hasEmbedding, 
			hasModelVersion, 
			embeddingLength: item.embedding?.length,
			modelVersion: item.embeddingModelVersion
		});
		return hasEmbedding && hasModelVersion;
	});
	
	console.log('✅ Items with embeddings:', itemsWithEmbeddings.length);
	return itemsWithEmbeddings;
}

export async function getAllJunctions(): Promise<Junction[]> {
	const junctions = data.junctionsCollection;
	if (!junctions) {
		console.error('No junctions collection found');
		return [];
	}

	const querySnapshot = await getDocsFromCache(junctions);
	return querySnapshot.docs.map((doc) => {
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
}
