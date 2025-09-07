<script lang="ts">
	import { goto } from "$app/navigation";
	import { addTagToTask, getRelations } from "$lib/database";
	import type { SearchResult } from "$lib/embeddings";
	import { createDebouncedSearch } from "$lib/semanticSearch";
	import { Asterisk } from "@lucide/svelte";
	import { fade } from "svelte/transition";

  interface RelationsDisplayProps {
    nodes: GraphNode[],
    task: Task
  }

  let { nodes, task }: RelationsDisplayProps = $props();
  
	// Tag input state
	let showTagInput = $state(false);
	let tagInputValue = $state('');
	let tagSuggestions = $state<SearchResult[]>([]);
	let showTagSuggestions = $state(false);
	let selectedTagIndex = $state(-1);
	let isSearchingTags = $state(false);

	let tagInputElement: HTMLInputElement;

  
	// Create debounced search for tags
	const debouncedTagSearch = createDebouncedSearch(300);

	// Update tag suggestions when input changes
	function updateTagSuggestions() {
		const query = tagInputValue.trim();
		
		if (query.length < 2) {
			showTagSuggestions = false;
			tagSuggestions = [];
			isSearchingTags = false;
			return;
		}

		isSearchingTags = true;
		showTagSuggestions = true;

		debouncedTagSearch(query, (results) => {
			// Filter out tags that are already associated with this task
			const currentTagNames = nodes
				.filter(node => node.type === 'tag')
				.map(tag => tag.name.toLowerCase());
			
			// Only show tag results that aren't already on this task
			tagSuggestions = results
				.filter(result => 
					result.type === 'tag' && 
					!currentTagNames.includes(result.item.name.toLowerCase())
				)
				.slice(0, 5);
			
			isSearchingTags = false;
			selectedTagIndex = -1;
		}, 8);
	}

	// Watch tag input changes
	$effect(() => {
		tagInputValue;
		if (showTagInput) {
			updateTagSuggestions();
		}
	});

  
	function handleNodeClick(node: GraphNode) {
		if(node.type === "tag")
			goto(`/tags/${node.name}`);
		else
			goto(`/tasks/${node.id}`)
	}
	
	// Tag management functions
	function addTag() {
		showTagInput = true;
		tagInputValue = '';
		setTimeout(() => tagInputElement?.focus(), 0);
	}

	function cancelTagInput() {
		showTagInput = false;
		tagInputValue = '';
		showTagSuggestions = false;
		tagSuggestions = [];
		selectedTagIndex = -1;
	}

	async function saveTag(tagName?: string) {
		const finalTagName = tagName || tagInputValue.trim();
		
		if (!finalTagName || !task) return;

		try {
			// Check if tag is already associated
			const existingTag = nodes.find(
				node => node.type === 'tag' && node.name.toLowerCase() === finalTagName.toLowerCase()
			);
			
			if (existingTag) {
				console.log('Tag already exists on task');
				cancelTagInput();
				return;
			}

			// Add the tag to the task
			await addTagToTask(finalTagName, { id: task.id } as any);
			
			// Reload parent nodes to show the new tag
			nodes = await getRelations(task.id || '', 'parent');
			
			cancelTagInput();
		} catch (error) {
			console.error('Error adding tag to task:', error);
		}
	}

	// Handle keyboard navigation for tag suggestions
	function handleTagKeydown(event: KeyboardEvent) {
		if (!showTagSuggestions || tagSuggestions.length === 0) {
			if (event.key === 'Enter') {
				event.preventDefault();
				saveTag();
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				cancelTagInput();
				return;
			}
			return;
		}

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				selectedTagIndex = Math.min(selectedTagIndex + 1, tagSuggestions.length - 1);
				break;

			case 'ArrowUp':
				event.preventDefault();
				selectedTagIndex = Math.max(selectedTagIndex - 1, -1);
				break;

			case 'Enter':
				event.preventDefault();
				if (selectedTagIndex >= 0) {
					const selectedTag = tagSuggestions[selectedTagIndex].item as Tag;
					saveTag(selectedTag.name);
				} else {
					saveTag();
				}
				break;

			case 'Escape':
				event.preventDefault();
				cancelTagInput();
				break;
		}
	}

	// Handle clicking on a tag suggestion
	function selectTagSuggestion(suggestion: SearchResult) {
		const tag = suggestion.item as Tag;
		saveTag(tag.name);
	}

	// Close suggestions when input loses focus
	function handleTagBlur(event: FocusEvent) {
		setTimeout(() => {
			const relatedTarget = event.relatedTarget as HTMLElement;
			const dropdown = document.querySelector('.tag-suggestions-dropdown');
			if (relatedTarget && dropdown?.contains(relatedTarget)) {
				return;
			}
			showTagSuggestions = false;
		}, 150);
	}

	function removeTag(tagId: string) {
		console.log('Remove tag from task:', tagId);
		// TODO: Implement remove tag logic
	}
</script>


<div class="flex flex-wrap gap-3">
  {#each nodes as parent (parent.id)}
    <div class="removable-tag relative">
      <button class="tag-chip clickable-tag" onclick={() => handleNodeClick(parent)}>
        #{parent.name}
      </button>
      <button
        class="remove-tag-button bg-error hover:bg-error/80 text-error-content absolute -top-2 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold transition-all duration-200"
        onclick={() => removeTag(parent.id || '')}
        title="Remove tag"
      >
        ×
      </button>
    </div>
  {/each}
  {#if showTagInput}
    <div class="relative">
      <input
        bind:this={tagInputElement}
        bind:value={tagInputValue}
        onkeydown={handleTagKeydown}
        onblur={handleTagBlur}
        class="input input-sm input-bordered min-w-32"
        placeholder="Enter tag name"
        autocomplete="off"
      />
      
      <!-- Tag suggestions dropdown -->
      {#if showTagSuggestions}
        <div
          class="tag-suggestions-dropdown absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-base-300 bg-base-100 shadow-lg"
          transition:fade={{ duration: 150 }}
        >
          {#if isSearchingTags}
            <div class="flex items-center justify-center p-3 text-sm text-base-content/70">
              <div class="loading loading-spinner loading-sm mr-2"></div>
              Searching tags...
            </div>
          {:else if tagSuggestions.length === 0}
            <div class="p-3 text-center text-sm text-base-content/70">
              No similar tags found
            </div>
          {:else}
            {#each tagSuggestions as suggestion, index}
              {@const tag = suggestion.item as Tag}
              <button
                type="button"
                onclick={() => selectTagSuggestion(suggestion)}
                class="flex w-full items-center gap-3 border-b border-base-200 p-3 text-left transition-colors duration-150 last:border-b-0 hover:bg-base-200 focus:bg-base-200 focus:outline-none"
                class:bg-primary={selectedTagIndex === index}
                class:text-primary-content={selectedTagIndex === index}
              >
                <div class="w-5 h-5 rounded-full bg-info flex items-center justify-center text-info-content text-xs font-bold">
                  #
                </div>
                <div class="flex-1">
                  <div class="font-medium">{tag.name}</div>
                  <div class="text-xs text-base-content/60">
                    {Math.round(suggestion.similarity * 100)}% match
                  </div>
                </div>
              </button>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <button class="tag-chip add-tag-chip" onclick={addTag} title="Add a new tag">
      ＋
    </button>
  {/if}
</div>

<style>
	.add-tag-chip {
		background-color: transparent;
		color: var(--color-base-content);
		border: 1px dashed var(--color-base-content);
		opacity: 0.5;
	}

	.add-tag-chip:hover {
		background-color: var(--color-primary);
		color: var(--color-primary-content);
		border-color: var(--color-primary);
		opacity: 1;
		transform: scale(1.05);
	}

	/* Make entire removable tag container transparent when hovering over remove button */
	.removable-tag:has(.remove-tag-button:hover) {
		opacity: 0.3;
		transform: scale(0.95);
	}

	.removable-tag {
		transition: all 0.2s ease;
	}
</style>