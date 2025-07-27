<script lang="ts">
	import { addTask } from '$lib/database';
	import { firebase } from '$lib/globalState.svelte';
	import { tick } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	// Space character for tag boundaries
	//const SEPARATOR_SPACE = '\u2002';

	// bindings
	let { isSidebar = $bindable(false) } = $props();
	
	let taskInputElement: HTMLDivElement | null = null;

	export class Chunk2 {
		content: string;
		type = () => {
			return this.content.includes('#') ? 'tag' : 'text';
		};

		constructor(ctn?: string, typ?: 'text' | 'tag') {
			this.content = $state(ctn || '');
		}
	}

	//const chunk = (content?: string, type?: 'text' | 'tag') => new Chunk(content, type);

	const chunk = (content: string = '', type = () => content.includes('#') ? 'tag' : 'text') => {
		let t = $derived(content.includes('#'));
		let c = { content, type };
		return c;
	}

	type Chunk = { content: string, type: 'text' | 'tag' };

	let chunks = $state([chunk('ttt')]);

	let chunkTypes = $derived(chunks.map(chunk => 
			chunk.content.startsWith('#') ? 'tag' : 'text'
		));

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
	let currentNodeTextPosition = $state(window.getSelection()?.anchorOffset);
	let currentNodeIndex = $derived(parseInt(currentNode?.dataset.itemId || '0'));
	let currentChunk = $derived(chunks[currentNodeIndex]);

	
	$inspect(chunks).with(console.log);
	$inspect(currentNodeIndex).with(console.log);
	$inspect(currentChunk).with(console.log);
	$inspect(currentNodeTextPosition).with(console.log);

	// claude code
	$effect(() => {
		//console.log("cleanup");
		let merged = [];
		let i = 0;
		let mergedNodeIndex;
		
		for (let i = chunks.length - 1; i > 0; i--) {
			if (chunkTypes[i] === 'text' && chunkTypes[i - 1] === 'text') {
				let newFocus;
				let newFocusOffset : number;

				// If we're deleting the active chunk, move cursor to previous
				if (i === currentNodeIndex) {
					console.log("i=" + i + " current node ndex " + currentNodeIndex);
					newFocus = i-1;
					newFocusOffset = chunks[i - 1].content.length;
				}
				
				chunks[i - 1].content += chunks[i].content;
				chunks.splice(i, 1);

				console.log("new focus wtf " + newFocus);

				if(newFocus != undefined) {
					// set timeout so the DOM will update first
					setTimeout(() => {
						//console.log("NEW FOCUS index " + (i-1));
						let newFocusElement = taskInputElement?.querySelector(`[data-item-id="${i-1}"]`);
						//console.log("NEW FOCUS " + newFocusElement?.outerHTML);
						// set focus to the text so we can put the cursor in the proper location
						if(newFocusElement)
							window.getSelection()?.setPosition(newFocusElement.firstChild, newFocusOffset);
					}, 0);
				}
			}
  	}
		
	});
	

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
				// if(currentNode?.dataset && currentNode?.dataset.itemId) {
				// 	(chunks[parseInt(currentNode.dataset.itemId)]).type() = 'text';
				// }
			}
		}

    if (event.key === '#' || event.key === '/') {
      event.preventDefault();

      // Prevent invalid separator pairs
      if (wouldCreateInvalidPair(event.key)) {
        return;
      }

			const nodeText = currentNode?.textContent;

			const textBeforeCursor = nodeText?.substring(0, currentNodeTextPosition) || '';
			const textAfterCursor = nodeText?.substring(currentNodeTextPosition || nodeText?.length);

			console.log("substring 1: " + textBeforeCursor);
			console.log("substring 2: " + textAfterCursor);

			currentChunk.content += ' ';

			currentChunk.content = textBeforeCursor;
			//chunks.push(chunk('#' + textAfterCursor));
			chunks.splice(currentNodeIndex + 1, 0, chunk('#' + textAfterCursor));
			//chunks.push(chunk('#'));

			if(currentNodeTextPosition)
				currentNodeTextPosition = (currentNodeTextPosition - textBeforeCursor.length + 1);

			setTimeout(() => {
				console.log("current node: " + currentNode?.outerHTML);
				console.log("parent node: " + currentNode?.parentElement?.outerHTML);
				console.log("uhhh " + currentNode?.nextElementSibling?.outerHTML);
				if(currentNode?.nextElementSibling) {
						//alert("set pos to next sib"+ currentNode.nextSibling.parentElement?.outerHTML);
						window.getSelection()?.setPosition(currentNode.nextElementSibling, 1);
						//updateCurrentNode();
					}
			}, 0);

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

	function taskTextEmpty() {
		return chunks.length === 1 && (chunks[0].content.length === 0 || chunks[0].content === '<br>');
	}

	// Handle form submission
	function handleSubmit(event: Event) {
		console.log("HANDLE SUBMIT");

		event.preventDefault();

		if (!firebase.user) {
			alert('Please log in to add a task.');
			return;
		}

		if (!taskTextEmpty()) {
      console.log(chunks);
			addTask(chunks);
			chunks = [];
		}
	}

	function updateCurrentNode() {
		// console.log("current node " + window.getSelection()?.anchorNode?.textContent);
		// console.log("parent node " + window.getSelection()?.anchorNode?.parentElement?.outerHTML);

		let lastCurrentNodeIndex = currentNodeIndex;

		console.log("current node index " + currentNodeIndex + "\n chunks length " + chunks.length);

		
			// node type 3 is text
			if(window.getSelection()?.anchorNode?.nodeType === 3)
				currentNode = window.getSelection()?.anchorNode?.parentElement;

			// 1 is element
			else if(window.getSelection()?.anchorNode?.nodeType === 1)
				currentNode = window.getSelection()?.anchorNode as HTMLElement;

			if(window.getSelection()?.anchorOffset)
				currentNodeTextPosition = window.getSelection()?.anchorOffset;
		

		
	}
</script>


<svelte:document />
<!-- onsubmit={handleSubmit} -->
<form class="justify-items-center grid grid-cols-1" class:sidebar-form={isSidebar}>
	<!-- Normal mode: stacked layout -->
	<div class="relative mb-4 min-w-3xs items-center">
		<!-- Placeholder overlay -->
		{#if taskTextEmpty()}
			<div
				class="textarea pointer-events-none absolute inset-0
				bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary"
				style="z-index: 5; min-height: 3.5rem; padding: 1rem 0.75rem;"
			>
				What's on your mind?
			</div>
		{/if}

		<!-- oninput={handleInput} -->
		<div
			bind:this={taskInputElement}
			contenteditable="false"
			class="textarea taskinput-textarea inset-0"
			style="min-height: 3.5rem; padding: 1rem 0.75rem; word-wrap: break-word; overflow-wrap: break-word; white-space: pre-wrap;"
		>
			{#each chunks as chunk, i (i)}
				<div 
				  data-item-id={i}
					bind:innerHTML={chunk.content}
					contenteditable="true"
					class="{chunkTypes[i]}-chip" 
					role="textbox"
					tabindex={i}
					transition:scale={{ duration: 50 }}
					onkeydown={handleKeydown}
					onkeyup={(e) => {
						if(i > 0 && (chunks[i].content.length === 0 || chunk.content === '<br>')) {
							console.log("CURRENT NODE " + currentNode?.outerHTML);
							if(currentNode?.previousElementSibling) {
									//alert("set pos to next sib"+ currentNode.nextSibling.parentElement?.outerHTML);
									window.getSelection()?.setPosition(currentNode.previousElementSibling, 1);
									//updateCurrentNode();
								}
							chunks.splice(i, 1);
							//setTimeout(() => {
							// console.log("current node: " + currentNode?.outerHTML);
							// console.log("parent node: " + currentNode?.parentElement?.outerHTML);
							// console.log("uhhh " + currentNode?.nextElementSibling?.outerHTML);
						//}, 0);
						}
						// console.log('Updated chunk', i, chunks[i].content);
						// 	console.log("selection after: ", sel?.anchorNode?.textContent);
						// 	console.log("index: ", sel?.anchorOffset);
						// 	console.log("set selection to " + sel?.anchorNode?.textContent + " at " + ((sel?.anchorOffset || 0) - 1));


						// setTimeout(() => {
						// 	console.log("selection at set: ", sel?.anchorNode?.textContent);
						// 	console.log("index: ", sel?.anchorOffset);
						// 	if(node)
						// 		window.getSelection()?.setPosition(node, index);
						// }, 0);
						}}>
					</div>
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

	.text-chip, .tag-chip {
		display: inline-block;
		vertical-align: baseline;
		margin-inline: 0.125rem;
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
