<script lang="ts">
	import { getTagsForTask } from '$lib/database';
	import { items } from '$lib/globalState.svelte';
	import { Timestamp } from 'firebase/firestore';

	let tasks = $derived(items.nodes);
</script>

<section>
	<div class="task-table table rounded-box bg-base-200 shadow-md p-4 flex flex-col">
    {#each tasks as task (task.id)}
      <div class="task-row grid grid-cols-[fit-content(80%)_1fr_auto] gap-4 py-2 items-center">
        <div class="task-text">{task.name}</div>
        <div class="task-tags">
          {#await getTagsForTask(task.id || '') then tags}
            {#each tags as tag}
              <span class="tag px-1">{tag.name}</span>
            {/each}
          {:catch error}
            <span class="error">Error loading tags: {error.message}</span>
          {/await}
        </div>
        <div class="task-date">{(task.createdAt as Timestamp).toDate().toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric' 
        })}</div>
      </div>
    {/each}
	</div>
</section>

<style>
	.task-table {
    width: fit-content; /* shrinks to content */
    min-width: 60%; /* ensures it doesn't shrink too small */
    max-width: 100%; /* prevents overflow */
    margin: 0 auto; /* centers the table */
  }

  .task-row {
    border-bottom: 0.5px solid --alpha(var(--color-primary) / 50%); /* light border for separation */
  }

  .task-row:last-child {
    border-bottom: none; /* remove border from last row */
  }

  .task-tags, .task-date {
    text-align: right;
  }
</style>