<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		getTagId,
		getTasksInTagWithEquivalents,
		createTagEquivalency,
		getTagEquivalencies,
		removeTagEquivalency,
		getAllTags,
		filterTagsByName
	} from '$lib/database';
	import { Save, X, Plus, Link, Unlink } from '@lucide/svelte';

	// Get the tag name from the URL parameter
	let tagName = $page.params.slug;
	let editedTagName = $state(tagName);
	let editedDescription = $state('');
	let editedColor = $state('#3b82f6');

	let graphContainer: HTMLElement;
	let graphNodes: Array<{
		id: string;
		name: string;
		x: number;
		y: number;
		level: number;
		isCurrentTag: boolean;
	}> = $state([]);
	let graphEdges: Array<{ source: string; target: string }> = $state([]);
	let containerDimensions = $state({ width: 0, height: 0, aspectRatio: 1 });

	// Type for tasks with source information
	type TaskWithSource = Task & {
		sourceTagId: string;
		sourceTagName: string;
		isEquivalent: boolean;
	};

	let taggedTasksPromise: Promise<TaskWithSource[]> = $state(
		getTagId(tagName).then((tag) => getTasksInTagWithEquivalents(tag?.id || ''))
	);

	// Tag equivalency state
	let currentTag: Tag | null = $state(null);
	let equivalencies: Junction[] = $state([]);
	let showEquivalencyModal = $state(false);
	let newEquivalencyTagName = $state('');
	let newEquivalencyDisplayName = $state('');
	let newEquivalencyUseOriginal = $state(false);

	// Tag suggestions
	let allTags: Tag[] = $state([]);
	let suggestedTags = $derived(filterTagsByName(allTags, newEquivalencyTagName));
	let showSuggestions = $state(false);
	let selectedSuggestionIndex = $state(-1);

	// Mock hierarchy data - replace with actual data from your database
	function generateMockHierarchy() {
		// Show only direct lineage: parents of current tag and children of current tag
		const allEdges = [
			{ source: 'shopping', target: tagName },
			{ source: tagName, target: 'health' },
			{ source: 'shopping', target: 'walmart' }, // This is a sibling - will be filtered out
			{ source: 'work', target: tagName },
			{ source: 'personal', target: 'health' } // This doesn't involve current tag - filtered out
		];

		// Filter to only direct lineage
		const edges = allEdges.filter((edge) => edge.source === tagName || edge.target === tagName);

		// Get all nodes in the lineage
		const lineageNodes = new Set<string>();
		edges.forEach((edge) => {
			lineageNodes.add(edge.source);
			lineageNodes.add(edge.target);
		});

		// Position nodes using percentages (0-100)
		const centerX = 50; // 50% from left

		// Find parents and children
		const parents = edges.filter((edge) => edge.target === tagName).map((edge) => edge.source);
		const children = edges.filter((edge) => edge.source === tagName).map((edge) => edge.target);

		const nodes: Array<{
			id: string;
			name: string;
			x: number;
			y: number;
			level: number;
			isCurrentTag: boolean;
		}> = [];

		// Add parents (level 0) - positioned above center (30% from top)
		parents.forEach((parentId, index) => {
			const spacing = parents.length > 1 ? 25 : 0; // 25% spacing
			const x = centerX + (index - (parents.length - 1) / 2) * spacing;
			nodes.push({
				id: parentId,
				name: parentId,
				x,
				y: 30,
				level: 0,
				isCurrentTag: false
			});
		});

		// Add current tag (level 1) - centered (50% from top)
		nodes.push({
			id: tagName,
			name: tagName,
			x: centerX,
			y: 50,
			level: 1,
			isCurrentTag: true
		});

		// Add children (level 2) - positioned below center (70% from top)
		children.forEach((childId, index) => {
			const spacing = children.length > 1 ? 25 : 0; // 25% spacing
			const x = centerX + (index - (children.length - 1) / 2) * spacing;
			nodes.push({
				id: childId,
				name: childId,
				x,
				y: 70,
				level: 2,
				isCurrentTag: false
			});
		});

		graphNodes = nodes;
		graphEdges = edges;
	}

	function updateContainerDimensions() {
		if (graphContainer) {
			const rect = graphContainer.getBoundingClientRect();
			containerDimensions = {
				width: rect.width,
				height: rect.height,
				aspectRatio: rect.width / rect.height
			};
		}
	}

	onMount(() => {
		generateMockHierarchy();
		updateContainerDimensions();

		// Load current tag, equivalencies, and all tags
		getTagId(tagName).then(async (tag) => {
			currentTag = tag;
			if (tag?.id) {
				equivalencies = await getTagEquivalencies(tag.id);
			}
		});

		getAllTags().then((tags) => {
			allTags = tags.filter((tag) => tag.name !== tagName); // Exclude current tag
		});

		// Update dimensions on resize
		window.addEventListener('resize', updateContainerDimensions);
		return () => window.removeEventListener('resize', updateContainerDimensions);
	});

	function handleSave() {
		console.log('Saving tag changes:', {
			name: editedTagName,
			description: editedDescription,
			color: editedColor
		});
		// TODO: Implement save logic
		goto(`/tags/${editedTagName}`);
	}

	function handleCancel() {
		goto(`/tags/${tagName}`);
	}

	function addRelatedTag() {
		console.log('Add related tag');
		// TODO: Implement add tag logic
	}

	function removeRelatedTag(tagId: string) {
		console.log('Remove related tag:', tagId);
		// TODO: Implement remove tag logic
	}

	function openEquivalencyModal() {
		showEquivalencyModal = true;
		newEquivalencyTagName = '';
		newEquivalencyDisplayName = '';
		newEquivalencyUseOriginal = false;
		showSuggestions = false;
		selectedSuggestionIndex = -1;
	}

	function closeEquivalencyModal() {
		showEquivalencyModal = false;
		showSuggestions = false;
		selectedSuggestionIndex = -1;
	}

	function handleTagInputChange() {
		showSuggestions = newEquivalencyTagName.trim().length > 0 && suggestedTags.length > 0;
		selectedSuggestionIndex = -1;
	}

	function handleTagInputKeydown(event: KeyboardEvent) {
		if (!showSuggestions) return;

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestedTags.length - 1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
				break;
			case 'Enter':
				event.preventDefault();
				if (selectedSuggestionIndex >= 0) {
					selectSuggestion(suggestedTags[selectedSuggestionIndex]);
				}
				break;
			case 'Escape':
				event.preventDefault();
				showSuggestions = false;
				selectedSuggestionIndex = -1;
				break;
		}
	}

	function selectSuggestion(tag: Tag) {
		newEquivalencyTagName = tag.name;
		showSuggestions = false;
		selectedSuggestionIndex = -1;
	}

	async function createEquivalency() {
		if (!currentTag?.id || !newEquivalencyTagName.trim()) {
			return;
		}

		try {
			// Get or create the linked tag
			let linkedTag = await getTagId(newEquivalencyTagName.trim());
			if (!linkedTag) {
				console.error('Linked tag not found');
				return;
			}

			const displayName = newEquivalencyDisplayName.trim() || newEquivalencyTagName.trim();

			await createTagEquivalency(
				currentTag.id!,
				linkedTag.id!,
				displayName,
				newEquivalencyUseOriginal
			);

			// Refresh equivalencies
			equivalencies = await getTagEquivalencies(currentTag.id);
			closeEquivalencyModal();
		} catch (error) {
			console.error('Error creating equivalency:', error);
		}
	}

	async function removeEquivalency(junctionId: string) {
		try {
			await removeTagEquivalency(junctionId);
			// Refresh equivalencies
			if (currentTag?.id) {
				equivalencies = await getTagEquivalencies(currentTag.id);
			}
		} catch (error) {
			console.error('Error removing equivalency:', error);
		}
	}
</script>

<svelte:head>
	<title>Edit #{tagName} - Tasks</title>
</svelte:head>

<section class="p-4">
	<div class="mx-auto max-w-4xl">
		<!-- Header -->
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-3xl font-bold">
				Edit <span class="page-tag-chip">#{tagName}</span>
			</h1>
			<div class="flex gap-2">
				<button class="btn btn-outline" onclick={handleCancel}>
					<X size={16} />
					Cancel
				</button>
				<button class="btn btn-primary" onclick={handleSave}>
					<Save size={16} />
					Save Changes
				</button>
			</div>
		</div>

		<!-- Tag Hierarchy Graph -->
		<div class="hierarchy-panel bg-base-100 rounded-box mb-6 p-6 shadow-md">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xl font-semibold">Tag Relationships</h2>
				<button class="btn btn-sm btn-outline" onclick={addRelatedTag}>
					<Plus size={14} />
					Add Relation
				</button>
			</div>

			<div
				class="graph-container bg-base-200 relative h-96 rounded-lg p-4"
				bind:this={graphContainer}
			>
				<!-- <svg class="w-full h-96" viewBox="0 0 800 400"> -->
				<!-- Simple connecting lines -->
				<!-- {#each graphEdges as edge}
						{@const source = graphNodes.find(n => n.id === edge.source)}
						{@const target = graphNodes.find(n => n.id === edge.target)}
						{#if source && target}
							<line 
								x1={source.x} 
								y1={source.y + 12} 
								x2={target.x}
								y2={target.y - 12}
								class="stroke-base-content/30 stroke-2"
							/>
						{/if}
					{/each} -->

				<!-- Nodes -->
				<!-- {#each graphNodes as node}
            {@const width = node.isCurrentTag ? 120 : (node.level === 0 ? 100 : 80)}
            {@const height = node.isCurrentTag ? 32 : (node.level === 0 ? 28 : 24)}
            {@const rx = height / 2}
						<g> -->

				<!-- Node pill shape with level-based styling -->
				<!-- <rect 
								x={node.x - width/2} 
								y={node.y - height/2} 
								width={width}
								height={height}
								rx={rx}
								ry={rx}
								class={node.isCurrentTag 
									? 'fill-primary stroke-primary-content stroke-2' 
									: node.level === 0 
										? 'fill-accent stroke-accent-content stroke-1 tag-node-hover'
										: 'fill-base-300 stroke-base-content/30 stroke-1 tag-node-hover'
								}
								class:cursor-pointer={!node.isCurrentTag}
							/>
							<text 
								x={node.x} 
								y={node.y + 4} 
								text-anchor="middle"
								class={node.isCurrentTag ? 'text-sm font-bold' : node.level === 0 ? 'text-xs font-semibold' : 'text-xs font-medium'}
								class:text-primary-content={node.isCurrentTag}
								class:text-accent-content={!node.isCurrentTag && node.level === 0}
								class:text-base-content={!node.isCurrentTag && node.level > 0}
								class:pointer-events-none={true}
							>
								#{node.name}
							</text>
							{#if !node.isCurrentTag}
								<circle 
									cx={node.x + width/2 + 12} 
									cy={node.y - height/2 - 4} 
									r="8"
									class="fill-error hover:fill-error/80 cursor-pointer stroke-error-content stroke-1"
									onclick={() => removeRelatedTag(node.id)}
								/>
								<text 
									x={node.x + width/2 + 12} 
									y={node.y - height/2} 
									text-anchor="middle"
									class="text-xs text-error-content pointer-events-none font-bold"
								>
									�
								</text>
							{/if}
						</g>
					{/each}
				</svg> -->

				<!-- CSS-based connecting lines -->
				{#each graphEdges as edge}
					{@const source = graphNodes.find((n) => n.id === edge.source)}
					{@const target = graphNodes.find((n) => n.id === edge.target)}
					{#if source && target}
						{@const sourceX = (source.x / 100) * containerDimensions.width}
						{@const sourceY = (source.y / 100) * containerDimensions.height}
						{@const targetX = (target.x / 100) * containerDimensions.width}
						{@const targetY = (target.y / 100) * containerDimensions.height}
						{@const deltaX = targetX - sourceX}
						{@const deltaY = targetY - sourceY}
						{@const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)}
						{@const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI)}
						<div
							class="connection-line"
							style="
							left: {source.x}%; 
							top: {source.y}%; 
							width: {distance}px;
							transform: rotate({angle}deg);
						"
						></div>
					{/if}
				{/each}

				<!-- Tag chip nodes positioned absolutely -->
				{#each graphNodes as node}
					<div
						class="absolute z-10 -translate-x-1/2 -translate-y-1/2 transform"
						style="left: {node.x}%; top: {node.y}%;"
					>
						<div class="relative">
							<button
								class="tag-chip {node.isCurrentTag ? 'current-tag-chip' : 'related-tag-chip'}"
								class:cursor-pointer={!node.isCurrentTag}
								disabled={node.isCurrentTag}
							>
								#{node.name}
							</button>
							{#if !node.isCurrentTag}
								<button
									class="bg-error hover:bg-error/80 text-error-content absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold transition-all duration-200"
									onclick={() => removeRelatedTag(node.id)}
									title="Remove relationship"
								>
									×
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Tag Equivalencies -->
		<div class="equivalency-panel bg-base-100 rounded-box mb-6 p-6 shadow-md">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xl font-semibold">Tag Equivalencies</h2>
				<button class="btn btn-sm btn-outline" onclick={openEquivalencyModal}>
					<Link size={14} />
					Link Tag
				</button>
			</div>

			{#if equivalencies.length === 0}
				<div class="py-8 text-center">
					<p class="text-base-content/70">No equivalent tags linked yet.</p>
					<p class="text-base-content/50 mt-1 text-sm">
						Link tags that represent the same concept.
					</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each equivalencies as equivalency}
						{@const details = equivalency.junctionType?.details}
						<div class="bg-base-200 flex items-center justify-between rounded-lg p-4">
							<div class="flex items-center gap-3">
								<div class="tag-chip">#{tagName}</div>
								<Link size={16} class="text-base-content/50" />
								<div class="tag-chip related-tag-chip">
									#{details?.useOriginalName
										? equivalency.childId
										: details?.displayName || equivalency.childId}
								</div>
							</div>
							<div class="flex items-center gap-2">
								{#if details?.useOriginalName}
									<span class="badge badge-sm badge-outline">Original Name</span>
								{:else}
									<span class="badge badge-sm badge-accent">Custom Display</span>
								{/if}
								<button
									class="btn btn-sm btn-ghost text-error hover:bg-error/10"
									onclick={() => removeEquivalency(equivalency.id || '')}
									title="Remove equivalency"
								>
									<Unlink size={14} />
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Tag Properties -->
		<div class="properties-panel bg-base-100 rounded-box mb-6 p-6 shadow-md">
			<h2 class="mb-4 text-xl font-semibold">Tag Properties</h2>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<div class="form-control">
					<label class="label">
						<span class="label-text">Tag Name</span>
					</label>
					<input
						type="text"
						class="input input-bordered"
						bind:value={editedTagName}
						placeholder="Enter tag name"
					/>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text">Color</span>
					</label>
					<input type="color" class="input input-bordered h-12" bind:value={editedColor} />
				</div>

				<div class="form-control md:col-span-2">
					<label class="label">
						<span class="label-text">Description</span>
					</label>
					<textarea
						class="textarea textarea-bordered"
						bind:value={editedDescription}
						placeholder="Optional description for this tag"
						rows="3"
					></textarea>
				</div>
			</div>
		</div>

		<!-- Task List (Read-only for context) -->
		<div class="tasks-panel bg-base-200 rounded-box shadow-md">
			<div class="border-base-300 border-b p-4">
				<h2 class="text-xl font-semibold">Tasks with this tag</h2>
				<p class="text-base-content/70 mt-1 text-sm">
					These tasks will be affected by your changes
				</p>
			</div>

			{#await taggedTasksPromise}
				<div class="p-8 text-center">
					<div class="loading loading-spinner loading-lg mx-auto"></div>
					<p class="text-base-content/70 mt-4">Loading tasks...</p>
				</div>
			{:then taggedTasks}
				{#if taggedTasks.length === 0}
					<div class="p-8 text-center">
						<p class="text-base-content/70 text-lg">
							No tasks found with tag <span class="tag-chip mx-1 inline-block">#{tagName}</span>
						</p>
					</div>
				{:else}
					<div class="p-4">
						{#each taggedTasks as task (task.id)}
							<div
								class="task-row border-base-300/50 flex items-center justify-between border-b px-2 py-3 last:border-b-0"
							>
								<div class="task-content">
									<div class="task-text" class:line-through={task.completed}>{task.name}</div>
								</div>
								<div class="task-date text-base-content/70 text-sm">
									{task.createdAt.toDate().toLocaleDateString('en-US', {
										weekday: 'short',
										month: 'short',
										day: 'numeric'
									})}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{:catch error}
				<div class="p-8 text-center">
					<p class="text-error">Error loading tasks: {error}</p>
				</div>
			{/await}
		</div>
	</div>
</section>

<!-- Equivalency Modal -->
{#if showEquivalencyModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="mb-4 text-lg font-bold">Link Equivalent Tag</h3>

			<div class="form-control mb-4">
				<label class="label">
					<span class="label-text">Tag to link</span>
				</label>
				<div class="relative">
					<input
						type="text"
						class="input input-bordered"
						bind:value={newEquivalencyTagName}
						oninput={handleTagInputChange}
						onkeydown={handleTagInputKeydown}
						onfocus={handleTagInputChange}
						placeholder="Enter existing tag name"
						autocomplete="off"
					/>
					{#if showSuggestions && suggestedTags.length > 0}
						<div
							class="bg-base-100 border-base-300 absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border shadow-lg"
						>
							{#each suggestedTags.slice(0, 8) as tag, index}
								<button
									type="button"
									class="hover:bg-base-200 w-full px-3 py-2 text-left transition-colors first:rounded-t-lg last:rounded-b-lg"
									class:bg-base-200={index === selectedSuggestionIndex}
									onclick={() => selectSuggestion(tag)}
								>
									<div class="tag-chip mr-2 inline-block text-xs">#{tag.name}</div>
									<span class="text-base-content/70 text-sm">{tag.name}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
				<label class="label">
					<span class="label-text-alt">Must be an existing tag</span>
				</label>
			</div>

			<div class="form-control mb-4">
				<label class="label">
					<span class="label-text">Display name (optional)</span>
				</label>
				<input
					type="text"
					class="input input-bordered"
					bind:value={newEquivalencyDisplayName}
					placeholder="Custom display name"
				/>
				<label class="label">
					<span class="label-text-alt">Leave empty to use the linked tag's original name</span>
				</label>
			</div>

			<div class="form-control mb-6">
				<label class="label cursor-pointer">
					<span class="label-text">Use original tag name when displaying</span>
					<input type="checkbox" class="checkbox" bind:checked={newEquivalencyUseOriginal} />
				</label>
				<label class="label">
					<span class="label-text-alt"
						>If checked, always show the linked tag's original name instead of custom display name</span
					>
				</label>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeEquivalencyModal}>Cancel</button>
				<button
					class="btn btn-primary"
					onclick={createEquivalency}
					disabled={!newEquivalencyTagName.trim()}
				>
					Link Tags
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={closeEquivalencyModal}></div>
	</div>
{/if}

<style>
	.page-tag-chip {
		background-color: var(--color-primary);
		color: var(--color-primary-content);
		padding: 0.25rem 1rem;
		border-radius: 9999px;
		font-size: 1.5rem;
		font-weight: 600;
		display: inline-block;
	}

	.tag-chip {
		background-color: var(--color-primary);
		color: var(--color-primary-content);
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 500;
		border: none;
		cursor: default;
		transition: all 0.2s ease;
	}

	.current-tag-chip {
		font-weight: 600;
		padding: 0.25rem 0.75rem;
		font-size: 0.875rem;
	}

	.related-tag-chip {
		background-color: var(--color-accent);
		color: var(--color-accent-content);
		cursor: pointer;
	}

	.related-tag-chip:hover {
		background-color: rgb(from var(--color-info) r g b / 0.2);
		color: var(--color-info);
		transform: scale(1.1);
		opacity: 0.9;
	}

	.hierarchy-panel,
	.properties-panel,
	.tasks-panel {
		transition: all 0.2s ease;
	}

	.graph-container {
		overflow: hidden;
	}

	.connection-line {
		position: absolute;
		pointer-events: none;
		z-index: 1;
		height: 2px;
		background-color: rgb(from var(--color-base-content) r g b / 0.3);
		transform-origin: left center;
		border-radius: 1px;
	}

	.task-row {
		transition: all 0.2s ease;
	}

	.task-row:hover {
		background-color: rgb(from var(--color-base-content) r g b / 0.02);
	}
</style>
