import { firebase, items, getNodesCollection, getJunctionsCollection } from '$lib/globalState.svelte';
import { addDoc, collection, doc, DocumentReference, getDoc, getDocs, query, QuerySnapshot, Timestamp, updateDoc, where } from 'firebase/firestore';
import { get } from 'svelte/store';

export async function addTask(chunks: {
    type: string;
    content: string;
}[]) {
  let task = '' as string;
  let tags = [] as string[];

  for (const chunk of chunks) {
    console.log(chunk.type, chunk.content);
    if (chunk.type === 'tag-inline' || chunk.type === 'tag-meta') {
      if(chunk.type === 'tag-inline') {
        task += chunk.content;
      } 
      tags.push(chunk.content.substring(1)); // Remove the leading '#' or '/'
      console.log('Found tag:', chunk.content);
    } else if (chunk.type === 'text' || chunk.type === 'separator') {
      task += chunk.content;
    }
  }

	console.log('Adding task:', chunks, "with tags:", tags);

	const nodes = getNodesCollection();
  const junctions = getJunctionsCollection();

	if (nodes && junctions) {
		const taskRef = await addDoc(nodes, {
			name: task,
			createdAt: Timestamp.now(),
			updatedAt: Timestamp.now(),
      completed: false,
      archived: false,
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
        tagRef = await addDoc(nodes, {
          name: tag,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }) as DocumentReference<Tag>;
        console.log('Created new tag:', tag, tagRef.id);  
      }
      else {
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
        type: 'tag-task'
      });

      console.log('Created junction:', tag, task, junctionRef.id);
      }
    }
    else {
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

export async function getTagsForTask(taskId: string): Promise<Tag[]> {
  const junctions = getJunctionsCollection();
  const nodes = getNodesCollection();

  if (!junctions || !nodes) {
    console.error('Missing junctions or nodes collection');
    return [];
  }

  if (!taskId) {
    console.error('No task ID provided');
    return [];
  }

  // find all junctions where childId is the taskId and type is 'tag-task'
  // this will give us all tags associated with the task
  const q = query(junctions, where('childId', '==', taskId), where('type', '==', 'tag-task'));
  const junctionQuerySnapshot = await getDocs(q);
  const tagIds = junctionQuerySnapshot.docs.map(doc => {
    const junction = doc.data() as Junction;
    return junction.parentId; // parentId is the tag ID
  });

  if( tagIds.length > 0) {
    console.log('Found tags for task:', taskId, tagIds);

    const q2 = query(nodes, where('__name__', 'in', tagIds));
    const tagQuerySnapshot = await getDocs(q2);

    const tags: Tag[] = tagQuerySnapshot.docs.map(doc => {
      console.log('Tag doc:', doc.id, doc.data());
      const data = doc.data() as Tag;
      return {
        id: doc.id,
        name: data.name,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    });
    return tags;
  } else {
    console.log('No tags found for task:', taskId);
    return [];
  }
}