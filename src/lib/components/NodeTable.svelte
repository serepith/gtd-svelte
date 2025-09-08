<script lang="ts">
	import { goto } from '$app/navigation';
	import AnimatedIcon from '$lib/icons/AnimatedIcon.svelte';
	import { Timestamp } from 'firebase/firestore';

	type TaskWithSource = Task & {
		sourceTagId: string;
		sourceTagName: string;
		isEquivalent: boolean;
	};

	interface Props {
		nodes: (Task | Tag | TaskWithSource | (Task & { tags?: Tag[] }))[];
		title: string;
		icon?: any;
		iconSize?: number;
		emptyMessage?: string;
		variant?: 'parent' | 'child' | 'default';
		showSourceTag?: boolean;
		showTags?: boolean;
		showActions?: boolean;
		showFilters?: boolean;
		showCompleted?: boolean;
		showArchived?: boolean;
		sortByDateAsc?: boolean;
		onComplete?: (task: Task) => void;
		onArchive?: (task: Task) => void;
		onEdit?: (task: Task) => void;
		onToggleCompleted?: () => void;
		onToggleArchived?: () => void;
		onToggleSort?: () => void;
	}

	let { 
		nodes, 
		title, 
		icon, 
		iconSize = 20, 
		emptyMessage = 'No items to show',
		variant = 'default',
		showSourceTag = false,
		showTags = false,
		showActions = false,
		showFilters = false,
		showCompleted = false,
		showArchived = false,
		sortByDateAsc = false,
		onComplete,
		onArchive,
		onEdit,
		onToggleCompleted,
		onToggleArchived,
		onToggleSort
	}: Props = $props();

	function handleNodeClick(node: Task | Tag | TaskWithSource) {
		if (node.type === 'task') {
			goto(`/tasks/${node.id}`);
		} else if (node.type === 'tag') {
			goto(`/tags/${node.name}`);
		}
	}
	
	function isTaskWithSource(node: Task | Tag | TaskWithSource): node is TaskWithSource {
		return node.type === 'task' && 'sourceTagId' in node;
	}

	function isTaskWithTags(node: Task | Tag | TaskWithSource | (Task & { tags?: Tag[] })): node is Task & { tags?: Tag[] } {
		return node.type === 'task' && 'tags' in node;
	}

	function formatDate(timestamp: Timestamp) {
		return timestamp.toDate().toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	let headerColorClass = $derived(() => {
		switch (variant) {
			case 'parent':
				return 'text-primary';
			case 'child':
				return 'text-secondary';
			default:
				return 'text-base-content';
		}
	});
</script>

{#if nodes.length > 0 || showFilters}
	<div class="node-table-panel bg-base-100 border border-base-300 rounded-box mb-6 shadow-sm">
		<div class="p-4 border-b border-base-300">
			<div class="flex items-center justify-between">
				<h2 class="flex items-center gap-2 text-lg font-semibold {headerColorClass}">
					{#if icon}
						{@const IconComponent = icon}
						<IconComponent size={iconSize} />
					{/if}
					{title} ({nodes.length})
				</h2>
				{#if showFilters}
					<div class="flex items-center gap-4">
						<button
							class="sort-btn"
							onclick={onToggleSort}
							aria-label="Sort by date {sortByDateAsc ? 'oldest first' : 'newest first'}"
							title="Sort by date {sortByDateAsc ? 'oldest first' : 'newest first'}"
						>
							<span class="text-sm font-medium">Date</span>
							<span class="sort-arrow" class:flipped={sortByDateAsc}>↓</span>
						</button>
						<div onclick={onToggleCompleted}>
							<AnimatedIcon
								iconType="complete"
								buttonType="filter"
								size={1.5}
								selected={showCompleted}
							/>
						</div>
						<div onclick={onToggleArchived}>
							<AnimatedIcon
								iconType="archive"
								buttonType="filter"
								size={1.5}
								selected={showArchived}
							/>
						</div>
					</div>
				{/if}
			</div>
		</div>
		<div class="p-4">
			{#if nodes.length === 0}
				<div class="empty-state py-8 text-center">
					<p class="text-base-content/70 text-lg">{emptyMessage}</p>
				</div>
			{:else}
				<div class="grid gap-3">
					{#each nodes as node (node.id)}
					<div 
						class={`node-card bg-base-200 rounded-lg p-4 border border-base-300 cursor-pointer transition-all duration-200 ${
							node.type === 'task' 
								? variant === 'child' ? 'hover:bg-secondary/10' : 'hover:bg-primary/10'
								: variant === 'child' ? 'hover:bg-warning/10' : 'hover:bg-info/10'
						}`}
						onclick={() => handleNodeClick(node)}
						role="button"
						tabindex="0"
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								handleNodeClick(node);
							}
						}}
					>
						<div class="flex items-center gap-3">
							{#if node.type === 'task'}
								<div onclick={(e) => e.stopPropagation()} role="button" tabindex="-1" onkeydown={() => {}}>
									<AnimatedIcon 
										iconType="complete" 
										buttonType="action" 
										bind:selected={node.completed} 
										size={1.2}
									/>
								</div>
								<div class="flex-1">
									<div class="font-medium" class:line-through={node.completed} class:opacity-60={node.completed}>
										{node.name}
									</div>
									<div class="flex items-center gap-2 mt-1">
										<div class="text-xs text-base-content/60">
											Task • Created {formatDate(node.createdAt).split(',')[0]}
										</div>
										{#if showSourceTag && isTaskWithSource(node)}
											<div class="tag-chip-small" class:equivalent-tag={node.isEquivalent}>
												#{node.sourceTagName}
											</div>
										{/if}
										{#if showTags && isTaskWithTags(node) && node.tags && node.tags.length > 0}
											{#each node.tags as tag}
												<button 
													class="tag-chip-small tag-chip-clickable"
													onclick={(e) => {
														e.stopPropagation();
														goto(`/tags/${tag.name}`);
													}}
													aria-label="Go to tag {tag.name}"
													title="Go to tag {tag.name}"
												>
													#{tag.name}
												</button>
											{/each}
										{/if}
									</div>
								</div>
								{#if node.archived}
									<span class="badge badge-warning badge-sm">Archived</span>
								{/if}
								{#if showActions}
									<div class="task-actions">
										<div onclick={(e) => e.stopPropagation()} role="button" tabindex="-1" onkeydown={() => {}}>
											<AnimatedIcon 
												iconType="complete" 
												buttonType="action" 
												bind:selected={node.completed}
												onclick={() => onComplete?.(node)}
											/>
										</div>
										<div onclick={(e) => e.stopPropagation()} role="button" tabindex="-1" onkeydown={() => {}}>
											<AnimatedIcon 
												iconType="archive" 
												buttonType="action" 
												bind:selected={node.archived}
												onclick={() => onArchive?.(node)}
											/>
										</div>
										<button
											class="action-btn edit-btn"
											onclick={(e) => {
												e.stopPropagation();
												onEdit?.(node);
											}}
											aria-label="Edit {node.name}"
											title="Edit task"
										>
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
												<path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
											</svg>
										</button>
									</div>
								{/if}
							{:else if node.type === 'tag'}
								<div class={`w-6 h-6 rounded-full flex items-center justify-center ${
									variant === 'child' ? 'bg-warning' : 'bg-info'
								}`}>
									<span class={`text-xs font-bold ${
										variant === 'child' ? 'text-warning-content' : 'text-info-content'
									}`}>#</span>
								</div>
								<div class="flex-1">
									<div class="font-medium">
										{node.name}
									</div>
									<div class="text-xs text-base-content/60 mt-1">
										Tag • Created {formatDate(node.createdAt).split(',')[0]}
									</div>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
		</div>
	</div>
{/if}

<style>
	.node-table-panel {
		transition: all 0.2s ease;
	}

	.node-card {
		border: 1px solid rgb(from var(--color-base-300) r g b / 0.5);
	}

	.node-card:hover {
		border-color: rgb(from var(--color-primary) r g b / 0.3);
		transform: translateY(-1px);
		box-shadow: 0 4px 8px rgb(from var(--color-base-content) r g b / 0.1);
	}
	
	.tag-chip-small {
		background-color: var(--color-primary);
		color: var(--color-primary-content);
		padding: 0.125rem 0.375rem;
		border-radius: 9999px;
		font-size: 0.65rem;
		font-weight: 500;
		opacity: 0.9;
	}

	.tag-chip-clickable {
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.tag-chip-clickable:hover {
		opacity: 1;
		transform: scale(1.05);
		box-shadow: 0 2px 4px rgb(from var(--color-base-content) r g b / 0.2);
	}

	.tag-chip-clickable:active {
		transform: scale(0.95);
	}
	
	.equivalent-tag {
		background-color: var(--color-accent);
		color: var(--color-accent-content);
		opacity: 0.8;
	}
	
	.task-actions {
		display: flex;
		gap: 0.25rem;
		opacity: 0.15;
		transition: opacity 0.3s ease;
		justify-content: flex-end;
	}

	.node-card:hover .task-actions {
		opacity: 0.6;
	}

	.task-actions:hover {
		opacity: 1;
	}

	.action-btn {
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
	}

	.action-btn:hover {
		background-color: var(--color-base-300);
		transform: scale(1.1);
	}

	.edit-btn:hover {
		background-color: rgb(from var(--color-info) r g b / 0.2);
		color: var(--color-info);
	}

	.action-btn :global(svg) {
		width: 1rem;
		height: 1rem;
	}
	
	/* Better mobile visibility - no hover effects on touch devices */
	@media (max-width: 768px) {
		.task-actions {
			opacity: 0.7;
		}
	}
	
	.sort-btn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		border: none;
		background: transparent;
		cursor: pointer;
		border-radius: 0.25rem;
		transition: all 0.2s ease;
		color: var(--color-base-content);
	}

	.sort-btn:hover {
		background-color: var(--color-base-300);
		transform: scale(1.05);
	}

	.sort-arrow {
		transition: transform 0.2s ease;
		font-size: 1rem;
	}

	.sort-arrow.flipped {
		transform: rotate(180deg);
	}
</style>