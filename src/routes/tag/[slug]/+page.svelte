<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getTagId, getTasksInTag } from '$lib/database';
	import { Check, Archive, Edit } from '@lucide/svelte';

	// Get the tag name from the URL parameter
	let tagName = $page.params.slug;
	let pageTagElement: HTMLElement;
	let isAnimating = $state(true); // Start as true so content is hidden initially
	//let error : Error | null = $state(null);

	let taggedTasksPromise: Promise<Task[]> = $state(
		getTagId(tagName).then((tag) => getTasksInTag(tag?.id || ''))
	);

	console.log('Tag view for:', tagName);

	onMount(async () => {
		//taggedTasksPromise = getTasksInTag(tagName).catch((e) => error = e);
		// Wait for the element to be available
		function tryAnimation() {
			const element = document.querySelector('.page-tag-chip') as HTMLElement;

			if (!element) {
				console.log('Element not found, retrying...');
				setTimeout(tryAnimation, 10);
				return;
			} else {
				// No transition data, just show content immediately
				setTimeout(() => {
					isAnimating = false;
				}, 100);
			}

			console.log('Element found!', element);
			pageTagElement = element;

			// Check if we have transition data
			const transitionDataStr = sessionStorage.getItem('tagTransition');
			if (transitionDataStr) {
				const transitionData = JSON.parse(transitionDataStr);
				console.log('Found transition data:', transitionData);

				// Only animate if this is the right tag
				if (transitionData.tagName === tagName) {
					animateFromSource(transitionData);
				}

				// Clean up
				sessionStorage.removeItem('tagTransition');
			}
		}

		tryAnimation();
	});

	function animateFromSource(sourceData: any) {
		if (!pageTagElement) {
			console.log('No pageTagElement found!');
			return;
		}

		console.log('Starting animation...');
		isAnimating = true;

		// Get the final position
		const finalRect = pageTagElement.getBoundingClientRect();
		console.log('Final rect:', finalRect);

		// Calculate the difference
		const deltaX = sourceData.x - finalRect.left;
		const deltaY = sourceData.y - finalRect.top;
		const scaleX = sourceData.width / finalRect.width;
		const scaleY = sourceData.height / finalRect.height;

		console.log('Animation deltas:', { deltaX, deltaY, scaleX, scaleY });

		// Start at source position/size
		const startTransform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
		console.log('Setting start transform:', startTransform);
		pageTagElement.style.transform = startTransform;
		pageTagElement.style.transformOrigin = 'top left';

		// Force a reflow
		console.log('Forcing reflow...');
		pageTagElement.offsetHeight;

		// Add transition and animate to final position
		console.log('Adding transition and animating...');
		pageTagElement.style.transition = 'transform 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)';
		pageTagElement.style.transform = 'translate(0px, 0px) scale(1, 1)';

		// Clean up after animation
		setTimeout(() => {
			console.log('Cleaning up animation...');
			pageTagElement.style.transition = '';
			pageTagElement.style.transform = '';
			pageTagElement.style.transformOrigin = '';

			// Delay the content reveal slightly for a nice staggered effect
			setTimeout(() => {
				isAnimating = false;
			}, 100);
		}, 400);
	}

	function handleEditTag() {
		goto(`/tag/${tagName}/edit`);
	}

	export function handleComplete(task: any) {
		console.log('Complete task:', task.name);
		// TODO: implement complete logic
	}

	export function handleArchive(task: any) {
		console.log('Archive task:', task.name);
		// TODO: implement archive logic
	}

	export function handleEdit(task: any) {
		console.log('Edit task:', task.name);
		// TODO: implement edit logic
	}
</script>

<svelte:head>
	<title>#{tagName} - Tasks</title>
</svelte:head>

<section class="flex-1 p-4">
	<div class="mx-auto flex max-w-4xl flex-1 flex-col">
		<!-- Header -->
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-3xl font-bold">
				<span class="page-tag-chip" bind:this={pageTagElement}>#{tagName}</span>
			</h1>
			<button class="btn btn-outline" onclick={handleEditTag}> Edit Tag </button>
		</div>

		<!-- Task list content -->
		<div
			class="content-panel bg-base-200 rounded-box shadow-md"
			class:content-hidden={isAnimating}
			class:content-visible={!isAnimating}
		>
			<!-- {#if isLoading}
				 -->
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
						<p class="text-base-content/50 mt-2 text-sm">
							Tasks with this tag will appear here when created.
						</p>
					</div>
				{:else}
					<div class="p-4">
						<!-- Task table header -->
						<div
							class="task-header border-base-300 mb-2 grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b px-2 py-2 font-semibold"
						>
							<div>Task</div>
							<div class="text-right">Date</div>
							<div class="text-right">Actions</div>
						</div>

						<!-- Task rows -->
						{#each taggedTasks as task (task.id)}
							<div
								class="task-row hover-parent grid grid-cols-[1fr_auto_auto] items-start gap-4 px-2 py-3"
								class:completed={task.completed}
							>
								<div class="task-content">
									<div class="task-text" class:line-through={task.completed}>{task.name}</div>
								</div>
								<div class="task-date text-base-content/70 self-center text-sm">
									{task.createdAt.toDate().toLocaleDateString('en-US', {
										weekday: 'short',
										month: 'short',
										day: 'numeric'
									})}
								</div>
								<div class="task-actions self-center">
									{#if !task.completed}
										<button
											class="action-btn complete-btn"
											onclick={() => handleComplete(task)}
											aria-label="Complete {task.name}"
											title="Complete task"
										>
											<Check />
										</button>
									{/if}
									<button
										class="action-btn archive-btn"
										onclick={() => handleArchive(task)}
										aria-label="Archive {task.name}"
										title="Archive task"
									>
										<Archive />
									</button>
									<button
										class="action-btn edit-btn"
										onclick={() => handleEdit(task)}
										aria-label="Edit {task.name}"
										title="Edit task"
									>
										<Edit />
									</button>
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

<style>
	.tag-chip {
		background-color: var(--color-primary);
		color: var(--color-primary-content);
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.page-tag-chip {
		background-color: var(--color-primary);
		color: var(--color-primary-content);
		padding: 0.25rem 1rem;
		border-radius: 9999px;
		font-size: 1.5rem;
		font-weight: 600;
		display: inline-block;
		position: relative;
		z-index: 10; /* Keep tag above the content */
	}

	.content-panel {
		margin-top: -1rem; /* Slightly overlap with the tag */
		padding-top: 3rem; /* Space for the overlapping tag */
		transform-origin: top center;
		transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.content-hidden {
		opacity: 0;
		transform: translateY(-20px) scaleY(0);
	}

	.content-visible {
		opacity: 1;
		transform: translateY(0) scaleY(1);
	}

	/* Task table styles */
	.task-header {
		color: var(--color-base-content);
		opacity: 0.8;
	}

	.task-row {
		border-bottom: 0.5px solid rgb(from var(--color-primary) r g b / 0.2);
		transition: all 0.2s ease;
	}

	.task-row:last-child {
		border-bottom: none;
	}

	.task-row:hover {
		background-color: rgb(from var(--color-base-content) r g b / 0.02);
	}

	.task-row.completed {
		opacity: 0.6;
	}

	.task-actions {
		display: flex;
		gap: 0.25rem;
		opacity: 0.15;
		transition: opacity 0.3s ease;
		justify-content: flex-end;
	}

	.hover-parent:hover .task-actions {
		opacity: 0.6;
	}

	.task-actions:hover {
		opacity: 1;
	}

	.action-btn {
		padding: 0.25rem;
		border: none;
		background: transparent;
		cursor: pointer;
		border-radius: 0.25rem;
		transition: all 0.2s ease;
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.action-btn:hover {
		background-color: var(--color-base-300);
		transform: scale(1.1);
	}

	.complete-btn:hover {
		background-color: rgb(from var(--color-success) r g b / 0.2);
		color: var(--color-success);
	}

	.archive-btn:hover {
		background-color: rgb(from var(--color-warning) r g b / 0.2);
		color: var(--color-warning);
	}

	.edit-btn:hover {
		background-color: rgb(from var(--color-info) r g b / 0.2);
		color: var(--color-info);
	}

	.action-btn :global(svg) {
		width: 1rem;
		height: 1rem;
	}
</style>
