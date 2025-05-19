import React, { useEffect, useState, useCallback, useRef } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import type { ElementDefinition, NodeSingular, NodeCollection, Stylesheet } from 'cytoscape';
// @ts-ignore
import coseBilkent from 'cytoscape-cose-bilkent'; // If you use this layout
import { loadIndexGraph, loadChildGraph, type SkillNode } from './helpers/node';
import { SearchPanel } from './components/SearchPanel.tsx'; // Import the new component
import './App.css'; // Import the CSS file

// Define FoundNode here or in a separate types.ts file and import it in both App.tsx and SearchPanel.tsx
interface FoundNode {
  id: string;
  label: string;
  node: NodeSingular;
}

// Default Cytoscape styles (this is for Cytoscape elements, not HTML)
const defaultCytoscapeStyles: Stylesheet[] = [
  { selector: 'node', style: { label: 'data(label)', 'background-color': '#6FB1FC', 'width': 'mapData(id.length, 4, 2, 20, 50)', 'height': 'mapData(id.length, 4, 2, 20, 50)', 'font-size': 'mapData(id.length, 4, 2, 8, 16)'} },
  { selector: 'edge', style: { 'target-arrow-shape': 'triangle', 'target-arrow-color': '#ccc', 'line-color': '#ccc', 'width': 1 } },
  { selector: 'node:selected', style: { 'background-color': 'orange', 'border-width': 3, 'border-color': 'black', 'z-index': 99 } },
  { selector: '.highlighted', style: { 'background-color': 'yellow', 'border-color': '#ffc107', 'border-width': 2, 'z-index': 98 } }
];


export const App: React.FC = () => {
  const [elements, setElements] = useState<ElementDefinition[]>([]);
  const [stylesheet, setStylesheet] = useState<Stylesheet[]>([]);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const animationTimeoutRef = useRef<number | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<FoundNode[]>([]);

  cytoscape.use(coseBilkent); // Make sure to register layout extensions

  useEffect(() => {
    loadIndexGraph().then(({ nodes, edges }) => {
      setElements(CytoscapeComponent.normalizeElements([...nodes, ...edges]));
    });
    fetch('/data/cy-style.json') // Your custom stylesheet
      .then(res => res.json())
      .then(styleJson => setStylesheet(styleJson))
      .catch(() => setStylesheet(defaultCytoscapeStyles)); // Fallback to default
  }, []);


  const clearAnimations = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.stop(true, true);
    }
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  }, []);

  const focusNode = useCallback((targetNode: NodeSingular | NodeCollection, cyInstance: cytoscape.Core, padding = 600) => {
    clearAnimations();
    animationTimeoutRef.current = window.setTimeout(() => {
        if (cyInstance && !cyInstance.destroyed() && targetNode.length > 0 && !targetNode.removed()) {
            cyInstance.animate({
                fit: { eles: targetNode, padding: padding },
                duration: 500,
                easing: 'ease-out-quad'
            });
        }
    }, 0);
  }, [clearAnimations]);

  const handleNodeClick = useCallback(async (event: cytoscape.EventObject) => {
    if (!cyRef.current) return; // Assuming cyRef is your Cytoscape instance reference
    const cy = cyRef.current;
    const node = event.target as NodeSingular;
    const nodeId = node.data('id') as string; // Get node ID
    const isExpanded = node.data('expanded') as boolean | undefined; // Get expanded status
    const parentNode = node.incomers().nodes()[0];
    const parentNodePos = parentNode ? parentNode.position() : { x: 0, y: 0 };

    // Assuming clearAnimations and focusNode are defined elsewhere in your App.tsx
    clearAnimations(); // Example: helper function to stop ongoing animations
    cy.nodes().deselect().removeClass('highlighted'); // Example: clear previous selections
    node.select().addClass('highlighted'); // Example: highlight current node

    // New logic: Check if the node ID is 4 characters long and the node is not already expanded
    if (nodeId && nodeId.length === 4 && !isExpanded) {
      try {
        // Call loadChildGraph with the parentId (nodeId) and the constructed childFileName
        // The loadChildGraph function provided in your prompt expects these two arguments.
        const childElements = await loadChildGraph(nodeId, node.position(), parentNodePos);

        node.data('expanded', true); // Mark the node as expanded in its data store

        // Assuming setElements is your state setter for graph elements
        setElements(prevElements => {
          // Filter out duplicate nodes and edges before adding
          const existingNodeIds = new Set(prevElements.filter(el => el.group === 'nodes').map(el => el.data.id));
          const existingEdgeIds = new Set(prevElements.filter(el => el.group === 'edges').map(el => el.data.id));

          const newNodes = childElements.nodes.filter(n => !existingNodeIds.has(n.data.id));
          const newEdges = childElements.edges.filter(e => e.data.id && !existingEdgeIds.has(e.data.id)); // Ensure new edges have an ID for filtering

          // It's good practice to use CytoscapeComponent.normalizeElements or ensure elements are in the correct format
          return CytoscapeComponent.normalizeElements([
            ...prevElements,
            ...newNodes,
            ...newEdges
          ]);
        });

        focusNode(node, cy); // Focus on the parent node after loading children
      } catch (error) {
        console.error(`Failed to load child graph for node ${nodeId} using file ${childFileName}:`, error);
        // Optional: handle the error, e.g., by showing a notification to the user
        // or resetting node.data('expanded') to false if you want to allow retrying.
        // node.data('expanded', false);
      }
    } else {
      // If the node ID is not 4 characters long, or if it's already expanded,
      // or if any other condition isn't met, just focus the node.
      focusNode(node, cy);
    }
    // Add dependencies for useCallback. These would include any external functions or state setters used.
    // e.g., [clearAnimations, focusNode, setElements]
  }, [clearAnimations, focusNode, setElements]);

  const handleFitGraph = useCallback(() => {
    if (cyRef.current) {
      clearAnimations();
      cyRef.current.nodes().deselect().removeClass('highlighted');
      focusNode(cyRef.current.elements(), cyRef.current, 50);
      // setSearchResults([]);
    }
  }, [clearAnimations, focusNode]);

  const performSearch = useCallback(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    clearAnimations();

    if (searchTerm) {
      const foundNodesCollection = cy.nodes().filter((n: NodeSingular) => {
        const label = n.data('label') as string | undefined;
        return label && label.toLowerCase().includes(searchTerm.toLowerCase());
      });

      cy.nodes().deselect().removeClass('highlighted');

      if (foundNodesCollection.length > 0) {
        const newSearchResults: FoundNode[] = foundNodesCollection.map((theNode: NodeSingular) => {
            const labelValue = theNode.data('id') + ' - ' + theNode.data('label');
            return {
              id: theNode.id(),
              label: typeof labelValue === 'string' ? labelValue : String(labelValue || ''),
              node: theNode
            };
          });
        setSearchResults(newSearchResults);
        foundNodesCollection.addClass('highlighted');
        focusNode(foundNodesCollection, cy, 100);
      } else {
        setSearchResults([]);
        // Consider using a more user-friendly notification than alert
        // For example, a small message inline with the search panel
        console.warn('Node not found via search.');
      }
    } else {
      setSearchResults([]);
      cy.nodes().removeClass('highlighted');
    }
  }, [searchTerm, clearAnimations, focusNode]);

  const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    if (!event.target.value) {
        setSearchResults([]);
        if (cyRef.current) {
            clearAnimations();
            cyRef.current.nodes().removeClass('highlighted');
        }
    }
  };

  const handleSearchKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      performSearch();
    }
  };

  const handleSearchResultClick = useCallback((foundNode: FoundNode) => {
    if (cyRef.current && !foundNode.node.removed()) {
      clearAnimations();
      cyRef.current.nodes().deselect().removeClass('highlighted');
      foundNode.node.select().addClass('highlighted');
      focusNode(foundNode.node, cyRef.current);
      // Optionally, keep search results or clear them:
      // setSearchResults([]);
    }
  }, [clearAnimations, focusNode]);

  useEffect(() => {
    return () => { // Cleanup on unmount
      clearAnimations();
    };
  }, [clearAnimations]);

  return (
    <div className="app-container">
      <SearchPanel
        searchTerm={searchTerm}
        onSearchTermChange={handleSearchInputChange}
        onSearchKeyPress={handleSearchKeyPress}
        onPerformSearch={performSearch}
        onFitGraph={handleFitGraph}
        searchResults={searchResults}
        onSearchResultClick={handleSearchResultClick}
      />
      <CytoscapeComponent
        elements={elements} // elements should be already normalized if using setElements correctly
        className="cytoscape-container" // Use className for the wrapper div
        // The `style` prop for CytoscapeComponent itself can't be a className,
        // but its internal div can be styled via its parent or Cytoscape's direct options if needed.
        // The className here will style the div that react-cytoscapejs renders.
        cy={(cy) => {
          cyRef.current = cy;
          cy.on('tap', 'node', handleNodeClick);
        }}
        stylesheet={stylesheet.length ? stylesheet : defaultCytoscapeStyles}
        // layout={{ name: 'cose-bilkent', idealEdgeLength: 100, nodeRepulsion: 4500 }} // Example layout options
      />
    </div>
  );
};