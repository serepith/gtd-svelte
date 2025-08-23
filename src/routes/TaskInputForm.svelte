<script lang="ts">
	import { addTask, getAllTasks, getSimilar } from '$lib/database';
	import { data } from '$lib/globalState.svelte';
	// import { firebase, getNodesCollection } from '$lib/globalState.svelte';
	import { fade, scale } from 'svelte/transition';

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

	const chunk = (content: string = '', type = () => (content.includes('#') ? 'tag' : 'text')) => {
		let t = $derived(content.includes('#'));
		let c = { content, type };
		return c;
	};

	let chunks = $state([chunk('')]);

	let chunkTypes = $derived(
		chunks.map((chunk) => (chunk.content.startsWith('#') ? 'tag' : 'text'))
	);

	// Auto-suggest state
	//let suggestions = $state<Task[]>([]);
	let showSuggestions = $state(false);
	let selectedSuggestionIndex = $state(-1);
	let suggestionTimeout: ReturnType<typeof setTimeout> | null = null;

	// Get the full text content from chunks for suggestions
	const fullTextContent = $derived.by(() => {
		return (
			chunks
				//.filter((chunk) => !chunk.content.startsWith('#'))
				.map((chunk) => chunk.content)
				.join('')
				.trim()
		);
	});

	let suggestions = $derived(getSimilar(fullTextContent));

	// Update suggestions when text changes
	async function updateSuggestions() {
		if (suggestionTimeout) {
			clearTimeout(suggestionTimeout);
		}

		const text = fullTextContent;
		if (text.length < 2) {
			showSuggestions = false;
			return;
		}

		// suggestionTimeout = setTimeout(async () => {
		// 	try {
		// 		const similarTasks = await getSimilar(text, 5);
		// 		// Filter out exact matches and empty tasks
		// 		suggestions = similarTasks.filter(
		// 			(task) => task.name.toLowerCase() !== text.toLowerCase() && task.name.trim().length > 0
		// 		);
		// 		showSuggestions = suggestions.length > 0;
		// 		selectedSuggestionIndex = -1;
		// 	} catch (error) {
		// 		console.error('Error fetching suggestions:', error);
		// 		showSuggestions = false;
		// 		suggestions = [];
		// 	}
		// }, 300); // Debounce for 300ms
	}

	// Watch for text changes to trigger suggestions
	// $effect(() => {
	// 	fullTextContent;
	// 	updateSuggestions();
	// });

	// Accept a suggestion
	// function acceptSuggestion(suggestion: Task) {
	// 	// Clear current text chunks
	// 	chunks = [chunk('')];

	// 	// Set the suggestion text
	// 	chunks[0].content = suggestion.name;

	// 	// Hide suggestions
	// 	showSuggestions = false;
	// 	suggestions = [];
	// 	selectedSuggestionIndex = -1;

	// 	// Focus back on input
	// 	setTimeout(() => {
	// 		if (taskInputElement?.firstElementChild) {
	// 			(taskInputElement.firstElementChild as HTMLElement).focus();
	// 			// Position cursor at end
	// 			const selection = window.getSelection();
	// 			const range = document.createRange();
	// 			const textNode = taskInputElement.firstElementChild.firstChild || taskInputElement.firstElementChild;
	// 			range.setStart(textNode, suggestion.name.length);
	// 			range.collapse(true);
	// 			selection?.removeAllRanges();
	// 			selection?.addRange(range);
	// 		}
	// 	}, 0);
	// }

	// Handle keyboard navigation for suggestions
	function handleSuggestionNavigation(event: KeyboardEvent): boolean {
		//if (!showSuggestions || suggestions.length === 0) return false;

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				// selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
				selectedSuggestionIndex = selectedSuggestionIndex + 1;

				return true;

			case 'ArrowUp':
				event.preventDefault();
				selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
				return true;

			case 'Enter':
			case 'Tab':
				//&& selectedSuggestionIndex < suggestions.length
				if (selectedSuggestionIndex >= 0) {
					event.preventDefault();
					//acceptSuggestion(suggestions[selectedSuggestionIndex]);
					return true;
				}
				break;

			case 'Escape':
				event.preventDefault();
				showSuggestions = false;
				//suggestions = [];
				selectedSuggestionIndex = -1;
				return true;
		}
		return false;
	}

	function getPrecedingChar() {
		let sel = window.getSelection();
		//alert(sel?.anchorOffset);
		//alert(sel?.anchorNode?.textContent);

		if (sel?.anchorNode?.textContent?.length && sel?.anchorNode?.textContent?.length > 1)
			return sel.anchorNode.textContent[sel?.anchorOffset - 2];
	}

	let currentNode = $state(window.getSelection()?.anchorNode?.parentElement);
	let currentNodeTextPosition = $state(window.getSelection()?.anchorOffset);
	let currentNodeIndex = $derived(parseInt(currentNode?.dataset.itemId || '0'));
	let currentChunk = $derived(chunks[currentNodeIndex]);

	$inspect(chunks).with(console.log);
	$inspect(currentNodeIndex).with(console.log);
	$inspect(currentChunk).with(console.log);
	$inspect(currentNodeTextPosition).with(console.log);

	function spliceOutChunk(i: number) {
		updateCurrentNode();

		let newFocus;
		let newFocusOffset: number;

		// If we're deleting the active chunk, move cursor to previous
		if (i === currentNodeIndex) {
			console.log('i=' + i + ' current node ndex ' + currentNodeIndex);
			newFocus = i - 1;
			newFocusOffset = chunks[i - 1].content.replace('<br>', '').length;
			console.log('chunk content: ' + chunks[i - 1].content);
		}

		chunks.splice(i, 1);

		//console.log("new focus wtf " + newFocus);

		if (newFocus != undefined) {
			// set timeout so the DOM will update first
			setTimeout(() => {
				//console.log("NEW FOCUS index " + (i-1));
				let newFocusElement = taskInputElement?.querySelector(`[data-item-id="${i - 1}"]`);
				//console.log("NEW FOCUS " + newFocusElement?.outerHTML);
				// set focus to the text so we can put the cursor in the proper location
				if (newFocusElement) {
					(newFocusElement as HTMLElement).focus();
					window.getSelection()?.setPosition(newFocusElement.firstChild, newFocusOffset);
				}
			}, 0);
		} else if (i === 0) {
			addChunk('text');
		}
	}

	// claude code -- clean up text chunks whenever chunks updates
	$effect(() => {
		let merged = [];
		let i = 0;
		let mergedNodeIndex;

		for (let i = chunks.length - 1; i > 0; i--) {
			if (chunkTypes[i] === 'text' && chunkTypes[i - 1] === 'text') {
				chunks[i - 1].content += chunks[i].content;
				spliceOutChunk(i);
			}
			// don't delete the current node or the last/only node
			else if (chunks[i].content.length === 0 && i != currentNodeIndex && i != chunks.length - 1) {
				console.log('i ' + i + ' current ndoe index ' + currentNodeIndex);
				spliceOutChunk(i);
			}
		}
	});

	function isInTag(): boolean {
		console.log('in tag');
		if (currentNode?.classList) return currentNode.classList.contains('tag-chip');
		else return false;
	}

	function addChunk(type: 'text' | 'tag') {
		updateCurrentNode();

		if (!currentNode) {
			currentNode = taskInputElement?.lastElementChild as HTMLElement;
			currentNodeTextPosition = currentNode.textContent?.length;
		}

		const newChunkText = type === 'tag' ? '#' : '';
		const nodeText = currentNode?.textContent;

		const textBeforeCursor = nodeText?.substring(0, currentNodeTextPosition) || '';
		let textAfterCursor = nodeText?.substring(currentNodeTextPosition || nodeText?.length);

		if (textAfterCursor?.length === 0) textAfterCursor = '&nbsp;';

		currentChunk.content = textBeforeCursor;
		chunks.splice(currentNodeIndex + 1, 0, chunk(newChunkText + textAfterCursor));

		if (currentNodeTextPosition)
			currentNodeTextPosition =
				currentNodeTextPosition - textBeforeCursor.length + newChunkText.length;

		setTimeout(() => {
			if (currentNode?.nextElementSibling) {
				(currentNode.nextElementSibling as HTMLElement).focus();
				window.getSelection()?.setPosition(currentNode.nextElementSibling, newChunkText.length);
			}
		}, 0);
	}

	const handleKeydown = (e: KeyboardEvent) => {
		console.log('HANDLE KEYDOWN');

		// Handle suggestion navigation first
		if (handleSuggestionNavigation(e)) {
			return;
		}

		// console.log('updateCurrentNode exists?', typeof updateCurrentNode); // Should log "function"

		console.log('keydown: ' + e.code);
		console.log('current node text content: ' + currentNode?.innerHTML);

		updateCurrentNode();

		console.log('current node: ' + currentNode?.outerHTML);

		if (!currentNode?.textContent?.trim() && e.code.length > 1) {
			console.log('CURRENT CHUNK: ' + currentChunk);
			currentChunk.content = '';
		}

		// if (e.code === '#' || e.code === '/') {
		// 	e.preventDefault();

		// 	// no empty tags
		// 	if (getPrecedingChar() === '#') return;

		// 	const nodeText = currentNode?.textContent;

		// 	const textBeforeCursor =
		// 		nodeText?.substring(0, currentNodeTextPosition ? currentNodeTextPosition - 1 : 0) || '';
		// 	const textAfterCursor = nodeText?.substring(currentNodeTextPosition || nodeText?.length);

		// 	console.log('substring 1: ' + textBeforeCursor);
		// 	console.log('substring 2: ' + textAfterCursor);

		// 	currentChunk.content = textBeforeCursor;
		// 	//chunks.push(chunk('#' + textAfterCursor));
		// 	chunks.splice(currentNodeIndex + 1, 0, chunk('#' + textAfterCursor));
		// 	//chunks.push(chunk('#'));

		// 	if (currentNodeTextPosition)
		// 		currentNodeTextPosition = currentNodeTextPosition - textBeforeCursor.length + 1;

		// 	setTimeout(() => {
		// 		// console.log("current node: " + currentNode?.outerHTML);
		// 		// console.log("parent node: " + currentNode?.parentElement?.outerHTML);
		// 		// console.log("uhhh " + currentNode?.nextElementSibling?.outerHTML);
		// 		if (currentNode?.nextElementSibling) {
		// 			//alert("set pos to next sib"+ currentNode.nextSibling.parentElement?.outerHTML);
		// 			(currentNode.nextElementSibling as HTMLElement).focus();
		// 			window.getSelection()?.setPosition(currentNode.nextElementSibling, 1);
		// 			//updateCurrentNode();
		// 		}
		// 	}, 0);

		// 	return;
		// }

		if (e.code === 'Backspace') {
			// if(currentNode?.dataset && currentNode?.dataset.itemId) {
			// 	(chunks[parseInt(currentNode.dataset.itemId)]).type() = 'text';
			// }
			//console.log("text elngth " + currentNode?.textContent);
			if (!currentNode?.textContent) spliceOutChunk(currentNodeIndex);
		} else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
			//claude code
			const selection = window.getSelection();
			const currentElement =
				selection?.anchorNode?.nodeType === 3
					? selection.anchorNode.parentElement
					: (selection?.anchorNode as HTMLElement);

			// Find current chunk index
			const currentIndex = parseInt(currentElement?.dataset.itemId || '0');
			const currentOffset = selection?.anchorOffset || 0;
			const textLength = currentElement?.textContent?.length || 0;

			let shouldNavigate = false;
			let targetIndex = currentIndex;
			let targetPosition = 0;

			if (e.code === 'ArrowLeft' && currentOffset === 0) {
				// At beginning of current chunk, go to previous
				shouldNavigate = true;
				targetIndex = Math.max(0, currentIndex - 1);
				targetPosition = chunks[targetIndex]?.content?.length || 0; // End of previous chunk
			} else if (e.code === 'ArrowRight' && currentOffset === textLength) {
				// At end of current chunk, go to next
				shouldNavigate = true;
				targetIndex = Math.min(chunks.length - 1, currentIndex + 1);
				targetPosition = 0; // Beginning of next chunk
			}

			if (shouldNavigate && targetIndex !== currentIndex) {
				e.preventDefault();

				// Find the target element
				const targetElement = document.querySelector(
					`[data-item-id="${targetIndex}"]`
				) as HTMLElement;
				if (targetElement) {
					targetElement.focus();

					// Set cursor position
					if (targetElement.textContent) {
						const range = document.createRange();
						const textNode = targetElement.firstChild || targetElement;
						range.setStart(textNode, Math.min(targetPosition, targetElement.textContent.length));
						range.collapse(true);

						selection?.removeAllRanges();
						selection?.addRange(range);
					}
				}
			}
		}

		// Otherwise, if we're in a tag, handle escape characters
		else if (isInTag()) {
			if (e.code === 'Enter' || e.code === 'Tab' || e.code === 'Escape') {
				// If we're in a tag and hit an escape character, end the current tag
				//insertCharacterAtCursor(SEPARATOR_SPACE);
				e.preventDefault();
				addChunk('text');

				setTimeout(() => {
					// console.log("current node: " + currentNode?.outerHTML);
					// console.log("parent node: " + currentNode?.parentElement?.outerHTML);
					// console.log("uhhh " + currentNode?.nextElementSibling?.outerHTML);
					if (currentNode?.nextElementSibling) {
						console.log('SET TO ' + (currentNode.nextElementSibling as HTMLElement).outerHTML);
						//alert("set pos to next sib"+ currentNode.nextSibling.parentElement?.outerHTML);
						(currentNode.nextElementSibling as HTMLElement).focus();
						window.getSelection()?.setPosition(currentNode.nextElementSibling, 0);
						//updateCurrentNode();

						updateCurrentNode();
					}
				}, 0);
			}
			return;
		} else if (e.code === 'Enter') {
			//else if (event.data === 'Enter' && !event.shiftKey) {
			// Regular Enter - submit
			e.preventDefault();
			handleSubmit(e);
		}

		//console.log('Cursor position after check: ', getCursorPosition());
	};

	const updateCurrentNode = () => {
		// console.log("current node " + window.getSelection()?.anchorNode?.textContent);
		// console.log("parent node " + window.getSelection()?.anchorNode?.parentElement?.outerHTML);

		let lastCurrentNodeIndex = currentNodeIndex;

		console.log('current node index ' + currentNodeIndex + '\n chunks length ' + chunks.length);

		const selection = window.getSelection();

		if (selection) {
			// node type 3 is text
			if (selection.anchorNode?.nodeType === 3) currentNode = selection.anchorNode?.parentElement;
			// 1 is element
			else if (selection.anchorNode?.nodeType === 1)
				currentNode = window.getSelection()?.anchorNode as HTMLElement;
			// if we're in the parent div, well, don't be
			if (currentNode?.classList.contains('taskinput-textarea')) {
				if (selection && selection.rangeCount > 0) {
					const range = selection.getRangeAt(0);
					const rect = range.getBoundingClientRect();
					moveToClosestChild(rect.x, rect.y);
				}
			} else {
				if (selection.anchorOffset) currentNodeTextPosition = window.getSelection()?.anchorOffset;
			}
		}
	};

	// Handle keyboard events
	const handleInput = (event: Event) => {
		console.log('HANDLE INPUT');

		console.log('updateCurrentNode exists?', typeof updateCurrentNode); // Should log "function"

		let e = event as InputEvent;

		console.log('INPUT: ' + e.data);

		updateCurrentNode();

		console.log('current node: ' + currentNode?.outerHTML);

		if (e.data === '#' || e.data === '/') {
			event.preventDefault();

			// no empty tags
			if (getPrecedingChar() === '#') return;

			const nodeText = currentNode?.textContent;

			const textBeforeCursor =
				nodeText?.substring(0, currentNodeTextPosition ? currentNodeTextPosition - 1 : 0) || '';
			let textAfterCursor = nodeText?.substring(currentNodeTextPosition || nodeText?.length);

			console.log('substring 1: ' + textBeforeCursor);
			console.log('substring 2: ' + textAfterCursor);

			currentChunk.content = textBeforeCursor;
			//chunks.push(chunk('#' + textAfterCursor));
			chunks.splice(currentNodeIndex + 1, 0, chunk('#' + textAfterCursor));
			//chunks.push(chunk('#'));

			if (currentNodeTextPosition)
				currentNodeTextPosition = currentNodeTextPosition - textBeforeCursor.length + 1;

			setTimeout(() => {
				// console.log("current node: " + currentNode?.outerHTML);
				// console.log("parent node: " + currentNode?.parentElement?.outerHTML);
				// console.log("uhhh " + currentNode?.nextElementSibling?.outerHTML);
				if (currentNode?.nextElementSibling) {
					//alert("set pos to next sib"+ currentNode.nextSibling.parentElement?.outerHTML);
					(currentNode.nextElementSibling as HTMLElement).focus();
					window.getSelection()?.setPosition(currentNode.nextElementSibling, 1);
					//updateCurrentNode();
				}
			}, 0);

			return;
		} else if (e.data === 'Backspace') {
			// if(currentNode?.dataset && currentNode?.dataset.itemId) {
			// 	(chunks[parseInt(currentNode.dataset.itemId)]).type() = 'text';
			// }
			//console.log("text elngth " + currentNode?.textContent);
			if (!currentNode?.textContent) spliceOutChunk(currentNodeIndex);
		}

		// Otherwise, if we're in a tag, handle escape characters
		else if (isInTag()) {
			if (e.data === 'Enter' || e.data === 'Tab' || e.data === 'Escape') {
				// If we're in a tag and hit an escape character, end the current tag
				//insertCharacterAtCursor(SEPARATOR_SPACE);
				event.preventDefault();
				addChunk('text');

				setTimeout(() => {
					// console.log("current node: " + currentNode?.outerHTML);
					// console.log("parent node: " + currentNode?.parentElement?.outerHTML);
					// console.log("uhhh " + currentNode?.nextElementSibling?.outerHTML);
					if (currentNode?.nextElementSibling) {
						console.log('SET TO ' + (currentNode.nextElementSibling as HTMLElement).outerHTML);
						//alert("set pos to next sib"+ currentNode.nextSibling.parentElement?.outerHTML);
						(currentNode.nextElementSibling as HTMLElement).focus();
						window.getSelection()?.setPosition(currentNode.nextElementSibling, 0);
						//updateCurrentNode();
					}
				}, 0);
			}
			return;
		} else if (e.data === 'Enter') {
			//else if (event.data === 'Enter' && !event.shiftKey) {
			// Regular Enter - submit
			event.preventDefault();
			handleSubmit(event);
		}

		//console.log('Cursor position after check: ', getCursorPosition());
	};

	function handleOnclick(event: MouseEvent) {
		console.log('this element is: ' + (event.target as HTMLElement).outerHTML);

		console.log('click x: ' + event.clientX + ', click y: ' + event.clientY);

		// Don't do anything if user clicked on a child div
		if ((event.target as HTMLElement) != taskInputElement) {
			console.log('different target');
			return;
		}

		event.preventDefault();

		moveToClosestChild(event.clientX, event.clientY);

		// let lastChild = taskInputElement?.lastElementChild;
		// console.log("active element " + document.activeElement?.outerHTML);
		// if(lastChild && document.activeElement != lastChild)
		// 	(lastChild as HTMLElement).focus();

		// event.preventDefault();

		// console.log("last child " + taskInputElement?.lastElementChild?.outerHTML);
		// console.log("last child text " + taskInputElement?.lastElementChild?.firstChild?.textContent);

		// if(lastChild) {
		// 	if(document.activeElement != lastChild)
		// 		(lastChild as HTMLElement).focus();

		// 	const selection = window.getSelection();
		// 	const currentRange = selection?.rangeCount ? selection.getRangeAt(0) : null;

		// 	// Create the desired range
		// 	const newRange = document.createRange();
		// 	newRange.selectNodeContents(lastChild);
		// 	newRange.collapse(false);

		// 	// Only update if different
		// 	if (!currentRange || !currentRange.isPointInRange(newRange.startContainer, newRange.startOffset)) {
		// 		console.log("adjusting range");
		// 		selection?.removeAllRanges();
		// 		selection?.addRange(newRange);
		// 	}
		// }
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

	interface ChildRect {
		child: HTMLElement;
		rect: DOMRect;
	}

	function distanceToRect(x: number, y: number, rect: DOMRect): number {
		const dx = Math.max(rect.left - x, 0, x - rect.right);
		const dy = Math.max(rect.top - y, 0, y - rect.bottom);
		return Math.sqrt(dx * dx + dy * dy);
	}

	function findClosestChild(clickX: number, clickY: number, children: HTMLElement[]): HTMLElement {
		// Get all bounding rectangles
		const rects: ChildRect[] = children.map((child) => ({
			child,
			rect: child.getBoundingClientRect()
		}));

		// Find children that overlap in each dimension
		const xOverlap: ChildRect[] = rects.filter(
			({ rect }) => clickX >= rect.left && clickX <= rect.right
		);
		const yOverlap: ChildRect[] = rects.filter(
			({ rect }) => clickY >= rect.top && clickY <= rect.bottom
		);

		// Case 1: Within both dimensions (shouldn't happen if parent was clicked)
		const bothOverlap: ChildRect[] = xOverlap.filter((item) => yOverlap.includes(item));
		if (bothOverlap.length > 0) return bothOverlap[0].child;

		// Case 2: Within Y bounds, choose closest X
		if (yOverlap.length > 0) {
			return yOverlap.reduce((closest: ChildRect, current: ChildRect): ChildRect => {
				const closestDist = Math.min(
					Math.abs(clickX - closest.rect.left),
					Math.abs(clickX - closest.rect.right)
				);
				const currentDist = Math.min(
					Math.abs(clickX - current.rect.left),
					Math.abs(clickX - current.rect.right)
				);
				return currentDist < closestDist ? current : closest;
			}).child;
		}

		// Case 3: Within X bounds, choose closest Y
		if (xOverlap.length > 0) {
			return xOverlap.reduce((closest: ChildRect, current: ChildRect): ChildRect => {
				const closestDist = Math.min(
					Math.abs(clickY - closest.rect.top),
					Math.abs(clickY - closest.rect.bottom)
				);
				const currentDist = Math.min(
					Math.abs(clickY - current.rect.top),
					Math.abs(clickY - current.rect.bottom)
				);
				return currentDist < closestDist ? current : closest;
			}).child;
		}

		// Case 4: In corners - use actual 2D distance to nearest edge
		return rects.reduce((closest: ChildRect, current: ChildRect): ChildRect => {
			const closestDist = distanceToRect(clickX, clickY, closest.rect);
			const currentDist = distanceToRect(clickX, clickY, current.rect);
			return currentDist < closestDist ? current : closest;
		}).child;
	}

	function moveToClosestChild(x: number, y: number) {
		if (taskInputElement) {
			let closestChild = findClosestChild(
				x,
				y,
				Array.from(taskInputElement.children) as HTMLElement[]
			);

			console.log('closest child: ' + closestChild.outerHTML);

			// Create synthetic click event for the child
			const childRect = closestChild.getBoundingClientRect();

			// Keep coordinates that are within bounds, clamp others
			const clampedX =
				x > childRect.left + 1 && x < childRect.right - 1
					? x // Keep original if within bounds
					: Math.max(childRect.left + 1, Math.min(childRect.right - 1, x)); // Clamp if outside

			const clampedY =
				y > childRect.top + 1 && y < childRect.bottom - 1
					? y // Keep original if within bounds
					: Math.max(childRect.top + 1, Math.min(childRect.bottom - 1, y)); // Clamp if outside

			console.log('x ' + clampedX + ' y ' + clampedY);

			//closestChild.focus();

			// Just focus and position cursor manually
			closestChild.focus();

			// Use caretPositionFromPoint or caretRangeFromPoint
			const position = document.caretPositionFromPoint?.(clampedX, clampedY);

			if (position) {
				console.log(
					'position: ' + position.getClientRect()?.x + ', ' + position.getClientRect()?.y
				);
				const selection = window.getSelection();
				selection?.removeAllRanges();

				if ('offsetNode' in position) {
					// caretPositionFromPoint result
					const range = document.createRange();
					range.setStart(position.offsetNode, position.offset);
					range.collapse(true);
					selection?.addRange(range);
				} else {
					// caretRangeFromPoint result
					selection?.addRange(position);
				}
			}
		}
	}

	function taskTextEmpty() {
		console.log(chunks.length);
		//console.log(chunks[0].content.length);
		return chunks.length === 1 && (chunks[0].content.length === 0 || chunks[0].content === '<br>');
	}

	function handleSubmit(event: Event) {
		console.log('HANDLE SUBMIT');

		event.preventDefault();

		if (!data.user) {
			alert('Please log in to add a task.');
			return;
		}

		if (!taskTextEmpty()) {
			console.log(chunks);
			addTask(chunks);
			// for(let i = 0; i < chunks.length; i++)
			// 	chunks.pop();
			chunks = [chunk('text')];
			// this is necessary because the key is the index so svelte won't detect a
			// state change unless we reset the content at index 0
			chunks[0].content = '';
		}

		// Hide suggestions after submit
		showSuggestions = false;
		//suggestions = [];
		selectedSuggestionIndex = -1;
	}
</script>

<svelte:document />
<form
	class="flex justify-items-center {isSidebar
		? 'flex flex-row items-center'
		: 'flex flex-col items-center'}"
	onsubmit={handleSubmit}
>
	<!-- Normal mode: stacked layout -->
	<div class="relative m-2 min-w-3xs items-center">
		<!-- Placeholder overlay -->
		{#if taskTextEmpty()}
			<div
				class="textarea from-primary to-secondary pointer-events-none
				absolute inset-0 flex bg-gradient-to-r bg-clip-text align-text-bottom text-transparent"
				style="z-index: 5; min-height: 4.25rem; padding: 1rem 1rem; word-wrap: break-word; 
				overflow-wrap: break-word; white-space: pre-wrap; align-items: center; justify-content: flex-start;"
			>
				What's on your mind?
			</div>
		{/if}

		<div
			bind:this={taskInputElement}
			contenteditable="false"
			role="textbox"
			tabindex="0"
			onmousedown={handleOnclick}
			onkeydown={() => {
				updateCurrentNode();
			}}
			class="textarea taskinput-textarea inset-0 flex flex-wrap"
			style="min-height: 4.25rem; padding: 1rem 0.75rem; word-wrap: break-word; 
  		align-content: center;
			overflow-wrap: break-word; white-space: pre-wrap;"
		>
			{#each chunks as chunk, i (i)}
				<div
					data-item-id={i}
					bind:innerHTML={chunk.content}
					contenteditable="true"
					class="{chunkTypes[i]}-chip"
					role="textbox"
					tabindex={0}
					transition:scale={{ duration: 50 }}
					oninput={handleInput}
					onkeydown={handleKeydown}
				></div>

				<!-- oninput={handleInput} -->
			{/each}
		</div>

		<!-- Auto-suggest dropdown -->
		{#if showSuggestions}
			{#await suggestions}
				Loading...
			{:then suggestions}
				<div
					class="bg-base-100 border-base-300 absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border shadow-lg"
					transition:fade={{ duration: 150 }}
				>
					{#each suggestions as suggestion, index}
						<button
							type="button"
							class="hover:bg-base-200 border-base-200 w-full border-b px-4 py-2 text-left transition-colors duration-150 last:border-b-0"
							class:bg-primary={selectedSuggestionIndex === index}
							class:text-primary-content={selectedSuggestionIndex === index}
						>
							<!-- onclick={() => acceptSuggestion(suggestion)} -->
							<div class="truncate font-medium">{suggestion.name}</div>
							<div class="text-base-content/70 truncate text-sm">Similar task</div>
						</button>
					{/each}
				</div>
			{/await}
		{/if}
	</div>

	<button type="submit" class="btn btn-soft btn-lg m-2" class:btn-disabled={!data.user}
		>Submit</button
	>
	<!-- {/if} -->
</form>

<style>
	[contenteditable]:focus {
		outline: none;
	}

	.task-input-form {
		grid-template-columns: 1;
	}

	.sidebar-form {
		width: 100%;
		grid-template-rows: 1;
		grid-template-columns: auto;
	}

	.sidebar-layout {
		align-items: flex-start;
	}

	.text-chip,
	.tag-chip {
		display: inline-flex;
		align-items: center;
		vertical-align: middle;
		/* line-height: 1.5 !important; */
		/* min-height: 1.5rem !important; */
		font-size: inherit;
		min-width: 0.06125rem;
		margin-inline: 0.25rem;
	}

	/* .text-chip {
		min-height: 1.5rem;
	 line-height: 1.5;
	} */

	/* .tag-chip {
		margin-inline: 0rem;
	} */

	/* Ensure tag chips are visible on mobile */
	@media (max-width: 768px) {
		.tag-chip {
			margin-inline: 0.125rem;
		}
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
