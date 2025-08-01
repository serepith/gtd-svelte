<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getTagsForTask, updateTask } from '$lib/database';
	import { collections } from '$lib/globalState.svelte';
	import Save from '@lucide/svelte/icons/save';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import Calendar from '@lucide/svelte/icons/calendar';
	import AnimatedIcon from '$lib/icons/AnimatedIcon.svelte';
	import { Timestamp } from 'firebase/firestore';

	// Get the task ID from the URL parameter
	let taskId = $page.params.slug;

	// Find the task in our collections
	let task = $derived(
		collections.nodes.find((node) => node.id === taskId && node.type === 'task') as Task | undefined
	);

	// Editable task properties
	let editedTaskName = $state('');
	let editedCompleted = $state(false);
	let editedArchived = $state(false);

	// Task tags
	let taskTagsPromise: Promise<Tag[]> = $state(getTagsForTask(taskId));
	let taskTags: Tag[] = $state([]);

	// Initialize editable fields when task is loaded
	$effect(() => {
		if (task) {
			editedTaskName = task.name;
			editedCompleted = task.completed;
			editedArchived = task.archived;
		}
	});

	onMount(async () => {
		try {
			taskTags = await taskTagsPromise;
		} catch (error) {
			console.error('Error loading task tags:', error);
			taskTags = [];
		}
	});

	function handleSave() {
		if (!task) return;

		console.log('Saving task changes:', {
			name: editedTaskName,
			completed: editedCompleted,
			archived: editedArchived
		});

		updateTask(task.id || '', {
			name: editedTaskName,
			completed: editedCompleted,
			archived: editedArchived
		});

		goto('/tasks');
	}

	function handleCancel() {
		goto('/tasks');
	}

	function handleTagClick(tag: Tag) {
		goto(`/tags/${tag.name}`);
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
	<title>Edit Task - {task?.name || 'Loading...'}</title>
</svelte:head>

{#if !task}
	<section class="p-4">
		<div class="mx-auto max-w-4xl">
			<div class="py-12 text-center">
				<div class="loading loading-spinner loading-lg mx-auto"></div>
				<p class="text-base-content/70 mt-4">Loading task...</p>
			</div>
		</div>
	</section>
{:else}
	<section class="p-4">
		<div class="mx-auto max-w-4xl">
			<!-- Header -->
			<div class="mb-6 flex items-center justify-between">
				<h1 class="text-3xl font-bold">Edit Task</h1>
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

			<!-- Task Properties -->
			<div class="properties-panel bg-base-200 rounded-box mb-6 shadow-md">
				<div class="p-6">
					<div class="form-control">
						<div class="flex items-center gap-3">
							<input
								type="text"
								class="input input-bordered flex-1"
								bind:value={editedTaskName}
								placeholder="Enter task name"
							/>
							<div class="flex items-center gap-1">
								<span class="text-base-content/70 text-sm">Complete</span>
								<AnimatedIcon
									iconType="complete"
									buttonType="action"
									bind:selected={editedCompleted}
								/>
							</div>
							<div class="flex items-center gap-1">
								<span class="text-base-content/70 text-sm">Archive</span>
								<AnimatedIcon
									iconType="archive"
									buttonType="action"
									bind:selected={editedArchived}
								/>
							</div>
						</div>
					</div>
				</div>

				<div class="p-6">
					<h2 class="mb-4 text-xl font-semibold">Associated Tags</h2>
					<div class="tags-container bg-base-300 min-h-20 rounded-lg p-4">
						<div class="flex flex-wrap gap-3">
							{#each taskTags as tag (tag.id)}
								<div class="removable-tag relative">
									<button class="tag-chip clickable-tag" onclick={() => handleTagClick(tag)}>
										#{tag.name}
									</button>
									<button
										class="remove-tag-button bg-error hover:bg-error/80 text-error-content absolute -top-2 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold transition-all duration-200"
										onclick={() => removeTag(tag.id || '')}
										title="Remove tag"
									>
										×
									</button>
								</div>
							{/each}
							<!-- Ghost "Add Tag" chip -->
							<button class="tag-chip add-tag-chip" onclick={addTag} title="Add a new tag">
								add tag ＋
							</button>
						</div>
					</div>
				</div>
			</div>

			<!-- Task Metadata -->
			<div class="metadata-panel bg-base-200 rounded-box shadow-md">
				<div class="p-4">
					<h2 class="flex items-center gap-2 text-xl font-semibold">
						<Calendar size={20} />
						Task Information
					</h2>
				</div>

				<div class="p-6">
					<div class="grid grid-cols-1 gap-6 text-sm md:grid-cols-2">
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
							<span class="label-text font-medium">Task ID</span>
							<p class="text-base-content/70 mt-1 font-mono text-xs">
								{task.id}
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

	.properties-panel,
	.metadata-panel {
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
