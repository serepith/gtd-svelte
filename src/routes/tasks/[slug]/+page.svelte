<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { addTagToTask, getRelations, getTagsForTask, updateTask } from '$lib/database';
	import X from '@lucide/svelte/icons/x';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import AnimatedIcon from '$lib/icons/AnimatedIcon.svelte';
	import NodeTable from '$lib/components/NodeTable.svelte';
	import { getDocsFromCache, Timestamp } from 'firebase/firestore';
	import { data, graphNodeConverter } from '$lib/globalState.svelte';

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
	let taskTags: Tag[] = $state([]);
	let parentNodes: (Task | Tag)[] = $state([]);
	let childNodes: (Task | Tag)[] = $state([]);

	$inspect(childNodes);
	
	// Helper functions to get relationships  
	async function getParentTasks(taskId: string): Promise<Task[]> {
		const junctions = data.junctionsCollection;
		const nodes = data.nodesCollection;
		
		if (!junctions || !nodes || !taskId) return [];
		
		// Find junctions where this task is the child and parent is a task
		const { query, where, getDocs } = await import('firebase/firestore');
		const junctionQuery = await getDocs(query(junctions, where('childId', '==', taskId), where('parentType', '==', 'task')));
		
		const parentIds = junctionQuery.docs.map(doc => doc.data().parentId);
		
		if (parentIds.length === 0) return [];
		
		// Import task converter from database module
		const { taskConverter } = await import('$lib/globalState.svelte');
		const parentQuery = await getDocs(query(nodes, where('__name__', 'in', parentIds)).withConverter(taskConverter));
		
		return parentQuery.docs.map(doc => doc.data());
	}
	
	async function getChildTasks(taskId: string): Promise<Task[]> {
		const junctions = data.junctionsCollection;
		const nodes = data.nodesCollection;
		
		if (!junctions || !nodes || !taskId) return [];
		
		// Find junctions where this task is the parent and child is a task
		const { query, where, getDocs } = await import('firebase/firestore');
		const junctionQuery = await getDocs(query(junctions, where('parentId', '==', taskId), where('childType', '==', 'task')));
		
		const childIds = junctionQuery.docs.map(doc => doc.data().childId);
		
		if (childIds.length === 0) return [];
		
		// Import task converter from database module
		const { taskConverter } = await import('$lib/globalState.svelte');
		const childQuery = await getDocs(query(nodes, where('__name__', 'in', childIds)).withConverter(taskConverter));
		
		return childQuery.docs.map(doc => doc.data());
	}
	
	async function getChildren(taskId: string): Promise<GraphNode[]> {
		const junctions = data.junctionsCollection;
		const nodes = data.nodesCollection;
		
		if (!junctions || !nodes || !taskId) return [];
		
		// Find junctions where this task is the parent
		const { query, where, getDocs } = await import('firebase/firestore');
		const junctionQuery = await getDocsFromCache(query(junctions, where('childId', '==', taskId)));
		
		const childIds = junctionQuery.docs.map(doc => doc.data().childId);
		
		if (childIds.length === 0) return [];
		
		// Import tag converter from database module
		const { tagConverter } = await import('$lib/globalState.svelte');
		const childQuery = await getDocsFromCache(query(nodes, where('__name__', 'in', childIds)).withConverter(graphNodeConverter));
		
		return childQuery.docs.map(doc => doc.data());
	}

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

			taskTags = await getTagsForTask(taskId);
			
			// Combine child nodes (child tasks and child tags)
			// childNodes = [...childTasksData, ...childTagsData];
		} catch (error) {
			console.error('Error loading task relationships:', error);
			taskTags = [];
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

	function handleBack() {
		goto('/tasks');
	}

	function handleNodeClick(node: GraphNode) {
		if(node.type === "tag")
			goto(`/tags/${node.name}`);
		else
			goto(`/tasks/${node.name}`)
	}
	

	function addTag() {
		console.log('Add tag to task');
		// TODO: Implement add tag logic
	}

	function removeTag(tagId: string) {
		console.log('Remove tag from task:', tagId);
		// TODO: Implement remove tag logic
	}

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
						<div class="flex flex-wrap gap-3">
							{#each parentNodes as parent (parent.id)}
								<div class="removable-tag relative">
									<button class="tag-chip clickable-tag" onclick={() => handleNodeClick(parent)}>
										#{parent.name}
									</button>
									<button
										class="remove-tag-button bg-error hover:bg-error/80 text-error-content absolute -top-2 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold transition-all duration-200"
										onclick={() => removeTag(parent.id || '')}
										title="Remove tag"
									>
										×
									</button>
								</div>
							{/each}
							<button class="tag-chip add-tag-chip" onclick={addTag} title="Add a new tag">
								＋
							</button>
						</div>

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

						<div class="flex flex-wrap gap-3">
							{#each childNodes as child (child.id)}
								<div class="removable-tag relative">
									<button class="tag-chip clickable-tag" onclick={() => handleNodeClick(child)}>
										#{child.name}
									</button>
									<button
										class="remove-tag-button bg-error hover:bg-error/80 text-error-content absolute -top-2 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold transition-all duration-200"
										onclick={() => removeTag(child.id || '')}
										title="Remove tag"
									>
										×
									</button>
								</div>
							{/each}
							<button class="tag-chip add-tag-chip" onclick={addTag} title="Add a new tag">
								add tag ＋
							</button>
						</div>

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
	.tag-chip {
		background-color: var(--color-primary);
		color: var(--color-primary-content);
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 500;
		border: 1px solid var(--color-base-content);
		cursor: default;
		transition: all 0.2s ease;
	}

	.clickable-tag {
		cursor: pointer !important;
	}

	.clickable-tag:hover {
		background-color: rgb(from var(--color-info) r g b / 0.2);
		color: var(--color-info);
		border: 1px solid var(--color-info);
		transform: scale(1.05);
	}

	.task-details-panel {
		transition: all 0.2s ease;
	}

	.add-tag-chip {
		background-color: transparent;
		color: var(--color-base-content);
		border: 1px dashed var(--color-base-content);
		opacity: 0.5;
	}

	.add-tag-chip:hover {
		background-color: var(--color-primary);
		color: var(--color-primary-content);
		border-color: var(--color-primary);
		opacity: 1;
		transform: scale(1.05);
	}

	/* Make entire removable tag container transparent when hovering over remove button */
	.removable-tag:has(.remove-tag-button:hover) {
		opacity: 0.3;
		transform: scale(0.95);
	}

	.removable-tag {
		transition: all 0.2s ease;
	}

	.tags-container {
		min-height: 5rem;
		transition: all 0.2s ease;
	}
</style>
