<script lang="ts">
	import { onMount } from 'svelte';
	import { createDebouncedSearch } from '$lib/semanticSearch';
	import type { SearchResult } from '$lib/embeddings';
	import { Search, Hash, CheckSquare } from '@lucide/svelte';

	const { placeholder = 'Search tasks and tags...', onItemSelect = () => {} } = $props<{ placeholder?: string; onItemSelect?: (item: SearchResult) => void }>();

	let searchQuery = $state('');
	let searchResults = $state<SearchResult[]>([]);
	let isSearching = $state(false);
	let showResults = $state(false);
	let searchInput: HTMLInputElement;

	// Create debounced search function
	const debouncedSearch = createDebouncedSearch(300);

	// Handle search input
	function handleSearch() {
		const query = searchQuery.trim();

		console.log("searched " + query);

		if (!query) {
			searchResults = [];
			showResults = false;
			isSearching = false;
			return;
		}

		isSearching = true;
		showResults = true;

		debouncedSearch(query, (results) => {
			console.log("Search completed for:", query, "Results:", results);
			searchResults = results;
			isSearching = false;
		});
	}

	// Handle item selection
	function selectItem(result: SearchResult) {
		onItemSelect(result);
		searchQuery = '';
		searchResults = [];
		showResults = false;
	}

	// Handle keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			searchQuery = '';
			searchResults = [];
			showResults = false;
			searchInput.blur();
		}
	}

	// Format similarity percentage
	function formatSimilarity(similarity: number): string {
		return Math.round(similarity * 100) + '%';
	}

	// Handle clicks outside to close results
	function handleClickOutside(event: Event) {
		const target = event.target as Element;
		if (!target.closest('.search-container')) {
			showResults = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);

		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<div class="search-container relative">
	<div class="search-input-container relative">
		<Search
			class="search-icon text-base-content/50 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
		/>
		<input
			bind:this={searchInput}
			bind:value={searchQuery}
			onkeydown={handleKeydown}
			oninput={handleSearch}
			type="text"
			{placeholder}
			class="search-input border-base-300 bg-base-100 focus:border-primary focus:ring-primary/20 w-full rounded-lg border py-2 pr-4 pl-10 text-sm transition-all focus:ring-2 focus:outline-none"
		/>
		{#if isSearching}
			<div class="absolute top-1/2 right-3 -translate-y-1/2">
				<div class="loading loading-spinner loading-xs"></div>
			</div>
		{/if}
	</div>

	{#if showResults}
		<div
			class="search-results border-base-300 bg-base-100 absolute top-full z-50 mt-1 w-full rounded-lg border shadow-lg"
		>
			{#if isSearching}
				<div class="text-base-content/70 flex items-center justify-center p-4 text-sm">
					<div class="loading loading-spinner loading-sm mr-2"></div>
					Searching...
				</div>
			{:else if searchResults.length === 0}
				<div class="text-base-content/70 p-4 text-center text-sm">
					No similar items found above similarity threshold
				</div>
			{:else}
				<div class="results-list max-h-60 overflow-y-auto">
					{#each searchResults as result}
						<button
							type="button"
							onclick={() => selectItem(result)}
							class="result-item hover:bg-base-200 focus:bg-base-200 flex w-full items-center gap-3 p-3 text-left transition-colors focus:outline-none"
						>
							<div class="result-icon flex-shrink-0">
								{#if result.type === 'task'}
									<CheckSquare class="text-primary h-4 w-4" />
								{:else}
									<Hash class="text-secondary h-4 w-4" />
								{/if}
							</div>

							<div class="result-content min-w-0 flex-1">
								<div class="result-name text-base-content font-medium">
									{result.item.name}
								</div>
								<div class="result-meta text-base-content/60 flex items-center gap-2 text-xs">
									<span class="result-type capitalize">{result.type}</span>
									<span class="separator">•</span>
									<span class="similarity">{formatSimilarity(result.similarity)} match</span>
								</div>
							</div>

							<div class="similarity-bar flex-shrink-0">
								<div class="bg-base-300 h-2 w-12 rounded-full">
									<div
										class="from-primary to-secondary h-full rounded-full bg-gradient-to-r"
										style="width: {result.similarity * 100}%"
									></div>
								</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.search-container {
		font-family: inherit;
	}

	.search-input:focus {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px rgb(from var(--color-primary) r g b / 0.2);
	}

	.search-results {
		background: var(--color-base-100);
		border: 1px solid var(--color-base-300);
		box-shadow:
			0 10px 15px -3px rgb(0 0 0 / 0.1),
			0 4px 6px -4px rgb(0 0 0 / 0.1);
	}

	.result-item:hover,
	.result-item:focus {
		background-color: var(--color-base-200);
	}

	.result-item:last-child {
		border-bottom: none;
	}

	.similarity-bar .bg-gradient-to-r {
		background: linear-gradient(to right, var(--color-primary), var(--color-secondary));
	}
</style>
