import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {
  Announcements,
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverlay,
  DragMoveEvent,
  DragEndEvent,
  DragOverEvent,
  MeasuringStrategy,
  DropAnimation,
  Modifier,
  defaultDropAnimation,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import {
  flattenTree,
  getProjection,
  removeChildrenOf,
} from './utils/utilities';
import type {SensorContext, TreeItem, TreePosition} from './utils/types';
import {sortableTreeKeyboardCoordinates} from './utils/keyboardCoordinates';
import {SortableTreeItem} from './TreeItem/TreeItem';
import {CSS} from '@dnd-kit/utilities';
import isEqual from 'lodash/isEqual';

const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

const dropAnimationConfig: DropAnimation = {
  keyframes({transform}) {
    return [
      {opacity: 1, transform: CSS.Transform.toString(transform.initial)},
      {
        opacity: 0,
        transform: CSS.Transform.toString({
          ...transform.final,
          x: transform.final.x + 5,
          y: transform.final.y + 5,
        }),
      },
    ];
  },
  easing: 'ease-out',
  sideEffects({active}) {
    active.node.animate([{opacity: 0}, {opacity: 1}], {
      duration: defaultDropAnimation.duration,
      easing: defaultDropAnimation.easing,
    });
  },
};

interface Props {
  collapsible?: boolean;
  indentationWidth?: number;
  indicator?: boolean;
  removable?: boolean;
  items: TreeItem[],
  getLabelStringForItem: (item: TreeItem) => string;
  getLabelForItem: (item: TreeItem) => React.ReactNode;
  getSubtreeSize: (item: TreeItem) => number | undefined;
  handleRemove: (id: UniqueIdentifier) => void;
  handleCollapse: (id: UniqueIdentifier) => void;
  handleMove: (activeItem: TreeItem, destination: TreePosition) => void;
}

export function SortableTree({
  collapsible,
  indicator = false,
  indentationWidth = 50,
  removable,
  items,
  getLabelStringForItem,
  getLabelForItem,
  getSubtreeSize,
  handleRemove,
  handleCollapse,
  handleMove,
}: Props) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [currentPosition, setCurrentPosition] = useState<{
    overId: UniqueIdentifier;
    depth: number;
  } | null>(null);

  const flattenedItems = useMemo(() => {
    const flattenedTree = flattenTree(items);
    const collapsedItems = flattenedTree
      .filter(e => e.collapsed && e.children.length > 0)
      .map(e => e.id);

    return removeChildrenOf(
      flattenedTree,
      activeId ? [activeId, ...collapsedItems] : collapsedItems
    );
  }, [activeId, items]);

  const projected =
    activeId && overId
      ? getProjection(
          flattenedItems,
          activeId,
          overId,
          offsetLeft,
          indentationWidth
        )
      : null;
  const sensorContext: SensorContext = useRef({
    items: flattenedItems,
    offset: offsetLeft,
  });
  const [coordinateGetter] = useState(() =>
    sortableTreeKeyboardCoordinates(sensorContext, indicator, indentationWidth)
  );
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter,
    })
  );

  const sortedIds = useMemo(
    () => flattenedItems.map(({id}) => id),
    [flattenedItems],
  );
  const activeItem = activeId
    ? flattenedItems.find(({id}) => id === activeId)
    : null;

  useEffect(() => {
    sensorContext.current = {
      items: flattenedItems,
      offset: offsetLeft,
    };
  }, [flattenedItems, offsetLeft]);

  const announcements: Announcements = {
    onDragStart({active}) {
      const activeItem = flattenedItems.find(({id}) => id === active.id);
      if (!activeItem) return;
      return `Picked up ${getLabelStringForItem(activeItem.item)}.`;
    },
    onDragMove({active, over}) {
      return getMovementAnnouncement('onDragMove', active.id, over?.id);
    },
    onDragOver({active, over}) {
      return getMovementAnnouncement('onDragOver', active.id, over?.id);
    },
    onDragEnd({active, over}) {
      return getMovementAnnouncement('onDragEnd', active.id, over?.id);
    },
    onDragCancel({active}) {
      const activeItem = flattenedItems.find(({id}) => id === active.id);
      if (!activeItem) return;
      return `Moving was cancelled. ${getLabelStringForItem(activeItem.item)} was dropped in its original position.`;
    },
  };

  return (
    <DndContext
      accessibility={{announcements}}
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={measuring}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
        {flattenedItems.map(({id, item, children, collapsed, depth}) => (
          <SortableTreeItem
            key={id}
            id={id}
            label={getLabelForItem(item)}
            depth={id === activeId && projected ? projected.depth : depth}
            indentationWidth={indentationWidth}
            indicator={indicator}
            collapsed={Boolean(collapsed && children.length)}
            onCollapse={
              collapsible && children.length
                ? () => handleCollapse(id)
                : undefined
            }
            onRemove={removable ? () => handleRemove(id) : undefined}
          />
        ))}
        {createPortal(
          <DragOverlay
            dropAnimation={dropAnimationConfig}
            modifiers={indicator ? [adjustTranslate] : undefined}
          >
            {activeId && activeItem ? (
              <SortableTreeItem
                id={activeId}
                depth={activeItem.depth}
                clone
                childCount={getSubtreeSize(activeItem.item)}
                label={activeId.toString()}
                indentationWidth={indentationWidth}
              />
            ) : null}
          </DragOverlay>,
          document.body
        )}
      </SortableContext>
    </DndContext>
  );

  function handleDragStart({active: {id: activeId}}: DragStartEvent) {
    setActiveId(activeId);
    setOverId(activeId);

    const activeItem = flattenedItems.find(({id}) => id === activeId);

    if (activeItem) {
      setCurrentPosition({
        depth: activeItem.depth,
        overId: activeId,
      });
    }

    document.body.style.setProperty('cursor', 'grabbing');
  }

  function handleDragMove({delta}: DragMoveEvent) {
    setOffsetLeft(delta.x);
  }

  function handleDragOver({over}: DragOverEvent) {
    setOverId(over?.id ?? null);
  }

  function handleDragEnd({active, over}: DragEndEvent) {
    resetState();

    if (!projected) return;
    if (projected.isNoOp) return;

    const activeItem = flattenedItems.find(({id}) => id === active.id);
    if (!activeItem) return;

    handleMove(activeItem, projected.destination);
  }

  function handleDragCancel() {
    resetState();
  }

  function resetState() {
    setOverId(null);
    setActiveId(null);
    setOffsetLeft(0);
    setCurrentPosition(null);

    document.body.style.setProperty('cursor', '');
  }

  function getMovementAnnouncement(
    eventName: 'onDragEnd' | 'onDragMove' | 'onDragOver',
    activeId: UniqueIdentifier,
    overId?: UniqueIdentifier
  ) {
    if (!overId || !projected) {
      return;
    }

    if (eventName !== 'onDragEnd') {
      const memoizeKey = {
        depth: projected.depth,
        overId
      };
      if (isEqual(currentPosition, memoizeKey)) {
        return;
      }
      setCurrentPosition(memoizeKey);
    }

    const activeItem = flattenedItems.find(({id}) => id === activeId);
    if (!activeItem) return;
    const activeItemName = getLabelStringForItem(activeItem.item);

    const { destination } = projected;
    const movedVerb = eventName === 'onDragEnd' ? 'dropped' : 'moved';
    const nestedVerb = eventName === 'onDragEnd' ? 'dropped' : 'nested';

    if (destination.kind === 'after') {
      const { sibling } = destination;
      const previousSibling = flattenedItems.find(({id}) => id === sibling.id);
      if (!previousSibling) return;
      const previousSiblingName = getLabelStringForItem(previousSibling.item);
      return `${activeItemName} was ${movedVerb} after ${previousSiblingName}.`;

    } else if (destination.kind === 'firstChildOf') {
      const { parent } = destination;

      if (parent === null) {
        const firstItem = flattenedItems[0];
        if (!firstItem) return;
        const nextItemName = getLabelStringForItem(firstItem.item);
        return `${activeItemName} was ${movedVerb} before ${nextItemName}.`;
      }

      const parentItem = flattenedItems.find(({id}) => id === parent.id);
      if (!parentItem) return;
      const previousItemName = getLabelStringForItem(parentItem.item);
      return `${activeItemName} was ${nestedVerb} under ${previousItemName}.`;

    } else {
      // assert destination.kind must be one of the above with types
      ((x: never) => {})(destination);
      throw new Error("destination.kind must be one of the above");
    }
  }
}

const adjustTranslate: Modifier = ({transform}) => {
  return {
    ...transform,
    y: transform.y - 25,
  };
};
