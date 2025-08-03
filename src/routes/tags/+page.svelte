<script lang="ts">
	import { goto } from '$app/navigation';
	import { data } from '$lib/globalState.svelte';
	//import { collections } from '$lib/globalState.svelte';
	import { Hash, Plus, ArrowRight } from '@lucide/svelte';

	let allTags: Tag[] = $derived(data.nodes.filter((node) => node.type === 'tag') as Tag[]);

	// Calculate the number of tag equivalencies
	let equivalenciesCount = $derived.by(() => {
		return data.junctions.filter(
			(junction) =>
				junction.junctionType?.type === 'equivalency' &&
				junction.parentType === 'tag' &&
				junction.childType === 'tag'
		).length;
	});

	// Group tags by their first letter for organization (kept for potential future use)
	let groupedTags = $derived(() => {
		const groups: Record<string, Tag[]> = {};

		allTags.forEach((tag) => {
			const firstLetter = tag.name.charAt(0).toUpperCase();
			if (!groups[firstLetter]) {
				groups[firstLetter] = [];
			}
			groups[firstLetter].push(tag);
		});

		// Sort groups alphabetically and sort tags within each group
		const sortedGroups: Record<string, Tag[]> = {};
		Object.keys(groups)
			.sort()
			.forEach((letter) => {
				sortedGroups[letter] = groups[letter].sort((a, b) => a.name.localeCompare(b.name));
			});

		return sortedGroups;
	});

	function handleTagClick(tagName: string) {
		goto(`/tags/${encodeURIComponent(tagName)}`);
	}

	function handleCreateTag() {
		// TODO: Implement create tag functionality
		console.log('Create new tag');
	}
</script>

<svelte:head>
	<title>All Tags - Tasks</title>
</svelte:head>

<section class="flex-1 p-4">
	<div class="mx-auto max-w-6xl">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h1 class="flex items-center gap-3 text-3xl font-bold">
					<Hash class="text-primary" size={32} />
					All Tags
				</h1>
				<p class="text-base-content/70 mt-2">Browse and manage all your tags</p>
			</div>
			<button class="btn btn-primary" onclick={handleCreateTag} title="Create new tag">
				<Plus size={16} />
				New Tag
			</button>
		</div>

		<!-- Content -->
		<!-- {#if isLoading}
			<div class="py-12 text-center">
				<div class="loading loading-spinner loading-lg mx-auto"></div>
				<p class="text-base-content/70 mt-4">Loading tags...</p>
			</div>
		{:else if error}
			<div class="py-12 text-center">
				<p class="text-error text-lg">Error loading tags: {error}</p>
			</div> -->
		{#if allTags.length === 0}
			<div class="py-12 text-center">
				<Hash class="text-base-content/30 mx-auto mb-4" size={64} />
				<h2 class="text-base-content/70 mb-2 text-xl font-semibold">No tags yet</h2>
				<p class="text-base-content/50 mb-6">
					Tags will appear here as you create tasks with #hashtags
				</p>
				<button class="btn btn-primary" onclick={handleCreateTag}>
					<Plus size={16} />
					Create your first tag
				</button>
			</div>
		{:else}
			<!-- Tags Overview Stats -->
			<div class="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
				<div class="bg-base-100 rounded-box p-6 shadow-sm">
					<div class="flex items-center gap-3">
						<Hash class="text-primary" size={24} />
						<div>
							<div class="text-2xl font-bold">{allTags.length}</div>
							<div class="text-base-content/70 text-sm">Total Tags</div>
						</div>
					</div>
				</div>
				<div class="bg-base-100 rounded-box p-6 shadow-sm">
					<div class="flex items-center gap-3">
						<ArrowRight class="text-info" size={24} />
						<div>
							<div class="text-2xl font-bold">{equivalenciesCount}</div>
							<div class="text-base-content/70 text-sm">Equivalencies</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Simple Tags List -->
			<div class="bg-base-100 rounded-box p-6 shadow-sm">
				<h2 class="mb-6 text-xl font-semibold">All Tags</h2>
				<div class="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
					{#each allTags.sort((a, b) => a.name.localeCompare(b.name)) as tag}
						<div
							class="tag-item bg-base-200 hover:bg-base-300 group flex cursor-pointer items-center justify-center rounded-lg p-3 transition-all duration-200"
							onclick={() => handleTagClick(tag.name)}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && handleTagClick(tag.name)}
							title="View tasks for #{tag.name}"
						>
							<div class="tag-chip text-center">#{tag.name}</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Grouped Tags Display (Alternative view - can be toggled later) -->
			<!-- <div class="space-y-8">
				{#each Object.entries(groupedTags) as [letter, tags]}
					<div class="bg-base-100 rounded-box p-6 shadow-sm">
						<h2 class="text-primary mb-4 text-xl font-semibold">
							{letter}
						</h2>
						<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
							{#each tags as tag}
								<div
									class="tag-card bg-base-200 hover:bg-base-300 group flex cursor-pointer items-center justify-between rounded-lg p-4 transition-all duration-200"
									onclick={() => handleTagClick(tag.name)}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && handleTagClick(tag.name)}
								>
									<div class="flex min-w-0 flex-1 items-center gap-3">
										<div class="tag-chip">#{tag.name}</div>
										<div class="text-base-content/50 truncate text-sm">
											{tag.createdAt.toDate().toLocaleDateString()}
										</div>
									</div>
									<button
										class="btn btn-ghost btn-sm opacity-0 transition-opacity group-hover:opacity-100"
										onclick={(e) => handleEditTag(tag.name, e)}
										title="Edit tag"
									>
										<Edit size={14} />
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div> -->
		{/if}
	</div>
</section>

<style>
	.tag-chip {
		background-color: var(--color-primary);
		color: var(--color-primary-content);
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.tag-item:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgb(from var(--color-base-content) r g b / 0.08);
	}

	.tag-item:hover .tag-chip {
		transform: scale(1.05);
	}
</style>
