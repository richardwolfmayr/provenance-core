import {
  IProvenanceGraphTraverser,
  StateNode,
  IActionFunctionRegistry,
  IProvenanceGraph,
  NodeIdentifier,
  ProvenanceEnabledFunction
} from './api';
import { isReversibleAction } from './utils';

function isNextNodeInTrackUp(
  currentNode: StateNode,
  nextNode: StateNode
): boolean {
  if (currentNode.parent && currentNode.parent.previous === nextNode) {
    return true;
  } else if (nextNode.parent && nextNode.parent.previous !== currentNode) {
    // This is a guard against the illegitimate use of this function for unconnected nodes
    throw new Error(
      'Unconnected nodes, you probably should not be using this function'
    );
  } else {
    return false;
  }
}

function findPathToTargetNode(
  currentNode: StateNode,
  targetNode: StateNode,
  track: StateNode[]
): boolean {
  if (currentNode === null) {
    return false;
  } else if (currentNode === targetNode) {
    track.push(currentNode);
    return true;
  } else {
    // Map the StateNodes in the children StateEdges
    const nodesToCheck = currentNode.children.map(child => child.next);
    // Add the parent node to that same list
    if (currentNode.parent !== null) {
      nodesToCheck.push(currentNode.parent.previous);
    }

    for (let node of nodesToCheck) {
      // If the node to check is in the track already, skip it.
      if (
        track.length > 0 &&
        track[track.length - 1] !== node &&
        findPathToTargetNode(node, targetNode, track)
      ) {
        track.push(currentNode);
        return true;
      }
    }
    return false;
  }
}

async function executeFunctions(
  functionsToDo: ProvenanceEnabledFunction[],
  argumentsToDo: any[]
): Promise<StateNode> {
  let result;
  for (let i = 0; i < functionsToDo.length; i++) {
    result = await functionsToDo[i].apply(null, argumentsToDo[i]);
  }
  return result;
}

export class ProvenanceGraphTraverser implements IProvenanceGraphTraverser {
  private functionRegistry: IActionFunctionRegistry;
  private graph: IProvenanceGraph;

  constructor(
    functionRegistry: IActionFunctionRegistry,
    graph: IProvenanceGraph
  ) {
    this.functionRegistry = functionRegistry;
    this.graph = graph;
  }

  /**
     * Finds shortest path between current node and node with request identifer.
     * Calls the do/undo functions of actions on the path.
     *
     * @param id
     */
  toStateNode(id: NodeIdentifier): Promise<StateNode> {
    const currentNode = this.graph.current;
    const targetNode = this.graph.getStateNode(id);

    const trackToTarget: StateNode[] = [];

    const success = findPathToTargetNode(
      currentNode,
      targetNode,
      trackToTarget
    );

    if (!success) {
      throw new Error('No path to target node found in graph');
    }

    const functionsToDo: ProvenanceEnabledFunction[] = [];
    const argumentsToDo: any[] = [];

    for (let i = 0; i < trackToTarget.length - 1; i++) {
      const thisNode = trackToTarget[i];
      const nextNode = trackToTarget[i + 1];
      const up = isNextNodeInTrackUp(thisNode, nextNode);

      if (up) {
        if (!thisNode.parent) {
          throw new Error('Going up from root? unreachable error ... i hope');
        }
        if (!isReversibleAction(thisNode.parent.action)) {
          throw new Error('trying to undo an Irreversible action');
        }
        const undoFunc = this.functionRegistry.getFunctionByName(
          thisNode.parent.action.undo
        );
        functionsToDo.push(undoFunc);
        argumentsToDo.push(thisNode.parent.action.undoArguments);
      } else {
        if (!nextNode.parent) {
          throw new Error(
            'Going down to the root? unreachable error ... i hope'
          );
        }
        const doFunc = this.functionRegistry.getFunctionByName(
          nextNode.parent.action.do
        );
        functionsToDo.push(doFunc);
        argumentsToDo.push(nextNode.parent.action.doArguments);
      }
    }

    return executeFunctions(functionsToDo, argumentsToDo);
  }
}