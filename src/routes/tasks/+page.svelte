<script lang="ts">
	import { archiveTask, completeTask, getTagsForTask } from '$lib/database';
	import { collections } from '$lib/globalState.svelte';
	import { Timestamp } from 'firebase/firestore';
	import { goto } from '$app/navigation';
	import { Check, Archive, Edit } from '@lucide/svelte';
	import { fade, fly } from 'svelte/transition';

  // todo this seems like...a bad approach
  let showCompleted = $state(false);
  let showArchived = $state(false);
	let tasks = $derived((collections.nodes.filter((node) => node.type === 'task') as Task[])
    .filter((node) => (showCompleted || !node.completed) && (showArchived || !node.archived)));


	function handleTagClick(tag: any, event: MouseEvent) {
		console.log('Filter by tag:', tag.name);
		
		const clickedElement = event.target as HTMLElement;
		const rect = clickedElement.getBoundingClientRect();
		
		// Store the source position and size
		const transitionData = {
			x: rect.left,
			y: rect.top,
			width: rect.width,
			height: rect.height,
			tagName: tag.name
		};
		
		console.log('Transition data:', transitionData);
		
		// Store in sessionStorage so the destination page can access it
		sessionStorage.setItem('tagTransition', JSON.stringify(transitionData));
		
		// Navigate
		goto(`/tag/${tag.name}`);
	}

	// Track tasks that are animating out
	let animatingTasks = $state(new Set<string>());
	let collapsingTasks = $state(new Set<string>());

	export function handleComplete(task: Task) {
		console.log('Complete task:', task.name);
		if (!showCompleted) {
			// Add visual feedback before removal
			animatingTasks.add(task.id || '');
			// Start collapsing after initial animation
			setTimeout(() => {
				collapsingTasks.add(task.id || '');
			}, 200);
			// Clean up tracking
			setTimeout(() => {
				animatingTasks.delete(task.id || '');
				collapsingTasks.delete(task.id || '');
			}, 800);
		}
		completeTask(task.id || '');
	}

	export function handleArchive(task: Task) {
		console.log('Archive task:', task.name);
		if (!showArchived) {
			// Add visual feedback before removal
			animatingTasks.add(task.id || '');
			// Start collapsing after initial animation
			setTimeout(() => {
				collapsingTasks.add(task.id || '');
			}, 200);
			// Clean up tracking
			setTimeout(() => {
				animatingTasks.delete(task.id || '');
				collapsingTasks.delete(task.id || '');
			}, 800);
		}
		archiveTask(task.id || '');
	}

	export function handleEdit(task: any) {
		console.log('Edit task:', task.name);
		// TODO: implement edit logic
	}
</script>

<section>
	<!-- Filter toggles -->
	<div class="mb-4 flex gap-4 items-center">
		<h2 class="text-xl font-semibold">Tasks</h2>
		<div class="flex gap-3 ml-auto">
			<label class="label cursor-pointer gap-2">
				<input 
					type="checkbox" 
					class="checkbox checkbox-sm" 
					bind:checked={showCompleted}
				/>
				<span class="label-text">Show completed</span>
			</label>
			<label class="label cursor-pointer gap-2">
				<input 
					type="checkbox" 
					class="checkbox checkbox-sm" 
					bind:checked={showArchived}
				/>
				<span class="label-text">Show archived</span>
			</label>
		</div>
	</div>

	<div class="task-table rounded-box bg-base-200 shadow-md p-4 px-6 flex flex-col">
    <!-- Table headers -->
    <div class="task-header grid grid-cols-[fit-content(80%)_1fr_auto_auto] gap-4 py-2 items-center font-semibold border-b border-base-300 mb-2">
      <div>Task</div>
      <div></div> <!-- Empty column for spacing -->
      <div class="text-right">Date</div>
      <div class="text-right">Actions</div>
    </div>

    {#each tasks as task (task.id)}
      <div 
        class="task-row grid grid-cols-[fit-content(80%)_1fr_auto_auto] gap-4 py-3 items-start hover-parent"
        class:animating-out={animatingTasks.has(task.id || '')}
        class:collapsing={collapsingTasks.has(task.id || '')}
        in:fly="{{ y: 20, duration: 300, delay: 50 }}"
        out:fly="{{ y: -20, duration: 200 }}"
      >
        <div class="task-content">
          <div class="task-text mb-1">{task.name}</div>
          <div class="task-tags-display">
            {#await getTagsForTask(task.id || '') then tags}
              {#each tags as tag}
                <button 
                  class="tag-chip clickable-tag" 
                  onclick={(e) => handleTagClick(tag, e)}
                  aria-label="Filter by tag {tag.name}"
                  title="Click to filter by this tag"
                >
                  {tag.name}
                </button>
              {/each}
            {:catch error}
              <span class="error text-xs text-error">Error loading tags</span>
            {/await}
          </div>
        </div>
        <div></div> <!-- Empty spacer column -->
        <div class="task-date text-sm text-base-content/70 self-center">{(task.createdAt as Timestamp).toDate().toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric' 
        })}</div>
        <div class="task-actions self-center">
          <button 
            class="action-btn complete-btn"
            onclick={() => handleComplete(task)}
            aria-label="Complete {task.name}"
            title="Complete task"
          >
            <Check />
          </button>
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
</section>

<style>
	.task-table {
    width: fit-content;
    min-width: 60%;
    max-width: 100%;
    margin: 0 auto;
  }

  .task-row {
    border-bottom: 0.5px solid rgb(from var(--color-primary) r g b / 0.2);
    transition: all 0.3s ease;
  }

  .task-row:last-child {
    border-bottom: none;
  }

  .task-row:hover {
    background-color: rgb(from var(--color-base-content) r g b / 0.02);
  }

  .task-row.animating-out {
    opacity: 0.5;
    transform: translateX(20px);
    background-color: rgb(from var(--color-success) r g b / 0.1);
    max-height: 200px; /* Set initial height for transition */
    overflow: hidden;
    transition: all 0.3s ease, max-height 0.4s ease 0.2s; /* Delay height collapse */
  }

  .task-row.animating-out.collapsing {
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    margin-top: 0;
    margin-bottom: 0;
    border-bottom-width: 0;
  }

  .task-tags, .task-date {
    text-align: right;
  }

  .task-header {
    color: var(--color-base-content);
    opacity: 0.8;
  }

  .task-content {
    min-width: 0; /* Allows text to wrap properly */
  }

  .task-tags-display {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.25rem;
  }

  /* Tag chip styles - add this to your app.css for reuse */
  .task-tags-display .tag-chip {
    background-color: var(--color-primary);
    color: var(--color-primary-content);
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    border: none;
    cursor: default;
  }

  .clickable-tag {
    cursor: pointer !important;
    transition: all 0.2s ease;
  }

  .clickable-tag:hover {
    background-color: rgb(from var(--color-info) r g b / 0.2);
    color: var(--color-info);
    transform: scale(1.1);
    opacity: 0.9;
  }

  .task-actions {
    display: flex;
    gap: 0.25rem;
    opacity: 0.15;
    transition: opacity 0.3s ease;
    justify-content: flex-end;
  }

  /* Progressive disclosure on hover */
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

  /* Icon sizing */
  .action-btn :global(svg) {
    width: 1rem;
    height: 1rem;
  }
</style>