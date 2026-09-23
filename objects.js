//Declare my 3 underwater objects

// FIX: original fish only had 5 vertices (0-4), but its edges array
// referenced a 6th vertex (index 5) that never existed -- those 4
// edges were silently being skipped. Restructured as a proper
// 6-vertex diamond (nose, top, bottom, left, right, tail) so it's
// both a valid wireframe AND triangulable for Level 3.
let fish = {
    vertices: [
      { x: 0,    y: 0,    z: 1    }, // 0 nose
      { x: 0,    y: 0.3,  z: 0.2  }, // 1 top
      { x: 0,    y: -0.3, z: 0.2  }, // 2 bottom
      { x: -0.3, y: 0,    z: 0.2  }, // 3 left
      { x: 0.3,  y: 0,    z: 0.2  }, // 4 right
      { x: 0,    y: 0,    z: -0.8 }  // 5 tail
    ],
    edges: [
      [0,1], [0,2], [0,3], [0,4],       // nose to ring
      [1,4], [4,2], [2,3], [3,1],       // ring loop
      [5,1], [5,2], [5,3], [5,4]        // tail to ring
    ],
    // 8 triangular faces -- an octahedron: 4 from the nose to the ring,
    // 4 from the tail to the ring
    faces: [
      [0,1,4], [0,4,2], [0,2,3], [0,3,1],
      [5,4,1], [5,2,4], [5,3,2], [5,1,3]
    ]
  };
  
  let coral = {
    vertices: [
      { x: 0,    y: -1,   z: 0 },    // 0 base
      { x: 0,    y: 0,    z: 0 },    // 1 trunk top
      { x: -0.5, y: 0.8,  z: 0.3 },  // 2 branch A tip
      { x: 0.5,  y: 0.7,  z: -0.2 }, // 3 branch B tip
      { x: 0.1,  y: 1.0,  z: 0.4 },  // 4 branch C tip
      { x: -0.3, y: 0.4,  z: -0.4 }  // 5 branch D tip
    ],
    edges: [
      [0,1],
      [1,2], [1,3], [1,4], [1,5]
    ],
    // Coral's branches don't enclose any volume, so rather than leave it
    // faceless, the 4 tips are triangulated into a flat "canopy" fan
    // around the trunk top -- gives Level 3 something to fill/shade.
    faces: [
      [1,2,3], [1,3,4], [1,4,5], [1,5,2]
    ]
  };
  
  let cliffs = {
    vertices: [
      { x:  0.4, y: 0,   z:  0.4 }, { x: -0.4, y: 0,   z:  0.4 },
      { x:  0.4, y: 0,   z: -0.4 }, { x: -0.4, y: 0,   z: -0.4 },
      { x:  0.3, y: 2.2, z:  0.3 }, { x: -0.3, y: 2.2, z:  0.3 },
      { x:  0.3, y: 2.2, z: -0.3 }, { x: -0.3, y: 2.2, z: -0.3 }
    ],
    edges: [
      [0,1],[0,2],[1,3],[2,3],   // base
      [4,5],[4,6],[5,7],[6,7],   // top
      [0,4],[1,5],[2,6],[3,7]    // verticals
    ],
    // a proper box: 6 quad faces, each split into 2 triangles = 12 total
    faces: [
      [0,1,2], [1,3,2],   // bottom
      [4,6,5], [5,6,7],   // top
      [0,4,1], [1,4,5],   // front
      [2,3,6], [3,7,6],   // back
      [0,2,4], [2,6,4],   // right
      [1,5,3], [3,5,7]    // left
    ]
  };
  
  // A flat square tile. Tiled repeatedly along z (and side by side along x)
  // it becomes a scrolling floor grid, like the trench run.
  let floorTile = {
    vertices: [
      { x: -1, y: 0, z: 0 },
      { x:  1, y: 0, z: 0 },
      { x:  1, y: 0, z: 1 },
      { x: -1, y: 0, z: 1 }
    ],
    edges: [
      [0,1], [1,2], [2,3], [3,0]
    ],
    faces: [
      [0,1,2], [0,2,3]
    ]
  };
  
  let models = { fish, coral, cliffs, floorTile };