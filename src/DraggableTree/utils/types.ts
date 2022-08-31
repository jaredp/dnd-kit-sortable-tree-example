import type {MutableRefObject} from 'react';
import type {UniqueIdentifier} from '@dnd-kit/core';


export type TreePosition<T> =
    { kind: 'after', sibling: T } 
  | { kind: 'firstChildOf', parent: T | null };

export interface FlattenedItem<T> {
  depth: number;
  item: T;
  id: UniqueIdentifier;
  collapsed?: boolean;
}

export type SensorContext<T> = MutableRefObject<{
  items: FlattenedItem<T>[];
  offset: number;
}>;
