import { pipeline, env } from '@xenova/transformers';

// Configuration
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const MODEL_VERSION = 'all-MiniLM-L6-v2-v1';
const SIMILARITY_THRESHOLD = 0.4;

// Disable local model loading for web environment
env.allowRemoteModels = true;
env.allowLocalModels = false;

// Cache for the transformer pipeline
let embeddingPipeline: any = null;

/**
 * Initialize and cache the embedding pipeline
 */
async function getEmbeddingPipeline() {
	if (!embeddingPipeline) {
		console.log('Loading embedding model...');
		embeddingPipeline = await pipeline('feature-extraction', MODEL_NAME);
		console.log('Embedding model loaded successfully');
	}
	return embeddingPipeline;
}

/**
 * Generate embedding for a given text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
	if (!text.trim()) {
		throw new Error('Cannot generate embedding for empty text');
	}

	try {
		const extractor = await getEmbeddingPipeline();
		const output = await extractor(text, {
			pooling: 'mean',
			normalize: true
		});

		// Convert tensor to array
		const embedding = Array.from(output.data);

		console.log(`Generated embedding for "${text}" (${embedding.length} dimensions)`);
		return embedding;
	} catch (error) {
		console.error('Error generating embedding:', error);
		throw error;
	}
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length) {
		throw new Error('Embeddings must have the same length');
	}

	let dotProduct = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}

	const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
	if (magnitude === 0) return 0;

	return dotProduct / magnitude;
}

/**
 * Check if an item needs embedding generation or update
 */
export function needsEmbedding(item: Task | Tag): boolean {
	return (
		!item.embedding || !item.embeddingModelVersion || item.embeddingModelVersion !== MODEL_VERSION
	);
}

/**
 * Get the current model version
 */
export function getModelVersion(): string {
	return MODEL_VERSION;
}

/**
 * Get the similarity threshold
 */
export function getSimilarityThreshold(): number {
	return SIMILARITY_THRESHOLD;
}

/**
 * Search result type
 */
export type SearchResult = {
	item: Task | Tag;
	similarity: number;
	type: 'task' | 'tag';
};

/**
 * Find semantically similar items
 */
export async function findSimilarItems(
	query: string,
	items: (Task | Tag)[],
	maxResults: number = 3
): Promise<SearchResult[]> {
	if (!query.trim() || items.length === 0) {
		return [];
	}

	try {
		// Generate embedding for search query
		const queryEmbedding = await generateEmbedding(query);

		// Calculate similarities for ALL items (for debugging)
		const allSimilarities: Array<{item: Task | Tag, similarity: number, type: 'task' | 'tag'}> = [];

		for (const item of items) {
			// Skip items without embeddings (they should be generated elsewhere)
			if (!item.embedding) {
				console.warn(`Item "${item.name}" missing embedding, skipping`);
				continue;
			}

			try {
				const similarity = cosineSimilarity(queryEmbedding, item.embedding);
				allSimilarities.push({
					item,
					similarity,
					type: item.type
				});
			} catch (error) {
				console.warn(`Error calculating similarity for "${item.name}":`, error);
			}
		}

		// Sort all similarities by score (highest first)
		allSimilarities.sort((a, b) => b.similarity - a.similarity);

		// Show top 10 similarities for debugging (regardless of threshold)
		console.log(`🎯 Top similarities for "${query}" (threshold: ${SIMILARITY_THRESHOLD}):`);
		const top10 = allSimilarities.slice(0, 10);
		top10.forEach((result, index) => {
			const percentage = Math.round(result.similarity * 100);
			const aboveThreshold = result.similarity >= SIMILARITY_THRESHOLD ? '✅' : '❌';
			console.log(`  ${index + 1}. ${aboveThreshold} "${result.item.name}" (${result.type}): ${percentage}%`);
		});

		// Filter results above threshold
		const results: SearchResult[] = allSimilarities
			.filter(result => result.similarity >= SIMILARITY_THRESHOLD)
			.slice(0, maxResults)
			.map(result => ({
				item: result.item,
				similarity: result.similarity,
				type: result.type
			}));

		console.log(`🔍 Returning ${results.length} results above threshold (${Math.round(SIMILARITY_THRESHOLD * 100)}%)`);

		return results;
	} catch (error) {
		console.error('Error in semantic search:', error);
		return [];
	}
}
