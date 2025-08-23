// diagramDetector.js - Complete diagram detection system
import React from 'react';
import InlineGeometryCanvas from './InlineGeometryCanvas';

// Combined template system with all diagram types
export const DIAGRAM_TEMPLATES = {
  // Angle-based problems
  parallel_lines_angles: {
    keywords: ['parallel lines', 'transversal', 'corresponding', 'alternate', 'co-interior'],
    shape: 'parallel_lines',
    defaultDimensions: { showAngles: true },
    prompt: "This looks like a parallel lines and angles problem. Does this diagram help visualize what you're working with?"
  },
  
  triangle_angles: {
    keywords: ['triangle', 'angle', 'find', 'missing', 'sum'],
    shape: 'triangle_find_angle',
    defaultDimensions: { angle1: null, angle2: null, angle3: null },
    prompt: "I see you're working with triangle angles. Does this diagram match your problem?"
  },
  
  angles_on_line: {
    keywords: ['straight line', 'angles on', 'supplementary', '180'],
    shape: 'angles_on_line',
    defaultDimensions: { knownAngles: [], total: 180, isAroundPoint: false },
    prompt: "This appears to be about angles on a straight line. Is this similar to your setup?"
  },
  
  // Geometry shapes
  rectangle_area: {
    keywords: ['rectangle', 'area', 'length', 'width', 'perimeter'],
    shape: 'rectangle',
    defaultDimensions: { length: 8, width: 5 },
    prompt: "Working with a rectangle? Here's a diagram to help visualize it."
  },
  
  triangle_area: {
    keywords: ['triangle', 'area', 'base', 'height'],
    shape: 'triangle',
    defaultDimensions: { base: 8, height: 6 },
    prompt: "This looks like a triangle area problem. Does this help?"
  },
  
  circle_properties: {
    keywords: ['circle', 'area', 'circumference', 'radius', 'diameter'],
    shape: 'circle',
    defaultDimensions: { radius: 5 },
    prompt: "Circle problem detected! Here's a visual to work with."
  },
  
  // 3D shapes
  cylinder_volume: {
    keywords: ['cylinder', 'volume', 'surface area', 'radius', 'height'],
    shape: 'cylinder',
    defaultDimensions: { height: 6, radius: 4 },
    prompt: "This seems to involve a cylinder. Does this match your problem?"
  },
  
  cone_volume: {
    keywords: ['cone', 'volume', 'surface area', 'radius', 'height'],
    shape: 'cone',
    defaultDimensions: { height: 5, radius: 3 },
    prompt: "Cone problem? Here's a 3D visualization."
  },

  // Additional templates
  probability_tree: {
    keywords: ['probability', 'tree diagram', 'outcomes', 'events', 'branches'],
    shape: 'probability_tree',
    defaultDimensions: { 
      events: ['First', 'Second'], 
      outcomes: [['A', 'B'], ['X', 'Y']] 
    },
    prompt: "This looks like a probability problem. Would this tree diagram help?"
  },
  
  bar_chart: {
    keywords: ['bar chart', 'bar graph', 'frequency', 'data', 'survey'],
    shape: 'bar_chart',
    defaultDimensions: { 
      categories: ['A', 'B', 'C', 'D'], 
      values: [10, 15, 8, 12],
      title: 'Data Chart'
    },
    prompt: "I see you're working with data. Here's a bar chart visualization."
  },
  
  coordinate_plane: {
    keywords: ['coordinate', 'graph', 'plot', 'x-axis', 'y-axis', 'cartesian'],
    shape: 'coordinate_plane',
    defaultDimensions: { 
      xRange: [-10, 10], 
      yRange: [-10, 10], 
      points: [],
      showGrid: true 
    },
    prompt: "Working with coordinates? Here's a coordinate plane."
  },
  
  linear_equation_graph: {
    keywords: ['linear equation', 'straight line', 'slope', 'y-intercept', 'gradient'],
    shape: 'linear_graph',
    defaultDimensions: { 
      slope: 2, 
      yIntercept: 3, 
      equation: 'y = 2x + 3' 
    },
    prompt: "Linear equation spotted! Here's the graphical representation."
  },
  
  factor_tree: {
    keywords: ['factor tree', 'prime factors', 'factorization', 'prime numbers'],
    shape: 'factor_tree',
    defaultDimensions: { 
      number: 60, 
      factors: [] 
    },
    prompt: "Need to find prime factors? Here's a factor tree structure."
  },
  
  number_line: {
    keywords: ['number line', 'integers', 'plot', 'negative'],
    shape: 'number_line',
    defaultDimensions: { min: -10, max: 10, highlights: [] },
    prompt: "Number line problem? Here's a visual reference."
  },
  
  // More comprehensive templates
  trapezium_area: {
    keywords: ['trapezium', 'trapezoid', 'parallel sides', 'area'],
    shape: 'trapezium',
    defaultDimensions: { topBase: 6, bottomBase: 10, height: 4 },
    prompt: "Trapezium area problem? Here's the shape with parallel sides."
  },

  rectangular_prism: {
    keywords: ['rectangular prism', 'cuboid', 'box', 'length width height'],
    shape: 'rectangular_prism',
    defaultDimensions: { length: 8, width: 6, height: 5 },
    prompt: "3D rectangular prism problem? Here's the visualization."
  },

  pie_chart: {
    keywords: ['pie chart', 'pie graph', 'sectors', 'percentage breakdown'],
    shape: 'pie_chart',
    defaultDimensions: { 
      segments: [
        { label: 'Red', value: 40, color: '#ff6b6b' },
        { label: 'Blue', value: 30, color: '#4ecdc4' },
        { label: 'Green', value: 20, color: '#45b7d1' },
        { label: 'Yellow', value: 10, color: '#f9ca24' }
      ]
    },
    prompt: "Pie chart needed? Here's a circular representation of your data."
  },

  coordinate_points: {
    keywords: ['plot points', 'coordinate plane', 'coordinates', 'cartesian'],
    shape: 'coordinate_points',
    defaultDimensions: { 
      points: [{x: 2, y: 3}, {x: -1, y: 4}, {x: 0, y: -2}],
      xRange: [-5, 5],
      yRange: [-5, 5]
    },
    prompt: "Plotting coordinates? Here's a coordinate plane ready for your points."
  },

  number_sequence: {
    keywords: ['sequence', 'pattern', 'next term', 'arithmetic sequence', 'nth term'],
    shape: 'number_sequence',
    defaultDimensions: { 
      sequence: [5, 11, 17, 23, 29],
      difference: 6,
      rule: '+6'
    },
    prompt: "Number sequence problem? Here's the pattern visualization."
  },

  isosceles_triangle: {
    keywords: ['isosceles triangle', 'base angles', 'equal sides'],
    shape: 'isosceles_triangle', 
    defaultDimensions: { baseAngles: 65, apexAngle: null },
    prompt: "Isosceles triangle problem? Here's the special triangle with equal sides."
  }
};

// Enhanced detection function
export const detectMathDiagram = (message) => {
  const msg = message.toLowerCase();
  
  // Extract numbers for dynamic dimensions
  const numbers = msg.match(/\b\d+(?:\.\d+)?\b/g)?.map(n => parseFloat(n)) || [];
  
  // Score each template
  const templateScores = Object.entries(DIAGRAM_TEMPLATES).map(([key, template]) => {
    let score = 0;
    
    // Keyword matching with weighted scoring
    template.keywords.forEach(keyword => {
      if (msg.includes(keyword.toLowerCase())) {
        // Give higher scores for exact matches
        if (msg.split(' ').includes(keyword.toLowerCase())) {
          score += 3; // Increased for exact word matches
        } else {
          score += 2; // Increased for partial matches
        }
      }
    });
    
    // Boost score significantly for specific combinations
    if (key === 'parallel_lines_angles' && msg.includes('parallel') && msg.includes('transversal')) {
      score += 5; // Major boost for parallel lines problems
    }
    if (key === 'triangle_angles' && msg.includes('triangle') && msg.includes('angle')) {
      score += 3; // Boost for triangle problems
    }
    
    // Boost score for specific mathematical symbols or notation
    const mathSymbols = {
      'equation': /[=]/g,
      'fraction': /\d+\/\d+/g,
      'percentage': /%/g,
      'angle': /°|degree/g,
      'coordinates': /\(\s*-?\d+\s*,\s*-?\d+\s*\)/g,
      'power': /\^|\*\*|²|³/g
    };
    
    Object.entries(mathSymbols).forEach(([concept, regex]) => {
      if (regex.test(msg) && template.keywords.some(k => k.includes(concept))) {
        score += 1;
      }
    });
    
    return { key, template, score };
  }).filter(t => t.score > 0)
    .sort((a, b) => b.score - a.score);
  
  if (templateScores.length === 0) return null;
  
  const bestMatch = templateScores[0];
  const { template } = bestMatch;
  
  // Create dimensions with extracted numbers where appropriate
  let dimensions = { ...template.defaultDimensions };
  
  // Enhanced smart number extraction
  if (template.shape === 'rectangle' && numbers.length >= 2) {
    dimensions.length = numbers[0];
    dimensions.width = numbers[1];
  } else if (template.shape === 'triangle' && numbers.length >= 2) {
    dimensions.base = numbers[0];
    dimensions.height = numbers[1];
  } else if (template.shape === 'circle' && numbers.length >= 1) {
    dimensions.radius = numbers[0];
  } else if ((template.shape === 'cylinder' || template.shape === 'cone') && numbers.length >= 2) {
    dimensions.radius = numbers[0];
    dimensions.height = numbers[1];
  } else if (template.shape === 'triangle_find_angle') {
    const angleMatches = msg.match(/(\d+)\s*(?:degree|°)/g);
    if (angleMatches) {
      const angles = angleMatches.map(m => parseInt(m.replace(/[^\d]/g, '')));
      dimensions.angle1 = angles[0] || null;
      dimensions.angle2 = angles[1] || null;
      dimensions.angle3 = angles[2] || null;
    }
  } else if (template.shape === 'linear_graph') {
    // Extract slope and y-intercept from equations like "y = 2x + 3"
    const equationMatch = msg.match(/y\s*=\s*([+-]?\d*\.?\d*)\s*x\s*([+-]\s*\d+\.?\d*)?/);
    if (equationMatch) {
      const slope = parseFloat(equationMatch[1]) || 1;
      const intercept = equationMatch[2] ? parseFloat(equationMatch[2].replace(/\s/g, '')) : 0;
      dimensions.slope = slope;
      dimensions.yIntercept = intercept;
      dimensions.equation = `y = ${slope}x ${intercept >= 0 ? '+' : ''}${intercept}`;
    }
  } else if (template.shape === 'factor_tree' && numbers.length >= 1) {
    dimensions.number = numbers[0];
  } else if (template.shape === 'fraction_bars' && numbers.length >= 2) {
    dimensions.numerator = numbers[0];
    dimensions.denominator = numbers[1];
  } else if (template.shape === 'bar_chart' && numbers.length >= 2) {
    dimensions.values = numbers.slice(0, 4);
  }
  
  return {
    template: bestMatch.key,
    shape: template.shape,
    dimensions,
    prompt: template.prompt,
    confidence: Math.min(bestMatch.score / Math.max(template.keywords.length, 3), 1)
  };
};

// Diagram popup component
export const DiagramPopup = ({ detection, onConfirm, onEdit, onDismiss, onUseWithoutDiagram }) => {
  if (!detection) return null;
  
  return (
    <div className="diagram-popup-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="diagram-popup" style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '700px',
        width: '95%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
          {detection.prompt}
        </h3>
        
        <div style={{
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <InlineGeometryCanvas 
            shape={detection.shape} 
            dimensions={detection.dimensions} 
          />
        </div>
        
        <div className="popup-buttons" style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          <button 
            onClick={() => onConfirm(detection)}
            style={{
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 20px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Use this diagram & ask
          </button>
          
          <button 
            onClick={() => onUseWithoutDiagram()}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 20px',
              cursor: 'pointer'
            }}
          >
            Ask without diagram
          </button>
          
          <button 
            onClick={() => onEdit(detection)}
            style={{
              backgroundColor: '#ffc107',
              color: '#212529',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 20px',
              cursor: 'pointer'
            }}
          >
            Edit diagram
          </button>
          
          <button 
            onClick={onDismiss}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 20px',
              cursor: 'pointer'
            }}
          >
            Dismiss
          </button>
        </div>
        
        <div style={{
          marginTop: '12px',
          fontSize: '12px',
          color: '#6c757d',
          textAlign: 'center'
        }}>
          Confidence: {Math.round(detection.confidence * 100)}% match
        </div>
      </div>
    </div>
  );
};