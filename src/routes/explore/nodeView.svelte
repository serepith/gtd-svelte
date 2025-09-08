<script lang="ts">
	let { node = $bindable() }: { node: GraphNode } = $props();

	let itemid = $derived(node.id);
</script>

<div {itemid}>
	{node.name}
</div>
