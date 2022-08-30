import React from "react";

import { SortableTree } from "./DraggableTree/SortableTree";

function App() {
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
          <SortableTree collapsible indicator removable />
        </div>
    </main>
  );
}

export default App;
