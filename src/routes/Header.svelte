<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { uiState, firebase } from '$lib/globalState.svelte';
	import logo from '$lib/images/svelte-logo.svg';
	import github from '$lib/images/github.svg';
	
	function handleTasksClick(e: Event) {
		e.preventDefault();
		
		// If coming from homepage and user is logged in, show sidebar
		if (page.url.pathname === '/' && firebase.user) {
			uiState.sidebarVisible = true;
		}
		
		goto('/tasks');
	}
	
	function handleHomeClick(e: Event) {
		e.preventDefault();
		
		// Hide sidebar when going to home
		uiState.sidebarVisible = false;
		
		goto('/');
	}
</script>

<header>
	<nav>
		<svg viewBox="0 0 2 3" aria-hidden="true">
			<path d="M0,0 L1,2 C1.5,3 1.5,3 2,3 L2,0 Z" />
		</svg>
		<ul>
			<li aria-current={page.url.pathname === '/' ? 'page' : undefined}>
				<a href="/" onclick={handleHomeClick}>Home</a>
			</li>
			<li aria-current={page.url.pathname === '/tasks' ? 'page' : undefined}>
				<a href="/tasks" onclick={handleTasksClick}>Tasks</a>
			</li>
		</ul>
		<svg viewBox="0 0 2 3" aria-hidden="true">
			<path d="M0,0 L0,3 C0.5,3 0.5,3 1,2 L2,0 Z" />
		</svg>
	</nav>
</header>

<style>
	header {
		display: flex;
		justify-content: space-between;
	}

	nav {
		display: flex;
		justify-content: center;
		/* --background: rgba(255, 255, 255, 0.7); */
	}

	svg {
		width: 2em;
		height: 3em;
		display: block;
	}

	path {
		fill: var(--background);
	}

	ul {
		position: relative;
		padding: 0;
		margin: 0;
		height: 3em;
		display: flex;
		justify-content: center;
		align-items: center;
		list-style: none;
		background: var(--background);
		background-size: contain;
	}

	li {
		position: relative;
		height: 100%;
	}

	li[aria-current='page']::before {
		--size: 6px;
		content: '';
		width: 0;
		height: 0;
		position: absolute;
		top: 0;
		left: calc(50% - var(--size));
		border: var(--size) solid transparent;
		border-top: var(--size) solid var(--color-theme-1);
	}

	nav a {
		display: flex;
		height: 100%;
		align-items: center;
		padding: 0 0.5rem;
		color: var(--color-text);
		font-weight: 700;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		text-decoration: none;
		transition: color 0.2s linear;
	}

	a:hover {
		color: var(--color-theme-1);
	}
</style>
