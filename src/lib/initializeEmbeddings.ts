import { ensureAllEmbeddings, getAllNodes, getAllItemsWithEmbeddings } from './database';
import { generateEmbedding } from './embeddings';

/**
 * Test if embeddings are working
 */
export async function testEmbeddings(): Promise<void> {
	console.log('🧪 Testing embedding generation...');
	
	try {
		const testEmbedding = await generateEmbedding('test task');
		console.log('✅ Embedding generation works!', {
			dimensions: testEmbedding.length,
			sample: testEmbedding.slice(0, 5)
		});
	} catch (error) {
		console.error('❌ Embedding generation failed:', error);
		throw error;
	}
}

/**
 * Get status of embeddings in your data
 */
export async function getEmbeddingStatus(): Promise<void> {
	console.log('📊 Checking embedding status...');
	
	try {
		const allNodes = await getAllNodes();
		const nodesWithEmbeddings = await getAllItemsWithEmbeddings();
		
		console.log('📈 Embedding Status:', {
			totalItems: allNodes.length,
			itemsWithEmbeddings: nodesWithEmbeddings.length,
			itemsNeedingEmbeddings: allNodes.length - nodesWithEmbeddings.length,
			breakdown: {
				tasks: allNodes.filter(n => n.type === 'task').length,
				tags: allNodes.filter(n => n.type === 'tag').length,
				tasksWithEmbeddings: nodesWithEmbeddings.filter(n => n.type === 'task').length,
				tagsWithEmbeddings: nodesWithEmbeddings.filter(n => n.type === 'tag').length
			}
		});

		if (nodesWithEmbeddings.length === 0) {
			console.log('💡 No embeddings found. Run initializeEmbeddings() to generate them.');
		}
	} catch (error) {
		console.error('❌ Failed to check embedding status:', error);
	}
}

/**
 * Initialize embeddings for the application
 * This can be called to generate embeddings for existing data
 */
export async function initializeEmbeddings(): Promise<void> {
	console.log('🚀 Initializing semantic search embeddings...');
	
	try {
		// First test that embeddings work
		await testEmbeddings();
		
		// Check current status
		await getEmbeddingStatus();
		
		// Generate embeddings for all items
		await ensureAllEmbeddings();
		
		// Check final status
		console.log('🎉 Initialization complete! Final status:');
		await getEmbeddingStatus();
		
		console.log('✅ Semantic search is ready!');
	} catch (error) {
		console.error('❌ Failed to initialize embeddings:', error);
		console.log('💡 Try running testEmbeddings() first to diagnose the issue');
		throw error;
	}
}

// Add helpful functions to window object for easy debugging
if (typeof window !== 'undefined') {
	(window as any).initializeEmbeddings = initializeEmbeddings;
	(window as any).testEmbeddings = testEmbeddings;
	(window as any).getEmbeddingStatus = getEmbeddingStatus;
	
	console.log('🔧 Debug functions available:');
	console.log('  - testEmbeddings() - Test if embedding generation works');
	console.log('  - getEmbeddingStatus() - Check how many items have embeddings');
	console.log('  - initializeEmbeddings() - Generate embeddings for all items');
}