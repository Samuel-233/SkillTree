import React, { useEffect, useState, useCallback, useRef } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import type { ElementDefinition } from 'cytoscape';
// @ts-ignore
import coseBilkent from 'cytoscape-cose-bilkent';
import { loadIndexGraph, loadChildGraph, type SkillNode } from './interfaces/node';

export const App: React.FC = () => {
  const [elements, setElements] = useState<ElementDefinition[]>([]);
  cytoscape.use(coseBilkent);
  useEffect(() => {
    loadIndexGraph().then(({ nodes, edges }) => {
      setElements([...nodes, ...edges]);
    });
  }, []);
  

  const handleNodeClick = useCallback(async (event: cytoscape.EventObject) => {
    const node = event.target;
    const data = node.data() as SkillNode & { childFile?: string; expanded?: boolean };

    if (data.childFile && !data.expanded) {
      const childElements = await loadChildGraph(data.id, data.childFile);
      setElements(prev => [...prev, ...childElements.nodes, ...childElements.edges]);
      node.data('expanded', true);
    }
  }, []);

  return (
    <CytoscapeComponent
      elements={elements}
      style={{ width: '100%', height: '100vh' }}
      cy={(cy) => {
        cy.on('tap', 'node', handleNodeClick);
        // cy.layout({
        //   name: 'cose-bilkent',
        //   animate: 'end',
        //   fit: true,
        //   nodeRepulsion: 1000,
        //   idealEdgeLength: 1000
        // } as any).run();

      }}
      stylesheet={[
        { selector: 'node', style: { label: 'data(label)', 'background-color': '#6FB1FC' } },
        { selector: 'edge', style: { 'target-arrow-shape': 'triangle', 'target-arrow-color': '#ccc', 'line-color': '#ccc' } }
      ]}
    />
  );
};
