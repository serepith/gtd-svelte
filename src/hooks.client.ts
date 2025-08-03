// Runs once when the app starts in the browser
//import { initFirebase } from '$lib/globalState.svelte';
import { data, DataManager } from '$lib/globalState.svelte';
import { getAuth } from 'firebase/auth';
import firebase from 'firebase/compat/app';
import { getFirestore } from 'firebase/firestore';

export async function init() {
	if(firebase.apps.length === 0)
		data.initFirebase();
}
