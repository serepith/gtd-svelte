<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3Force from 'd3-force';
	import * as d3Selection from 'd3-selection';
	import { data } from '$lib/globalState.svelte';
	
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
		vx?: number;
		vy?: number;
		fx?: number;
		fy?: number;
	};
	
	type Link = {
		source: string | Node;
		target: string | Node;
	};

	onMount(() => console.log("MOUNTED"));
	
	let allNodes: Node[] = $state([]);
	let allLinks: Link[] = $state([]);
	let nodes: Node[] = $state([]);
	let links: Link[] = $state([]);
	let simulation: d3Force.Simulation<Node, Link>;
	let centerNode: Node | null = $state(null);
	
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
		} else {
			nodes = [];
			links = [];
		}
		
		if (simulation) {
			simulation.nodes(nodes);
			simulation.force('link', d3Force.forceLink(links).id(d => (d as Node).id));
			simulation.alpha(1).restart();
			
			// Fix center node position
			if (centerNode) {
				const center = nodes.find(n => n.id === centerNode?.id);
				if (center) {
					center.fx = width / 2;
					center.fy = height / 2;
				}
			}
		}
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
	
	function initSimulation() {
		if (!context) return;
		
		simulation = d3Force.forceSimulation(nodes)
			.force('charge', d3Force.forceManyBody().strength(-200))
			.force('link', d3Force.forceLink(links).id(d => (d as Node).id).distance(100))
			.force('center', d3Force.forceCenter(width / 2, height / 2))
			.force('collision', d3Force.forceCollide().radius(35))
			.on('tick', draw);
		
		// Add click handler for selecting center node
		canvas.addEventListener('click', handleCanvasClick);
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
				} else {
					nodeWidth = 120;
					nodeHeight = 40;
				}
				
				// Check if click is within rectangular bounds
				if (x >= node.x - nodeWidth / 2 && x <= node.x + nodeWidth / 2 &&
				    y >= node.y - nodeHeight / 2 && y <= node.y + nodeHeight / 2) {
					setCenterNode(node);
					break;
				}
			}
		}
	}
	
	function setCenterNode(node: Node) {
		// Release previous center node
		if (centerNode) {
			const prevCenter = nodes.find(n => n.id === centerNode?.id);
			if (prevCenter) {
				prevCenter.fx = undefined;
				prevCenter.fy = undefined;
			}
		}
		
		// Set new center node
		centerNode = node;
		
		// Re-filter nodes to show new 2-degree neighborhood
		if (centerNode) {
			const filteredResult = getFilteredNodesAndLinks(centerNode.id);
			nodes = filteredResult.nodes;
			links = filteredResult.links;
			
			// Update simulation with new filtered data
			simulation.nodes(nodes);
			simulation.force('link', d3Force.forceLink(links).id(d => (d as Node).id));
			
			// Fix new center node position
			const newCenter = nodes.find(n => n.id === centerNode?.id);
			if (newCenter) {
				newCenter.fx = width / 2;
				newCenter.fy = height / 2;
			}
		}
		
		// Restart simulation
		simulation.alpha(0.8).restart();
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
		if (!context) return;
		
		context.clearRect(0, 0, width, height);
		
		// Draw links
		context.strokeStyle = '#6b7280';
		context.lineWidth = 1;
		context.beginPath();
		links.forEach(link => {
			const source = link.source as Node;
			const target = link.target as Node;
			if (source.x !== undefined && source.y !== undefined && 
			    target.x !== undefined && target.y !== undefined) {
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
				const nodeWidth = Math.min(400, width * 0.6);  // 60% of canvas width, max 400px
				const nodeHeight = Math.min(300, height * 0.4); // 40% of canvas height, max 300px
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
					if (node.x !== undefined && node.y !== undefined) {
						context.fillText(line, contentX, contentY + (index * 24));
					}
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
				
				if (node.x !== undefined && node.y !== undefined) {
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
					context.fillText('Click to edit • Future: inline editing controls', contentX, contentY + contentHeight - 20);
				}
				
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
				
				if (simulation) {
					simulation.force('center', d3Force.forceCenter(width / 2, height / 2));
					// Update center node position if it exists
					if (centerNode) {
						const center = nodes.find(n => n.id === centerNode?.id);
						if (center) {
							center.fx = width / 2;
							center.fy = height / 2;
						}
					}
				}
			}
		};
		
		window.addEventListener('resize', handleResize);
		handleResize();
		initSimulation();
		
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

<div class="w-full h-full border rounded-lg bg-white">
	<canvas bind:this={canvas} {width} {height} class="w-full h-full cursor-pointer"></canvas>
</div>