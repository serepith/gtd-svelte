<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { draw, fade, fly, scale, slide } from 'svelte/transition';

	/** Based on https://github.com/jis3r/icons
	 */
	type IconType = keyof typeof iconTypes;

	type ButtonType = 'action' | 'filter';

	interface Props {
		color?: string;
		size?: number;
		strokeWidth?: number;
		selected?: boolean;
		iconType: IconType;
		buttonType: ButtonType;
		onclick?: () => void;
		class?: string;
	}

	let {
		color = 'currentColor',
		size = 1,
		strokeWidth = 2,
		selected = $bindable(false),
		iconType,
		buttonType,
		onclick = () => {},
		class: className = ''
	}: Props = $props();

	function customScale(node: Node, { delay = 0, duration = 400 }) {
		return {
			delay,
			duration,
			css: (t: any, u: any) => `transform:scaleY(${t}); transform-origin: 0% 30%;`
		};
	}

	const iconTypes = {
		complete: {
			staticPaths: ['M21.801 10A10 10 0 1 1 17 3.335'],
			animationPaths: [
				{ path: 'm9 11 3 3L22 4', fn: draw, params: { duration: 200 }, visibility: 'checked' }
			]
		},
		archive: {
			staticPaths: ['M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8', 'M10 12h4'],
			animationPaths: [
				{
					path: 'M22,3v5h-20v-5Z',
					fn: fly,
					params: { duration: 200, x: 0, y: -10 },
					visibility: 'unchecked'
				},
				{
					path: 'M4,7h16v0l-2,-2H6l-2,2Z',
					fn: customScale,
					params: { duration: 200 },
					visibility: 'checked'
				}
			]
		}
	};

	const altTextTypes = {
		action: {
			complete: {
				selected: 'Mark task as incomplete',
				unselected: 'Mark task as complete'
			},
			archive: {
				selected: 'Unarchive task',
				unselected: 'Archive task'
			}
		},
		filter: {
			complete: {
				selected: 'Hide completed tasks',
				unselected: 'Show completed tasks'
			},
			archive: {
				selected: 'Hide archived tasks',
				unselected: 'Show archived tasks'
			}
		}
	};

	let altText = $derived(altTextTypes[buttonType][iconType][selected ? 'selected' : 'unselected']);
	let staticPaths = $derived(iconTypes[iconType].staticPaths);
	let animationPaths = $derived(iconTypes[iconType].animationPaths);

	let isIconChecked = $state(false);
</script>

<button
	class="header-toggle align-center flex justify-center-safe rounded-lg bg-transparent opacity-40"
	class:active={selected}
	onclick={() => {
		selected = !selected;
		onclick();
	}}
	onmouseenter={() => (isIconChecked = !selected)}
	onmouseleave={() => (isIconChecked = selected)}
	aria-label={altText}
	title={altText}
	style="padding: {size / 2}rem"
>
	<div class={className} aria-label={iconType + ' icon'} role="img">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={16 * size}
			height={16 * size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			stroke-width={strokeWidth}
			stroke-linecap="round"
			stroke-linejoin="round"
			class="svg-icon"
			class:checked={selected}
			overflow="visible"
		>
			{#each staticPaths as pathData}
				<path d={pathData} />
			{/each}

			<!-- Must be nested this way or animations will not play--innermost # must be dependent on
			 the state change that triggers the animation. -->
			{#each animationPaths as pathData}
				{#if (isIconChecked && pathData.visibility === 'checked') || (!isIconChecked && pathData.visibility === 'unchecked')}
					<path
						d={pathData.path}
						class="animation-path"
						stroke-dashoffset="0"
						stroke-dasharray="60"
						transition:pathData.fn={pathData.params}
					/>
				{/if}
			{/each}
		</svg>
	</div>
</button>

<style>
	.header-toggle {
		transition: all 0.2s ease;
		color: var(--color-base-content);
	}

	.header-toggle:hover {
		opacity: 0.8;
		background-color: rgb(from var(--color-base-content) r g b / 0.1);
		transform: scale(1.15);
	}

	.header-toggle.active {
		opacity: 1;
		color: var(--color-success);
		background-color: rgb(from var(--color-success) r g b / 0.1);
	}

	.header-toggle.active:hover {
		background-color: rgb(from var(--color-success) r g b / 0.2);
		transform: scale(1.15);
	}

	.header-toggle:hover .base-icon,
	.header-toggle:hover .overlay-icon {
		transform: scale(1.05);
	}

	.header-toggle.active .base-icon {
		color: var(--color-success);
	}

	.base-icon {
		position: absolute;
		top: 0;
		left: 0;
		transition: all 0.2s ease;
	}
</style>
