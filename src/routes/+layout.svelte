<script lang="ts">
	import Header from './Header.svelte';
	import TaskInputForm from './TaskInputForm.svelte';
	import { page } from '$app/state';
	import '../app.css';

	let { children } = $props();

	let isSidebar = $derived(page.url.pathname != '/');
</script>

<div class="app flex min-h-screen flex-col">
	<Header />

	<section class="flex flex-1 flex-col gap-5 p-5">
		<div
			class="grid flex-1 place-items-center-safe
		border-none focus-within:outline-none"
		>
			<TaskInputForm bind:isSidebar />
		</div>

		<main>
			{#if children}
				{@render children()}
			{/if}
		</main>
	</section>
</div>
