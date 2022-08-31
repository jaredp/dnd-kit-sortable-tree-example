import type {UniqueIdentifier} from '@dnd-kit/core';
import {arrayMove} from '@dnd-kit/sortable';
import clamp from 'lodash/clamp';
import findLast from 'lodash/findLast'

import type {FlattenedItem, TreePosition} from './types';

export const iOS = /iPad|iPhone|iPod/.test(navigator.platform);

function getDragDepth(offset: number, indentationWidth: number) {
  return Math.round(offset / indentationWidth);
}

export function getProjection<T>(
  items: FlattenedItem<T>[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier,
  dragOffset: number,
  indentationWidth: number
) {
  const overItemIndex = items.findIndex(({id}) => id === overId);
  const activeItemIndex = items.findIndex(({id}) => id === activeId);

  const newItems = arrayMove(items, activeItemIndex, overItemIndex);
  const previousItem = newItems[overItemIndex - 1];
  const nextItem = newItems[overItemIndex + 1];

  const activeItemDepth = items[activeItemIndex]?.depth ?? 0;
  const dragDepth = getDragDepth(dragOffset, indentationWidth);
  const projectedDepth = activeItemDepth + dragDepth;
  
  const maxDepth = getMaxDepth(previousItem);
  const minDepth = getMinDepth(nextItem);
  const depth = clamp(projectedDepth, minDepth, maxDepth);

  const isNoOp = overId === activeId && depth === activeItemDepth;

  // either prevSibling or parent
  const predecessor = overItemIndex === 0 ? undefined : findLast(
    newItems,
    (item) => item.depth <= depth,
    overItemIndex - 1
  );
  const destination: TreePosition<T> =
    predecessor === undefined ? { kind: 'firstChildOf', parent: null }
    : predecessor.depth < depth ? { kind: 'firstChildOf', parent: predecessor.item }
    : { kind: 'after', sibling: predecessor.item };
  
  return { depth, maxDepth, minDepth, isNoOp, destination };
}

function getMaxDepth<T>(previousItem?: FlattenedItem<T>) {
  return previousItem === undefined ? 0 : previousItem.depth + 1;
}

function getMinDepth<T>(nextItem?: FlattenedItem<T>) {
  return nextItem?.depth ?? 0;
}

export function removeChildrenOf<T>(
  items: FlattenedItem<T>[],
  ids: UniqueIdentifier[]
) {
  const excludeParentIds = new Set(ids);

  const filtered = [];

  let skip_until_depth = null;
  for (const item of items) {
    if (skip_until_depth === null || item.depth <= skip_until_depth) {
      filtered.push(item);
      skip_until_depth = excludeParentIds.has(item.id) ? item.depth : null;
    }
  }

  return filtered;
}
