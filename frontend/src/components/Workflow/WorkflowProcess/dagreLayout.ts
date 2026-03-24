import dagre from 'dagre';
import type { Edge, Node } from '@xyflow/react';

const SNAP_GRID = 15;

/** Approximate rendered size of each workflow node type (matches CustomNode.tsx). */
function getNodeDimensions(node: Node): { width: number; height: number } {
    const type = node.type;
    if (type === 'timer' || type === 'hook') {
        return { width: 40, height: 40 };
    }
    if (type === 'parallel' || type === 'exclusive') {
        return { width: 40, height: 40 };
    }
    return { width: 100, height: 34 };
}

function snapToGrid(value: number): number {
    return Math.round(value / SNAP_GRID) * SNAP_GRID;
}

/**
 * Computes top-to-bottom (DAG) layout positions using dagre.
 * Returns new node objects with updated `position` only.
 */
export function getLayoutedNodes(nodes: Node[], edges: Edge[]): Node[] {
    if (nodes.length === 0) {
        return nodes;
    }

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
        rankdir: 'TB',
        nodesep: 55,
        ranksep: 90,
        marginx: 24,
        marginy: 24,
    });

    nodes.forEach((node) => {
        const { width, height } = getNodeDimensions(node);
        g.setNode(node.id, { width, height });
    });

    edges.forEach((edge) => {
        if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
            g.setEdge(edge.source, edge.target);
        }
    });

    dagre.layout(g);

    return nodes.map((node) => {
        const pos = g.node(node.id);
        if (!pos) {
            return node;
        }
        const { width, height } = getNodeDimensions(node);
        return {
            ...node,
            position: {
                x: snapToGrid(pos.x - width / 2),
                y: snapToGrid(pos.y - height / 2),
            },
        };
    });
}
