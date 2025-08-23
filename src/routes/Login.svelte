<script lang="ts">
	import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
	import firebase from "firebase/compat/app";

  let { auth } = $props();

	// Handle login
	async function handleLogin(event: Event) {
		if (firebase.auth) {
			const provider = new GoogleAuthProvider();
			const userCredential = await signInWithPopup(auth, provider);
			console.log(firebase.auth);
			//console.log(auth);

			//console.log('User logged in:', user);
		} else {
			console.error('Firebase Auth not initialized');
			console.log(firebase.auth);
		}
	}
</script>

<button class="btn btn-soft btn-lg min-w-sm" onclick={(e) => handleLogin(e)}>Login</button>
