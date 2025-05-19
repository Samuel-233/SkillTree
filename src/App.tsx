import React, { useEffect, useState, useCallback, useRef } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
// @ts-ignore
import type { ElementDefinition, NodeSingular, NodeCollection, Stylesheet } from 'cytoscape';
// @ts-ignore
import coseBilkent from 'cytoscape-cose-bilkent';
import { loadIndexGraph, loadChildGraph, type CytoscapeChildSkillNodeData, type FoundNode } from './helpers/node';
import { SearchPanel } from './components/SearchPanel';
import { SettingsMenu } from './components/SettingPanel';
import { SkillDetailPanel } from './components/SkillDetailPanel';
import { availableLanguages, type LanguageCode } from './config';
import './App.css';

/**
 * Default styles for the Cytoscape graph.
 */
const defaultCytoscapeStyles: Stylesheet[] = [
  { selector: 'node', style: { label: 'data(label)', 'background-color': '#6FB1FC', 'width': 'mapData(id.length, 4, 2, 20, 50)', 'height': 'mapData(id.length, 4, 2, 20, 50)', 'font-size': 'mapData(id.length, 4, 2, 8, 16)'} },
  { selector: 'edge', style: { 'target-arrow-shape': 'triangle', 'target-arrow-color': '#ccc', 'line-color': '#ccc', 'width': 1 } },
  { selector: 'node:selected', style: { 'background-color': 'orange', 'border-width': 3, 'border-color': 'black', 'z-index': 99 } },
  { selector: '.highlighted', style: { 'background-color': 'yellow', 'border-color': '#ffc107', 'border-width': 2, 'z-index': 98 } }
];

const LOCAL_STORAGE_LANGUAGE_KEY = 'graphAppLanguage';

/**
 * Main application component that renders the skill graph and associated UI elements.
 * It manages graph elements, user interactions, search functionality, language settings,
 * and detail display for selected skills.
 */
export const App: React.FC = () => {
  // State for graph elements (nodes and edges)
  const [elements, setElements] = useState<ElementDefinition[]>([]);
  // State for graph stylesheet
  const [stylesheet, setStylesheet] = useState<Stylesheet[]>([]);
  // Ref to the Cytoscape core instance
  const cyRef = useRef<cytoscape.Core | null>(null);
  // Ref for managing animation timeouts
  const animationTimeoutRef = useRef<number | null>(null);

  // State for search functionality
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<FoundNode[]>([]);

  // State for skill detail panel
  const [selectedSkillDetail, setSelectedSkillDetail] = useState<CytoscapeChildSkillNodeData | null>(null);
  const [isDetailPanelVisible, setIsDetailPanelVisible] = useState<boolean>(false);

  // State for the current application language
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(() => {
    const savedLanguage = localStorage.getItem(LOCAL_STORAGE_LANGUAGE_KEY);
    if (savedLanguage && availableLanguages.some(lang => lang.code === savedLanguage)) {
      return savedLanguage as LanguageCode;
    }
    return 'en'; // Default language
  });

  // Register cose-bilkent layout extension with Cytoscape
  cytoscape.use(coseBilkent);

  /**
   * Effect hook to load the initial index graph data and stylesheet when the
   * current language changes. It also handles fitting the graph to the viewport.
   */
  useEffect(() => {
    console.log(`Loading index graph for language: ${currentLanguage}`);
    loadIndexGraph(currentLanguage).then(({ nodes, edges }) => {
      if (cyRef.current) {
        cyRef.current.elements().remove(); // Clear previous elements
      }
      const newElements = CytoscapeComponent.normalizeElements([...nodes, ...edges]);
      setElements(newElements);

    }).catch(error => {
        console.error(`Error loading index graph for language ${currentLanguage}:`, error);
    });

    // Fetch and set the stylesheet for the current language, or use default
    fetch(`/data/${currentLanguage}/cy-style.json`)
      .then(res => res.json())
      .then(styleJson => setStylesheet(styleJson))
      .catch(() => setStylesheet(defaultCytoscapeStyles));
  }, [currentLanguage]);

  /**
   * Handles changes to the application language.
   * Updates localStorage, resets relevant states (elements, search, details),
   * and sets the new current language to trigger data reloading.
   * @param {LanguageCode} newLanguage - The new language code selected by the user.
   */
  const handleLanguageChange = (newLanguage: LanguageCode) => {
    if (newLanguage !== currentLanguage) {
      console.log(`Language changed to: ${newLanguage}`);
      localStorage.setItem(LOCAL_STORAGE_LANGUAGE_KEY, newLanguage);
      
      setElements([]); 
      setSearchResults([]);
      setSearchTerm('');
      setIsDetailPanelVisible(false);
      setSelectedSkillDetail(null);
      
      setCurrentLanguage(newLanguage);
    }
  };

  /**
   * Clears any ongoing Cytoscape animations and animation timeouts.
   */
  const clearAnimations = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.stop(true, true); // Stop animations immediately
    }
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  }, []);

  /**
   * Focuses the view on a target node or collection of nodes with animation.
   * @param {NodeSingular | NodeCollection} targetNode - The Cytoscape node or collection to focus on.
   * @param {cytoscape.Core} cyInstance - The Cytoscape core instance.
   * @param {number} [padding=600] - The padding around the target element(s) when fitting the view.
   */
  const focusNode = useCallback((targetNode: cytoscape.NodeSingular | cytoscape.NodeCollection, cyInstance: cytoscape.Core, padding = 600) => {
    clearAnimations();
    animationTimeoutRef.current = window.setTimeout(() => {
      // Filter out removed elements from targetNode before checking its length and using it
      const elementsToFit = targetNode.filter((el: cytoscape.NodeSingular) => !el.removed());

      if (cyInstance && !cyInstance.destroyed() && elementsToFit.length > 0) {
        cyInstance.animate({
          fit: { eles: elementsToFit, padding: padding }, // Use the filtered collection
          duration: 500, // Animation duration
          easing: 'ease-out-quad' // Animation easing
        });
      }
    }, 0); // Timeout of 0 ms to ensure it runs after current execution stack
  }, [clearAnimations]);

  /**
   * Handles click events on graph nodes.
   * If a child skill node is clicked, it displays its details.
   * If a category node (expandable) is clicked, it loads and displays its child graph.
   * Otherwise, it selects and focuses on the clicked node.
   * @param {cytoscape.EventObject} event - The Cytoscape event object for the tap.
   */
  const handleNodeClick = useCallback(async (event: cytoscape.EventObject) => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    const node = event.target as NodeSingular;
    const nodeData = node.data();

    clearAnimations();

    cy.nodes().deselect().removeClass('highlighted'); // Deselect and unhighlight all nodes first
    node.select().addClass('highlighted'); // Select and highlight the clicked node

    if (nodeData.isChildSkill) {
      // Clicked on a specific skill node
      setSelectedSkillDetail(nodeData as CytoscapeChildSkillNodeData);
      setIsDetailPanelVisible(true);
      // Optional: focus on skill node with smaller padding
      // focusNode(node, cy, 300); 
    } else if (nodeData.id && nodeData.id.length === 4 && !nodeData.expanded) {
      // Clicked on an expandable category node (e.g., length 4 ID) that isn't expanded yet
      setIsDetailPanelVisible(false);
      setSelectedSkillDetail(null);
      try {
        const parentNodePos = node.incomers().nodes()[0]?.position() || { x: 0, y: 0 }; // Position of parent for layout
        const childElements = await loadChildGraph(nodeData.id, node.position(), parentNodePos, currentLanguage);
        node.data('expanded', true); // Mark node as expanded
        // Add new child elements to the graph
        setElements(prevElements => CytoscapeComponent.normalizeElements([...prevElements, ...childElements.nodes, ...childElements.edges]));
        focusNode(node, cy); // Focus on the expanded parent node
      } catch (error) {
        console.error(`Failed to load child graph for node ${nodeData.id}`, error);
        focusNode(node, cy); // Still focus on node even if child loading fails
      }
    } else {
      // Clicked on other types of nodes (root, already expanded, etc.)
      setIsDetailPanelVisible(false);
      setSelectedSkillDetail(null);
      focusNode(node, cy);
    }
  }, [currentLanguage, clearAnimations, focusNode, setElements]);

  /**
   * Handles the action to fit the entire graph into the viewport.
   * Clears selections and closes the detail panel.
   */
  const handleFitGraph = useCallback(() => {
    if (cyRef.current) {
      clearAnimations();
      cyRef.current.nodes().deselect().removeClass('highlighted');
      setIsDetailPanelVisible(false);
      setSelectedSkillDetail(null);
      // Fit all elements with a small padding
      focusNode(cyRef.current.elements(), cyRef.current, 50); 
    }
  }, [clearAnimations, focusNode]);

  /**
   * Performs a search for nodes based on the current searchTerm.
   * Highlights found nodes and focuses the view on them.
   */
  const performSearch = useCallback(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    clearAnimations();

    if (searchTerm) {
      // Filter nodes whose label includes the search term (case-insensitive)
    const foundNodesCollection = cy.nodes().filter((n: cytoscape.NodeSingular) => {
      const label = n.data('label') as string | undefined;
      return !!(label && label.toLowerCase().includes(searchTerm.toLowerCase()));
    });

      cy.nodes().deselect().removeClass('highlighted');
      setIsDetailPanelVisible(false);
      setSelectedSkillDetail(null);

      if (foundNodesCollection.length > 0) {
        const newSearchResults: FoundNode[] = foundNodesCollection.map((theNode: NodeSingular) => ({
            id: theNode.id(),
            label: `${theNode.data('id')} - ${theNode.data('label') || ''}`,
            node: theNode
          }));
        setSearchResults(newSearchResults);
        foundNodesCollection.addClass('highlighted'); // Highlight found nodes
        focusNode(foundNodesCollection, cy, 100); // Focus on the collection of found nodes
      } else {
        setSearchResults([]);
        console.warn('Node not found via search.');
      }
    } else {
      // If search term is empty, clear results and highlights
      setSearchResults([]);
      cy.nodes().removeClass('highlighted');
    }
  }, [searchTerm, clearAnimations, focusNode]);

  /**
   * Handles changes in the search input field.
   * Updates the searchTerm state. If the input is cleared, it also clears search results and highlights.
   * @param {React.ChangeEvent<HTMLInputElement>} event - The input change event.
   */
  const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    if (!event.target.value) { // If search term is cleared
        setSearchResults([]);
        if (cyRef.current) {
            clearAnimations();
            cyRef.current.nodes().removeClass('highlighted');
        }
    }
  };

  /**
   * Handles key press events in the search input field.
   * Triggers search if the 'Enter' key is pressed.
   * @param {React.KeyboardEvent<HTMLInputElement>} event - The keyboard event.
   */
  const handleSearchKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      performSearch();
    }
  };

  /**
   * Handles clicks on items in the search results list.
   * Selects, highlights, and focuses on the corresponding node in the graph.
   * @param {FoundNode} foundNode - The search result item that was clicked.
   */
  const handleSearchResultClick = useCallback((foundNode: FoundNode) => {
    if (cyRef.current && !foundNode.node.removed()) { // Check if node still exists
      clearAnimations();
      cyRef.current.nodes().deselect().removeClass('highlighted');
      setIsDetailPanelVisible(false); 
      setSelectedSkillDetail(null);
      foundNode.node.select().addClass('highlighted');
      focusNode(foundNode.node, cyRef.current);
    }
  }, [clearAnimations, focusNode]);

  /**
   * Effect hook for component cleanup.
   * Clears any active animations or timeouts when the component unmounts.
   */
  useEffect(() => {
    return () => { // Cleanup function
      clearAnimations();
    };
  }, [clearAnimations]); // Depends on clearAnimations callback

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
        elements={elements}
        className="cytoscape-container"
        cy={(cy) => {
          cyRef.current = cy; // Store Cytoscape instance
          cy.on('tap', 'node', handleNodeClick); // Register node tap handler
          // Initial fit is handled by the useEffect hook dependent on currentLanguage
        }}
        stylesheet={stylesheet.length ? stylesheet : defaultCytoscapeStyles} // Use fetched or default styles
      />
      <SettingsMenu
        currentLanguage={currentLanguage}
        availableLanguages={availableLanguages}
        onLanguageChange={handleLanguageChange}
      />
      <SkillDetailPanel
        skillData={selectedSkillDetail}
        isVisible={isDetailPanelVisible}
        onClose={() => {
            setIsDetailPanelVisible(false);
            setSelectedSkillDetail(null); // Clear details on close
            // Optional: If a skill was selected, attempt to deselect/unhighlight it
            // if(cyRef.current && selectedSkillDetail) {
            //     const skillNode = cyRef.current.getElementById(selectedSkillDetail.id);
            //     if(skillNode.length > 0 && skillNode.selected()){
            //         // skillNode.deselect().removeClass('highlighted'); 
            //     }
            // }
        }}
      />  
    </div>
  );
};