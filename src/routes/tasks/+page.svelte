<script lang="ts">
  import { items } from '$lib/globalState.svelte';
	import { Timestamp } from 'firebase/firestore';

  let tasks = $derived(items.nodes);
</script>

<section>
  <ul class="list rounded-box shadow-md bg-base-200">
    {#each tasks as task (task.id)}
      <li class="list-row">
        <div class="task-text list-col-grow">{task.name}</div>
        <div class="task-date">{(task.createdAt as Timestamp).toDate().toDateString()}</div>
      </li>
    {/each}
  </ul>
</section>