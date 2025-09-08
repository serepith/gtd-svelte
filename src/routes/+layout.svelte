<script lang="ts">
	import Header from './Header.svelte';
	import TaskInputForm from './TaskInputForm.svelte';
	import { page } from '$app/state';
	import '../app.css';
	
	// Import debug functions for embeddings (this makes them available in browser console)
	import '$lib/initializeEmbeddings';
	
	// Import debug functions for junction validation (this makes them available in browser console)
	import '$lib/initializeJunctionValidation';

	let { children } = $props();

	let isSidebar = $derived(page.url.pathname != '/');
</script>

<div class="app flex min-h-screen flex-col">
	<Header />

	<section class="flex flex-1 flex-col gap-5 p-5">
		<div
			class="grid {isSidebar ? 'min-content' : 'flex-1'} place-items-center-safe
		border-none focus-within:outline-none"
		>
			<TaskInputForm bind:isSidebar />
		</div>

		<main class="flex flex-1 justify-center">
			{#if children}
				{@render children()}
			{/if}
		</main>
	</section>
</div>
