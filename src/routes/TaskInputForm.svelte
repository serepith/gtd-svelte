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

	const chunk = (content: string = '', type = () => (content.includes('#') ? 'tag' : 'text')) => {
		let t = $derived(content.includes('#'));
		let c = { content, type };
		return c;
	};

	type Chunk = { content: string; type: 'text' | 'tag' };

	let chunks = $state([chunk('')]);

	let chunkTypes = $derived(
		chunks.map((chunk) => (chunk.content.startsWith('#') ? 'tag' : 'text'))
	);

	// function getLastChild() {
	// 	// node type 3 is text
	// 		// if(taskInputElement?.lastChild?.nodeType === 3)
	// 		// 	return taskInputElement?.lastChild?.parentElement;

	// 		// // 1 is element
	// 		// else if(taskInputElement?.lastChild?.nodeType === 1)
	// 		// 	return taskInputElement?.lastChild as HTMLElement;
	// }

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
		let newFocus;
		let newFocusOffset: number;

		// If we're deleting the active chunk, move cursor to previous
		if (i === currentNodeIndex) {
			console.log('i=' + i + ' current node ndex ' + currentNodeIndex);
			newFocus = i - 1;
			newFocusOffset = chunks[i - 1].content.length;
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
		if (currentNode?.classList) return currentNode.classList.contains('tag-chip');
		else return false;
	}

	function wouldCreateInvalidPair(key: string): boolean {
		if (key !== '#' && key !== '/') return false;

		if (getPrecedingChar() === '#') return true;

		return false;
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
		const textAfterCursor = nodeText?.substring(currentNodeTextPosition || nodeText?.length);

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

	// Handle keyboard events
	function handleKeydown(event: KeyboardEvent) {
		console.log('HANDLE KEYDOWN');

		updateCurrentNode();

		if (event.key === '#' || event.key === '/') {
			event.preventDefault();

			// no empty tags
			if (getPrecedingChar() === '#') return;

			const nodeText = currentNode?.textContent;

			const textBeforeCursor = nodeText?.substring(0, currentNodeTextPosition) || '';
			const textAfterCursor = nodeText?.substring(currentNodeTextPosition || nodeText?.length);

			// console.log("substring 1: " + textBeforeCursor);
			// console.log("substring 2: " + textAfterCursor);

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

			// else if (isInTag()) {
			// }

			// Ending tag or not, insert the character
			// This needs to be handled manually because we're going to be
			// replacing the contenteditable's innerHTML
			//insertCharacterAtCursor(event.key);

			return;
		} else if (event.key === 'Backspace') {
			// if(currentNode?.dataset && currentNode?.dataset.itemId) {
			// 	(chunks[parseInt(currentNode.dataset.itemId)]).type() = 'text';
			// }
			//console.log("text elngth " + currentNode?.textContent);
			if (!currentNode?.textContent) spliceOutChunk(currentNodeIndex);
		}

		// Otherwise, if we're in a tag, handle escape characters
		else if (isInTag()) {
			if (event.key === 'Enter' || event.key === 'Tab' || event.key === 'Escape') {
				// If we're in a tag and hit an escape character, end the current tag
				//insertCharacterAtCursor(SEPARATOR_SPACE);
				event.preventDefault();
				chunks.push(chunk(''));

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
		} else if (event.key === 'Enter' && !event.shiftKey) {
			// Regular Enter - submit
			event.preventDefault();
			handleSubmit(event);
		}

		//console.log('Cursor position after check: ', getCursorPosition());
	}

	// Handle keyboard events
	function handleInput(event: Event) {
		console.log('HANDLE KEYDOWN');

		let e = event as InputEvent;

		console.log('INPUT: ' + e.data);

		updateCurrentNode();

		if (e.data === '#' || e.data === '/') {
			event.preventDefault();

			// no empty tags
			if (getPrecedingChar() === '#') return;

			const nodeText = currentNode?.textContent;

			const textBeforeCursor =
				nodeText?.substring(0, currentNodeTextPosition ? currentNodeTextPosition - 1 : 0) || '';
			const textAfterCursor = nodeText?.substring(currentNodeTextPosition || nodeText?.length);

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

			// else if (isInTag()) {
			// }

			// Ending tag or not, insert the character
			// This needs to be handled manually because we're going to be
			// replacing the contenteditable's innerHTML
			//insertCharacterAtCursor(event.key);

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
				chunks.push(chunk(''));

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
	}

	function handleOnclick(event: MouseEvent) {
		console.log('this element is: ' + (event.target as HTMLElement).outerHTML);

		// Don't do anything if user clicked on a child div
		if ((event.target as HTMLElement) != taskInputElement) {
			console.log('different target');
			return;
		}

		event.preventDefault();

		let closestChild = findClosestChild(
			event.clientX,
			event.clientY,
			Array.from(taskInputElement.children) as HTMLElement[]
		);

		//console.log(closestChild.outerHTML);

		// Create synthetic click event for the child
		const childRect = closestChild.getBoundingClientRect();

		// Keep coordinates that are within bounds, clamp others
		const clampedX =
			event.clientX > childRect.left && event.clientX < childRect.right
				? event.clientX // Keep original if within bounds
				: Math.max(childRect.left, Math.min(childRect.right, event.clientX)); // Clamp if outside

		const clampedY =
			event.clientY > childRect.top && event.clientY < childRect.bottom
				? event.clientY // Keep original if within bounds
				: Math.max(childRect.top, Math.min(childRect.bottom, event.clientY)); // Clamp if outside

		console.log('x ' + clampedX + ' y ' + clampedY);

		//closestChild.focus();

		// Just focus and position cursor manually
		closestChild.focus();

		// Use caretPositionFromPoint or caretRangeFromPoint
		const position =
			document.caretPositionFromPoint?.(clampedX, clampedY) ||
			document.caretRangeFromPoint?.(clampedX, clampedY);

		if (position) {
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

	function distanceToRect(x: number, y: number, rect: DOMRect): number {
		const dx = Math.max(rect.left - x, 0, x - rect.right);
		const dy = Math.max(rect.top - y, 0, y - rect.bottom);
		return Math.sqrt(dx * dx + dy * dy);
	}

	function taskTextEmpty() {
		console.log(chunks.length);
		//console.log(chunks[0].content.length);
		return chunks.length === 1 && (chunks[0].content.length === 0 || chunks[0].content === '<br>');
	}

	// Handle form submission
	function handleSubmit(event: Event) {
		console.log('HANDLE SUBMIT');

		event.preventDefault();

		if (!firebase.user) {
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
	}

	function updateCurrentNode() {
		// console.log("current node " + window.getSelection()?.anchorNode?.textContent);
		// console.log("parent node " + window.getSelection()?.anchorNode?.parentElement?.outerHTML);

		let lastCurrentNodeIndex = currentNodeIndex;

		console.log('current node index ' + currentNodeIndex + '\n chunks length ' + chunks.length);

		// node type 3 is text
		if (window.getSelection()?.anchorNode?.nodeType === 3)
			currentNode = window.getSelection()?.anchorNode?.parentElement;
		// 1 is element
		else if (window.getSelection()?.anchorNode?.nodeType === 1)
			currentNode = window.getSelection()?.anchorNode as HTMLElement;

		if (window.getSelection()?.anchorOffset)
			currentNodeTextPosition = window.getSelection()?.anchorOffset;
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
				absolute inset-0 bg-gradient-to-r bg-clip-text text-transparent"
				style="z-index: 5; min-height: 3.5rem; padding: 1rem 0.75rem; word-wrap: break-word; overflow-wrap: break-word; white-space: pre-wrap; line-height: 1.5;"
			>
				What's on your mind?
			</div>
		{/if}

		<!-- oninput={handleInput} -->
		<div
			bind:this={taskInputElement}
			contenteditable="false"
			role="textbox"
			tabindex="0"
			onmousedown={handleOnclick}
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
					tabindex={0}
					transition:scale={{ duration: 50 }}
					oninput={handleInput}
					onkeyup={(e) => {
						// if(i > 0 && (chunks[i].content.length === 0 || chunk.content === '<br>')) {
						// 	console.log("CURRENT NODE " + currentNode?.outerHTML);
						// 	if(currentNode?.previousElementSibling) {
						// 			//alert("set pos to next sib"+ currentNode.nextSibling.parentElement?.outerHTML);
						// 			window.getSelection()?.setPosition(currentNode.previousElementSibling, 1);
						// 			//updateCurrentNode();
						// 		}
						// 	chunks.splice(i, 1);
						// 	//setTimeout(() => {
						// 	// console.log("current node: " + currentNode?.outerHTML);
						// 	// console.log("parent node: " + currentNode?.parentElement?.outerHTML);
						// 	// console.log("uhhh " + currentNode?.nextElementSibling?.outerHTML);
						// //}, 0);
						// }
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
					}}
				></div>
			{/each}
		</div>
	</div>

	<button type="submit" class="btn btn-soft btn-lg m-2" class:btn-disabled={!firebase.user}
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
		line-height: 1.5 !important;
		min-height: 1.5rem !important;
		font-size: inherit;
	}

	.text-chip {
		min-height: 1.5rem;
		line-height: 1.5;
	}

	.tag-chip {
		margin-inline: 0.25rem;
	}

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
