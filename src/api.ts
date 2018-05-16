export type NodeIdentifier = string
export type Action = IrreversibleAction | ReversableAction

export type Metadata = {
  createdBy: string
  createdOn: string
  tags: string[]
  userIntent: string
  [key: string]: any
}

export type Artifacts = {
  [key: string]: any
}

export type StateNode = {
  id: NodeIdentifier
  label: string
  actionResult?: any
  parent: StateEdge | null
  children: StateEdge[]
  artifacts: Artifacts
}

export type StateEdge = {
  previous: StateNode
  next: StateNode
  action: Action
}

export type IrreversibleAction = {
  metadata: Metadata
  do: string
  doArguments: any[] // should be immutable
}

export type ReversableAction = {
  metadata: Metadata
  do: string
  doArguments: any[] // should be immutable
  undo: string
  undoArguments: any[] // should be immutable
}

export type ProvenanceEnabledFunction = (...args: any[]) => Promise<any>

export interface IProvenanceGraph {
  version: string
  addNode(node: StateNode): void
  getStateNode(id: NodeIdentifier): StateNode
}

export interface IProvenanceGraphTracker {
  /**
   *
   * @param name
   * @param func Function that get called with the doArguments or undoArguments
   *
   */
  registerFunction(name: string, func: ProvenanceEnabledFunction): void

  /**
   * Calls the action.do function with action.doArguments
   *
   * @param action
   *
   */
  applyActionToCurrentStateNode(action: Action): Promise<StateNode>

  /**
   * Finds shortest path between current node and node with request identifer.
   * Calls the do/undo functions of actions on the path.
   *
   * @param id
   */
  traverseToStateNode(id: NodeIdentifier): Promise<StateNode>
}
