<script lang="ts">
	import { addTask } from '$lib/database';
	import { firebase } from '$lib/globalState.svelte';

  // bindings
	let taskText = $state('')
	let taskTextareaElement: HTMLTextAreaElement | null = null;

  // it's 2025, who doesn't have a textarea that auto-resizes?
	const resizeTextarea = (textarea: HTMLTextAreaElement) => {
		textarea.style.height = 'auto'; // Reset height to auto to shrink if needed
		textarea.style.height = textarea.scrollHeight + 'px'; // Set height to scrollHeight
	};
	
  // hijack svelte's $effect to resize the textarea when taskText changes
	$effect(() => {
		// Reference taskText to make it a dependency
		taskText;
		// when taskText changes, adjust the height of the textarea
		if (taskTextareaElement) {
			resizeTextarea(taskTextareaElement);
		}
	});

  // debugging
	$effect(() => {
		$inspect(firebase, 'firebase');
	})

	// Handle form submission
	// Add new task and reset text to ''
	// Svelte will auto-resize the textarea based on content
	function handleSubmit(event: Event) {
		event.preventDefault();

		if (!firebase.user) {
			alert('Please log in to add a task.');
			return;
		}
		
		if (taskText) {
			addTask(taskText);
			taskText = '';
		}
	}
</script>

<form class="grid grid-cols-1 gap-4" onsubmit={handleSubmit}>
  <textarea
    bind:this={taskTextareaElement}
    bind:value={taskText}
    class="textarea taskinput-textarea"
    placeholder="What's on your mind?"
    onkeydown={(e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e); 
      }
      // Shift+Enter still makes new lines
    }}
    onclick={(e) => taskTextareaElement?.focus()}
  ></textarea>

  <button type="submit" class="btn btn-soft btn-lg" class:btn-disabled={!firebase.user}>Submit</button>
</form>

