/**
 * Junction Validator - Production utility for validating junction integrity
 * 
 * This module provides functions to validate junctions in a live database.
 * Unlike the test suite, this is designed to run against real data.
 */

import { getAllJunctions, getAllNodes } from './database';

export interface ValidationResult {
	isValid: boolean;
	errors: ValidationError[];
	warnings: ValidationWarning[];
	statistics: JunctionStatistics;
}

export interface ValidationError {
	type: 'missing_field' | 'invalid_type' | 'orphaned_junction' | 'type_mismatch';
	junctionId: string;
	message: string;
	details?: any;
}

export interface ValidationWarning {
	type: 'duplicate_junction' | 'deprecated_structure';
	junctionId?: string;
	message: string;
	details?: any;
}

export interface JunctionStatistics {
	totalJunctions: number;
	byParentType: Record<string, number>;
	byChildType: Record<string, number>;
	byRelationType: Record<string, number>;
	withJunctionType: number;
	equivalencyJunctions: number;
	healthScore: number; // 0-100, based on error/warning ratio
}

/**
 * Validate all junctions in the database
 */
export async function validateAllJunctions(): Promise<ValidationResult> {
	console.log('🔍 Starting junction validation...');
	
	try {
		const [junctions, nodes] = await Promise.all([
			getAllJunctions(),
			getAllNodes()
		]);

		console.log(`📊 Found ${junctions.length} junctions and ${nodes.length} nodes`);

		const result: ValidationResult = {
			isValid: true,
			errors: [],
			warnings: [],
			statistics: calculateStatistics(junctions)
		};

		// Create node lookup map for faster access
		const nodeMap = new Map<string, GraphNode>();
		for (const node of nodes) {
			if (node.id) {
				nodeMap.set(node.id, node);
			}
		}

		// Run all validation checks
		validateRequiredFields(junctions, result);
		validateTypeCominations(junctions, result);
		validateJunctionTypeStructure(junctions, result);
		validateNodeReferences(junctions, nodeMap, result);
		validateTypeConsistency(junctions, nodeMap, result);
		findDuplicateJunctions(junctions, result);

		// Calculate health score
		result.statistics.healthScore = calculateHealthScore(result);
		result.isValid = result.errors.length === 0;

		console.log(`✅ Validation complete. Health score: ${result.statistics.healthScore}/100`);
		
		if (result.errors.length > 0) {
			console.error(`❌ Found ${result.errors.length} errors`);
		}
		
		if (result.warnings.length > 0) {
			console.warn(`⚠️ Found ${result.warnings.length} warnings`);
		}

		return result;

	} catch (error) {
		console.error('❌ Error during junction validation:', error);
		return {
			isValid: false,
			errors: [{
				type: 'missing_field',
				junctionId: 'unknown',
				message: `Validation failed: ${error}`
			}],
			warnings: [],
			statistics: {
				totalJunctions: 0,
				byParentType: {},
				byChildType: {},
				byRelationType: {},
				withJunctionType: 0,
				equivalencyJunctions: 0,
				healthScore: 0
			}
		};
	}
}

function validateRequiredFields(junctions: Junction[], result: ValidationResult) {
	const requiredFields = ['parentId', 'childId', 'parentType', 'childType', 'createdAt'];
	
	for (const junction of junctions) {
		for (const field of requiredFields) {
			const value = junction[field as keyof Junction];
			if (value === undefined || value === null || value === '') {
				result.errors.push({
					type: 'missing_field',
					junctionId: junction.id || 'unknown',
					message: `Missing required field: ${field}`,
					details: { field, junction }
				});
			}
		}
	}
}

function validateTypeCominations(junctions: Junction[], result: ValidationResult) {
	const validCombinations = new Set(['tag->task', 'tag->tag']);
	
	for (const junction of junctions) {
		const combination = `${junction.parentType}->${junction.childType}`;
		
		if (!validCombinations.has(combination)) {
			result.errors.push({
				type: 'invalid_type',
				junctionId: junction.id || 'unknown',
				message: `Invalid type combination: ${combination}`,
				details: { combination, junction }
			});
		}
	}
}

function validateJunctionTypeStructure(junctions: Junction[], result: ValidationResult) {
	for (const junction of junctions) {
		if (junction.junctionType) {
			if (!junction.junctionType.type) {
				result.errors.push({
					type: 'invalid_type',
					junctionId: junction.id || 'unknown',
					message: 'junctionType.type is required when junctionType is present'
				});
			}

			if (junction.junctionType.type === 'equivalency') {
				if (!junction.junctionType.details) {
					result.errors.push({
						type: 'invalid_type',
						junctionId: junction.id || 'unknown',
						message: 'junctionType.details is required for equivalency type'
					});
				}

				// Equivalency must be between tags
				if (junction.parentType !== 'tag' || junction.childType !== 'tag') {
					result.errors.push({
						type: 'invalid_type',
						junctionId: junction.id || 'unknown',
						message: 'Equivalency junctions must be between tags (tag->tag)'
					});
				}
			}
		}
	}
}

function validateNodeReferences(junctions: Junction[], nodeMap: Map<string, GraphNode>, result: ValidationResult) {
	for (const junction of junctions) {
		if (!nodeMap.has(junction.parentId)) {
			result.errors.push({
				type: 'orphaned_junction',
				junctionId: junction.id || 'unknown',
				message: `Parent node not found: ${junction.parentId}`,
				details: { missingNodeId: junction.parentId, nodeType: 'parent' }
			});
		}

		if (!nodeMap.has(junction.childId)) {
			result.errors.push({
				type: 'orphaned_junction',
				junctionId: junction.id || 'unknown',
				message: `Child node not found: ${junction.childId}`,
				details: { missingNodeId: junction.childId, nodeType: 'child' }
			});
		}
	}
}

function validateTypeConsistency(junctions: Junction[], nodeMap: Map<string, GraphNode>, result: ValidationResult) {
	for (const junction of junctions) {
		const parentNode = nodeMap.get(junction.parentId);
		const childNode = nodeMap.get(junction.childId);

		if (parentNode && parentNode.type !== junction.parentType) {
			result.errors.push({
				type: 'type_mismatch',
				junctionId: junction.id || 'unknown',
				message: `Parent type mismatch: junction declares '${junction.parentType}' but node is '${parentNode.type}'`,
				details: { declaredType: junction.parentType, actualType: parentNode.type, nodeId: junction.parentId }
			});
		}

		if (childNode && childNode.type !== junction.childType) {
			result.errors.push({
				type: 'type_mismatch',
				junctionId: junction.id || 'unknown',
				message: `Child type mismatch: junction declares '${junction.childType}' but node is '${childNode.type}'`,
				details: { declaredType: junction.childType, actualType: childNode.type, nodeId: junction.childId }
			});
		}
	}
}

function findDuplicateJunctions(junctions: Junction[], result: ValidationResult) {
	const relationshipMap = new Map<string, Junction[]>();
	
	for (const junction of junctions) {
		const key = `${junction.parentId}->${junction.childId}`;
		if (!relationshipMap.has(key)) {
			relationshipMap.set(key, []);
		}
		relationshipMap.get(key)!.push(junction);
	}

	for (const [relationship, junctionList] of relationshipMap) {
		if (junctionList.length > 1) {
			for (const junction of junctionList) {
				result.warnings.push({
					type: 'duplicate_junction',
					junctionId: junction.id || 'unknown',
					message: `Duplicate junction relationship: ${relationship}`,
					details: { 
						relationship, 
						totalDuplicates: junctionList.length,
						allJunctionIds: junctionList.map(j => j.id).filter(Boolean)
					}
				});
			}
		}
	}
}

function calculateStatistics(junctions: Junction[]): JunctionStatistics {
	const stats: JunctionStatistics = {
		totalJunctions: junctions.length,
		byParentType: {},
		byChildType: {},
		byRelationType: {},
		withJunctionType: 0,
		equivalencyJunctions: 0,
		healthScore: 0
	};

	for (const junction of junctions) {
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

	return stats;
}

function calculateHealthScore(result: ValidationResult): number {
	const totalIssues = result.errors.length + result.warnings.length * 0.5; // Warnings count as half
	const totalJunctions = Math.max(1, result.statistics.totalJunctions); // Avoid division by zero
	
	// Score based on issue ratio (fewer issues = higher score)
	const issueRatio = totalIssues / totalJunctions;
	const baseScore = Math.max(0, 100 - (issueRatio * 100));
	
	// Apply penalties for critical errors
	const criticalErrorPenalty = result.errors.filter(e => 
		e.type === 'orphaned_junction' || e.type === 'type_mismatch'
	).length * 10;
	
	return Math.max(0, Math.round(baseScore - criticalErrorPenalty));
}

/**
 * Run junction validation and log results to console
 */
export async function runJunctionHealthCheck(): Promise<boolean> {
	console.log('🏥 Running Junction Health Check...');
	
	const result = await validateAllJunctions();
	
	// Log statistics
	console.log('📊 Junction Statistics:');
	console.log(`  Total Junctions: ${result.statistics.totalJunctions}`);
	console.log(`  By Parent Type:`, result.statistics.byParentType);
	console.log(`  By Child Type:`, result.statistics.byChildType);
	console.log(`  By Relation Type:`, result.statistics.byRelationType);
	console.log(`  With Junction Type: ${result.statistics.withJunctionType}`);
	console.log(`  Equivalency Junctions: ${result.statistics.equivalencyJunctions}`);
	console.log(`  Health Score: ${result.statistics.healthScore}/100`);
	
	// Log errors
	if (result.errors.length > 0) {
		console.log('\n❌ Errors Found:');
		for (const error of result.errors) {
			console.log(`  ${error.type}: ${error.message} (Junction: ${error.junctionId})`);
		}
	}
	
	// Log warnings
	if (result.warnings.length > 0) {
		console.log('\n⚠️ Warnings:');
		for (const warning of result.warnings) {
			console.log(`  ${warning.type}: ${warning.message} ${warning.junctionId ? `(Junction: ${warning.junctionId})` : ''}`);
		}
	}
	
	if (result.isValid) {
		console.log('\n✅ All junctions are valid!');
	} else {
		console.log(`\n❌ Found ${result.errors.length} errors that need to be fixed.`);
	}
	
	return result.isValid;
}