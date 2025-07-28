<script lang="ts">
	import Header from './Header.svelte';
	import TaskInputForm from './TaskInputForm.svelte';
	import { page } from '$app/state';
	import '../app.css';
	
	let { children } = $props();

	let isSidebar = $derived(page.url.pathname != '/');
</script>

<div class="app min-h-screen flex flex-col">
	<Header />

	<section class="flex flex-col flex-1 gap-5 p-5">
		<div class="grid place-items-center-safe flex-1
		focus-within:outline-none border-none">
			<TaskInputForm bind:isSidebar />
		</div>

		<main>
			{#if children}
				{@render children()}
			{/if}
		</main>
	</section>
</div>
