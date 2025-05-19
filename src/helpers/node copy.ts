import type { ElementsDefinition, NodeSingular } from 'cytoscape';
import { availableLanguages, type LanguageCode } from '../config';
/* ---------- 接口 ---------- */

export interface CategoryNode {
  id: string;
  label: string;
  childFile?: string;
}

// New interface for the resource object
export interface ResourceLink {
  link: string;
  description: string;
}

export interface SkillNode {
  name: string;
  description?: string;
  wiki?: string;
  resources?: ResourceLink[]; // Updated from string[] to ResourceLink[]
}

export interface CytoscapeChildSkillNodeData {
  id: string;           // Generated unique ID for this Cytoscape node
  label: string;          // Derived from SkillNode.name
  description?: string;
  wiki?: string;
  resources?: ResourceLink[]; // Updated from string[] to ResourceLink[]
  parentId: string;       // The ID of the CategoryNode that was clicked to load these
  isChildSkill?: boolean; // Flag to identify these nodes, optional
}


export interface FoundNode {
  id: string;
  label: string;
  node: NodeSingular;
}
/* ---------- 对外函数 ---------- */

export async function loadIndexGraph(language: LanguageCode): Promise<ElementsDefinition> {
  const res = await fetch(`/data/${language}/isced-index.json`);
  if (!res.ok) throw new Error('无法加载顶层分类数据');
  const allCategories: CategoryNode[] = await res.json();
  return categoriesToElements(allCategories);
}

/* ---------- 排布核心 ---------- */

function categoriesToElements(allCategories: CategoryNode[]): ElementsDefinition {
  const nodes: any[] = [];
  const edges: any[] = [];
  const posMap: Record<string, { x: number; y: number }> = {};

  /* 1️⃣ root */
  nodes.push({
    data: { id: 'r', label: 'ISCED Root' },
    classes: 'level-0 root-node',
    position: { x: 0, y: 0 },
  });
  posMap['root'] = { x: 0, y: 0 };

  /* 2️⃣ 一级环 (Broad fields - id.length === 2) */
  const MAIN_R = 2200; // Radius for the first level ring

  // Filter and sort Level 1 nodes (Broad Fields)
  const broadFieldLevelNodes = allCategories
    .filter(c => c.id.length === 2) // "00" to "10" and "99"
    .sort((a, b) => {
      // Ensure "99" is last if you want specific ordering, otherwise sort by id
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

  /* 将二、三级节点分组 —— key = parentId */
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

  /* 3️⃣ 二级节点 (Narrow fields - 3 位 id) */
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

  /* 4️⃣ 三级节点 (Detailed fields - 4 位 id) */
  const THIRD_R_FAN = 250; // Radius of the fan for L3 nodes from their L2 parent (was 300 in original prompt, adjust as needed)

  Object.entries(level3Groups).forEach(([level2ParentId, group]) => {
    const level2ParentPos = posMap[level2ParentId];
    // Directional reference for L3 fan is its L1 grandparent
    const level1GrandparentId = level2ParentId.slice(0, 2);
    const level1GrandparentPos = posMap[level1GrandparentId];

    if (!level2ParentPos) {
      console.warn(`Position for Level 2 parent ${level2ParentId} not found. Skipping its L3 children.`);
      return;
    }
    // Note: The original code had a more complex handling for missing level1GrandparentPos.
    // I've simplified it here to directly use level1GrandparentPos or fallback to root.
    // Ensure your posMap is consistently populated or adjust error handling as needed.
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

/* ---------- 扇形排布工具 ---------- */

/**
 * Arranges child nodes in a fan shape outwards from the parent.
 * The fan is centered along the line extending from directionSourcePosition through parentPosition.
 * @param parentPosition The position of the parent node (center of the fan).
 * @param directionSourcePosition The position of the node that defines the outward direction (e.g., root for L2 fan, L1-parent for L3 fan).
 * @param idx The index of the current child node in its group.
 * @param total The total number of child nodes in the group.
 * @param radius The distance from the parentPosition to the child nodes.
 * @param fanAngle The total angle of the fan spread.
 */
function fanOut(
  parentPosition: { x: number; y: number },
  directionSourcePosition: { x: number; y: number },
  idx: number,
  total: number,
  radius: number,
  fanAngle: number = Math.PI / 4 // Default fan angle
) {
  // Calculate the base angle: This is the angle of the vector from directionSourcePosition to parentPosition.
  // The fan will spread outwards along this axis.
  const baseAngle = Math.atan2(
    parentPosition.y - directionSourcePosition.y,
    parentPosition.x - directionSourcePosition.x
  );

  const spread = fanAngle;

  let angle;
  if (total === 1) {
    angle = baseAngle; // Single child goes directly along the baseAngle
  } else {
    // Spread children symmetrically around the baseAngle
    const startAngle = baseAngle - spread / 2;
    angle = startAngle + (spread * idx) / (total - 1);
  }

  return {
    x: parentPosition.x + radius * Math.cos(angle),
    y: parentPosition.y + radius * Math.sin(angle)
  };
}

/* ---------- 懒加载子图 ---------- */

export async function loadChildGraph(
  parentId: string,
  parentPos: { x: number; y: number }, // Position of the clicked parent node
  grandParentPos: { x: number; y: number }, // Position of the parent's parent (for fan direction)
  language: LanguageCode
): Promise<ElementsDefinition> {
  // Assuming childFile name is stored on the parent node and needs to be fetched
  // This part of logic might need adjustment based on how childFile names are actually determined.
  // For this example, let's assume the parentId IS the filename (e.g. "0110.json" for parent "0110")
  // If childFile is a property on the parent node object in your data, you'd fetch that first.
  const res = await fetch(`/data/${language}/${parentId}.json`); // Assumes filename is parentId.json (or derived)

  if (!res.ok) {
    throw new Error(`Could not load child data from file: ${language}/${parentId}.json. Status: ${res.status}`);
  }
  const loadedSkills: SkillNode[] = await res.json();
  return childGraphToElements(loadedSkills, parentId, parentPos, grandParentPos);
}

function childGraphToElements(
  skillsArray: SkillNode[],
  parentId: string,
  parentPos: { x: number; y: number }, // Position of the parent node
  grandParentPos: { x: number; y: number } // Position for fan direction
): ElementsDefinition {
  const nodes: { data: CytoscapeChildSkillNodeData; position: { x: number; y: number }; classes: string; group: 'nodes' }[] = [];
  const edges: { data: { id: string; source: string; target: string }; group: 'edges' }[] = [];

  // Parameters for the fanOut function
  const radiusForFanOut = 120; // Distance of child nodes from the parent node
  const spreadAngleForFanOut = Math.PI * 1.2; // Spread angle for the fan

  skillsArray.forEach((skill, index) => {
    // Sanitize name for ID or use a more robust ID generation if names can have many special chars
    const sanitizedName = skill.name.replace(/[^A-Za-z0-9_.-]/g, '_').toLowerCase();
    const newNodeId = `${parentId}-${sanitizedName}-${index}`; // Ensure unique IDs

    // Calculate position using fanOut
    const newPosition = fanOut(
      parentPos,
      grandParentPos, // Use grandparent for direction to fan outwards correctly
      index,
      skillsArray.length,
      radiusForFanOut,
      spreadAngleForFanOut
    );

    nodes.push({
      group: 'nodes',
      classes: 'skill-node', // Add a class for styling skill nodes
      data: {
        id: newNodeId,
        label: skill.name,
        description: skill.description,
        wiki: skill.wiki,
        resources: skill.resources, // This will now be ResourceLink[]
        parentId: parentId,
        isChildSkill: true,
      },
      position: newPosition,
    });

    edges.push({
      group: 'edges',
      data: {
        id: `edge-${parentId}-to-${newNodeId}`,
        source: parentId,
        target: newNodeId,
      },
    });
  });

  return { nodes, edges };
}