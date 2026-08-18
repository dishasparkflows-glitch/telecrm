const { evaluateConditions } = require('../events/eventListeners');

/**
 * Finds the next node in the graph based on the current node's execution result.
 * 
 * @param {object} rule - The AutomationRule containing nodes and edges
 * @param {string} currentNodeId - The ID of the node that just executed
 * @param {string|null} edgeHandle - The handle to follow (e.g. 'true', 'false' for conditions). Null for standard actions.
 * @returns {object|null} - The next node to execute, or null if workflow should exit/end.
 */
const findNextNode = (rule, currentNodeId, edgeHandle = null) => {
    let edgesToFollow = rule.edges.filter(e => e.source === currentNodeId);
    
    if (edgeHandle !== null) {
        // If we are branching (e.g., from a condition node)
        edgesToFollow = edgesToFollow.filter(e => e.sourceHandle === edgeHandle);
    }
    
    // For now, SparkCRM automation supports one edge per handle (single path execution).
    // If we wanted parallel execution, we'd return an array of next nodes.
    if (edgesToFollow.length === 0) {
        return null; // End of workflow or branch
    }
    
    const nextEdge = edgesToFollow[0];
    const nextNode = rule.nodes.find(n => n.id === nextEdge.target);
    
    return nextNode || null;
};

/**
 * Determines the outcome of a node evaluation, specifically for condition nodes.
 * 
 * @param {object} node - The node configuration
 * @param {object} data - The data context (e.g. Lead data)
 * @returns {string|null} - The edge handle to follow ('true' or 'false'), or null for non-branching nodes.
 */
const evaluateNodeBranch = (node, data) => {
    if (node.type === 'condition') {
        const isMet = evaluateConditions(node.conditions, data);
        return isMet ? 'true' : 'false';
    }
    return null;
};

module.exports = {
    findNextNode,
    evaluateNodeBranch
};
