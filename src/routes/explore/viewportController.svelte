<script lang="ts">
	import { useViewport } from '@xyflow/svelte';

	let { viewport = $bindable() } = $props();

	viewport = useViewport();
</script>
