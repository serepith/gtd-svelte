// Runs once when the app starts in the browser
import { initFirebase } from '$lib/globalState.svelte';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export async function init() {
	initFirebase();
}
