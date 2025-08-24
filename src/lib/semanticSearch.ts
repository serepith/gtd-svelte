import { findSimilarItems, type SearchResult } from './embeddings';
import { getAllItemsWithEmbeddings } from './database';

/**
 * Perform semantic search across all tasks and tags
 */
export async function performSemanticSearch(
	query: string,
	maxResults: number = 3
): Promise<SearchResult[]> {
	console.log('🔍 Starting semantic search for:', query);
	
	if (!query.trim()) {
		console.log('❌ Empty query, returning empty results');
		return [];
	}

	try {
		// Get all items that have embeddings
		const itemsWithEmbeddings = await getAllItemsWithEmbeddings();
		console.log('📊 Items with embeddings found:', itemsWithEmbeddings.length);
		
		// Debug: log the first few items
		if (itemsWithEmbeddings.length > 0) {
			console.log('📝 Sample items with embeddings:', itemsWithEmbeddings.slice(0, 3).map(item => ({
				name: item.name,
				type: item.type,
				hasEmbedding: !!item.embedding,
				embeddingLength: item.embedding?.length,
				modelVersion: item.embeddingModelVersion
			})));
		}

		if (itemsWithEmbeddings.length === 0) {
			console.warn('⚠️  No items with embeddings found for search');
			console.log('💡 Try running getEmbeddingStatus() to debug');
			return [];
		}

		// Find similar items using embeddings
		const results = await findSimilarItems(query, itemsWithEmbeddings, maxResults);

		console.log(`✅ Semantic search for "${query}" found ${results.length} results`);
		if (results.length > 0) {
			console.log('🎯 Search results:', results.map(r => ({
				name: r.item.name,
				type: r.type,
				similarity: r.similarity
			})));
		}
		
		return results;
	} catch (error) {
		console.error('❌ Error in semantic search:', error);
		return [];
	}
}

/**
 * Debounced semantic search function
 */
export function createDebouncedSearch(delay: number = 300) {
	let timeoutId: NodeJS.Timeout | null = null;

	return function debouncedSearch(
		query: string,
		callback: (results: SearchResult[]) => void,
		maxResults: number = 3
	) {
		// Clear existing timeout
		if (timeoutId) {
			clearTimeout(timeoutId);
		}

		// Set new timeout
		timeoutId = setTimeout(async () => {
			try {
				const results = await performSemanticSearch(query, maxResults);
				callback(results);
			} catch (error) {
				console.error('Error in debounced search:', error);
				callback([]);
			}
		}, delay);
	};
}
