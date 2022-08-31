import { UniqueIdentifier } from "@dnd-kit/core";
import React from "react";

import { SortableTree } from "./DraggableTree/SortableTree";
import { TreeItem, TreeItems, TreePosition } from "./DraggableTree/utils/types";


const initialItems: TreeItems = [
  {
    id: 'Home',
    children: [],
  },
  {
    id: 'Collections',
    children: [
      {id: 'Spring', children: []},
      {id: 'Summer', children: []},
      {id: 'Fall', children: []},
      {id: 'Winter', children: []},
    ],
  },
  {
    id: 'About Us',
    children: [],
  },
  {
    id: 'My Account',
    children: [
      {id: 'Addresses', children: []},
      {id: 'Order History', children: []},
    ],
  },
];


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
      return node?.collapsed ? [...children, addend] : [addend, ...children];
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

function App() {
  const [items, setItems] = React.useState(() => initialItems);

  return (
    <main style={{
      position: 'relative',
      minHeight: '100vh',
      outline: 'none'
    }}>
        <div style={{
          maxWidth: 600,
          padding: 10,
          margin: '10% auto 0px',
        }}>
          <SortableTree 
            collapsible indicator removable
            items={items}
            handleRemove={id => setItems(items => removeItem(items, id))}
            handleCollapse={id => setItems(items => setProperty(items, id, 'collapsed', c => !c))}
            handleMove={(activeItem, destination) => {
              setItems(items => insertSubtreeAt(
                removeItem(items, activeItem.id),
                activeItem,
                destination
              ));
            }}
          />
        </div>
    </main>
  );
}

export default App;
