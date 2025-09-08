import { validateAllJunctions, runJunctionHealthCheck } from './junctionValidator';
import { getAllJunctions, getAllNodes } from './database';

/**
 * Test if junction validation is working
 */
export async function testJunctionValidation(): Promise<void> {
	console.log('🧪 Testing junction validation...');
	
	try {
		const junctions = await getAllJunctions();
		const nodes = await getAllNodes();
		
		console.log('✅ Junction validation works!', {
			totalJunctions: junctions.length,
			totalNodes: nodes.length,
			junctionTypes: [...new Set(junctions.map(j => `${j.parentType}->${j.childType}`))]
		});
	} catch (error) {
		console.error('❌ Junction validation failed:', error);
		throw error;
	}
}

/**
 * Get quick statistics about junctions
 */
export async function getJunctionStatus(): Promise<void> {
	console.log('📊 Checking junction status...');
	
	try {
		const junctions = await getAllJunctions();
		const nodes = await getAllNodes();
		
		// Quick stats
		const stats = {
			totalJunctions: junctions.length,
			totalNodes: nodes.length,
			byRelationType: {} as Record<string, number>,
			withJunctionType: 0,
			equivalencyJunctions: 0
		};

		for (const junction of junctions) {
			const relationType = `${junction.parentType}->${junction.childType}`;
			stats.byRelationType[relationType] = (stats.byRelationType[relationType] || 0) + 1;
			
			if (junction.junctionType) {
				stats.withJunctionType++;
				if (junction.junctionType.type === 'equivalency') {
					stats.equivalencyJunctions++;
				}
			}
		}
		
		console.log('📈 Junction Status:', stats);

		if (junctions.length === 0) {
			console.log('💡 No junctions found. Create some tasks with tags to see junctions.');
		}
	} catch (error) {
		console.error('❌ Failed to check junction status:', error);
	}
}

/**
 * Run comprehensive junction validation
 */
export async function validateJunctions(): Promise<void> {
	console.log('🔍 Running comprehensive junction validation...');
	
	try {
		const result = await validateAllJunctions();
		
		// Log summary
		console.log('📋 Validation Summary:');
		console.log(`  Valid: ${result.isValid ? '✅ YES' : '❌ NO'}`);
		console.log(`  Health Score: ${result.statistics.healthScore}/100`);
		console.log(`  Total Junctions: ${result.statistics.totalJunctions}`);
		console.log(`  Errors: ${result.errors.length}`);
		console.log(`  Warnings: ${result.warnings.length}`);
		
		// Log detailed breakdown
		if (result.errors.length > 0) {
			console.group('❌ Errors:');
			for (const error of result.errors.slice(0, 10)) { // Limit to first 10
				console.log(`${error.type}: ${error.message} (Junction: ${error.junctionId})`);
			}
			if (result.errors.length > 10) {
				console.log(`... and ${result.errors.length - 10} more errors`);
			}
			console.groupEnd();
		}
		
		if (result.warnings.length > 0) {
			console.group('⚠️ Warnings:');
			for (const warning of result.warnings.slice(0, 10)) { // Limit to first 10
				console.log(`${warning.type}: ${warning.message} ${warning.junctionId ? `(Junction: ${warning.junctionId})` : ''}`);
			}
			if (result.warnings.length > 10) {
				console.log(`... and ${result.warnings.length - 10} more warnings`);
			}
			console.groupEnd();
		}
		
		console.log('💡 Use runJunctionHealthCheck() for a detailed console report.');
		
	} catch (error) {
		console.error('❌ Junction validation failed:', error);
		throw error;
	}
}

/**
 * Run health check with full console output
 */
export async function junctionHealthCheck(): Promise<boolean> {
	return await runJunctionHealthCheck();
}

/**
 * Show junction validation help
 */
export function junctionValidationHelp(): void {
	console.log('🆘 Junction Validation Help:');
	console.log('');
	console.log('Available Commands:');
	console.log('  testJunctionValidation() - Test if validation system works');
	console.log('  getJunctionStatus() - Quick junction statistics');  
	console.log('  validateJunctions() - Run validation with summary');
	console.log('  junctionHealthCheck() - Full detailed health check');
	console.log('  junctionValidationHelp() - Show this help');
	console.log('');
	console.log('What each validation checks:');
	console.log('  ✓ Required fields (parentId, childId, parentType, childType, createdAt)');
	console.log('  ✓ Valid type combinations (tag→task, tag→tag)');
	console.log('  ✓ Junction type structure (equivalency metadata)');
	console.log('  ✓ Node reference integrity (all referenced nodes exist)');
	console.log('  ✓ Type consistency (declared types match actual node types)');
	console.log('  ✓ Duplicate detection (same parent→child relationships)');
	console.log('');
	console.log('Health Score (0-100):');
	console.log('  90-100: Excellent - No issues');
	console.log('  70-89:  Good - Minor warnings only');
	console.log('  50-69:  Fair - Some errors, needs attention');
	console.log('  0-49:   Poor - Significant issues, requires fixes');
}

// Add helpful functions to window object for easy debugging
if (typeof window !== 'undefined') {
	(window as any).testJunctionValidation = testJunctionValidation;
	(window as any).getJunctionStatus = getJunctionStatus;
	(window as any).validateJunctions = validateJunctions;
	(window as any).junctionHealthCheck = junctionHealthCheck;
	(window as any).junctionValidationHelp = junctionValidationHelp;
	
	console.log('🔧 Junction validation functions available:');
	console.log('  - testJunctionValidation() - Test validation system');
	console.log('  - getJunctionStatus() - Quick junction stats');
	console.log('  - validateJunctions() - Run validation with summary');
	console.log('  - junctionHealthCheck() - Detailed health check');
	console.log('  - junctionValidationHelp() - Show detailed help');
}