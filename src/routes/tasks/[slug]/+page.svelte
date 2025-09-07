<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { addTagToTask, getRelations, getTagsForTask, updateTask, getAllTags } from '$lib/database';
	import X from '@lucide/svelte/icons/x';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import AnimatedIcon from '$lib/icons/AnimatedIcon.svelte';
	import NodeTable from '$lib/components/NodeTable.svelte';
	import { getDocsFromCache, Timestamp } from 'firebase/firestore';
	import { data, graphNodeConverter } from '$lib/globalState.svelte';
	import { createDebouncedSearch } from '$lib/semanticSearch';
	import type { SearchResult } from '$lib/embeddings';
	import { fade, scale } from 'svelte/transition';
	import RelationsDisplay from '$lib/components/RelationsDisplay.svelte';

	// Get the task ID from the URL parameter
	let taskId = $page.params.slug;

	// Find the task in our collections
	let task = $derived(
		data.nodes.find((node) => node.id === taskId && node.type === 'task') as Task | undefined
	);

	// Editable task properties
	let editedTaskName = $state('');
	let editedCompleted = $state(false);
	let editedArchived = $state(false);
	
	// Autosave state
	let saveTimeout: ReturnType<typeof setTimeout> | undefined;
	let isSaving = $state(false);
	let lastSaved = $state<Date | null>(null);

	// Task relationships
	let parentNodes: (Task | Tag)[] = $state([]);
	let childNodes: (Task | Tag)[] = $state([]);

	// Initialize editable fields when task is loaded
	$effect(() => {
		if (task) {
			editedTaskName = task.name;
			editedCompleted = task.completed;
			editedArchived = task.archived;
		}
	});

	// TODO streamline this
	onMount(async () => {
		try {
			parentNodes = await getRelations(taskId, 'parent');
			childNodes = await getRelations(taskId, 'child');
			
			console.log("RELATIONS FOUND: " + parentNodes);

			//taskTags = await getTagsForTask(taskId);
			
			// Combine child nodes (child tasks and child tags)
			// childNodes = [...childTasksData, ...childTagsData];
		} catch (error) {
			console.error('Error loading task relationships:', error);
			//taskTags = [];
			parentNodes = [];
			childNodes = [];
		}
	});


	// Cleanup timeout on component destroy
	onDestroy(() => {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
	});

	// Autosave function with debouncing
	async function autoSave() {
		if (!task) return;

		console.log('Autosaving task changes:', {
			name: editedTaskName,
			completed: editedCompleted,
			archived: editedArchived
		});

		isSaving = true;
		try {
			await updateTask(task.id || '', {
				name: editedTaskName,
				completed: editedCompleted,
				archived: editedArchived
			});
			lastSaved = new Date();
		} catch (error) {
			console.error('Failed to autosave task:', error);
		} finally {
			isSaving = false;
		}
	}

	// Debounced autosave effect for task name (text input)
	$effect(() => {
		if (!task || editedTaskName === task.name) return;
		
		// Clear existing timeout
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		
		// Set new timeout for debounced save
		saveTimeout = setTimeout(() => {
			autoSave();
		}, 1000); // 1 second debounce for text input
	});

	// Immediate autosave effect for boolean fields (completed/archived)
	$effect(() => {
		if (!task) return;
		
		// Only save if the values have actually changed from the original task
		const hasChanges = editedCompleted !== task.completed || editedArchived !== task.archived;
		
		if (hasChanges) {
			autoSave();
		}
	});


	function formatDate(timestamp: Timestamp) {
		return timestamp.toDate().toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Task - {task?.name || 'Loading...'}</title>
</svelte:head>

{#if !task}
	<section class="p-4">
		<div class="mx-auto max-w-6xl">
			<div class="py-12 text-center">
				<div class="loading loading-spinner loading-lg mx-auto"></div>
				<p class="text-base-content/70 mt-4">Loading task...</p>
			</div>
		</div>
	</section>
{:else}
	<section class="p-4">
		<div class="mx-auto max-w-6xl">
			<!-- Header -->
			<div class="mb-6 flex items-center justify-between">
				<div class="flex items-center gap-4">
					{#if isSaving}
						<div class="flex items-center gap-2 text-sm text-base-content/70">
							<div class="loading loading-spinner loading-xs"></div>
							Saving...
						</div>
					{:else if lastSaved}
						<div class="text-sm text-base-content/70">
							Saved {lastSaved.toLocaleTimeString()}
						</div>
					{/if}
				</div>
			</div>

			
			<div class="task-details-panel bg-base-200 rounded-box mb-6 shadow-md">
				<div class="flex flex-col p-6 gap-3">

					<!-- Parents Section -->
					<RelationsDisplay nodes={parentNodes} {task} />

					<!-- Task Details Section -->
					<div class="form-control">
						<div class="flex justify-center gap-3">
							<input
								type="text"
								class="input input-ghost text-lg font-medium"
								bind:value={editedTaskName}
								placeholder="Enter task name"
							/>
							<div class="flex items-center gap-3">
								<div class="flex items-center gap-1">
									<!-- <span class="text-base-content/70 text-sm">Complete</span> -->
									<AnimatedIcon
										iconType="complete"
										buttonType="action"
										bind:selected={editedCompleted}
									/>
								</div>
								<div class="flex items-center gap-1">
									<!-- <span class="text-base-content/70 text-sm">Archive</span> -->
									<AnimatedIcon
										iconType="archive"
										buttonType="action"
										bind:selected={editedArchived}
									/>
								</div>
							</div>
						</div>
					</div>

					<!-- Child Section -->

					<RelationsDisplay nodes={childNodes} {task} />

				</div>

				<!-- Metadata Section -->
				<div class="px-6 pb-6">
					<div class="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
						<div>
							<span class="label-text font-medium">Created</span>
							<p class="text-base-content/70 mt-1">
								{formatDate(task.createdAt)}
							</p>
						</div>
						<div>
							<span class="label-text font-medium">Last Updated</span>
							<p class="text-base-content/70 mt-1">
								{formatDate(task.updatedAt)}
							</p>
						</div>
						<div>
							<span class="label-text font-medium">Status</span>
							<div class="mt-1 flex gap-2">
								{#if editedCompleted}
									<span class="badge badge-success badge-sm">Completed</span>
								{/if}
								{#if editedArchived}
									<span class="badge badge-warning badge-sm">Archived</span>
								{/if}
								{#if !editedCompleted && !editedArchived}
									<span class="badge badge-info badge-sm">Active</span>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</div>

		</div>
	</section>
{/if}

<style>
	.task-details-panel {
		transition: all 0.2s ease;
	}
</style>
