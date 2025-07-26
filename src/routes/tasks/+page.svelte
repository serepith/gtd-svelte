<script lang="ts">
	import { goto } from '$app/navigation';
	import { getTagsForTask } from '$lib/database';
	import { collections } from '$lib/globalState.svelte';
	import { Timestamp } from 'firebase/firestore';
//import CircleCheckBig from '@lucide/svelte/icons/circle-check-big';
	import { updateTask } from '$lib/database';
	import AnimatedIcon from '$lib/icons/AnimatedIcon.svelte';
	import Edit from '@lucide/svelte/icons/edit';
	import ListTodo from '@lucide/svelte/icons/list-todo';
	import { flip } from 'svelte/animate';

	// Custom transition for "blipping out" effect
	// function blipIn(node, { duration = 200 }) {
	// 	return {
	// 		duration,
	// 		css: t => {
	// 			const eased = cubicOut(t);
	// 			return `
	// 				opacity: ${eased};
	// 				transform: scale(${0.3 + eased * 0.7}) scaleX(-1);
	// 			`;
	// 		}
	// 	};
	// }

	// function blipOut(node, { duration = 200 }) {
	// 	return {
	// 		duration,
	// 		css: t => {
	// 			const eased = cubicOut(1 - t);
	// 			return `
	// 				opacity: ${t};
	// 				transform: scale(${t * 0.3}) scaleX(-1);
	// 				filter: blur(${(1 - t) * 2}px);
	// 			`;
	// 		}
	// 	};
	// }

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
		console.log('Toggle complete task:', task.name);
		const willBeCompleted = !task.completed;
		
		// if (!showCompleted && willBeCompleted) {
		// 	// Add visual feedback before removal
		// 	animatingTasks.add(task.id || '');
		// 	// Start collapsing after initial animation
		// 	setTimeout(() => {
		// 		collapsingTasks.add(task.id || '');
		// 	}, 200);
		// 	// Clean up tracking
		// 	setTimeout(() => {
		// 		animatingTasks.delete(task.id || '');
		// 		collapsingTasks.delete(task.id || '');
		// 	}, 800);
		// }
		updateTask(task.id || '', { completed: willBeCompleted });
	}

	export function handleArchive(task: Task) {
		console.log('Toggle archive task:', task.name);
		const willBeArchived = !task.archived;
		
		// if (!showArchived && willBeArchived) {
		// 	// Add visual feedback before removal
		// 	animatingTasks.add(task.id || '');
		// 	// Start collapsing after initial animation
		// 	setTimeout(() => {
		// 		collapsingTasks.add(task.id || '');
		// 	}, 200);
		// 	// Clean up tracking
		// 	setTimeout(() => {
		// 		animatingTasks.delete(task.id || '');
		// 		collapsingTasks.delete(task.id || '');
		// 	}, 800);
		// }
		updateTask(task.id || '', { archived: willBeArchived });
	}

	export function handleEdit(task: any) {
		console.log('Edit task:', task.name);
		goto(`/tasks/${task.id}`);
	}
</script>

<section>
	<div class="task-table rounded-xl bg-gradient-to-br from-base-100 to-base-200 shadow-xl border border-base-300 p-6 flex flex-col">
    <!-- Table headers -->
    <div class="task-header grid grid-cols-[fit-content(80%)_1fr_auto_auto] gap-4 px-4 py-4 items-center font-bold text-lg border-b-2 border-primary/20 mb-4">
      <div class="text-primary">Tasks</div>
      <div></div> <!-- Empty column for spacing -->
      <div class="text-right">
        <AnimatedIcon
          iconType="complete"
          buttonType="filter"
          size={1.5}
          bind:selected={showCompleted}/>
      </div>
      <div class="text-right">
        <AnimatedIcon
          iconType="archive"
          buttonType="filter"
          size={1.5}
          bind:selected={showArchived}/>
      </div>
    </div>

    {#if tasks.length === 0}
      <div class="empty-state text-center py-12">
        <div class="mb-4 opacity-50">
          <ListTodo size={48} class="mx-auto text-base-content/30" />
        </div>
        <h3 class="text-lg font-semibold text-base-content/70 mb-2">No tasks found</h3>
        <p class="text-sm text-base-content/50">
          {#if !showCompleted && !showArchived}
            All your tasks are completed or archived. Use the toggle buttons in the header to show them.
          {:else if showCompleted && !showArchived}
            No completed tasks to show.
          {:else if !showCompleted && showArchived}
            No archived tasks to show.
          {:else}
            Create your first task to get started!
          {/if}
        </p>
      </div>
    {:else}
      {#each tasks as task (task.id)}
        <div 
          class="task-row grid grid-cols-[fit-content(80%)_1fr_auto_auto] gap-4 px-4 py-4 items-start hover-parent rounded-lg hover:bg-base-200/50 transition-all duration-200"
          class:animating-out={animatingTasks.has(task.id || '')}
          class:collapsing={collapsingTasks.has(task.id || '')}
          animate:flip={{ duration: 200 }}
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
          <!-- <button 
            class="action-btn complete-btn"
            class:active={task.completed}
            onclick={() => handleComplete(task)}
            aria-label="{task.completed ? 'Uncomplete' : 'Complete'} {task.name}"
            title="{task.completed ? 'Mark as incomplete' : 'Mark as complete'}"
          > -->
            <AnimatedIcon iconType="complete" buttonType="action" bind:selected={task.completed} />
          <!-- </button> -->
          <!-- <button 
            class="action-btn archive-btn"
            class:active={task.archived}
            onclick={() => handleArchive(task)}
            aria-label="{task.archived ? 'Unarchive' : 'Archive'} {task.name}"
            title="{task.archived ? 'Unarchive task' : 'Archive task'}"
          >
            <Archive />
          </button> -->
            <AnimatedIcon iconType="archive" buttonType="action" bind:selected={task.archived} />

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
    {/if}
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
    border-bottom: 1px solid rgb(from var(--color-base-300) r g b / 0.5);
    transition: all 0.3s ease;
    margin-bottom: 0.25rem;
  }

  .task-row:last-child {
    border-bottom: none;
    margin-bottom: 0;
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

  /* .task-header {
    color: var(--color-base-content);
    background: linear-gradient(135deg, 
      rgb(from var(--color-base-200) r g b / 0.8) 0%, 
      rgb(from var(--color-primary) r g b / 0.05) 50%, 
      rgb(from var(--color-base-200) r g b / 0.8) 100%
    );
  } */



  .icon-stack {
    position: relative;
    display: inline-block;
    width: 24px;
    height: 24px;
  }

  .flip-horizontal {
    transform: scaleX(-1);
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

  /* Active buttons bypass progressive disclosure */
  .task-actions .action-btn.active {
    opacity: 1;
  }

  /* .action-btn {
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
  } */

  /* .action-btn:hover {
    background-color: var(--color-base-300);
    transform: scale(1.1);
  } */

  /* .complete-btn:hover {
    background-color: rgb(from var(--color-success) r g b / 0.2);
    color: var(--color-success);
  } */

  .archive-btn:hover {
    background-color: rgb(from var(--color-warning) r g b / 0.2);
    color: var(--color-warning);
  }

  .edit-btn:hover {
    background-color: rgb(from var(--color-info) r g b / 0.2);
    color: var(--color-info);
  }

  /* Icon sizing */
  /* .action-btn :global(svg) {
    width: 1rem;
    height: 1rem;
  } */

  /* .action-btn.active {
    opacity: 1;
    background-color: rgb(from var(--color-success) r g b / 0.15);
  } */

  /* .complete-btn:hover {
    background-color: rgb(from var(--color-success) r g b / 0.2);
    color: var(--color-success);
  } */

  /* .complete-btn.active {
    color: var(--color-success);
    background-color: rgb(from var(--color-success) r g b / 0.15);
  } */

  .archive-btn.active {
    color: var(--color-warning);
    background-color: rgb(from var(--color-warning) r g b / 0.15);
  }
</style>