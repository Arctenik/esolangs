// note: this mutates the nodes
export function colorGraph(nodes) {
  // based on the dsatur algorithm
  const uncolored = nodes.slice();
  const [colors, newColor] = initColors();
  return handleErrorsWithInfo({ nodes }, () => {
    while (uncolored.length) {
      uncolored.sort((a, b) => {
        const satDiff = getSat(b) - getSat(a);
        if (satDiff) return satDiff;
        return getUncoloredDegree(b) - getUncoloredDegree(a);
      });
      const nodeToColor = uncolored.shift();
      const colorCandidates = getColorCandidates(nodeToColor);
      if (nodeToColor.paired) {
        removeValueFromArray(uncolored, nodeToColor.paired);
        const pairedColorCandidates = getColorCandidates(nodeToColor.paired);
        const [colorA, colorB] = determinePairColors(nodeToColor, colorCandidates, pairedColorCandidates);
        colorNode(nodeToColor, colorA);
        colorNode(nodeToColor.paired, colorB);
      } else {
        colorNode(nodeToColor, colorCandidates[0] ?? newColor());
      }
    }
    return [nodes, colors];
  });
  
  function determinePairColors(node, colorCandidates, pairedColorCandidates) {
    // Existing colors in correct order
    const existingPair = getExistingColorPair(colorCandidates, pairedColorCandidates, node.pairRole);
    if (existingPair) return existingPair;
    
    // Existing colors that can be put in the correct order
    const potentialPair = getPotentialColorPair(colorCandidates, pairedColorCandidates, node.pairRole);
    if (potentialPair) {
      orderColors(potentialPair[0], potentialPair[1], node.pairRole);
      return potentialPair;
    }
    
    const colorEndKeys = convertPairOrder("next", "prev", node.pairRole);
    
    // Existing color for current node with open end; new color for paired
    const openA = colorCandidates.find(c => !c[colorEndKeys[0]]);
    if (openA) {
      const colorB = newColor();
      orderColors(openA, colorB, node.pairRole);
      return [openA, colorB];
    }
    
    // Existing color for paired node with open end; new color for current
    const openB = pairedColorCandidates.find(c => !c[colorEndKeys[1]]);
    if (openB) {
      const colorA = newColor();
      orderColors(colorA, openB, node.pairRole);
      return [colorA, openB];
    }
    
    // No compatible existing colors; new colors for both
    const colorA = newColor();
    const colorB = newColor();
    orderColors(colorA, colorB, node.pairRole);
    return [colorA, colorB];
  }
  
  function getColorCandidates(node) {
    const connectedColors = getConnectedColors(node);
    return colors.filter(c => !connectedColors.has(c)).sort((a, b) => b.nodeCount - a.nodeCount);
  }
}

function getSat(node) {
  return getConnectedColors(node, true).size;
}

function getConnectedColors(node, countImplied = false) {
  const colors = new Set();
  for (const neighbor of node.connections) {
    if (neighbor.color) colors.add(neighbor.color);
  }
  if (node.paired && countImplied) {
    const [, reverseKey] = convertPairOrder("next", "prev", node.pairRole);
    for (const pairNeighbor of node.paired.connections) {
      const color = pairNeighbor.color?.[reverseKey];
      if (color) colors.add(color);
    }
  }
  return colors;
}

function getUncoloredDegree(node) {
  return node.connections.reduce((c, n) => c + (n.color ? 0 : 1), 0);
}

function getExistingColorPair(colorsA, colorsB, aRole) {
  const key = aRole === "before" ? "next" : "prev";
  for (const a of colorsA) {
    if (a[key] && colorsB.includes(a[key])) return [a, a[key]];
  }
  return null;
}

function getPotentialColorPair(colorsA, colorsB, aRole) {
  const [aKey, bKey] = convertPairOrder("next", "prev", aRole);
  for (const a of colorsA) {
    if (a[aKey]) continue;
    for (const b of colorsB) {
      if (b[bKey]) continue;
      if (colorsConnect(...convertPairOrder(b, a, aRole))) continue;
      return [a, b];
    }
  }
  return null;
}

function colorsConnect(start, end) {
  const visited = new Set();
  let node = start;
  while (node && !visited.has(node)) {
    visited.add(node);
    if (node === end) return true;
    node = node.next;
  }
  return false;
}

function colorNode(node, color) {
  node.color = color;
  color.nodeCount++;
}

function orderColors(a, b, aRole = "before") {
  const [bef, aft] = convertPairOrder(a, b, aRole);
  if (bef.next) throw new Error("Color already has next");
  if (aft.prev) throw new Error("Color already has prev");
  bef.next = aft;
  aft.prev = bef;
}

function convertPairOrder(a, b, aRole) {
  if (aRole === "before") return [a, b];
  if (aRole === "after") return [b, a];
  throw new Error(`Invalid pair role: ${aRole}`);
}

function initColors() {
  const colors = [];
  const newColor = () => {
    const color = { id: "c" + colors.length, nodeCount: 0 };
    colors.push(color);
    return color;
  };
  return [colors, newColor];
}

function handleErrorsWithInfo(info, cb) {
  try {
    return cb();
  } catch (e) {
    throw Object.assign(e, info);
  }
}
