import type {UniqueIdentifier} from '@dnd-kit/core';
import {arrayMove} from '@dnd-kit/sortable';
import sumBy from 'lodash/sumBy';
import clamp from 'lodash/clamp';
import findLast from 'lodash/findLast'

import type {FlattenedItem, TreeItem, TreeItems, TreePosition} from './types';

export const iOS = /iPad|iPhone|iPod/.test(navigator.platform);

function getDragDepth(offset: number, indentationWidth: number) {
  return Math.round(offset / indentationWidth);
}

export function getProjection(
  items: FlattenedItem[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier,
  dragOffset: number,
  indentationWidth: number
) {
  const overItemIndex = items.findIndex(({id}) => id === overId);
  const activeItemIndex = items.findIndex(({id}) => id === activeId);

  const activeItem = items[activeItemIndex];

  const newItems = arrayMove(items, activeItemIndex, overItemIndex);
  const previousItem = newItems[overItemIndex - 1];
  const nextItem = newItems[overItemIndex + 1];

  const dragDepth = getDragDepth(dragOffset, indentationWidth);
  const projectedDepth = (activeItem?.depth ?? 0) + dragDepth;
  
  const maxDepth = getMaxDepth(previousItem);
  const minDepth = getMinDepth(nextItem);
  const depth = clamp(projectedDepth, minDepth, maxDepth);

  // either prevSibling or parent
  const predecessor = overItemIndex === 0 ? undefined : findLast(
    newItems,
    (item) => item.depth <= depth,
    overItemIndex - 1
  );
  const destination: TreePosition =
    predecessor === undefined ? { kind: 'firstChildOf', parent: null }
    : predecessor.depth < depth ? { kind: 'firstChildOf', parent: predecessor }
    : { kind: 'after', sibling: predecessor };
  
  const parentId = (() => {
    if (depth === 0 || !previousItem) {
      return null;
    }

    if (depth === previousItem.depth) {
      return previousItem.parentId;
    }

    if (depth > previousItem.depth) {
      return previousItem.id;
    }

    const newParent = newItems
      .slice(0, overItemIndex)
      .reverse()
      .find((item) => item.depth === depth)?.parentId;

    return newParent ?? null;
  })();

  return { depth, maxDepth, minDepth, destination, parentId };
}

function getMaxDepth(previousItem?: FlattenedItem) {
  return previousItem === undefined ? 0 : previousItem.depth + 1;
}

function getMinDepth(nextItem?: FlattenedItem) {
  return nextItem?.depth ?? 0;
}

function flatten(
  items: TreeItems,
  parentId: UniqueIdentifier | null = null,
  depth = 0
): FlattenedItem[] {
  return items.reduce<FlattenedItem[]>((acc, item, index) => {
    return [
      ...acc,
      {...item, parentId, depth, index},
      ...flatten(item.children, item.id, depth + 1),
    ];
  }, []);
}

export function flattenTree(items: TreeItems): FlattenedItem[] {
  return flatten(items);
}

export function findItemDeep(
  items: TreeItems,
  itemId: UniqueIdentifier
): TreeItem | undefined {
  for (const item of items) {
    const {id, children} = item;

    if (id === itemId) {
      return item;
    }

    if (children.length) {
      const child = findItemDeep(children, itemId);

      if (child) {
        return child;
      }
    }
  }

  return undefined;
}

// This is gross for a few reasons, not the least of which:
// 1. having no mechanism to short-circuit if the edit has finished with the subtree it cares about
// 2. makes a full copy of subtrees that had/needed no edits
// 3. is recursive instead of using an explicit stack, so it can stackoverflow
// 4. preorder traversal instead of postorder traversal, for no particular reason
export function mapForest(
  forest: TreeItem[],
  fn: (node: TreeItem[], parent: TreeItem | null) => TreeItem[],
  parent: TreeItem | null = null
): TreeItem[] {
  return fn(forest, parent).flatMap(tree => ({
    ...tree, children: mapForest(tree.children, fn, tree)
  }));
}

export function removeItem(root: TreeItems, id: UniqueIdentifier): TreeItems {
  return mapForest(root, forest => forest.filter(t => t.id !== id));
}

export function mapForestByTree(
  forest: TreeItem[],
  fn: (node: TreeItem) => TreeItem
): TreeItem[] {
  return mapForest(forest, child => child.map(fn));
}

export function setProperty<T extends keyof TreeItem>(
  items: TreeItem[],
  id: UniqueIdentifier,
  property: T,
  fn: (value: TreeItem[T]) => TreeItem[T]
): TreeItem[] {
  return mapForestByTree(items, node => 
    node.id === id ? {...node, [property]: fn(node[property]) } 
    : node
  );
}

export function forestWithSubtreeInsertedAfter(
  root: TreeItem[],
  addend: TreeItem,
  sibling: TreeItem
): TreeItem[] {
  return mapForest(root, children => {
    const sibIndex = children.findIndex(({id}) => id === sibling.id);
    if (sibIndex === -1) {
      // not in this subtree, act as identity function
      return children;
    }

    const newChildren = children.slice();
    newChildren.splice(sibIndex + 1, 0, addend);
    return newChildren;
  });
}

export function forestWithSubtreeInsertedFirstInside(
  forest: TreeItem[],
  addend: TreeItem,
  parent: TreeItem | null
): TreeItem[] {
  return mapForest(forest, (children, node) => {
    if (node?.id === parent?.id) {
      return [addend, ...children];
    }
    return children;
  });
}


export function insertSubtreeAt(forest: TreeItem[], addend: TreeItem, destination: TreePosition): TreeItem[] {
  if (destination.kind === 'after') {
    return forestWithSubtreeInsertedAfter(forest, addend, destination.sibling);

  } else if (destination.kind === 'firstChildOf') {
    return forestWithSubtreeInsertedFirstInside(forest, addend, destination.parent);

  } else {
    // assert destination.kind must be one of the above with types
    ((x: never) => {})(destination);
    throw new Error("destination.kind must be one of the above");
  }
}

function getSubtreeNodeCount(item: TreeItem): number {
  return sumBy(item.children, c => getSubtreeNodeCount(c)) + 1;
}

export function getSubtreeNodeCountById(items: TreeItems, id: UniqueIdentifier) {
  const item = findItemDeep(items, id);
  return item ? getSubtreeNodeCount(item) : 0;
}

export function removeChildrenOf(
  items: FlattenedItem[],
  ids: UniqueIdentifier[]
) {
  const excludeParentIds = [...ids];

  return items.filter((item) => {
    if (item.parentId && excludeParentIds.includes(item.parentId)) {
      if (item.children.length) {
        excludeParentIds.push(item.id);
      }
      return false;
    }

    return true;
  });
}
