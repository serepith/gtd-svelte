<script lang="ts">
	import { onMount } from 'svelte';
	import { data } from '$lib/globalState.svelte';
	
	// Focus action for auto-focusing input
	function focus(element: HTMLElement) {
		element.focus();
	}
	
	let canvas: HTMLCanvasElement;
	let context: CanvasRenderingContext2D;
	let width = $state(800);
	let height = $state(600);
	
	type Node = {
		id: string;
		name: string;
		type: 'task' | 'tag';
		x?: number;
		y?: number;
	};
	
	type Link = {
		source: string | Node;
		target: string | Node;
	};
	
	let allNodes: Node[] = $state([]);
	let allLinks: Link[] = $state([]);
	let nodes: Node[] = $state([]);
	let links: Link[] = $state([]);
	let centerNode: Node | null = $state(null);
	let isEditing = $state(false);
	let editingName = $state('');
	
	// Track only the source data to prevent infinite loops
	let lastDataNodesLength = $state(0);
	let lastDataJunctionsLength = $state(0);
	
	$effect(() => {
		// Only update when source data actually changes
		if (data.nodes.length !== lastDataNodesLength || 
		    data.junctions.length !== lastDataJunctionsLength) {
			lastDataNodesLength = data.nodes.length;
			lastDataJunctionsLength = data.junctions.length;
			
			if (data.nodes.length > 0) {
				updateGraph();
			}
		}
	});
	
	function updateGraph() {
		// Convert data.nodes to D3 nodes
		allNodes = data.nodes.map(node => ({
			id: node.id || '',
			name: node.name,
			type: node.type
		}));
		
		// Create all links based on junctions
		allLinks = data.junctions.map(junction => ({
			source: junction.parentId,
			target: junction.childId
		}));
		
		// Set center node to the one with highest degree if none selected
		if (!centerNode && allNodes.length > 0) {
			centerNode = findNodeWithHighestDegree();
		}
		
		// Filter to show only focus node + 2 degrees of separation
		if (centerNode) {
			const filteredResult = getFilteredNodesAndLinks(centerNode.id);
			nodes = filteredResult.nodes;
			links = filteredResult.links;
			
			// Apply hierarchical layout
			applyHierarchicalLayout(centerNode.id);
		} else {
			nodes = [];
			links = [];
		}
		
		// Trigger redraw
		setTimeout(() => {
			if (context) {
				draw();
			}
		}, 0);
	}
	
	function getFilteredNodesAndLinks(focusNodeId: string): { nodes: Node[], links: Link[] } {
		const nodeIds = new Set<string>();
		const adjacencyMap = new Map<string, string[]>();
		
		// Build adjacency map
		allLinks.forEach(link => {
			const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
			const targetId = typeof link.target === 'string' ? link.target : link.target.id;
			
			if (!adjacencyMap.has(sourceId)) adjacencyMap.set(sourceId, []);
			if (!adjacencyMap.has(targetId)) adjacencyMap.set(targetId, []);
			
			adjacencyMap.get(sourceId)!.push(targetId);
			adjacencyMap.get(targetId)!.push(sourceId);
		});
		
		// BFS to find nodes within 2 degrees
		const queue: { id: string, degree: number }[] = [{ id: focusNodeId, degree: 0 }];
		const visited = new Set<string>();
		
		while (queue.length > 0) {
			const { id, degree } = queue.shift()!;
			
			if (visited.has(id) || degree > 2) continue;
			
			visited.add(id);
			nodeIds.add(id);
			
			// Add neighbors if within degree limit
			const neighbors = adjacencyMap.get(id) || [];
			neighbors.forEach(neighborId => {
				if (!visited.has(neighborId) && degree + 1 <= 2) {
					queue.push({ id: neighborId, degree: degree + 1 });
				}
			});
		}
		
		// Filter nodes and links
		const filteredNodes = allNodes.filter(node => nodeIds.has(node.id));
		const filteredLinks = allLinks.filter(link => {
			const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
			const targetId = typeof link.target === 'string' ? link.target : link.target.id;
			return nodeIds.has(sourceId) && nodeIds.has(targetId);
		});
		
		return { nodes: filteredNodes, links: filteredLinks };
	}
	
	function applyHierarchicalLayout(focusNodeId: string) {
		// Clear existing positions
		nodes.forEach(node => {
			node.x = undefined;
			node.y = undefined;
		});
		
		// Find focus node and center it
		const focusNode = nodes.find(n => n.id === focusNodeId);
		if (!focusNode) return;
		
		focusNode.x = width / 2;
		focusNode.y = height / 2;
		
		// Categorize nodes by relationship to focus
		const parents: Node[] = [];
		const children: Node[] = [];
		const siblings: Node[] = [];
		
		// Build relationship maps
		const parentIds = new Set<string>();
		const childIds = new Set<string>();
		
		// Find direct parents and children
		links.forEach(link => {
			const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
			const targetId = typeof link.target === 'string' ? link.target : link.target.id;
			
			if (sourceId === focusNodeId) {
				childIds.add(targetId);
			}
			if (targetId === focusNodeId) {
				parentIds.add(sourceId);
			}
		});
		
		// Find siblings (nodes that share a parent or child with focus)
		const siblingIds = new Set<string>();
		links.forEach(link => {
			const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
			const targetId = typeof link.target === 'string' ? link.target : link.target.id;
			
			// Nodes that share a parent with focus
			if (parentIds.has(sourceId) && targetId !== focusNodeId && !childIds.has(targetId)) {
				siblingIds.add(targetId);
			}
			if (parentIds.has(targetId) && sourceId !== focusNodeId && !childIds.has(sourceId)) {
				siblingIds.add(sourceId);
			}
			
			// Nodes that share a child with focus
			if (childIds.has(sourceId) && targetId !== focusNodeId && !parentIds.has(targetId)) {
				siblingIds.add(targetId);
			}
			if (childIds.has(targetId) && sourceId !== focusNodeId && !parentIds.has(sourceId)) {
				siblingIds.add(sourceId);
			}
		});
		
		// Categorize nodes
		nodes.forEach(node => {
			if (node.id === focusNodeId) return;
			
			if (parentIds.has(node.id)) {
				parents.push(node);
			} else if (childIds.has(node.id)) {
				children.push(node);
			} else if (siblingIds.has(node.id)) {
				siblings.push(node);
			}
		});
		
		// Calculate responsive spacing based on viewport
		const focusNodeHeight = Math.min(300, height * 0.4);
		const focusNodeWidth = Math.min(400, width * 0.6);
		
		// Adaptive spacing based on available space
		const availableVerticalSpace = (height - focusNodeHeight) / 2 - 40; // Leave margins
		const availableHorizontalSpace = (width - focusNodeWidth) / 2 - 40;
		
		const levelSpacing = Math.min(150, availableVerticalSpace * 0.7); // Use 70% of available vertical space
		const sideSpacing = Math.min(180, availableHorizontalSpace * 0.8); // Use 80% of available horizontal space
		const nodeSpacing = Math.min(140, width / Math.max(parents.length, children.length, 3)); // Adapt to node count
		
		// Position parents above
		if (parents.length > 0) {
			const parentY = focusNode.y - focusNodeHeight / 2 - levelSpacing;
			const startX = focusNode.x - ((parents.length - 1) * nodeSpacing) / 2;
			
			parents.forEach((parent, index) => {
				parent.x = startX + (index * nodeSpacing);
				parent.y = parentY;
			});
		}
		
		// Position children below
		if (children.length > 0) {
			const childY = focusNode.y + focusNodeHeight / 2 + levelSpacing;
			const startX = focusNode.x - ((children.length - 1) * nodeSpacing) / 2;
			
			children.forEach((child, index) => {
				child.x = startX + (index * nodeSpacing);
				child.y = childY;
			});
		}
		
		// Position siblings to the sides
		if (siblings.length > 0) {
			const halfCount = Math.ceil(siblings.length / 2);
			const siblingVerticalSpacing = Math.min(60, height / Math.max(siblings.length, 4)); // Adaptive vertical spacing
			
			// Left side siblings
			for (let i = 0; i < halfCount; i++) {
				if (siblings[i]) {
					siblings[i].x = focusNode.x - focusNodeWidth / 2 - sideSpacing;
					siblings[i].y = focusNode.y - ((halfCount - 1) * siblingVerticalSpacing) / 2 + (i * siblingVerticalSpacing);
				}
			}
			
			// Right side siblings
			for (let i = halfCount; i < siblings.length; i++) {
				if (siblings[i]) {
					siblings[i].x = focusNode.x + focusNodeWidth / 2 + sideSpacing;
					siblings[i].y = focusNode.y - ((siblings.length - halfCount - 1) * siblingVerticalSpacing) / 2 + ((i - halfCount) * siblingVerticalSpacing);
				}
			}
		}
		
		// Ensure all nodes are within viewport bounds
		const margin = 60; // Minimum margin from edges
		nodes.forEach(node => {
			if (node.x !== undefined && node.y !== undefined) {
				node.x = Math.max(margin, Math.min(width - margin, node.x));
				node.y = Math.max(margin, Math.min(height - margin, node.y));
			}
		});
	}
	
	function findNodeWithHighestDegree(): Node | null {
		if (allNodes.length === 0) return null;
		
		// Calculate degree (number of edges) for each node
		const nodeDegrees = new Map<string, number>();
		
		// Initialize all nodes with degree 0
		allNodes.forEach(node => {
			nodeDegrees.set(node.id, 0);
		});
		
		// Count edges for each node
		allLinks.forEach(link => {
			const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
			const targetId = typeof link.target === 'string' ? link.target : link.target.id;
			
			// Increment degree for both source and target (undirected graph)
			nodeDegrees.set(sourceId, (nodeDegrees.get(sourceId) || 0) + 1);
			nodeDegrees.set(targetId, (nodeDegrees.get(targetId) || 0) + 1);
		});
		
		// Find node with highest degree
		let maxDegree = -1;
		let nodeWithMaxDegree: Node | null = null;
		
		allNodes.forEach(node => {
			const degree = nodeDegrees.get(node.id) || 0;
			if (degree > maxDegree) {
				maxDegree = degree;
				nodeWithMaxDegree = node;
			}
		});
		
		return nodeWithMaxDegree || allNodes[0];
	}
	
	function handleCanvasClick(event: MouseEvent) {
		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		
		// Find clicked node
		for (const node of nodes) {
			if (node.x !== undefined && node.y !== undefined) {
				const isCenterNode = centerNode && node.id === centerNode.id;
				let nodeWidth, nodeHeight;
				
				if (isCenterNode) {
					nodeWidth = Math.min(400, width * 0.6);
					nodeHeight = Math.min(300, height * 0.4);
					
					// If clicking the center node, start editing
					if (x >= node.x - nodeWidth / 2 && x <= node.x + nodeWidth / 2 &&
					    y >= node.y - nodeHeight / 2 && y <= node.y + nodeHeight / 2) {
						startEditing();
						break;
					}
				} else {
					nodeWidth = 120;
					nodeHeight = 40;
					
					// If clicking a different node, change center
					if (x >= node.x - nodeWidth / 2 && x <= node.x + nodeWidth / 2 &&
					    y >= node.y - nodeHeight / 2 && y <= node.y + nodeHeight / 2) {
						setCenterNode(node);
						break;
					}
				}
			}
		}
	}
	
	function startEditing() {
		if (centerNode) {
			isEditing = true;
			editingName = centerNode.name;
		}
	}
	
	function saveEdit() {
		if (centerNode && editingName.trim()) {
			// Update the node name
			centerNode.name = editingName.trim();
			
			// Update in the original data source
			const originalNode = data.nodes.find(n => n.id === centerNode?.id);
			if (originalNode) {
				originalNode.name = editingName.trim();
				// TODO: Save to database
			}
			
			isEditing = false;
			// Redraw to show updated name
			if (context) {
				draw();
			}
		}
	}
	
	function cancelEdit() {
		isEditing = false;
		editingName = '';
	}
	
	function setCenterNode(node: Node) {
		// Set new center node
		centerNode = node;
		
		// Re-filter nodes to show new 2-degree neighborhood
		if (centerNode) {
			const filteredResult = getFilteredNodesAndLinks(centerNode.id);
			nodes = filteredResult.nodes;
			links = filteredResult.links;
			
			// Apply new hierarchical layout
			applyHierarchicalLayout(centerNode.id);
		}
		
		// Redraw
		setTimeout(() => {
			if (context) {
				draw();
			}
		}, 0);
	}
	
	function drawRoundedRect(x: number, y: number, width: number, height: number, radius: number) {
		context.beginPath();
		context.moveTo(x + radius, y);
		context.lineTo(x + width - radius, y);
		context.quadraticCurveTo(x + width, y, x + width, y + radius);
		context.lineTo(x + width, y + height - radius);
		context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
		context.lineTo(x + radius, y + height);
		context.quadraticCurveTo(x, y + height, x, y + height - radius);
		context.lineTo(x, y + radius);
		context.quadraticCurveTo(x, y, x + radius, y);
		context.closePath();
	}
	
	function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
		context.font = `${fontSize}px sans-serif`;
		const words = text.split(' ');
		const lines: string[] = [];
		let currentLine = '';
		
		for (const word of words) {
			const testLine = currentLine + (currentLine ? ' ' : '') + word;
			const metrics = context.measureText(testLine);
			
			if (metrics.width > maxWidth && currentLine) {
				lines.push(currentLine);
				currentLine = word;
			} else {
				currentLine = testLine;
			}
		}
		
		if (currentLine) {
			lines.push(currentLine);
		}
		
		return lines;
	}
	
	function draw() {
		if (!context || !canvas) return;
		
		// Clear the entire canvas
		context.clearRect(0, 0, canvas.width, canvas.height);
		
		// Draw links
		context.strokeStyle = '#6b7280';
		context.lineWidth = 1;
		context.beginPath();
		links.forEach(link => {
			const source = typeof link.source === 'string' 
				? nodes.find(n => n.id === link.source) 
				: link.source as Node;
			const target = typeof link.target === 'string' 
				? nodes.find(n => n.id === link.target) 
				: link.target as Node;
				
			if (source?.x !== undefined && source?.y !== undefined && 
			    target?.x !== undefined && target?.y !== undefined) {
				context.moveTo(source.x, source.y);
				context.lineTo(target.x, target.y);
			}
		});
		context.stroke();
		
		// Draw nodes
		nodes.forEach(node => {
			if (node.x === undefined || node.y === undefined) return;
			
			const isCenterNode = centerNode && node.id === centerNode.id;
			
			if (isCenterNode) {
				// Draw center node as very large control surface
				const nodeWidth = Math.min(400, width * 0.6);
				const nodeHeight = Math.min(300, height * 0.4);
				const rectX = node.x - nodeWidth / 2;
				const rectY = node.y - nodeHeight / 2;
				
				// Background with gradient
				const gradient = context.createLinearGradient(rectX, rectY, rectX, rectY + nodeHeight);
				if (node.type === 'task') {
					gradient.addColorStop(0, '#1d4ed8');
					gradient.addColorStop(1, '#1e40af');
				} else {
					gradient.addColorStop(0, '#047857');
					gradient.addColorStop(1, '#065f46');
				}
				
				drawRoundedRect(rectX, rectY, nodeWidth, nodeHeight, 16);
				context.fillStyle = gradient;
				context.fill();
				
				// Border
				context.strokeStyle = '#fbbf24';
				context.lineWidth = 4;
				context.stroke();
				
				// Inner content area
				const contentPadding = 20;
				const contentX = rectX + contentPadding;
				const contentY = rectY + contentPadding;
				const contentWidth = nodeWidth - (contentPadding * 2);
				const contentHeight = nodeHeight - (contentPadding * 2);
				
				// Header section
				context.fillStyle = '#ffffff';
				context.font = 'bold 20px sans-serif';
				context.textAlign = 'left';
				context.textBaseline = 'top';
				
				const titleLines = wrapText(node.name, contentWidth - 40, 20);
				titleLines.forEach((line, index) => {
					context.fillText(line, contentX, contentY + (index * 24));
				});
				
				// Divider line
				const dividerY = contentY + (titleLines.length * 24) + 15;
				context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
				context.lineWidth = 1;
				context.beginPath();
				context.moveTo(contentX, dividerY);
				context.lineTo(contentX + contentWidth, dividerY);
				context.stroke();
				
				// Details section
				context.font = '14px sans-serif';
				context.fillStyle = 'rgba(255, 255, 255, 0.9)';
				const detailsStartY = dividerY + 20;
				
				context.fillText(`Type: ${node.type}`, contentX, detailsStartY);
				context.fillText(`ID: ${node.id}`, contentX, detailsStartY + 20);
				
				// Show connected nodes count
				const connectedCount = links.filter(link => {
					const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
					const targetId = typeof link.target === 'string' ? link.target : link.target.id;
					return sourceId === node.id || targetId === node.id;
				}).length;
				
				context.fillText(`Connections: ${connectedCount}`, contentX, detailsStartY + 40);
				
				// Placeholder for future editing controls
				context.font = '12px sans-serif';
				context.fillStyle = 'rgba(255, 255, 255, 0.6)';
				context.fillText('Hierarchical Layout • Click nodes to change focus', contentX, contentY + contentHeight - 20);
				
			} else {
				// Draw regular nodes as smaller rounded rectangles
				const nodeWidth = 120;
				const nodeHeight = 40;
				const rectX = node.x - nodeWidth / 2;
				const rectY = node.y - nodeHeight / 2;
				
				// Background
				drawRoundedRect(rectX, rectY, nodeWidth, nodeHeight, 8);
				context.fillStyle = node.type === 'task' ? '#3b82f6' : '#10b981';
				context.fill();
				
				// Border
				context.strokeStyle = '#1f2937';
				context.lineWidth = 1;
				context.stroke();
				
				// Text
				context.fillStyle = '#ffffff';
				context.font = '12px sans-serif';
				context.textAlign = 'center';
				context.textBaseline = 'middle';
				
				// Truncate long names
				const maxLength = 15;
				const displayName = node.name.length > maxLength 
					? node.name.substring(0, maxLength) + '...'
					: node.name;
				
				context.fillText(displayName, node.x, node.y);
			}
		});
	}
	
	onMount(() => {
		context = canvas.getContext('2d')!;
		
		// Initial canvas sizing
		const handleResize = () => {
			const container = canvas.parentElement;
			if (container) {
				const rect = container.getBoundingClientRect();
				width = rect.width;
				// Calculate remaining vertical space more accurately
				const headerHeight = 80; // Approximate header height
				const padding = 20; // Some padding
				height = Math.max(400, window.innerHeight - rect.top - headerHeight - padding);
				
				canvas.width = width;
				canvas.height = height;
				canvas.style.width = `${width}px`;
				canvas.style.height = `${height}px`;
				
				// Re-layout if we have data
				if (centerNode) {
					applyHierarchicalLayout(centerNode.id);
				}
				// Always trigger draw after resize
				draw();
			}
		};
		
		window.addEventListener('resize', handleResize);
		handleResize();
		
		// Add click handler for selecting center node
		canvas.addEventListener('click', handleCanvasClick);
		
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

<div class="w-full h-full border rounded-lg bg-white relative">
	<canvas bind:this={canvas} {width} {height} class="w-full h-full cursor-pointer bg-transparent"></canvas>
	
	{#if isEditing && centerNode && centerNode.x !== undefined && centerNode.y !== undefined}
		{@const nodeWidth = Math.min(400, width * 0.6)}
		{@const nodeHeight = Math.min(300, height * 0.4)}
		{@const overlayX = centerNode.x - nodeWidth / 2}
		{@const overlayY = centerNode.y - nodeHeight / 2}
		
		<div 
			class="absolute bg-white border-2 border-amber-400 rounded-lg shadow-lg p-4 z-10"
			style="left: {overlayX}px; top: {overlayY}px; width: {nodeWidth}px;"
		>
			<div class="mb-3">
				<label class="block text-sm font-medium text-gray-700 mb-1">
					Node Name
				</label>
				<input 
					type="text" 
					bind:value={editingName}
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					placeholder="Enter node name..."
					use:focus
					on:keydown={(e) => {
						if (e.key === 'Enter') saveEdit();
						if (e.key === 'Escape') cancelEdit();
					}}
				/>
			</div>
			
			<div class="flex gap-2 justify-end">
				<button 
					class="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
					on:click={cancelEdit}
				>
					Cancel
				</button>
				<button 
					class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
					on:click={saveEdit}
				>
					Save
				</button>
			</div>
		</div>
	{/if}
</div>