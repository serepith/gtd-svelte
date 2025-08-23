<script lang="ts">
	import type { User } from 'firebase/auth';
	import type { Firestore } from 'firebase/firestore';
	import { setContext } from 'svelte';
	//import { CollectionState, type CurrentUserState } from "svelte-firebase-state";
	//TODO type is not any
	//let { user, firestore, children }: { user: CurrentUserState, firestore: Firestore, children: any } = $props();
	// TypeScript knows these are non-null by the time we get here
	//setContext('data', { user, nodes, firestore });
</script>

<!-- {#if children}
  {@render children()}
{/if} -->
