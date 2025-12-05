import { CanvasNodeData } from 'obsidian/canvas';
import { SortData } from '../types';

/**
 * Calculate sort data (distance and quadrant) for canvas nodes relative to center
 */
export function getSortData(nodes: CanvasNodeData[], centerNode: CanvasNodeData): Record<string, SortData> {
	let sortData: Record<string, SortData> = {};

	let maxLength = 0;
	nodes.forEach(node => {
		const deltaX = (node.x + node.width / 2) - (centerNode.x + centerNode.width / 2);
		const deltaY = (node.y + node.height / 2) - (centerNode.y + centerNode.height / 2);
		sortData[node.id] = { 
			length: Math.hypot(deltaX, deltaY), 
			quadrant: getQuadrant(deltaX, deltaY) 
		};

		if (sortData[node.id].length > maxLength) {
			maxLength = sortData[node.id].length;
		}
	});

	// Normalize lengths to be 0 - 1 with 3 decimal places
	nodes.forEach(node => {
		sortData[node.id].length = Math.round(sortData[node.id].length * 1000 / maxLength) / 1000;
	});

	return sortData;
}

/**
 * Determine which quadrant a point belongs to
 * Quadrant mapping: 
 * -- (top-left) = 1
 * +- (top-right) = 2
 * -+ (bottom-left) = 3
 * ++ (bottom-right) = 4
 */
export function getQuadrant(x: number, y: number): number {
	const quadrantMap: Record<string, number> = {
		"--": 1,
		"+-": 2,
		"-+": 3,
		"++": 4,
	};

	const key = `${x >= 0 ? "+" : "-"}${y >= 0 ? "+" : "-"}`;
	return quadrantMap[key];
}
