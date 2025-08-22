// src/components/InlineGeometryCanvas.js
import React from 'react';

const InlineGeometryCanvas = ({ shape, dimensions }) => {
  const renderCone = ({ height = 5, radius = 3 }) => {
    const scale = 15;
    const svgHeight = height * scale;
    const svgRadius = radius * scale;
    const centerX = 150;
    const centerY = 30;
    const baseY = centerY + svgHeight;

    return (
      <g>
        <path
          d={`M ${centerX} ${centerY} L ${centerX - svgRadius} ${baseY} A ${svgRadius} ${svgRadius/3} 0 0 0 ${centerX + svgRadius} ${baseY} Z`}
          fill="#ff69b4"
          stroke="#000"
          strokeWidth="1.5"
          opacity="0.7"
        />
        <ellipse
          cx={centerX}
          cy={baseY}
          rx={svgRadius}
          ry={svgRadius/3}
          fill="none"
          stroke="#000"
          strokeWidth="1.5"
          strokeDasharray="3,3"
        />
        <line x1={centerX} y1={centerY} x2={centerX} y2={baseY} stroke="#000" strokeWidth="1.5" />
        <line x1={centerX} y1={baseY} x2={centerX + svgRadius} y2={baseY} stroke="#000" strokeWidth="1.5" />
        <text x={centerX - 12} y={(centerY + baseY) / 2} fontSize="12" fontWeight="bold">
          {height}cm
        </text>
        <text x={centerX + svgRadius/2} y={baseY + 15} fontSize="12" fontWeight="bold">
          {radius}cm
        </text>
        <rect x={centerX - 6} y={baseY - 6} width="6" height="6" fill="none" stroke="#000" strokeWidth="1" />
      </g>
    );
  };

  const renderAnglesOnLine = ({ knownAngles = [45, 90], total = 180, isAroundPoint = false }) => {
    const centerX = 150;
    const centerY = 80;
    const armLength = 60;
    
    // Calculate missing angle
    const knownSum = knownAngles.reduce((sum, angle) => sum + angle, 0);
    const missingAngle = total - knownSum;
    const allAngles = [...knownAngles, missingAngle];
    
    // Sort angles for proper display
    allAngles.sort((a, b) => a - b);
    
    if (isAroundPoint) {
      // Angles around a point visualization
      return (
        <g>
          <circle cx={centerX} cy={centerY} r="3" fill="#333" />
          <text x={centerX} y={centerY + 20} textAnchor="middle" fontSize="12" fontWeight="bold">
            Center Point
          </text>
          <text x={centerX} y={centerY + 35} textAnchor="middle" fontSize="11" fill="#666">
            Angles around a point = 360°
          </text>
          <text x={centerX} y={centerY + 50} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#d63384">
            Missing angle = {total}° - {knownSum}° = {missingAngle}°
          </text>
        </g>
      );
    } else {
      // Angles on a straight line (L-shape scenario)
      return (
        <g>
          {/* Base horizontal line */}
          <line 
            x1={centerX - armLength} 
            y1={centerY} 
            x2={centerX + armLength} 
            y2={centerY} 
            stroke="#333" 
            strokeWidth="3" 
          />
          
          {/* Vertical line forming the L-shape */}
          <line 
            x1={centerX} 
            y1={centerY} 
            x2={centerX} 
            y2={centerY - armLength} 
            stroke="#333" 
            strokeWidth="3" 
          />
          
          {/* Additional angled line if we have more than 2 angles */}
          {allAngles.length > 2 && (
            <line 
              x1={centerX} 
              y1={centerY} 
              x2={centerX + armLength * 0.7} 
              y2={centerY - armLength * 0.7} 
              stroke="#333" 
              strokeWidth="3" 
            />
          )}
          
          {/* Right angle indicator */}
          <rect
            x={centerX + 8}
            y={centerY - 8}
            width="8"
            height="8"
            fill="none"
            stroke="#e53e3e"
            strokeWidth="2"
          />
          
          {/* Angle A (45 degrees) */}
          <path
            d={`M ${centerX + 25} ${centerY} A 25 25 0 0 0 ${centerX + 25 * Math.cos(Math.PI/4)} ${centerY - 25 * Math.sin(Math.PI/4)}`}
            fill="none"
            stroke="#e53e3e"
            strokeWidth="2"
          />
          <text x={centerX + 30} y={centerY - 10} fontSize="12" fontWeight="bold" fill="#e53e3e">
            A = {knownAngles[0]}°
          </text>
          
          {/* Angle B (the missing angle) */}
          <path
            d={`M ${centerX + 15 * Math.cos(Math.PI/4)} ${centerY - 15 * Math.sin(Math.PI/4)} A 15 15 0 0 0 ${centerX} ${centerY - 15}`}
            fill="none"
            stroke="#d63384"
            strokeWidth="3"
          />
          <text x={centerX + 5} y={centerY - 25} fontSize="12" fontWeight="bold" fill="#d63384">
            B = ?
          </text>
          
          {/* Straight line indicator */}
          <text x={centerX - 40} y={centerY - 15} fontSize="10" fill="#666">
            Straight line
          </text>
          <line x1={centerX - 50} y1={centerY} x2={centerX - 35} y2={centerY} stroke="#666" strokeWidth="1" />
          
          {/* Vertex point */}
          <circle cx={centerX} cy={centerY} r="3" fill="#333" />
          
          {/* Calculation explanation */}
          <text x={centerX} y={centerY + 30} textAnchor="middle" fontSize="11" fill="#666">
            Angles on a straight line = 180°
          </text>
          <text x={centerX} y={centerY + 45} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#d63384">
            B = 180° - 90° - {knownAngles[0]}° = {missingAngle}°
          </text>
        </g>
      );
    }
  };

  const renderSingleAngle = ({ angle = 90, isRightAngle = false }) => {
    const centerX = 150;
    const centerY = 80;
    const armLength = 60;
    
    const angleRad = (angle * Math.PI) / 180;
    const arm1End = { x: centerX + armLength, y: centerY };
    const arm2End = { 
      x: centerX + armLength * Math.cos(angleRad), 
      y: centerY - armLength * Math.sin(angleRad) 
    };
    
    return (
      <g>
        <line 
          x1={centerX - 20} 
          y1={centerY} 
          x2={arm1End.x} 
          y2={arm1End.y} 
          stroke="#333" 
          strokeWidth="2" 
        />
        <line 
          x1={centerX} 
          y1={centerY} 
          x2={arm2End.x} 
          y2={arm2End.y} 
          stroke="#333" 
          strokeWidth="2" 
        />
        <path
          d={`M ${centerX + 30} ${centerY} A 30 30 0 0 0 ${centerX + 30 * Math.cos(angleRad)} ${centerY - 30 * Math.sin(angleRad)}`}
          fill="none"
          stroke="#e53e3e"
          strokeWidth="2"
        />
        <text 
          x={centerX + 35} 
          y={centerY - 15} 
          fontSize="14" 
          fontWeight="bold" 
          fill="#e53e3e"
        >
          {angle}°
        </text>
        {isRightAngle && (
          <rect
            x={centerX + 15}
            y={centerY - 15}
            width="15"
            height="15"
            fill="none"
            stroke="#e53e3e"
            strokeWidth="2"
          />
        )}
        <circle cx={centerX} cy={centerY} r="3" fill="#333" />
        <text x={centerX} y={centerY + 20} textAnchor="middle" fontSize="12" fontWeight="bold">
          Vertex
        </text>
        {isRightAngle && (
          <text x={centerX} y={centerY + 35} textAnchor="middle" fontSize="11" fill="#666">
            Right Angle (90°)
          </text>
        )}
      </g>
    );
  };

  const renderParallelLines = ({ showAngles = true, highlightAlternate = false }) => {
    const line1Y = 60;
    const line2Y = 120;
    const intersection1 = { x: 100, y: line1Y };
    const intersection2 = { x: 180, y: line2Y };
    
    return (
      <g>
        <line x1="30" y1={line1Y} x2="270" y2={line1Y} stroke="#0066cc" strokeWidth="2" />
        <line x1="30" y1={line2Y} x2="270" y2={line2Y} stroke="#0066cc" strokeWidth="2" />
        <line x1="50" y1="40" x2="250" y2="140" stroke="#cc0066" strokeWidth="2" />
        
        <text x="40" y={line1Y - 10} fontSize="12" fontWeight="bold" fill="#0066cc">line 1</text>
        <text x="40" y={line2Y - 10} fontSize="12" fontWeight="bold" fill="#0066cc">line 2</text>
        <text x="55" y="35" fontSize="12" fontWeight="bold" fill="#cc0066">transversal</text>
        
        {showAngles && (
          <g>
            <text x={intersection1.x - 30} y={intersection1.y - 15} fontSize="10" fontWeight="bold">a</text>
            <text x={intersection1.x + 15} y={intersection1.y - 15} fontSize="10" fontWeight="bold">b</text>
            <text x={intersection1.x + 15} y={intersection1.y + 20} fontSize="10" fontWeight="bold">c</text>
            <text x={intersection1.x - 30} y={intersection1.y + 20} fontSize="10" fontWeight="bold">d</text>
            
            <text x={intersection2.x - 30} y={intersection2.y - 15} fontSize="10" fontWeight="bold">e</text>
            <text x={intersection2.x + 15} y={intersection2.y - 15} fontSize="10" fontWeight="bold">f</text>
            <text x={intersection2.x + 15} y={intersection2.y + 20} fontSize="10" fontWeight="bold">g</text>
            <text x={intersection2.x - 30} y={intersection2.y + 20} fontSize="10" fontWeight="bold">h</text>
            
            {highlightAlternate && (
              <g>
                <circle cx={intersection1.x - 15} cy={intersection1.y - 8} r="3" fill="#ff6b6b" opacity="0.7" />
                <circle cx={intersection2.x + 15} cy={intersection2.y + 8} r="3" fill="#ff6b6b" opacity="0.7" />
                <text x="40" y="150" fontSize="11" fill="#ff6b6b" fontWeight="bold">Alternate angles: a = g, c = e</text>
              </g>
            )}
          </g>
        )}
      </g>
    );
  };

  const renderTriangleFindAngle = ({ angle1, angle2, angle3 }) => {
    const centerX = 150;
    const bottomY = 130;
    const sideLength = 80;
    const height = 70;
    const topY = bottomY - height;
    
    let angles = [angle1, angle2, angle3];
    let missingIndex = -1;
    let knownSum = 0;
    
    for (let i = 0; i < 3; i++) {
      if (angles[i] === null) {
        missingIndex = i;
      } else {
        knownSum += angles[i];
      }
    }
    
    if (missingIndex !== -1) {
      angles[missingIndex] = 180 - knownSum;
    }
    
    return (
      <g>
        <polygon
          points={`${centerX},${topY} ${centerX - sideLength/2},${bottomY} ${centerX + sideLength/2},${bottomY}`}
          fill="#fff3cd"
          stroke="#000"
          strokeWidth="2"
          opacity="0.7"
        />
        <text x={centerX} y={topY + 30} textAnchor="middle" fontSize="12" fontWeight="bold" 
              fill={missingIndex === 0 ? "#d63384" : "#e53e3e"}>
          {missingIndex === 0 ? `?` : `${angles[0]}°`}
        </text>
        <text x={centerX - sideLength/2 + 20} y={bottomY - 20} fontSize="12" fontWeight="bold" 
              fill={missingIndex === 1 ? "#d63384" : "#e53e3e"}>
          {missingIndex === 1 ? `?` : `${angles[1]}°`}
        </text>
        <text x={centerX + sideLength/2 - 25} y={bottomY - 20} fontSize="12" fontWeight="bold" 
              fill={missingIndex === 2 ? "#d63384" : "#e53e3e"}>
          {missingIndex === 2 ? `?` : `${angles[2]}°`}
        </text>
        {missingIndex !== -1 && (
          <text x={centerX} y={bottomY + 25} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#d63384">
            Missing angle = 180° - {knownSum}° = {angles[missingIndex]}°
          </text>
        )}
      </g>
    );
  };

  const renderShape = () => {
    switch (shape) {
      case 'angles_on_line':
        return renderAnglesOnLine(dimensions);
      case 'single_angle':
        return renderSingleAngle(dimensions);
      case 'triangle_find_angle':
        return renderTriangleFindAngle(dimensions);
      case 'parallel_lines':
        return renderParallelLines(dimensions);
      case 'cone':
        return renderCone(dimensions);
      default:
        return <text x="150" y="100" textAnchor="middle" fontSize="14">Shape not supported yet</text>;
    }
  };

  const getFormula = () => {
    switch (shape) {
      case 'angles_on_line':
        return dimensions.isAroundPoint ? 'Angles around a point = 360°' : 'Angles on a straight line = 180°';
      case 'single_angle':
        return dimensions.isRightAngle ? 'A right angle measures exactly 90°' : `This angle measures ${dimensions.angle}°`;
      case 'triangle_find_angle':
        return 'Sum of angles in any triangle = 180°. Use this to find missing angles.';
      case 'parallel_lines':
        return 'When parallel lines are cut by a transversal: alternate angles are equal, corresponding angles are equal';
      case 'cone':
        return 'Volume = (1/3) × π × r² × h';
      default:
        return '';
    }
  };

  return (
    <div style={{
      backgroundColor: '#f8f9fa',
      border: '1px solid #e9ecef',
      borderRadius: '8px',
      padding: '12px',
      margin: '8px 0',
      maxWidth: '320px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        fontSize: '14px',
        fontWeight: '600',
        marginBottom: '8px',
        textAlign: 'center',
        color: '#495057'
      }}>
        {shape.charAt(0).toUpperCase() + shape.slice(1).replace('_', ' ')} Diagram
      </div>
      
      <div style={{
        backgroundColor: 'white',
        borderRadius: '4px',
        padding: '8px',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <svg width="300" height="160" style={{ border: '1px solid #dee2e6', borderRadius: '4px' }}>
          {renderShape()}
        </svg>
      </div>
      
      <div style={{
        fontSize: '12px',
        color: '#6c757d',
        marginTop: '8px',
        textAlign: 'center',
        fontWeight: '500'
      }}>
        {getFormula()}
      </div>
    </div>
  );
};

export default InlineGeometryCanvas;