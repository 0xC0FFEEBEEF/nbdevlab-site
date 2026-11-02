import {
  cloneBuilderDocument,
  createBuilderId,
  type BuilderDocument,
  type BuilderNode,
} from '../../../shared/builder'

export interface BuilderNodeLocation {
  node: BuilderNode
  parentId: string | null
  index: number
  path: string[]
}

export function findBuilderNode(
  root: BuilderNode,
  nodeId: string,
  parentId: string | null = null,
  path: string[] = [],
): BuilderNodeLocation | null {
  if (root.id === nodeId) {
    return {
      node: root,
      parentId,
      index: path.length === 0 ? 0 : Number(path[path.length - 1] ?? 0),
      path,
    }
  }

  const children = root.children ?? []
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]
    const located = findBuilderNode(child, nodeId, root.id, [...path, String(index)])
    if (located) {
      return located
    }
  }

  return null
}

function updateNodeTree(
  node: BuilderNode,
  nodeId: string,
  updater: (node: BuilderNode) => BuilderNode,
): BuilderNode {
  if (node.id === nodeId) {
    return updater(node)
  }

  if (!node.children?.length) {
    return node
  }

  return {
    ...node,
    children: node.children.map((child) => updateNodeTree(child, nodeId, updater)),
  }
}

function updateChildrenOfNode(
  node: BuilderNode,
  parentId: string,
  updater: (children: BuilderNode[]) => BuilderNode[],
): BuilderNode {
  if (node.id === parentId) {
    return {
      ...node,
      children: updater(node.children ?? []),
    }
  }

  if (!node.children?.length) {
    return node
  }

  return {
    ...node,
    children: node.children.map((child) => updateChildrenOfNode(child, parentId, updater)),
  }
}

function cloneNodeWithFreshIds(node: BuilderNode): BuilderNode {
  const prefix = node.type.split('/')[0] || 'builder'
  return {
    ...node,
    id: createBuilderId(prefix),
    children: node.children?.map(cloneNodeWithFreshIds),
  }
}

export function updateBuilderDocumentNode(
  document: BuilderDocument,
  nodeId: string,
  updater: (node: BuilderNode) => BuilderNode,
): BuilderDocument {
  const nextDocument = cloneBuilderDocument(document)
  nextDocument.root = updateNodeTree(nextDocument.root, nodeId, updater)
  nextDocument.updatedAt = new Date().toISOString()
  nextDocument.source = 'admin'
  return nextDocument
}

export function addBuilderChildNode(
  document: BuilderDocument,
  parentId: string,
  node: BuilderNode,
  index?: number,
): BuilderDocument {
  const nextDocument = cloneBuilderDocument(document)
  nextDocument.root = updateChildrenOfNode(nextDocument.root, parentId, (children) => {
    const nextChildren = [...children]
    const insertionIndex =
      typeof index === 'number' ? Math.max(0, Math.min(nextChildren.length, index)) : nextChildren.length
    nextChildren.splice(insertionIndex, 0, node)
    return nextChildren
  })
  nextDocument.updatedAt = new Date().toISOString()
  nextDocument.source = 'admin'
  return nextDocument
}

export function removeBuilderNode(document: BuilderDocument, nodeId: string): BuilderDocument {
  if (document.root.id === nodeId) {
    return document
  }

  const nextDocument = cloneBuilderDocument(document)
  const location = findBuilderNode(nextDocument.root, nodeId)
  if (!location?.parentId) {
    return document
  }

  nextDocument.root = updateChildrenOfNode(nextDocument.root, location.parentId, (children) =>
    children.filter((child) => child.id !== nodeId),
  )
  nextDocument.updatedAt = new Date().toISOString()
  nextDocument.source = 'admin'
  return nextDocument
}

export function duplicateBuilderNode(document: BuilderDocument, nodeId: string): BuilderDocument {
  const nextDocument = cloneBuilderDocument(document)
  const location = findBuilderNode(nextDocument.root, nodeId)
  if (!location?.parentId) {
    return document
  }

  const duplicated = cloneNodeWithFreshIds(location.node)
  nextDocument.root = updateChildrenOfNode(nextDocument.root, location.parentId, (children) => {
    const nextChildren = [...children]
    nextChildren.splice(location.index + 1, 0, duplicated)
    return nextChildren
  })
  nextDocument.updatedAt = new Date().toISOString()
  nextDocument.source = 'admin'
  return nextDocument
}

export function moveBuilderNode(
  document: BuilderDocument,
  nodeId: string,
  direction: -1 | 1,
): BuilderDocument {
  const nextDocument = cloneBuilderDocument(document)
  const location = findBuilderNode(nextDocument.root, nodeId)
  if (!location?.parentId) {
    return document
  }

  nextDocument.root = updateChildrenOfNode(nextDocument.root, location.parentId, (children) => {
    const fromIndex = children.findIndex((child) => child.id === nodeId)
    const toIndex = fromIndex + direction

    if (fromIndex < 0 || toIndex < 0 || toIndex >= children.length) {
      return children
    }

    const nextChildren = [...children]
    const [item] = nextChildren.splice(fromIndex, 1)
    nextChildren.splice(toIndex, 0, item)
    return nextChildren
  })
  nextDocument.updatedAt = new Date().toISOString()
  nextDocument.source = 'admin'
  return nextDocument
}

export function reorderBuilderSiblings(
  document: BuilderDocument,
  parentId: string,
  activeId: string,
  overId: string,
): BuilderDocument {
  if (activeId === overId) {
    return document
  }

  const nextDocument = cloneBuilderDocument(document)
  nextDocument.root = updateChildrenOfNode(nextDocument.root, parentId, (children) => {
    const fromIndex = children.findIndex((child) => child.id === activeId)
    const toIndex = children.findIndex((child) => child.id === overId)

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return children
    }

    const nextChildren = [...children]
    const [item] = nextChildren.splice(fromIndex, 1)
    nextChildren.splice(toIndex, 0, item)
    return nextChildren
  })
  nextDocument.updatedAt = new Date().toISOString()
  nextDocument.source = 'admin'
  return nextDocument
}
