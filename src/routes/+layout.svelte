<script lang="ts">
	import Header from './Header.svelte';
	import TaskInputForm from './TaskInputForm.svelte';
	import SemanticSearch from '$lib/components/SemanticSearch.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { SearchResult } from '$lib/embeddings';
	import '../app.css';
	
	// Import debug functions for embeddings (this makes them available in browser console)
	import '$lib/initializeEmbeddings';

	let { children } = $props();

	let isSidebar = $derived(page.url.pathname != '/');

	// Handle search result selection
	function handleSearchResult(result: SearchResult) {
		const item = result.item;
		if (result.type === 'task') {
			// Navigate to task page or show task details
			goto(`/tasks/${item.id}`);
		} else if (result.type === 'tag') {
			// Navigate to tag page
			goto(`/tags/${item.name}`);
		}
	}
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

		<!-- Semantic Search - only show when not on home page -->
		{#if isSidebar}
			<div class="semantic-search-container mx-auto w-full max-w-2xl">
				<SemanticSearch
					placeholder="Search similar tasks and tags..."
					onItemSelect={handleSearchResult}
				/>
			</div>
		{/if}

		<main class="flex flex-1">
			{#if children}
				{@render children()}
			{/if}
		</main>
	</section>
</div>
