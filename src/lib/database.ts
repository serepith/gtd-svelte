import { firebase, items, getNodesCollection } from '$lib/globalState.svelte';
import { addDoc, doc, DocumentReference, Timestamp, updateDoc } from 'firebase/firestore';
import { get } from 'svelte/store';

export async function addTask(task: string) {
  console.log("Adding task:", task);

  const nodes = getNodesCollection();

  if (nodes) {
    const rtn = await addDoc(nodes, { name: task, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    console.log("Task added to collection:", task, rtn.id);
  }
  else {
    console.error("No nodes collection found");
  }
}

export async function updateTask(id: string, update: Partial<Task>) {
  console.log("Updating task:", id, update);

  const nodes = getNodesCollection();

  if (nodes) {
    const docRef = doc(nodes, id);
    await updateDoc(docRef, { ...update, updatedAt: Timestamp.now() });
    console.log("Task updated:", id);
  }
  else {
    console.error("No nodes collection found");
  }
}