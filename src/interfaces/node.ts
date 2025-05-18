import type { ElementsDefinition } from 'cytoscape';

/* ---------- 接口 ---------- */

export interface CategoryNode {
  id: string;
  label: string;
  childFile?: string;
}
export interface SkillNode {
  id: string;
  label: string;
}

/* ---------- 对外函数 ---------- */

export async function loadIndexGraph(): Promise<ElementsDefinition> {
  const res = await fetch('/data/isced-index.json');
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
    data: { id: 'root', label: 'ISCED Root' },
    position: { x: 0, y: 0 },
    locked: true
  });
  posMap['root'] = { x: 0, y: 0 };

  /* 2️⃣ 一级环 (Broad fields - id.length === 2) */
  const MAIN_R = 800; // Radius for the first level ring

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
    const x = MAIN_R * Math.cos(angle);
    const y = MAIN_R * Math.sin(angle);

    nodes.push({
      data: { id: nodeData.id, label: nodeData.label },
      position: { x, y },
      locked: true // Lock Level 1 nodes in their circular positions
    });
    edges.push({ data: { id: `root-${nodeData.id}`, source: 'root', target: nodeData.id } });
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
  const SECOND_R_FAN = 400; // Radius of the fan for L2 nodes from their L1 parent (was 500 in original prompt, adjust as needed)

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
      const pos = fanOut(level1ParentPos, rootPos, idx, group.length, SECOND_R_FAN);
      nodes.push({
        data: { ...level2Node, hasChildren: !!level2Node.childFile },
        position: pos
      });
      edges.push({
        data: {
          id: `${level1ParentId}-${level2Node.id}`,
          source: level1ParentId,
          target: level2Node.id
        }
      });
      posMap[level2Node.id] = pos;
    });
  });

  /* 4️⃣ 三级节点 (Detailed fields - 4 位 id) */
  const THIRD_R_FAN = 150; // Radius of the fan for L3 nodes from their L2 parent (was 300 in original prompt, adjust as needed)

  Object.entries(level3Groups).forEach(([level2ParentId, group]) => {
    const level2ParentPos = posMap[level2ParentId];
    // Directional reference for L3 fan is its L1 grandparent
    const level1GrandparentId = level2ParentId.slice(0, 2);
    const level1GrandparentPos = posMap[level1GrandparentId];

    if (!level2ParentPos) {
      console.warn(`Position for Level 2 parent ${level2ParentId} not found. Skipping its L3 children.`);
      return;
    }
    if (!level1GrandparentPos) {
      console.warn(`Position for Level 1 grandparent ${level1GrandparentId} not found. Using root as fallback for L3 fan direction for children of ${level2ParentId}.`);
      // Fallback to rootPos might not give the desired tiered fan effect but prevents errors.
      // const rootPos = posMap['root'];
      // fanOut(level2ParentPos, rootPos || {x:0, y:0} , ...)
      // For now, we'll assume level1GrandparentPos should exist if data is consistent.
      // If it might not, a more robust fallback is needed.
      // For the desired visual, we need the L1 grandparent.
      // If L1 grandparent is missing from posMap, this fan will be problematic.
      // Let's use root as a fallback if L1 is missing.
      const directionSourceForL3 = level1GrandparentPos || posMap['root'];


      group.sort((a,b) => a.id.localeCompare(b.id)); // Sort children
      group.forEach((level3Node, idx) => {
        const pos = fanOut(level2ParentPos, directionSourceForL3, idx, group.length, THIRD_R_FAN);
        nodes.push({
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
    } else { // level1GrandparentPos exists
        group.sort((a,b) => a.id.localeCompare(b.id)); // Sort children
        group.forEach((level3Node, idx) => {
            const pos = fanOut(level2ParentPos, level1GrandparentPos, idx, group.length, THIRD_R_FAN);
            nodes.push({
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
            posMap[level3Node.id] = pos;
        });
    }
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
 */
function fanOut(
  parentPosition: { x: number; y: number },
  directionSourcePosition: { x: number; y: number },
  idx: number,
  total: number,
  radius: number
) {
  // Calculate the base angle: This is the angle of the vector from directionSourcePosition to parentPosition.
  // The fan will spread outwards along this axis.
  const baseAngle = Math.atan2(
    parentPosition.y - directionSourcePosition.y,
    parentPosition.x - directionSourcePosition.x
  );

  const spread = Math.PI / 3; // 60° fan spread. Adjust as needed (e.g., Math.PI / 2 for 90°).

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

/* ---------- 懒加载子图保持原样 ---------- */

export async function loadChildGraph(
  parentId: string,
  childFile: string
): Promise<ElementsDefinition> {
  const res = await fetch(`/data/${childFile}`);
  if (!res.ok) throw new Error(`无法加载子文件 ${childFile}`);
  const json: {
    nodes: SkillNode[];
    edges?: { source: string; target: string }[];
  } = await res.json();
  return childGraphToElements(json, parentId);
}

function childGraphToElements(
  data: { nodes: SkillNode[]; edges?: { source: string; target: string }[] },
  parentId: string
): ElementsDefinition {
  const nodes = data.nodes.map((n) => ({
    data: n,
    position: { x: Math.random() * 200 - 100, y: Math.random() * 200 - 100 } // Random position for child graph nodes
  }));

  const edges = (data.edges ?? []).map((e) => ({
    data: {
      id: `${parentId}-${e.source}-${e.target}`.replace(/[^A-Za-z0-9_-]/g, '_'),
      source: e.source,
      target: e.target
    }
  }));

  return { nodes, edges };
}