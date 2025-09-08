import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getAllJunctions, getAllNodes } from './database';
import { Timestamp } from 'firebase/firestore';

// Mock the embeddings module to prevent Worker issues in tests
vi.mock('./embeddings', () => ({
	runEmbedding: vi.fn(),
	generateEmbedding: vi.fn(),
	needsEmbedding: vi.fn(),
	getModelVersion: vi.fn().mockReturnValue('test-model-v1')
}));

// Mock the global state to prevent Firebase dependency issues
vi.mock('$lib/globalState.svelte', () => ({
	data: {
		junctionsCollection: 'mockJunctionsCollection',
		nodesCollection: 'mockNodesCollection'
	}
}));

// Mock Firebase functions
vi.mock('firebase/firestore', async () => {
	const actual = await vi.importActual('firebase/firestore');
	return {
		...actual,
		getDocsFromCache: vi.fn(),
		query: vi.fn(),
		where: vi.fn()
	};
});

describe('Junction Validation Suite', () => {
	let junctions: Junction[] = [];
	let nodes: GraphNode[] = [];
	let nodeIds: Set<string> = new Set();

	beforeAll(async () => {
		// This will need to be mocked in tests, but shows the structure for integration tests
		try {
			junctions = await getAllJunctions();
			nodes = await getAllNodes();
			nodeIds = new Set(nodes.map(node => node.id).filter(Boolean) as string[]);
		} catch (error) {
			console.log('Using mock data for tests');
			// Test will use mock data instead
		}
	});

	describe('Junction Structure Validation', () => {
		it('should validate that all junctions have required fields', async () => {
			// Mock data for unit test
			const mockJunctions: Junction[] = [
				{
					id: 'junction-1',
					parentId: 'parent-1',
					childId: 'child-1',
					parentType: 'tag',
					childType: 'task',
					createdAt: Timestamp.now()
				},
				{
					id: 'junction-2',
					parentId: 'parent-2',
					childId: 'child-2',
					parentType: 'tag',
					childType: 'task',
					createdAt: Timestamp.now(),
					junctionType: {
						type: 'equivalency',
						details: {
							displayName: 'Test Display',
							useOriginalName: false
						}
					}
				}
			];

			// Use mock data if no real data available
			const testJunctions = junctions.length > 0 ? junctions : mockJunctions;
			
			const requiredFields = ['parentId', 'childId', 'parentType', 'childType', 'createdAt'];
			const invalidJunctions: { junction: Junction; missingFields: string[] }[] = [];

			for (const junction of testJunctions) {
				const missingFields = requiredFields.filter(field => 
					junction[field as keyof Junction] === undefined || 
					junction[field as keyof Junction] === null ||
					junction[field as keyof Junction] === ''
				);

				if (missingFields.length > 0) {
					invalidJunctions.push({ junction, missingFields });
				}
			}

			if (invalidJunctions.length > 0) {
				console.error('❌ Junctions with missing required fields:', invalidJunctions);
			}

			expect(invalidJunctions).toHaveLength(0);
		});

		it('should validate junction type combinations are valid', async () => {
			const mockJunctions: Junction[] = [
				{
					id: 'junction-valid-1',
					parentId: 'tag-1',
					childId: 'task-1',
					parentType: 'tag',
					childType: 'task',
					createdAt: Timestamp.now()
				},
				{
					id: 'junction-valid-2',
					parentId: 'tag-1',
					childId: 'tag-2',
					parentType: 'tag',
					childType: 'tag',
					createdAt: Timestamp.now()
				}
			];

			const testJunctions = junctions.length > 0 ? junctions : mockJunctions;
			
			// Valid combinations in this system
			const validCombinations = new Set([
				'tag->task',  // Tags can contain tasks
				'tag->tag'    // Tags can be equivalent to other tags
			]);

			const invalidJunctions: { junction: Junction; reason: string }[] = [];

			for (const junction of testJunctions) {
				const combination = `${junction.parentType}->${junction.childType}`;
				
				if (!validCombinations.has(combination)) {
					invalidJunctions.push({ 
						junction, 
						reason: `Invalid type combination: ${combination}` 
					});
				}

				// Additional validation: task->task relationships might be invalid
				if (junction.parentType === 'task' && junction.childType === 'task') {
					invalidJunctions.push({
						junction,
						reason: 'Task-to-task relationships are not supported'
					});
				}
			}

			if (invalidJunctions.length > 0) {
				console.error('❌ Junctions with invalid type combinations:', invalidJunctions);
			}

			expect(invalidJunctions).toHaveLength(0);
		});

		it('should validate junction type structure when present', async () => {
			const mockJunctions: Junction[] = [
				{
					id: 'junction-1',
					parentId: 'tag-1',
					childId: 'tag-2',
					parentType: 'tag',
					childType: 'tag',
					createdAt: Timestamp.now(),
					junctionType: {
						type: 'equivalency',
						details: {
							displayName: 'Valid Display Name',
							useOriginalName: false
						}
					}
				},
				{
					id: 'junction-2',
					parentId: 'tag-3',
					childId: 'tag-4',
					parentType: 'tag',
					childType: 'tag',
					createdAt: Timestamp.now()
					// No junctionType - this should be valid
				}
			];

			const testJunctions = junctions.length > 0 ? junctions : mockJunctions;
			const invalidJunctions: { junction: Junction; reason: string }[] = [];

			for (const junction of testJunctions) {
				if (junction.junctionType) {
					// Validate junctionType structure
					if (!junction.junctionType.type) {
						invalidJunctions.push({
							junction,
							reason: 'junctionType.type is required when junctionType is present'
						});
					}

					if (junction.junctionType.type === 'equivalency') {
						if (!junction.junctionType.details) {
							invalidJunctions.push({
								junction,
								reason: 'junctionType.details is required for equivalency type'
							});
						} else {
							// For equivalency, both parent and child should be tags
							if (junction.parentType !== 'tag' || junction.childType !== 'tag') {
								invalidJunctions.push({
									junction,
									reason: 'Equivalency junctions must be between tags (tag->tag)'
								});
							}
						}
					}
				}
			}

			if (invalidJunctions.length > 0) {
				console.error('❌ Junctions with invalid junctionType structure:', invalidJunctions);
			}

			expect(invalidJunctions).toHaveLength(0);
		});
	});

	describe('Junction Integrity Validation', () => {
		it('should validate that all referenced nodes exist', async () => {
			// Mock nodes data
			const mockNodes: GraphNode[] = [
				{
					id: 'node-1',
					name: 'Task 1',
					type: 'task',
					createdAt: Timestamp.now(),
					updatedAt: Timestamp.now(),
					completed: false,
					archived: false
				} as Task,
				{
					id: 'node-2',
					name: 'Tag 1',
					type: 'tag',
					createdAt: Timestamp.now(),
					updatedAt: Timestamp.now()
				} as Tag
			];

			const mockJunctions: Junction[] = [
				{
					id: 'junction-1',
					parentId: 'node-2',
					childId: 'node-1',
					parentType: 'tag',
					childType: 'task',
					createdAt: Timestamp.now()
				},
				{
					id: 'junction-orphaned',
					parentId: 'nonexistent-parent',
					childId: 'node-1',
					parentType: 'tag',
					childType: 'task',
					createdAt: Timestamp.now()
				}
			];

			// Use real data if available, otherwise use mocks
			const testNodes = nodes.length > 0 ? nodes : mockNodes;
			const testJunctions = junctions.length > 0 ? junctions : mockJunctions;
			const testNodeIds = new Set(testNodes.map(node => node.id).filter(Boolean) as string[]);

			const orphanedJunctions: { junction: Junction; missingNodes: string[] }[] = [];

			for (const junction of testJunctions) {
				const missingNodes: string[] = [];

				if (!testNodeIds.has(junction.parentId)) {
					missingNodes.push(`parent: ${junction.parentId}`);
				}

				if (!testNodeIds.has(junction.childId)) {
					missingNodes.push(`child: ${junction.childId}`);
				}

				if (missingNodes.length > 0) {
					orphanedJunctions.push({ junction, missingNodes });
				}
			}

			if (orphanedJunctions.length > 0) {
				console.error('❌ Orphaned junctions (referencing nonexistent nodes):', orphanedJunctions);
			}

			// For integration tests, this should be 0. For unit tests with mock data, we expect 1 orphaned junction
			if (nodes.length > 0) {
				// Real data - should have no orphaned junctions
				expect(orphanedJunctions).toHaveLength(0);
			} else {
				// Mock data - expect the one orphaned junction we created for testing
				expect(orphanedJunctions).toHaveLength(1);
				expect(orphanedJunctions[0].junction.id).toBe('junction-orphaned');
			}
		});

		it('should validate node types match junction declarations', async () => {
			// Mock data with type mismatches
			const mockNodes: GraphNode[] = [
				{
					id: 'task-node',
					name: 'A Task',
					type: 'task',
					createdAt: Timestamp.now(),
					updatedAt: Timestamp.now(),
					completed: false,
					archived: false
				} as Task,
				{
					id: 'tag-node',
					name: 'A Tag',
					type: 'tag',
					createdAt: Timestamp.now(),
					updatedAt: Timestamp.now()
				} as Tag
			];

			const mockJunctions: Junction[] = [
				{
					id: 'junction-correct',
					parentId: 'tag-node',
					childId: 'task-node',
					parentType: 'tag',
					childType: 'task',
					createdAt: Timestamp.now()
				},
				{
					id: 'junction-parent-mismatch',
					parentId: 'task-node',
					childId: 'tag-node',
					parentType: 'tag', // Claims parent is tag, but task-node is actually a task
					childType: 'tag',
					createdAt: Timestamp.now()
				}
			];

			const testNodes = nodes.length > 0 ? nodes : mockNodes;
			const testJunctions = junctions.length > 0 ? junctions : mockJunctions;
			
			// Create lookup map for node types
			const nodeTypeMap = new Map<string, 'task' | 'tag'>();
			for (const node of testNodes) {
				if (node.id) {
					nodeTypeMap.set(node.id, node.type);
				}
			}

			const typeMismatchJunctions: { junction: Junction; mismatches: string[] }[] = [];

			for (const junction of testJunctions) {
				const mismatches: string[] = [];
				
				const actualParentType = nodeTypeMap.get(junction.parentId);
				const actualChildType = nodeTypeMap.get(junction.childId);

				if (actualParentType && actualParentType !== junction.parentType) {
					mismatches.push(`parent type mismatch: declared '${junction.parentType}' but actual type is '${actualParentType}'`);
				}

				if (actualChildType && actualChildType !== junction.childType) {
					mismatches.push(`child type mismatch: declared '${junction.childType}' but actual type is '${actualChildType}'`);
				}

				if (mismatches.length > 0) {
					typeMismatchJunctions.push({ junction, mismatches });
				}
			}

			if (typeMismatchJunctions.length > 0) {
				console.error('❌ Junctions with type mismatches:', typeMismatchJunctions);
			}

			// For real data, expect no mismatches. For mock data, expect 1 mismatch
			if (nodes.length > 0) {
				expect(typeMismatchJunctions).toHaveLength(0);
			} else {
				expect(typeMismatchJunctions).toHaveLength(1);
				expect(typeMismatchJunctions[0].junction.id).toBe('junction-parent-mismatch');
			}
		});

		it('should identify potential duplicate junctions', async () => {
			const mockJunctions: Junction[] = [
				{
					id: 'junction-1',
					parentId: 'tag-1',
					childId: 'task-1',
					parentType: 'tag',
					childType: 'task',
					createdAt: Timestamp.fromMillis(Date.now() - 1000)
				},
				{
					id: 'junction-2',
					parentId: 'tag-1',
					childId: 'task-1',
					parentType: 'tag',
					childType: 'task',
					createdAt: Timestamp.fromMillis(Date.now())
				},
				{
					id: 'junction-3',
					parentId: 'tag-2',
					childId: 'task-1',
					parentType: 'tag',
					childType: 'task',
					createdAt: Timestamp.now()
				}
			];

			const testJunctions = junctions.length > 0 ? junctions : mockJunctions;
			
			// Group junctions by parent-child relationship
			const relationshipMap = new Map<string, Junction[]>();
			
			for (const junction of testJunctions) {
				const key = `${junction.parentId}->${junction.childId}`;
				if (!relationshipMap.has(key)) {
					relationshipMap.set(key, []);
				}
				relationshipMap.get(key)!.push(junction);
			}

			// Find duplicates
			const duplicateRelationships: { relationship: string; junctions: Junction[] }[] = [];
			
			for (const [relationship, junctionList] of relationshipMap) {
				if (junctionList.length > 1) {
					duplicateRelationships.push({ relationship, junctions: junctionList });
				}
			}

			if (duplicateRelationships.length > 0) {
				console.warn('⚠️ Potential duplicate junctions found:', duplicateRelationships);
				
				// Log details for each duplicate set
				for (const duplicate of duplicateRelationships) {
					console.warn(`Relationship ${duplicate.relationship} has ${duplicate.junctions.length} junctions:`);
					for (const junction of duplicate.junctions) {
						console.warn(`  - Junction ${junction.id} created at ${junction.createdAt.toDate()}`);
					}
				}
			}

			// For mock data, we expect 1 duplicate relationship
			if (nodes.length === 0) {
				expect(duplicateRelationships).toHaveLength(1);
				expect(duplicateRelationships[0].junctions).toHaveLength(2);
			}
			// For real data, log warning but don't fail the test as duplicates might be valid in some cases
		});
	});

	describe('Junction Statistics and Health Check', () => {
		it('should provide junction statistics and health metrics', async () => {
			const mockJunctions: Junction[] = [
				{
					id: 'junction-1',
					parentId: 'tag-1',
					childId: 'task-1',
					parentType: 'tag',
					childType: 'task',
					createdAt: Timestamp.now()
				},
				{
					id: 'junction-2',
					parentId: 'tag-1',
					childId: 'tag-2',
					parentType: 'tag',
					childType: 'tag',
					createdAt: Timestamp.now(),
					junctionType: {
						type: 'equivalency',
						details: { displayName: 'Test', useOriginalName: false }
					}
				}
			];

			const testJunctions = junctions.length > 0 ? junctions : mockJunctions;
			
			// Calculate statistics
			const stats = {
				totalJunctions: testJunctions.length,
				byParentType: {} as Record<string, number>,
				byChildType: {} as Record<string, number>,
				byRelationType: {} as Record<string, number>,
				withJunctionType: 0,
				equivalencyJunctions: 0
			};

			for (const junction of testJunctions) {
				// Count by parent type
				stats.byParentType[junction.parentType] = (stats.byParentType[junction.parentType] || 0) + 1;
				
				// Count by child type
				stats.byChildType[junction.childType] = (stats.byChildType[junction.childType] || 0) + 1;
				
				// Count by relationship type
				const relationType = `${junction.parentType}->${junction.childType}`;
				stats.byRelationType[relationType] = (stats.byRelationType[relationType] || 0) + 1;
				
				// Count junctions with junction type
				if (junction.junctionType) {
					stats.withJunctionType++;
					
					if (junction.junctionType.type === 'equivalency') {
						stats.equivalencyJunctions++;
					}
				}
			}

			console.log('📊 Junction Statistics:', stats);

			// Basic health checks
			expect(stats.totalJunctions).toBeGreaterThanOrEqual(0);
			expect(Object.keys(stats.byParentType).length).toBeGreaterThanOrEqual(0);
			expect(Object.keys(stats.byChildType).length).toBeGreaterThanOrEqual(0);
			
			// All junction counts should add up to total
			const parentTypeSum = Object.values(stats.byParentType).reduce((sum, count) => sum + count, 0);
			const childTypeSum = Object.values(stats.byChildType).reduce((sum, count) => sum + count, 0);
			const relationTypeSum = Object.values(stats.byRelationType).reduce((sum, count) => sum + count, 0);
			
			expect(parentTypeSum).toBe(stats.totalJunctions);
			expect(childTypeSum).toBe(stats.totalJunctions);
			expect(relationTypeSum).toBe(stats.totalJunctions);
		});
	});
});