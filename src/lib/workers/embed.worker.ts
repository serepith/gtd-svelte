/// <reference lib="webworker" />

import { type FeatureExtractionPipeline, pipeline, env } from "@xenova/transformers";

// Configuration
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const MODEL_VERSION = 'all-MiniLM-L6-v2-v1';
const SIMILARITY_THRESHOLD = 0.4;

// Disable local model loading for web environment
env.allowRemoteModels = true;
env.allowLocalModels = false;

// Runs off the main thread
export type EmbedJob = { text: string };
export type EmbedResult = { vector: ArrayBuffer };


// Cache for the transformer pipeline
let embeddingPipeline: FeatureExtractionPipeline | null = null;


/**
 * Initialize and cache the embedding pipeline
 */
async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log('Loading embedding model...');
    embeddingPipeline = await pipeline('feature-extraction', MODEL_NAME) as FeatureExtractionPipeline;
    console.log('Embedding model loaded successfully');
  }
  return embeddingPipeline;
}


/**
 * Generate embedding for a given text
 */
export async function generateEmbedding(text: string) {
  if (!text.trim()) {
    throw new Error('Cannot generate embedding for empty text');
  }

  try {
    const extractor = await getEmbeddingPipeline();
    const output = await extractor(text, {
      pooling: 'mean',
      normalize: true
    });

    return output;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

self.onmessage = async (e: MessageEvent<EmbedJob>) => {
  const vec = await generateEmbedding(e.data.text);
  const float32vec = vec.to('float32').data as Float32Array;
  const buf = float32vec.buffer as ArrayBuffer; // ArrayBuffer in normal cases
  // transfer zero-copy
  (self as DedicatedWorkerGlobalScope).postMessage({ vector: buf } satisfies EmbedResult, [buf]);
};
