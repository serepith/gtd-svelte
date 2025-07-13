<script lang="ts">
	import { addTask } from '$lib/database';
	import { firebase } from '$lib/globalState.svelte';
	import { get } from 'svelte/store';

	// Space character for tag boundaries
	const SEPARATOR_SPACE = '\u2002';

	// bindings
	let { taskText = $bindable() } = $props();
	
	let contentEditableElement: HTMLDivElement | null = null;

	const chunks = $derived.by(() => {
		console.log("CHUNKS");
		if (!taskText) return [];

		// Split on separators but keep them using capturing groups
		const parts = taskText.split(/(#|\/|\u2002)/).filter(Boolean);
		const result = [];
		console.log('Parts:', parts);
		let currentText = '';
		let currentType = 'text';

		for (const part of parts) {
			if (part === '#') {
				// Push any accumulated text first
				if (currentText && currentType === 'text') {
					result.push({ type: currentType, content: currentText });
				}
				currentText = '#';
				currentType = 'tag-inline';
			} else if (part === '/') {
				// Push any accumulated text first
				if (currentText || currentType === 'text') {
					result.push({ type: currentType, content: currentText });
				}
				currentText = '/';
				currentType = 'tag-meta';
			} else if (part === SEPARATOR_SPACE) {
				// End current chunk
        result.push({ type: currentType, content: currentText });
        // Push separator
        result.push({ type: 'separator', content: SEPARATOR_SPACE });
        // Reset for next chunk
        currentText = '';
        currentType = 'text';
			} else if (part !== undefined) {
				currentText += part;
			}
		}

		// Don't forget the last chunk
		if (currentText || currentType !== 'text') {
			result.push({ type: currentType, content: currentText });
		}

    console.log('Chunks:', result);
		return result;
	});

	// Render chunks as HTML (for contenteditable updates)
	const renderedHTML = $derived(
		chunks
			.map((chunk) => {
				if (chunk.type === 'text') {
					return chunk.content.replace(/\n/g, '<br>');
				} else if (chunk.type === 'tag-inline') {
					return `<span class="inline-flex items-center"><span class="tag-chip-animate bg-primary text-primary-content px-2 py-1 rounded-full text-sm font-medium">${chunk.content}</span></span>`;
				} else if (chunk.type === 'tag-meta') {
					return `<span class="inline-flex items-center"><span class="tag-chip-animate bg-accent text-accent-content px-2 py-1 rounded-full text-sm font-medium">${chunk.content}</span></span>`;
				} else if (chunk.type === 'separator') {
					return `<span class="text-base-content opacity-40">${SEPARATOR_SPACE}</span>`;
				}
				return '';
			})
			.join('')
	);

	// // debugging
	// $effect(() => {
	// 	$inspect(firebase, 'firebase');
	// });

	// Update contenteditable with styled HTML when chunks change
	// $effect(() => {
	// 	if (contentEditableElement && renderedHTML !== contentEditableElement.innerHTML) {
	// 		// Save selection before updating
	// 		const selection = window.getSelection();
	// 		let savedRange = null;
	// 		if (selection && selection.rangeCount > 0) {
	// 			savedRange = selection.getRangeAt(0).cloneRange();
	// 		}

	// 		contentEditableElement.innerHTML = renderedHTML;

	// 		// Restore selection if possible
	// 		if (savedRange && selection) {
	// 			try {
	// 				selection.removeAllRanges();
	// 				selection.addRange(savedRange);
	// 			} catch (e) {
	// 				// If restoring fails, just put cursor at end
	// 				const range = document.createRange();
	// 				range.selectNodeContents(contentEditableElement);
	// 				range.collapse(false);
	// 				selection.removeAllRanges();
	// 				selection.addRange(range);
	// 			}
	// 		}
	// 	}
	// });

	// Update contenteditable with styled HTML when chunks change
	$effect(() => {
		console.log("CURSOR EFFECT");
		if (contentEditableElement && renderedHTML !== contentEditableElement.innerHTML) {
			// Save cursor position before updating HTML
			const cursorOffset = saveCursorPosition();
			
			contentEditableElement.innerHTML = renderedHTML;

			// Restore cursor position using offset
			restoreCursorPosition(cursorOffset);
		}
	});

	// Store and restore cursor position using text offset approach 
	function saveCursorPosition(): number {
		const selection = window.getSelection();
		if (!selection || !contentEditableElement || selection.rangeCount === 0) return 0;

		const range = selection.getRangeAt(0);
		const preCaretRange = range.cloneRange();
		preCaretRange.selectNodeContents(contentEditableElement);
		preCaretRange.setEnd(range.endContainer, range.endOffset);
		
		const textOffset = preCaretRange.toString().length;
		console.log('Saving cursor position:', textOffset);
		return textOffset;
	}

	function restoreCursorPosition(textOffset: number) {
		if (!contentEditableElement) return;
		
		console.log('Restoring cursor position to:', textOffset);
		
		const walker = document.createTreeWalker(
			contentEditableElement, 
			NodeFilter.SHOW_TEXT, 
			null
		);
		
		let currentOffset = 0;
		let node;
		
		while ((node = walker.nextNode())) {
			const nodeLength = node.textContent?.length || 0;
			
			if (currentOffset + nodeLength >= textOffset) {
				const range = document.createRange();
				const selection = window.getSelection();
				const positionInNode = textOffset - currentOffset;
				
				try {
					range.setStart(node, positionInNode);
					range.setEnd(node, positionInNode);
					selection?.removeAllRanges();
					selection?.addRange(range);
					console.log('Cursor restored successfully');
					return;
				} catch (e) {
					console.error('Failed to restore cursor position:', e);
				}
			}
			
			currentOffset += nodeLength;
		}
		
		console.log('Could not find position, placing at end');
		// Fallback: place cursor at end
		const range = document.createRange();
		const selection = window.getSelection();
		range.selectNodeContents(contentEditableElement);
		range.collapse(false);
		selection?.removeAllRanges();
		selection?.addRange(range);
	}

	// Fallback: Get cursor position as plain text offset
	function getCursorPosition(): number {
		const selection = window.getSelection();
		if (!selection || !contentEditableElement) return 0;

		const range = selection.getRangeAt(0);
		const preCaretRange = range.cloneRange();
		preCaretRange.selectNodeContents(contentEditableElement);
		preCaretRange.setEnd(range.endContainer, range.endOffset);
		return preCaretRange.toString().length;
	}


	// Check if cursor is currently in a tag
	function isInTag(): boolean {
		console.log("IS IN TAG");

		// Find which chunk the cursor is in
		let textPos = 0;
		const cursorPos = getCursorPosition();

		for (const chunk of chunks) {
			const chunkLength = chunk.content.length; // +1 for the trigger char
			if (cursorPos >= textPos && cursorPos <= textPos + chunkLength) {
				return chunk.type === 'tag-inline' || chunk.type === 'tag-meta';
			}
			textPos += chunkLength;
		}

		return false;
	}

  function insertCharacterAtCursor(char: string) {
		console.log("INSERT CHAR AT");

    const selection = window.getSelection();
    if (!selection || !contentEditableElement) return;

    const range = selection.getRangeAt(0);
    const textNode = document.createTextNode(char);

    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);

    // Update our text state
    taskText = contentEditableElement.textContent || '';
  }

	// End current tag by inserting separator
	// function endCurrentTag(addChar?: '#' | '/') {
	// 	// const selection = window.getSelection();
	// 	// if (!selection || !isInTag()) return;
	// 	// const range = selection.getRangeAt(0);

  //   // let addText = SEPARATOR_SPACE;
  //   // if(addChar) {
  //   //   addText += addChar;
  //   // }

	// 	// const textNode = document.createTextNode(addText);

	// 	// range.insertNode(textNode);
	// 	// range.setStartAfter(textNode);
	// 	// range.setEndAfter(textNode);
	// 	// selection.removeAllRanges();
	// 	// selection.addRange(range);

	// 	// Update our text state and save the new cursor position
	// 	//taskText = contentEditableElement?.textContent || '';

	// 	//savedCursorPos += 1;
	// 	// setCursorPosition(getCursorPosition() + 1); // Move cursor after the separator
	// 	// savedCursorPos = getCursorPosition();
	// 	//console.log('Ending tag, new cursor position:', savedCursorPos);
	// 	// Save cursor position before any changes

	// 	//console.log('Key pressed:', event.key, 'at position:', savedCursorPos);

  //   insertCharacterAtCursor(SEPARATOR_SPACE);

  //   if (addChar) {
  //     insertCharacterAtCursor(addChar);
  //   }
	// }

	// Check if typing this character would create invalid adjacent separators
	function wouldCreateInvalidPair(key: string): boolean {
		if (key !== '#' && key !== '/') return false;

		const cursorPos = getCursorPosition();
		const charBefore = taskText[cursorPos - 1];
		const charAfter = taskText[cursorPos];

		// Check if we'd create an invalid pair with character before or after
		const separators = ['#', '/'];
		return separators.includes(charBefore) || separators.includes(charAfter);
	}

	// Handle keyboard events
	function handleKeydown(event: KeyboardEvent) {
		console.log("HANDLE KEYDOWN");

    if (event.key === '#' || event.key === '/') {
      event.preventDefault();

      // Prevent invalid separator pairs
      if (wouldCreateInvalidPair(event.key)) {
        return;
      } 
      // If we're in a tag, end it before inserting the new character
      //else if (isInTag()) {
        insertCharacterAtCursor(SEPARATOR_SPACE);
      //}
      // Ending tag or not, insert the character
      // This needs to be handled manually because we're going to be
      // replacing the contenteditable's innerHTML
      insertCharacterAtCursor(event.key);
 
      return;
    }

    // Otherwise, if we're in a tag, handle escape characters
    else if(isInTag()) {
      if(event.key === 'Enter' || event.key === 'Tab' || event.key === 'Escape') {
        // If we're in a tag and hit an escape character, end the current tag
        insertCharacterAtCursor(SEPARATOR_SPACE);
        event.preventDefault();
      }
      return;
    }

		else if (event.key === 'Enter' && !event.shiftKey) {
      // Regular Enter - submit
      event.preventDefault();
      handleSubmit(event);
		} 

		console.log('Cursor position after check: ', getCursorPosition());
	}

	// Handle input from contenteditable
	function handleInput(event: Event) {
		console.log("HANDLE INPUT");

		const target = event.target as HTMLDivElement;
		taskText = target.textContent || '';

		// Update saved cursor position after input
		//savedCursorPos = getCursorPosition();
	}

	// Auto-resize the contenteditable
	function resizeContentEditable(element: HTMLDivElement) {
		console.log("RESIZE EDITABLE");

		element.style.height = 'auto';
		element.style.height = element.scrollHeight + 'px';
	}

	// Handle resize when content changes
	$effect(() => {
		console.log("RESIZE EFFECT");

		// Reference taskText to make it a dependency
		taskText;
		if (contentEditableElement) {
			resizeContentEditable(contentEditableElement);
		}
	});

	// Handle form submission
	function handleSubmit(event: Event) {
		console.log("HANDLE SUBMIT");

		event.preventDefault();

		if (!firebase.user) {
			alert('Please log in to add a task.');
			return;
		}

		if (taskText.trim()) {
      console.log(chunks);
			addTask(chunks);
			taskText = '';
			if (contentEditableElement) {
				contentEditableElement.innerHTML = '';
			}
		}
	}

	// Sync taskText changes back to contenteditable (for when we clear it)
	$effect(() => {
		console.log("TASKTEXT EFFECT");

		if (contentEditableElement && !taskText && contentEditableElement.innerHTML !== '') {
			contentEditableElement.innerHTML = '';
		}
	});
</script>

<form onsubmit={handleSubmit} class="justify-items-center grid grid-cols-1">
	<div class="relative mb-4 min-w-3xs items-center">
		<!-- Placeholder overlay -->
		{#if !taskText.trim()}
			<div
				class="textarea pointer-events-none absolute inset-0
        bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary"
				style="z-index: 5; min-height: 3.5rem; padding: 1rem 0.75rem;"
			>
				What's on your mind?
			</div>
		{/if}

		<div
			bind:this={contentEditableElement}
			contenteditable="true"
			role="textbox"
			aria-multiline="true"
      tabindex="0"
			class="textarea taskinput-textarea inset-0"
			oninput={handleInput}
			onkeydown={handleKeydown}
			style="min-height: 3.5rem; padding: 1rem 0.75rem; word-wrap: break-word; overflow-wrap: break-word; white-space: pre-wrap;"
		></div>
	</div>

	<button type="submit" class="btn btn-soft btn-lg" class:btn-disabled={!firebase.user}
		>Submit</button
	>
</form>

<style>
	[contenteditable]:focus {
		outline: none;
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
