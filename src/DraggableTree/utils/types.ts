import type {MutableRefObject} from 'react';
import type {UniqueIdentifier} from '@dnd-kit/core';

export interface TreeItem {
  id: UniqueIdentifier;
  children: TreeItem[];
  collapsed?: boolean;
}

export type TreePosition =
    { kind: 'after', sibling: TreeItem } 
  | { kind: 'firstChildOf', parent: TreeItem | null };

export interface FlattenedItem {
  depth: number;
  item: TreeItem;
  id: UniqueIdentifier;
  collapsed?: boolean;
}

export type SensorContext = MutableRefObject<{
  items: FlattenedItem[];
  offset: number;
}>;
