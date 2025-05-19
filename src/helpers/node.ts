import type { ElementsDefinition, NodeSingular, NodeDataDefinition } from 'cytoscape';
// import { availableLanguages, type LanguageCode } from '../config'; // Assuming this is correctly pathed if used directly here, otherwise passed as arg.

/* ---------- Interfaces ---------- */

/**
 * Represents a category node in the graph data structure, typically from the index file.
 */
export interface CategoryNode {
  id: string;          // Unique identifier for the category
  label: string;       // Display name for the category
  childFile?: string;  // Optional filename for loading child nodes (skills or sub-categories)
}

/**
 * Represents a hyperlink resource associated with a skill.
 */
export interface ResourceLink {
  link: string;        // URL of the resource
  description: string; // Brief description of the resource
}

/**
 * Represents a skill node, typically loaded from a childFile.
 */
export interface SkillNode {
  name: string;                // Name of the skill
  description?: string;         // Detailed description of the skill
  wiki?: string;                // Link to a wiki page for more information
  resources?: ResourceLink[];   // Array of learning resources for the skill
}

/**
 * Represents the data structure for a Cytoscape node that displays a skill.
 * This is derived from SkillNode and includes graph-specific properties.
 */
export interface CytoscapeChildSkillNodeData extends NodeDataDefinition { // Extends Cytoscape's NodeDataDefinition
  id: string;                 // Generated unique ID for this Cytoscape node
  label: string;              // Derived from SkillNode.name
  description?: string;
  wiki?: string;
  resources?: ResourceLink[];
  parentId: string;           // The ID of the CategoryNode that triggered loading these skills
  isChildSkill?: boolean;      // Flag to identify these nodes as specific skill items
}

/**
 * Represents a node found through the search functionality.
 */
export interface FoundNode {
  id: string;          // ID of the found node
  label: string;       // Display label of the found node (often id + name)
  node: NodeSingular;  // The Cytoscape node object itself
}
function getPath(fileName: string): string {
  let baseUrl = import.meta.env.BASE_URL;
  // 确保 baseUrl 以 / 结尾 (如果不是根路径 '/')
  if (baseUrl !== '/' && !baseUrl.endsWith('/')) {
    baseUrl += '/';
  }
  return `${baseUrl}${fileName}`;
}


/* ---------- Exported Functions ---------- */

/**
 * Loads the initial index graph data (top-level categories) for a given language.
 * Fetches data from a JSON file structured according to the CategoryNode interface.
 * @param {LanguageCode} language - The language code for which to load the graph.
 * @returns {Promise<ElementsDefinition>} A promise that resolves to Cytoscape elements (nodes and edges).
 * @throws {Error} If fetching or parsing the data fails.
 */
export async function loadIndexGraph(language: string /* LanguageCode */): Promise<ElementsDefinition> {

  const res = await fetch(getPath(`data/${language}/isced-index.json`));
  if (!res.ok) {
    throw new Error(`Failed to load top-level category data for language ${language}. Status: ${res.status}`);
  }
  const allCategories: CategoryNode[] = await res.json();
  return categoriesToElements(allCategories);
}
/* ---------- Layout Core ---------- */

/**
 * Converts an array of CategoryNode objects into Cytoscape elements (nodes and edges)
 * for the initial graph display. It defines the hierarchical structure and positions
 * for root, level 1, level 2, and level 3 category nodes.
 * @param {CategoryNode[]} allCategories - An array of all category nodes.
 * @returns {ElementsDefinition} Cytoscape elements definition (nodes and edges).
 */
function categoriesToElements(allCategories: CategoryNode[]): ElementsDefinition {
  const nodes: any[] = [];
  const edges: any[] = [];
  const posMap: Record<string, { x: number; y: number }> = {};

  // 1. Root Node
  nodes.push({
    data: { id: 'r', label: 'ISCED Root' },
    classes: 'level-0 root-node',
    position: { x: 0, y: 0 },
  });
  posMap['root'] = { x: 0, y: 0 };

  // 2. Level 1 Nodes (Broad fields)
  const MAIN_R = 2200; // Radius for the first level ring
  const broadFieldLevelNodes = allCategories
    .filter(c => c.id.length === 2) // e.g., "00" to "10", "99"
    .sort((a, b) => { // Specific sort: "99" last, others by ID
      if (a.id === "99") return 1;
      if (b.id === "99") return -1;
      return a.id.localeCompare(b.id);
    });

  const NUM_BROAD_FIELDS = broadFieldLevelNodes.length; // Should be 12 if "99" is included

  broadFieldLevelNodes.forEach((nodeData, i) => {
    const angle = (2 * Math.PI * i) / NUM_BROAD_FIELDS;
    const x = MAIN_R * (i % 2 + 1.5) * Math.cos(angle);
    const y = MAIN_R * (i % 2 + 1.5) * Math.sin(angle);

    nodes.push({
      data: { id: nodeData.id, label: nodeData.label },
      classes: 'level-1',
      position: { x, y },
    });
    edges.push({ data: { id: `r-${nodeData.id}`, source: 'r', target: nodeData.id } });
    posMap[nodeData.id] = { x, y };
  });

  // Group Level 2 and 3 nodes by their parent ID
  const level2Groups: Record<string, CategoryNode[]> = {}; // Parent ID is 2 digits (L1)
  const level3Groups: Record<string, CategoryNode[]> = {}; // Parent ID is 3 digits (L2)

  for (const c of allCategories) {
    if (c.id.length === 3) { // Level 2 node
      const parentId = c.id.slice(0, 2);
      (level2Groups[parentId] ??= []).push(c);
    } else if (c.id.length === 4) { // Level 3 node
      const parentId = c.id.slice(0, 3);
      (level3Groups[parentId] ??= []).push(c);
    }
  }

  // Group Level 2 and 3 nodes by their parent ID
  // Use radii similar to your original code for outward fanning
  const SECOND_R_FAN = 900; // Radius of the fan for L2 nodes from their L1 parent

  Object.entries(level2Groups).forEach(([level1ParentId, group]) => {
    const level1ParentPos = posMap[level1ParentId];
    const rootPos = posMap['root']; // Directional reference for L2 fan is the main root

    if (!level1ParentPos) {
      console.warn(`Position for Level 1 parent ${level1ParentId} not found. Skipping its L2 children.`);
      return;
    }
    if (!rootPos) { // Should always exist
        console.warn(`Root position not found.`);
        return;
    }

    group.sort((a,b) => a.id.localeCompare(b.id)); // Sort children for consistent fan layout
    group.forEach((level2Node, idx) => {
      const pos = fanOut(level1ParentPos, rootPos, idx, group.length, SECOND_R_FAN, Math.PI * 1.2);
      nodes.push({
        classes: 'level-2',
        data: { ...level2Node, hasChildren: !!level2Node.childFile },
        position: pos,
      });
      edges.push({
        data: {
          id: `${level1ParentId}-${level2Node.id}`,
          source: level1ParentId,
          target: level2Node.id,
        }
      });
      posMap[level2Node.id] = pos;
    });
  });

   // 4. Level 3 Nodes (Detailed fields)
  const THIRD_R_FAN = 250; // Radius of the fan for L3 nodes from their L2 parent

  Object.entries(level3Groups).forEach(([level2ParentId, group]) => {
    const level2ParentPos = posMap[level2ParentId];
    const level1GrandparentId = level2ParentId.slice(0, 2);
    const level1GrandparentPos = posMap[level1GrandparentId];

    if (!level2ParentPos) {
      console.warn(`Position for Level 2 parent ${level2ParentId} not found. Skipping its L3 children.`);
      return;
    }
    const directionSourceForL3 = level1GrandparentPos || posMap['root'];

    group.sort((a,b) => a.id.localeCompare(b.id)); // Sort children
    group.forEach((level3Node, idx) => {
        // Determine the fan angle based on whether we have a valid L1 grandparent or are falling back to root
        const fanAngleForL3 = level1GrandparentPos ? Math.PI * 1.6 : Math.PI / 2; // Original: PI*1.6 if L1 exists, PI/2 if fallback
        const pos = fanOut(level2ParentPos, directionSourceForL3, idx, group.length, THIRD_R_FAN, fanAngleForL3);
        nodes.push({
            classes: 'level-3',
            data: { ...level3Node, hasChildren: !!level3Node.childFile },
            position: pos
        });
        edges.push({
            data: {
                id: `${level2ParentId}-${level3Node.id}`,
                source: level2ParentId,
                target: level3Node.id
            }
        });
        posMap[level3Node.id] = pos; // Though usually leaf nodes, good to store pos
    });
  });

  return { nodes, edges };
}

/* ---------- Fan Layout Utility ---------- */

/**
 * Calculates the position for a child node in a fan-like arrangement around a parent.
 * The fan spreads outwards, centered along the line from a direction source (e.g., grandparent)
 * through the parent.
 * @param {{ x: number; y: number }} parentPosition - Position of the parent node (center of the fan).
 * @param {{ x: number; y: number }} directionSourcePosition - Position of a reference node defining the outward direction.
 * @param {number} idx - Index of the current child node in its sibling group.
 * @param {number} total - Total number of sibling nodes in the group.
 * @param {number} radius - Distance from the parent to the child nodes.
 * @param {number} [fanAngle=Math.PI / 4] - The total angular spread of the fan.
 * @returns {{ x: number; y: number }} The calculated (x, y) position for the child node.
 */
function fanOut(
  parentPosition: { x: number; y: number },
  directionSourcePosition: { x: number; y: number },
  idx: number,
  total: number,
  radius: number,
  fanAngle: number = Math.PI / 4 
): { x: number; y: number } {
  const baseAngle = Math.atan2( // Angle of vector from directionSource to parent
    parentPosition.y - directionSourcePosition.y,
    parentPosition.x - directionSourcePosition.x
  );

  let angle;
  if (total === 1) { // Single child goes directly along baseAngle
    angle = baseAngle;
  } else { // Spread multiple children symmetrically around baseAngle
    const startAngle = baseAngle - fanAngle / 2;
    angle = startAngle + (fanAngle * idx) / (total - 1);
  }

  return {
    x: parentPosition.x + radius * Math.cos(angle),
    y: parentPosition.y + radius * Math.sin(angle)
  };
}

/* ---------- Lazy Load Child Graph ---------- */

/**
 * Loads child skill nodes for a given parent category node.
 * Fetches data from a JSON file (e.g., based on parentId) which contains an array of SkillNode objects.
 * @param {string} parentId - The ID of the parent category node whose children are to be loaded.
 * @param {{ x: number; y: number }} parentPos - The position of the clicked parent node.
 * @param {{ x: number; y: number }} grandParentPos - Position of the parent's parent (for fan direction).
 * @param {string} language - The language code (e.g., 'en', 'es') for fetching localized data.
 * @returns {Promise<ElementsDefinition>} A promise resolving to Cytoscape elements for the child skill nodes and their edges.
 * @throws {Error} If fetching or parsing the child data fails.
 */
export async function loadChildGraph(
  parentId: string,
  parentPos: { x: number; y: number },
  grandParentPos: { x: number; y: number },
  language: string /* LanguageCode */
): Promise<ElementsDefinition> {
  // Assumes child data file is named parentId.json (e.g., "0110.json")
  const res = await fetch(getPath(`data/${language}/${parentId}.json`)); 
  if (!res.ok) {
    throw new Error(`Could not load child skill data from file: ${language}/${parentId}.json. Status: ${res.status}`);
  }
  const loadedSkills: SkillNode[] = await res.json();
  return childGraphToElements(loadedSkills, parentId, parentPos, grandParentPos);
}

/**
 * Converts an array of SkillNode objects into Cytoscape elements for display as children of a parent category.
 * Positions these skill nodes in a fan shape around the parent.
 * @param {SkillNode[]} skillsArray - Array of skill data to convert.
 * @param {string} parentId - ID of the parent category node.
 * @param {{ x: number; y: number }} parentPos - Position of the parent node.
 * @param {{ x: number; y: number }} grandParentPos - Position of the grandparent node (for fan direction).
 * @returns {ElementsDefinition} Cytoscape elements (nodes and edges) for the skill graph.
 */
function childGraphToElements(
  skillsArray: SkillNode[],
  parentId: string,
  parentPos: { x: number; y: number },
  grandParentPos: { x: number; y: number }
): ElementsDefinition {
  const nodes: { data: CytoscapeChildSkillNodeData; position: { x: number; y: number }; classes: string; group: 'nodes' }[] = [];
  const edges: { data: { id: string; source: string; target: string }; group: 'edges' }[] = [];

  const radiusForFanOut = 120; // Distance of skill nodes from their parent
  const spreadAngleForFanOut = Math.PI * 1.2; // Angular spread for the fan

  skillsArray.forEach((skill, index) => {
    // Create a unique ID for the skill node, sanitizing name for safety
    const sanitizedName = skill.name.replace(/[^A-Za-z0-9_.-]/g, '_').toLowerCase();
    const newNodeId = `${parentId}-${sanitizedName}-${index}`; 

    const newPosition = fanOut(
      parentPos,
      grandParentPos, // Use grandparent for outward fan direction
      index,
      skillsArray.length,
      radiusForFanOut,
      spreadAngleForFanOut
    );

    nodes.push({
      group: 'nodes',
      classes: 'skill-node', // CSS class for styling skill nodes
      data: {
        id: newNodeId,
        label: skill.name,
        description: skill.description,
        wiki: skill.wiki,
        resources: skill.resources,
        parentId: parentId,
        isChildSkill: true, // Flag this as a child skill node
      },
      position: newPosition,
    });

    edges.push({
      group: 'edges',
      data: {
        id: `edge-${parentId}-to-${newNodeId}`, // Unique edge ID
        source: parentId, // Edge from parent category
        target: newNodeId, // Edge to the new skill node
      },
    });
  });

  return { nodes, edges };
}
