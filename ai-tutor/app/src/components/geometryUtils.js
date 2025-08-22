// src/components/geometryUtils.js

// Helper function to extract numbers from text
export const extractNumber = (text, keywords) => {
    for (const keyword of keywords) {
      const pattern = new RegExp(`${keyword}[^\\d]*(\\d+(?:\\.\\d+)?)`, 'i');
      const match = text.match(pattern);
      if (match) return parseFloat(match[1]);
    }
    return null;
  };
  
  // Function to detect geometry problems from text
  export const detectGeometryProblem = (message) => {
    const msg = message.toLowerCase();
    
    // Angles on a straight line or around a point
    if ((msg.includes('find') || msg.includes('calculate')) && 
        msg.includes('angle') && 
        (msg.includes('straight line') || msg.includes('around') || msg.includes('point') || 
         msg.includes('l shape') || msg.includes('adjacent') || (msg.includes('45') && msg.includes('90')))) {
      
      // Extract known angles
      const angles = [];
      const angleMatches = msg.match(/(\d+)\s*(?:degree|°)/g);
      if (angleMatches) {
        angleMatches.forEach(match => {
          const angle = parseInt(match.replace(/[^\d]/g, ''));
          angles.push(angle);
        });
      }
      
      // Determine if it's straight line (180°) or around point (360°)
      const isAroundPoint = msg.includes('around') || msg.includes('point') || msg.includes('360');
      const total = isAroundPoint ? 360 : 180;
      
      return { 
        shape: 'angles_on_line', 
        dimensions: { 
          knownAngles: angles, 
          total,
          isAroundPoint 
        } 
      };
    }
    
    // Triangle angle problems - prioritize this over single angles
    if (msg.includes('triangle') && msg.includes('angle') && !msg.includes('area')) {
      const angleMatches = msg.match(/(\d+)\s*(?:degree|°)/g);
      let angle1 = null, angle2 = null, angle3 = null;
      
      if (angleMatches) {
        const angles = angleMatches.map(match => parseInt(match.replace(/[^\d]/g, '')));
        angle1 = angles[0] || null;
        angle2 = angles[1] || null;
        angle3 = angles[2] || null;
      }
      
      return { shape: 'triangle_find_angle', dimensions: { angle1, angle2, angle3 } };
    }
    
    // Specific angle drawing (90 degree, 45 degree, etc.) - only if NOT a triangle problem
    if ((msg.includes('draw') || msg.includes('construct') || msg.includes('show')) && 
        (msg.includes('degree') || msg.includes('°')) && msg.includes('angle') && !msg.includes('triangle')) {
      const angle = extractNumber(msg, ['degree', '°']) || 90;
      return { shape: 'single_angle', dimensions: { angle } };
    }
    
    // Right angle specifically
    if (msg.includes('right angle') || msg.includes('90 degree') || msg.includes('90°')) {
      return { shape: 'single_angle', dimensions: { angle: 90, isRightAngle: true } };
    }
    
    // Angle measurement problems
    if (msg.includes('find') && msg.includes('angle') && (msg.includes('triangle') || msg.includes('missing'))) {
      const angle1 = extractNumber(msg, ['first', 'one', 'angle']) || null;
      const angle2 = extractNumber(msg, ['second', 'two']) || null;
      const angle3 = extractNumber(msg, ['third', 'three']) || null;
      return { shape: 'triangle_find_angle', dimensions: { angle1, angle2, angle3 } };
    }
    
    // Complementary angles (add to 90°)
    if (msg.includes('complementary') && msg.includes('angle')) {
      const knownAngle = extractNumber(msg, ['angle', 'degree', '°']) || null;
      return { shape: 'complementary_angles', dimensions: { knownAngle } };
    }
    
    // Supplementary angles (add to 180°)
    if (msg.includes('supplementary') && msg.includes('angle')) {
      const knownAngle = extractNumber(msg, ['angle', 'degree', '°']) || null;
      return { shape: 'supplementary_angles', dimensions: { knownAngle } };
    }
    
    // Parallel lines and angles patterns
    if ((msg.includes('parallel lines') || msg.includes('parallel line')) && 
        (msg.includes('angle') || msg.includes('alternate') || msg.includes('corresponding') || msg.includes('transversal'))) {
      return { shape: 'parallel_lines', dimensions: { showAngles: true } };
    }
    
    // Alternate angles specifically
    if (msg.includes('alternate angle') || msg.includes('alternate interior') || msg.includes('alternate exterior')) {
      return { shape: 'parallel_lines', dimensions: { showAngles: true, highlightAlternate: true } };
    }
    
    // Corresponding angles
    if (msg.includes('corresponding angle')) {
      return { shape: 'parallel_lines', dimensions: { showAngles: true, highlightCorresponding: true } };
    }
    
    // Co-interior angles (same-side interior)
    if (msg.includes('co-interior') || msg.includes('same side interior') || msg.includes('same-side interior')) {
      return { shape: 'parallel_lines', dimensions: { showAngles: true, highlightCoInterior: true } };
    }
    
    // Cone patterns
    if (msg.includes('cone') && (msg.includes('volume') || msg.includes('height') || msg.includes('radius'))) {
      const height = extractNumber(msg, ['height', 'tall', 'high']) || 5;
      const radius = extractNumber(msg, ['radius', 'base']) || 3;
      return { shape: 'cone', dimensions: { height, radius } };
    }
    
    // Cylinder patterns
    if (msg.includes('cylinder') && (msg.includes('volume') || msg.includes('height') || msg.includes('radius'))) {
      const height = extractNumber(msg, ['height', 'tall', 'high']) || 6;
      const radius = extractNumber(msg, ['radius', 'base']) || 4;
      return { shape: 'cylinder', dimensions: { height, radius } };
    }
    
    // Rectangle patterns
    if ((msg.includes('rectangle') || msg.includes('rectangular')) && (msg.includes('area') || msg.includes('length') || msg.includes('width'))) {
      const length = extractNumber(msg, ['length', 'long']) || 8;
      const width = extractNumber(msg, ['width', 'wide']) || 5;
      return { shape: 'rectangle', dimensions: { length, width } };
    }
    
    // Triangle patterns
    if (msg.includes('triangle') && (msg.includes('area') || msg.includes('base') || msg.includes('height'))) {
      const base = extractNumber(msg, ['base', 'bottom']) || 8;
      const height = extractNumber(msg, ['height', 'tall', 'high']) || 6;
      return { shape: 'triangle', dimensions: { base, height } };
    }
    
    // Circle patterns
    if (msg.includes('circle') && (msg.includes('area') || msg.includes('radius'))) {
      const radius = extractNumber(msg, ['radius']) || 5;
      return { shape: 'circle', dimensions: { radius } };
    }
    
    // Trapezium patterns
    if (msg.includes('trapezium') && (msg.includes('area') || msg.includes('parallel'))) {
      const topBase = extractNumber(msg, ['top', 'shorter']) || 4;
      const bottomBase = extractNumber(msg, ['bottom', 'longer', 'base']) || 8;
      const height = extractNumber(msg, ['height']) || 5;
      return { shape: 'trapezium', dimensions: { topBase, bottomBase, height } };
    }
    
    return null;
  };