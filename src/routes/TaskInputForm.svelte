<script lang="ts">
	import { addTask } from '$lib/database';
	import { firebase } from '$lib/globalState.svelte';
	import { get } from 'svelte/store';

	// Space character for tag boundaries
	const SEPARATOR_SPACE = '\u2002';

	let savedCursorPos = 0;
	// bindings
	let taskText = $state('');
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

	// Render chunks as HTML
	const renderedHTML = $derived(
		chunks
			.map((chunk) => {
				if (chunk.type === 'text') {
					return chunk.content.replace(/\n/g, '<br>');
				} else if (chunk.type === 'tag-inline') {
					return `<span class="inline-flex items-center"><span class="bg-blue-100 text-blue-800 px-1 rounded text-sm">${chunk.content}</span></span>`;
				} else if (chunk.type === 'tag-meta') {
					return `<span class="inline-flex items-center"><span class="bg-purple-100 text-purple-800 px-1 rounded text-sm">${chunk.content}</span></span>`;
				} else if (chunk.type === 'separator') {
					return `<span class="text-gray-400">${SEPARATOR_SPACE}</span>`;
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
			contentEditableElement.innerHTML = renderedHTML;

			// Restore cursor position
			console.log('Restoring cursor position:', savedCursorPos);
			if (savedCursorPos > 0) {
				setCursorPosition(savedCursorPos + 1); // +1 to account for the new character
        // Since we saved the position before the last change
			}
		}
	});

	// Get cursor position in contenteditable
	function getCursorPosition(): number {
		console.log("CURSOR POSITION GET");

		const selection = window.getSelection();
		if (!selection || !contentEditableElement) return 0;

		const range = selection.getRangeAt(0);
		const preCaretRange = range.cloneRange();
		preCaretRange.selectNodeContents(contentEditableElement);
		preCaretRange.setEnd(range.endContainer, range.endOffset);
		return preCaretRange.toString().length;
	}

	// Set cursor position in contenteditable
	function setCursorPosition(pos: number) {
		console.log("CURSOR POSITION SET");

		if (!contentEditableElement) return;

		const walker = document.createTreeWalker(contentEditableElement, NodeFilter.SHOW_TEXT, null);

		let currentPos = 0;
		let node;

		while ((node = walker.nextNode())) {
			console.log('Current node:', node.textContent, 'at position:', currentPos);
			const nodeLength = node.textContent?.length || 0;
			if (currentPos + nodeLength >= pos) {
				const range = document.createRange();
				const selection = window.getSelection();
				range.setStart(node, pos - currentPos);
				range.setEnd(node, pos - currentPos);
				selection?.removeAllRanges();
				selection?.addRange(range);
				return;
			}
			currentPos += nodeLength;
		}
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

		console.log("insert character cursor pos: ", getCursorPosition());
		savedCursorPos = getCursorPosition();

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

<form onsubmit={handleSubmit} class="justify-items-center">
	<div class="relative mb-4 min-w-3xs">
		<!-- Placeholder overlay -->
		<!-- {#if !taskText.trim()}
			<div
				class="textarea pointer-events-none absolute inset-0 p-3 
        bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary"
				style="z-index: 5; min-height: 2.5rem;"
			>
				What's on your mind?
			</div>
		{/if} -->

		<div
			bind:this={contentEditableElement}
			contenteditable="true"
			role="textbox"
			aria-multiline="true"
      tabindex="0"
			class="textarea taskinput-textarea p-3 inset-0"
			oninput={handleInput}
			onkeydown={handleKeydown}
			style="min-height: 2.5rem; word-wrap: break-word; overflow-wrap: break-word; white-space: pre-wrap;"
		></div>
	</div>

	<!-- <button type="submit" class="btn btn-soft btn-lg" class:btn-disabled={!firebase.user}
		>Submit</button
	> -->
</form>

<style>
	[contenteditable]:focus {
		outline: none;
	}
</style>
