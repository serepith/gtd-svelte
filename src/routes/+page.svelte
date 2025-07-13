<script lang="ts">
	import { firebase } from '$lib/globalState.svelte';
	import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
	import TaskInputForm from './TaskInputForm.svelte';
// $effect(() => {
	// 	$inspect(firebase, 'firebase');
	// });

	import type { Snapshot } from './$types';

	let taskText = $state('');

	export const snapshot: Snapshot = {
		capture: () => taskText,
		restore: (value) => taskText = value
	};

	// Handle login
	async function handleLogin(event: Event) {
		if (firebase.auth) {
			const provider = new GoogleAuthProvider();
			const userCredential = await signInWithPopup(firebase.auth, provider);
			console.log('User logged in:', firebase.user);
		} else {
			console.error('Firebase Auth not initialized');
			console.log(firebase, firebase.auth);
		}
	}
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<section>
	<div class="grid grid-cols-1 gap-4 flex-1 items-center justify-items-center-safe" style="min-width: 25%;">
		{#if !firebase.user}
			<button class="btn btn-soft btn-lg min-w-sm" onclick={(e) => handleLogin(e)}
				>Login</button
			>
		{:else}
			<TaskInputForm bind:taskText></TaskInputForm>
		{/if}
	</div>
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		flex: 0.6;
	}
</style>
