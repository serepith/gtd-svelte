<script lang="ts">
	import { goto } from '$app/navigation';
	import { updateTask, getTagsForTask } from '$lib/database';
	import { data } from '$lib/globalState.svelte';
	import { Timestamp } from 'firebase/firestore';
	import AnimatedIcon from '$lib/icons/AnimatedIcon.svelte';
	import NodeTable from '$lib/components/NodeTable.svelte';
	import ListTodo from '@lucide/svelte/icons/list-todo';

	
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
	let sortByDateAsc = $state(false);
	// let tasks = $derived(
	// 	(collections.nodes.filter((node) => node.type === 'task') as Task[]).filter(
	// 		(node) => (showCompleted || !node.completed) && (showArchived || !node.archived)
	// 	).sort((a, b) => b.createdAt - a.createdAt)
	// );

	let sortedTasks = $derived.by(() => {
		const filtered = data.tasks.filter(
			(task) => (showCompleted || !task.completed) && (showArchived || !task.archived)
		);

		return filtered.sort((a, b) => {
			const aTime = (a.createdAt as Timestamp).toMillis();
			const bTime = (b.createdAt as Timestamp).toMillis();
			return sortByDateAsc ? aTime - bTime : bTime - aTime;
		});
	});

	// Enrich tasks with their tags
	let tasksWithTags = $state<Array<Task & { tags?: Tag[] }>>([]);

	// Update tasks with tags whenever sortedTasks changes
	$effect(() => {
		if (sortedTasks.length === 0) {
			tasksWithTags = [];
			return;
		}

		// Use an async function inside the effect
		(async () => {
			const enrichedTasks = await Promise.all(
				sortedTasks.map(async (task) => {
					try {
						const tags = await getTagsForTask(task.id || '');
						return { ...task, tags };
					} catch (error) {
						console.error('Failed to get tags for task:', task.id, error);
						return { ...task, tags: [] };
					}
				})
			);

			tasksWithTags = enrichedTasks;
		})();
	});


	function handleComplete(task: Task) {
		console.log('Toggle complete task:', task.name);
		updateTask(task.id || '', { completed: !task.completed });
	}

	function handleArchive(task: Task) {
		console.log('Toggle archive task:', task.name);
		updateTask(task.id || '', { archived: !task.archived });
	}

	function handleEdit(task: Task) {
		console.log('Edit task:', task.name);
		goto(`/tasks/${task.id}`);
	}
	
	function toggleCompleted() {
		showCompleted = !showCompleted;
	}
	
	function toggleArchived() {
		showArchived = !showArchived;
	}
	
	function toggleSort() {
		sortByDateAsc = !sortByDateAsc;
	}
	
	let emptyMessage = $derived(() => {
		if (!showCompleted && !showArchived) {
			return 'All your tasks are completed or archived. Use the filter buttons to show them.';
		} else if (showCompleted && !showArchived) {
			return 'No completed tasks to show.';
		} else if (!showCompleted && showArchived) {
			return 'No archived tasks to show.';
		} else {
			return 'Create your first task to get started!';
		}
	});
</script>

<section class="flex-1 items-center">
	<div class="task-container">
		<NodeTable 
			nodes={tasksWithTags}
			title="Tasks"
			showActions={true}
			showFilters={true}
			showTags={true}
			{showCompleted}
			{showArchived}
			{sortByDateAsc}
			emptyMessage={emptyMessage()}
			onComplete={handleComplete}
			onArchive={handleArchive}
			onEdit={handleEdit}
			onToggleCompleted={toggleCompleted}
			onToggleArchived={toggleArchived}
			onToggleSort={toggleSort}
		/>
	</div>
</section>

<style>
	.task-container {
		width: fit-content;
		min-width: 60%;
		max-width: 100%;
		margin: 0 auto;
	}
</style>
