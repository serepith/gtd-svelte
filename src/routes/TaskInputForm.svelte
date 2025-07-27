<script lang="ts">
	import { addTask } from '$lib/database';
	import { firebase } from '$lib/globalState.svelte';
	import { tick } from 'svelte';

	// Space character for tag boundaries
	//const SEPARATOR_SPACE = '\u2002';

	// bindings
	let { isSidebar = $bindable(false) } = $props();
	
	let contentEditableElement: HTMLDivElement | null = null;

	// const chunks = $derived.by(() => {
	// 	console.log("CHUNKS");
	// 	if (!taskText) return [];

	// 	// Split on separators but keep them using capturing groups
	// 	const parts = taskText.split(/(#|\/|\u2002)/).filter(Boolean);
	// 	const result = [];
	// 	console.log('Parts:', parts);
	// 	let currentText = '';
	// 	let currentType = 'text';

	// 	for (const part of parts) {
	// 		if (part === '#') {
	// 			// Push any accumulated text first
	// 			if (currentText && currentType === 'text') {
	// 				result.push({ type: currentType, content: currentText });
	// 			}
	// 			currentText = '#';
	// 			currentType = 'tag-inline';
	// 		} else if (part === '/') {
	// 			// Push any accumulated text first
	// 			if (currentText || currentType === 'text') {
	// 				result.push({ type: currentType, content: currentText });
	// 			}
	// 			currentText = '/';
	// 			currentType = 'tag-meta';
	// 		} else if (part === SEPARATOR_SPACE) {
	// 			// End current chunk
  //       result.push({ type: currentType, content: currentText });
  //       // Push separator
  //       result.push({ type: 'separator', content: SEPARATOR_SPACE });
  //       // Reset for next chunk
  //       currentText = '';
  //       currentType = 'text';
	// 		} else if (part !== undefined) {
	// 			currentText += part;
	// 		}
	// 	}

	// 	// Don't forget the last chunk
	// 	if (currentText || currentType !== 'text') {
	// 		result.push({ type: currentType, content: currentText });
	// 	}

  //   console.log('Chunks:', result);
	// 	return result;
	// });

	type Chunk = { content: string, type: 'text' | 'tag' };

	let chunks = $state([{ content: 'tttt', type: 'text' }]);
	$inspect(chunks).with(console.log);

	function getCurrentNode() {
		return window.getSelection()?.anchorNode?.parentElement;
	}

	function getPrecedingChar() {
		let sel = window.getSelection();
		//alert(sel?.anchorOffset);
		//alert(sel?.anchorNode?.textContent);

		if (sel?.anchorNode?.textContent)
			return sel.anchorNode.textContent[sel?.anchorOffset - 1];
	}

	let currentNode = $state(window.getSelection()?.anchorNode?.parentElement);

	let currentChunk = $state(chunks[0]);

	function isInTag(): boolean {
		if(currentNode?.classList)
			return currentNode.classList.contains('tag-chip');
		else return false;
	}

	function wouldCreateInvalidPair(key: string): boolean {
		if (key !== '#' && key !== '/') return false;

		//alert(getPrecedingChar());
		//alert(getCurrentNode()?.outerHTML);
		if(getPrecedingChar() === '#')
			return true;

		return false;
	}

	// Handle keyboard events
	function handleKeydown(event: KeyboardEvent) {
		console.log("HANDLE KEYDOWN");

		updateCurrentNode();

		if(getPrecedingChar() === '#') {
			if (event.key === '#' || event.key === '/') {
      	event.preventDefault();
				return;
			}
			else if (event.key === 'Backspace') {
				// TODO: how to link chunks to DOM?
			}
		}

    if (event.key === '#' || event.key === '/') {
      event.preventDefault();

      // Prevent invalid separator pairs
      if (wouldCreateInvalidPair(event.key)) {
        return;
      }

			chunks.push({ content: '#', type: 'tag' });
				//insertCharacterAtCursor(event.key);
			// alert(currentNode);
			// alert(currentNode?.nextSibling);

			// await tick();
			// await tick();

			setTimeout(() => {
				console.log("current node: " + currentNode?.outerHTML);
				console.log("parent node: " + currentNode?.parentElement?.outerHTML);
				console.log("uhhh " + currentNode?.nextElementSibling?.outerHTML);
				if(currentNode?.nextElementSibling) {
						//alert("set pos to next sib"+ currentNode.nextSibling.parentElement?.outerHTML);
						window.getSelection()?.setPosition(currentNode.nextElementSibling, 1);
						//updateCurrentNode();
					}
			}, 75);

			// else if (isInTag()) {
			// }

      // Ending tag or not, insert the character
      // This needs to be handled manually because we're going to be
      // replacing the contenteditable's innerHTML
      //insertCharacterAtCursor(event.key);
 
      return;
    }

    // Otherwise, if we're in a tag, handle escape characters
    else if(isInTag()) {
      if(event.key === 'Enter' || event.key === 'Tab' || event.key === 'Escape') {
        // If we're in a tag and hit an escape character, end the current tag
        //insertCharacterAtCursor(SEPARATOR_SPACE);
        event.preventDefault();
      }
      return;
    }

		else if (event.key === 'Enter' && !event.shiftKey) {
      // Regular Enter - submit
      event.preventDefault();
      //handleSubmit(event);
		} 

		//console.log('Cursor position after check: ', getCursorPosition());
	}

	// Handle input from contenteditable
	// function handleInput(event: Event) {
	// 	console.log("HANDLE INPUT");

	// 	const target = event.target as HTMLDivElement;
	// 	//taskText = target.textContent || '';

	// 	// Update saved cursor position after input
	// 	//savedCursorPos = getCursorPosition();
	// }

	// Auto-resize the contenteditable
	// function resizeContentEditable(element: HTMLDivElement) {
	// 	console.log("RESIZE EDITABLE");

	// 	element.style.height = 'auto';
	// 	element.style.height = element.scrollHeight + 'px';
	// }

	// Handle resize when content changes
	// $effect(() => {
	// 	console.log("RESIZE EFFECT");

	// 	// Reference taskText to make it a dependency
	// 	taskText;
	// 	if (contentEditableElement) {
	// 		resizeContentEditable(contentEditableElement);
	// 	}
	// });

	// Handle form submission
	// function handleSubmit(event: Event) {
	// 	console.log("HANDLE SUBMIT");

	// 	event.preventDefault();

	// 	if (!firebase.user) {
	// 		alert('Please log in to add a task.');
	// 		return;
	// 	}

	// 	if (taskText.trim()) {
  //     console.log(chunks);
	// 		addTask(chunks);
	// 		taskText = '';
	// 		if (contentEditableElement) {
	// 			contentEditableElement.innerHTML = '';
	// 		}
	// 	}
	// }

	// Sync taskText changes back to contenteditable (for when we clear it)
	// $effect(() => {
	// 	console.log("TASKTEXT EFFECT");

	// 	if (contentEditableElement && !taskText && contentEditableElement.innerHTML !== '') {
	// 		contentEditableElement.innerHTML = '';
	// 	}
	// });

	function updateCurrentNode() {
		console.log("update to " + window.getSelection()?.anchorNode?.parentElement?.outerHTML);
		if(window.getSelection()?.anchorNode)
			currentNode = window.getSelection()?.anchorNode?.parentElement;
	}
</script>


<svelte:document />
<!-- onsubmit={handleSubmit} -->
<form class="justify-items-center grid grid-cols-1" class:sidebar-form={isSidebar}>
	<!-- Normal mode: stacked layout -->
	<div class="relative mb-4 min-w-3xs items-center">
		<!-- Placeholder overlay -->
		<!-- {#if !taskText.trim()}
			<div
				class="textarea pointer-events-none absolute inset-0
				bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary"
				style="z-index: 5; min-height: 3.5rem; padding: 1rem 0.75rem;"
			>
				What's on your mind?
			</div>
		{/if} -->

		<!-- oninput={handleInput} -->
		<div
			bind:this={contentEditableElement}
			contenteditable="true"
			role="textbox"
			aria-multiline="true"
			tabindex="0"
			class="textarea taskinput-textarea inset-0"
			onkeydown={handleKeydown}
			style="min-height: 3.5rem; padding: 1rem 0.75rem; word-wrap: break-word; overflow-wrap: break-word; white-space: pre-wrap;"
		>
			{#each chunks as chunk, i}
				<div contenteditable="true" class="{chunk.type === 'text' ? 'text-chip' : 'tag-chip'}" bind:innerHTML={chunk.content}></div>
			{/each}
		</div>
	</div>

	<button type="submit" class="btn btn-soft btn-lg" class:btn-disabled={!firebase.user}
		>Submit</button
	>
	<!-- {/if} -->
</form>

<style>
	[contenteditable]:focus {
		outline: none;
	}

	.sidebar-form {
		width: 100%;
		justify-items: stretch;
	}

	.sidebar-layout {
		align-items: flex-start;
	}

	.tag-chip-animate {
		animation: tag-chip-appear 0.25s ease-out forwards;
		transform-origin: center;
	}

	@keyframes tag-chip-appear {
		0% {
			opacity: 0;
			transform: scale(0.7);
		}
		60% {
			opacity: 1;
			transform: scale(1.1);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* Force animation restart on newly added elements */
	.tag-chip-animate:not(:defined) {
		animation-play-state: running;
	}
</style>
