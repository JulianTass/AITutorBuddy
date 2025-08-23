// src/components/InlineGeometryCanvas.js - Extended version with all diagram types
import React from 'react';

const InlineGeometryCanvas = ({ shape, dimensions }) => {
  // Original render functions (keeping your existing ones)
  const renderCone = ({ height = 5, radius = 3 }) => {
    const scale = 15;
    const svgHeight = height * scale;
    const svgRadius = radius * scale;
    const centerX = 200;
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

  const renderCylinder = ({ height = 6, radius = 4 }) => {
    const scale = 15;
    const svgHeight = height * scale;
    const svgRadius = radius * scale;
    const centerX = 150;
    const topY = 80;
    const bottomY = topY + svgHeight;

    return (
      <g>
        <rect
          x={centerX - svgRadius}
          y={topY}
          width={svgRadius * 2}
          height={svgHeight}
          fill="#87ceeb"
          stroke="#000"
          strokeWidth="2"
          opacity="0.7"
        />
        <ellipse cx={centerX} cy={topY} rx={svgRadius} ry={svgRadius/3} fill="#add8e6" stroke="#000" strokeWidth="2" />
        <ellipse cx={centerX} cy={bottomY} rx={svgRadius} ry={svgRadius/3} fill="#add8e6" stroke="#000" strokeWidth="2" />
        <line x1={centerX - svgRadius - 20} y1={topY} x2={centerX - svgRadius - 20} y2={bottomY} stroke="#000" strokeWidth="2" />
        <line x1={centerX} y1={bottomY} x2={centerX + svgRadius} y2={bottomY} stroke="#000" strokeWidth="2" />
        <text x={centerX - svgRadius - 40} y={(topY + bottomY) / 2} fontSize="12" fontWeight="bold">
          {height}cm
        </text>
        <text x={centerX + svgRadius/2} y={bottomY + 20} fontSize="12" fontWeight="bold">
          {radius}cm
        </text>
      </g>
    );
  };

  const renderRectangle = ({ length = 8, width = 5 }) => {
    const scale = 20;
    const svgLength = length * scale;
    const svgWidth = width * scale;
    const startX = (300 - svgLength) / 2;
    const startY = (160 - svgWidth) / 2;

    return (
      <g>
        <rect
          x={startX}
          y={startY}
          width={svgLength}
          height={svgWidth}
          fill="#98fb98"
          stroke="#000"
          strokeWidth="2"
          opacity="0.7"
        />
        <text x={startX + svgLength/2} y={startY - 10} textAnchor="middle" fontSize="12" fontWeight="bold">
          {length}cm
        </text>
        <text x={startX - 20} y={startY + svgWidth/2} textAnchor="middle" fontSize="12" fontWeight="bold" 
              transform={`rotate(-90, ${startX - 20}, ${startY + svgWidth/2})`}>
          {width}cm
        </text>
      </g>
    );
  };

  const renderTriangle = ({ base = 8, height = 6 }) => {
    const scale = 20;
    const svgBase = base * scale;
    const svgHeight = height * scale;
    const centerX = 150;
    const bottomY = 120;
    const topY = bottomY - svgHeight;

    return (
      <g>
        <polygon
          points={`${centerX},${topY} ${centerX - svgBase/2},${bottomY} ${centerX + svgBase/2},${bottomY}`}
          fill="#ffd700"
          stroke="#000"
          strokeWidth="2"
          opacity="0.7"
        />
        <line x1={centerX} y1={topY} x2={centerX} y2={bottomY} stroke="#000" strokeWidth="2" strokeDasharray="3,3" />
        <text x={centerX} y={bottomY + 20} textAnchor="middle" fontSize="12" fontWeight="bold">
          {base}cm
        </text>
        <text x={centerX - 20} y={(topY + bottomY)/2} fontSize="12" fontWeight="bold">
          {height}cm
        </text>
        <rect x={centerX - 8} y={bottomY - 8} width="8" height="8" fill="none" stroke="#000" strokeWidth="1" />
      </g>
    );
  };

  const renderCircle = ({ radius = 5 }) => {
    const scale = 15;
    const svgRadius = radius * scale;
    const centerX = 200;
    const centerY = 100;

    return (
      <g>
        <circle cx={centerX} cy={centerY} r={svgRadius} fill="#ff9999" stroke="#000" strokeWidth="2" opacity="0.7" />
        <line x1={centerX} y1={centerY} x2={centerX + svgRadius} y2={centerY} stroke="#000" strokeWidth="2" />
        <text x={centerX + svgRadius/2} y={centerY - 10} textAnchor="middle" fontSize="12" fontWeight="bold">
          {radius}cm
        </text>
        <circle cx={centerX} cy={centerY} r="3" fill="#000" />
      </g>
    );
  };

  const renderTriangleInequality = ({ knownSides = [3, 3], unknownVariable = 'x' }) => {
    const [side1, side2] = knownSides;
    const minLength = Math.abs(side1 - side2);
    const maxLength = side1 + side2;
    
    const centerX = 150;
    const bottomY = 130;
    
    return (
      <g>
        <text x={centerX} y={30} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#333">
          Triangle Inequality Rule
        </text>
        <text x={centerX} y={50} textAnchor="middle" fontSize="12" fill="#666">
          The sum of any two sides must be greater than the third side
        </text>
        <text x={centerX} y={bottomY} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#d63384">
          {minLength} &lt; {unknownVariable} &lt; {maxLength}
        </text>
      </g>
    );
  };

  const renderAnglesOnLine = ({ knownAngles = [45, 90], total = 180, isAroundPoint = false }) => {
    const centerX = 150;
    const centerY = 80;
    const armLength = 60;
    
    const knownSum = knownAngles.reduce((sum, angle) => sum + angle, 0);
    const missingAngle = total - knownSum;
    
    if (isAroundPoint) {
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
      return (
        <g>
          <line 
            x1={centerX - armLength} 
            y1={centerY} 
            x2={centerX + armLength} 
            y2={centerY} 
            stroke="#333" 
            strokeWidth="3" 
          />
          <line 
            x1={centerX} 
            y1={centerY} 
            x2={centerX} 
            y2={centerY - armLength} 
            stroke="#333" 
            strokeWidth="3" 
          />
          <rect
            x={centerX + 8}
            y={centerY - 8}
            width="8"
            height="8"
            fill="none"
            stroke="#e53e3e"
            strokeWidth="2"
          />
          <text x={centerX + 30} y={centerY - 10} fontSize="12" fontWeight="bold" fill="#e53e3e">
            A = {knownAngles[0]}°
          </text>
          <text x={centerX + 5} y={centerY - 25} fontSize="12" fontWeight="bold" fill="#d63384">
            B = ?
          </text>
          <circle cx={centerX} cy={centerY} r="3" fill="#333" />
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
      </g>
    );
  };

  const renderParallelLines = ({ showAngles = true, highlightAlternate = false }) => {
    const line1Y = 70;
    const line2Y = 130;
    
    return (
      <g>
        <line x1="40" y1={line1Y} x2="360" y2={line1Y} stroke="#0066cc" strokeWidth="3" />
        <line x1="40" y1={line2Y} x2="360" y2={line2Y} stroke="#0066cc" strokeWidth="3" />
        <line x1="80" y1="30" x2="320" y2="170" stroke="#cc0066" strokeWidth="3" />
        
        <text x="50" y={line1Y - 10} fontSize="14" fontWeight="bold" fill="#0066cc">line 1</text>
        <text x="50" y={line2Y - 10} fontSize="14" fontWeight="bold" fill="#0066cc">line 2</text>
        <text x="90" y="25" fontSize="14" fontWeight="bold" fill="#cc0066">transversal</text>
        
        {showAngles && (
          <g>
            <text x="120" y="65" fontSize="12" fontWeight="bold">a</text>
            <text x="155" y="65" fontSize="12" fontWeight="bold">b</text>
            <text x="155" y="85" fontSize="12" fontWeight="bold">c</text>
            <text x="120" y="85" fontSize="12" fontWeight="bold">d</text>
            
            <text x="220" y="115" fontSize="12" fontWeight="bold">e</text>
            <text x="255" y="115" fontSize="12" fontWeight="bold">f</text>
            <text x="255" y="145" fontSize="12" fontWeight="bold">g</text>
            <text x="220" y="145" fontSize="12" fontWeight="bold">h</text>
            
            {highlightAlternate && (
              <text x="50" y="190" fontSize="12" fill="#ff6b6b" fontWeight="bold">
                Alternate angles: a = g, c = e
              </text>
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

  // New render functions for additional diagram types
  const renderBarChart = ({ categories = ['A', 'B', 'C', 'D'], values = [10, 15, 8, 12], title = 'Data Chart' }) => {
    const maxValue = Math.max(...values);
    const scale = 120 / maxValue;
    const barWidth = 40;
    const spacing = 15;
    const startX = 80;
    const baseY = 170;
    
    return (
      <g>
        <text x={200} y={25} textAnchor="middle" fontSize="16" fontWeight="bold">{title}</text>
        
        <line x1={startX - 10} y1={baseY} x2={startX + categories.length * (barWidth + spacing)} y2={baseY} stroke="#333" strokeWidth="2" />
        <line x1={startX - 10} y1={baseY} x2={startX - 10} y2={baseY - 140} stroke="#333" strokeWidth="2" />
        
        {categories.map((category, i) => (
          <g key={i}>
            <rect
              x={startX + i * (barWidth + spacing)}
              y={baseY - values[i] * scale}
              width={barWidth}
              height={values[i] * scale}
              fill={`hsl(${i * 60}, 70%, 60%)`}
              stroke="#000"
              strokeWidth="1"
            />
            <text
              x={startX + i * (barWidth + spacing) + barWidth/2}
              y={baseY + 20}
              textAnchor="middle"
              fontSize="14"
              fontWeight="bold"
            >
              {category}
            </text>
            <text
              x={startX + i * (barWidth + spacing) + barWidth/2}
              y={baseY - values[i] * scale - 8}
              textAnchor="middle"
              fontSize="12"
              fontWeight="bold"
            >
              {values[i]}
            </text>
          </g>
        ))}
      </g>
    );
  };

  const renderCoordinatePlane = ({ xRange = [-5, 5], yRange = [-5, 5] }) => {
    const centerX = 150;
    const centerY = 80;
    const scale = 15;
    
    return (
      <g>
        <line x1={50} y1={centerY} x2={250} y2={centerY} stroke="#333" strokeWidth="2" />
        <line x1={centerX} y1={20} x2={centerX} y2={140} stroke="#333" strokeWidth="2" />
        
        <text x={250} y={centerY - 10} fontSize="12" fontWeight="bold">x</text>
        <text x={centerX + 10} y={25} fontSize="12" fontWeight="bold">y</text>
        
        <text x={centerX} y={15} textAnchor="middle" fontSize="12" fontWeight="bold">Coordinate Plane</text>
      </g>
    );
  };

  const renderTrapezium = ({ topBase = 6, bottomBase = 10, height = 4 }) => {
    const scale = 18;
    const svgTopBase = topBase * scale;
    const svgBottomBase = bottomBase * scale;
    const svgHeight = height * scale;
    const centerX = 200;
    const bottomY = 140;
    const topY = bottomY - svgHeight;

    return (
      <g>
        <polygon
          points={`${centerX - svgTopBase/2},${topY} ${centerX + svgTopBase/2},${topY} ${centerX + svgBottomBase/2},${bottomY} ${centerX - svgBottomBase/2},${bottomY}`}
          fill="#dda0dd"
          stroke="#000"
          strokeWidth="2"
          opacity="0.7"
        />
        <line x1={centerX - svgBottomBase/2 - 25} y1={topY} x2={centerX - svgBottomBase/2 - 25} y2={bottomY} stroke="#000" strokeWidth="2" />
        <text x={centerX} y={topY - 10} textAnchor="middle" fontSize="12" fontWeight="bold">
          {topBase}cm
        </text>
        <text x={centerX} y={bottomY + 20} textAnchor="middle" fontSize="12" fontWeight="bold">
          {bottomBase}cm
        </text>
        <text x={centerX - svgBottomBase/2 - 40} y={(topY + bottomY)/2} fontSize="12" fontWeight="bold">
          {height}cm
        </text>
      </g>
    );
  };

  const renderRectangularPrism = ({ length = 8, width = 6, height = 5 }) => {
    const scale = 15;
    const centerX = 200;
    const centerY = 100;
    
    return (
      <g>
        {/* Front face */}
        <rect x={centerX - 60} y={centerY - 30} width={length * scale} height={width * scale} 
              fill="#87ceeb" stroke="#000" strokeWidth="2" opacity="0.7" />
        
        {/* Top face */}
        <polygon points={`${centerX - 60},${centerY - 30} ${centerX - 40},${centerY - 50} ${centerX - 40 + length * scale},${centerY - 50} ${centerX - 60 + length * scale},${centerY - 30}`}
                 fill="#add8e6" stroke="#000" strokeWidth="2" opacity="0.8" />
        
        {/* Right face */}
        <polygon points={`${centerX - 60 + length * scale},${centerY - 30} ${centerX - 40 + length * scale},${centerY - 50} ${centerX - 40 + length * scale},${centerY - 50 + width * scale} ${centerX - 60 + length * scale},${centerY - 30 + width * scale}`}
                 fill="#6fa8dc" stroke="#000" strokeWidth="2" opacity="0.8" />
        
        <text x={centerX - 30} y={centerY + width * scale + 20} textAnchor="middle" fontSize="12" fontWeight="bold">
          {length} × {width} × {height}
        </text>
      </g>
    );
  };

  const renderPieChart = ({ segments = [] }) => {
    const centerX = 200;
    const centerY = 100;
    const radius = 60;
    let currentAngle = -90; // Start from top
    
    return (
      <g>
        <text x={centerX} y={30} textAnchor="middle" fontSize="14" fontWeight="bold">Pie Chart</text>
        
        {segments.map((segment, i) => {
          const angle = (segment.value / 100) * 360;
          const startAngle = currentAngle * Math.PI / 180;
          const endAngle = (currentAngle + angle) * Math.PI / 180;
          
          const x1 = centerX + radius * Math.cos(startAngle);
          const y1 = centerY + radius * Math.sin(startAngle);
          const x2 = centerX + radius * Math.cos(endAngle);
          const y2 = centerY + radius * Math.sin(endAngle);
          
          const largeArc = angle > 180 ? 1 : 0;
          
          const pathData = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
          
          const labelAngle = (currentAngle + angle/2) * Math.PI / 180;
          const labelX = centerX + (radius * 0.7) * Math.cos(labelAngle);
          const labelY = centerY + (radius * 0.7) * Math.sin(labelAngle);
          
          currentAngle += angle;
          
          return (
            <g key={i}>
              <path d={pathData} fill={segment.color} stroke="#000" strokeWidth="1" />
              <text x={labelX} y={labelY} textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">
                {segment.value}%
              </text>
            </g>
          );
        })}
        
        {/* Legend */}
        {segments.map((segment, i) => (
          <g key={`legend-${i}`}>
            <rect x={320} y={60 + i * 20} width={12} height={12} fill={segment.color} stroke="#000" />
            <text x={340} y={72 + i * 20} fontSize="11" fontWeight="bold">{segment.label}</text>
          </g>
        ))}
      </g>
    );
  };

  const renderCoordinatePoints = ({ points = [], xRange = [-5, 5], yRange = [-5, 5] }) => {
    const centerX = 200;
    const centerY = 100;
    const scale = 20;
    
    return (
      <g>
        {/* Grid */}
        {Array.from({length: xRange[1] - xRange[0] + 1}, (_, i) => xRange[0] + i).map(x => (
          <line key={`vgrid-${x}`} x1={centerX + x * scale} y1={centerY + yRange[0] * scale} 
                x2={centerX + x * scale} y2={centerY + yRange[1] * scale} stroke="#e0e0e0" strokeWidth="1" />
        ))}
        {Array.from({length: yRange[1] - yRange[0] + 1}, (_, i) => yRange[0] + i).map(y => (
          <line key={`hgrid-${y}`} x1={centerX + xRange[0] * scale} y1={centerY - y * scale} 
                x2={centerX + xRange[1] * scale} y2={centerY - y * scale} stroke="#e0e0e0" strokeWidth="1" />
        ))}
        
        {/* Axes */}
        <line x1={centerX + xRange[0] * scale} y1={centerY} x2={centerX + xRange[1] * scale} y2={centerY} stroke="#333" strokeWidth="2" />
        <line x1={centerX} y1={centerY + yRange[0] * scale} x2={centerX} y2={centerY + yRange[1] * scale} stroke="#333" strokeWidth="2" />
        
        {/* Points */}
        {points.map((point, i) => (
          <g key={i}>
            <circle cx={centerX + point.x * scale} cy={centerY - point.y * scale} r="4" fill="#e53e3e" />
            <text x={centerX + point.x * scale + 10} y={centerY - point.y * scale - 10} fontSize="11" fontWeight="bold">
              ({point.x},{point.y})
            </text>
          </g>
        ))}
        
        <text x={centerX} y={20} textAnchor="middle" fontSize="12" fontWeight="bold">Coordinate Points</text>
      </g>
    );
  };

  const renderNumberSequence = ({ sequence = [5, 11, 17, 23, 29], rule = '+6' }) => {
    const startX = 50;
    const y = 100;
    const spacing = 60;
    
    return (
      <g>
        <text x={200} y={30} textAnchor="middle" fontSize="14" fontWeight="bold">Number Sequence</text>
        
        {sequence.map((num, i) => (
          <g key={i}>
            <rect x={startX + i * spacing - 15} y={y - 15} width="30" height="30" 
                  fill="#fff3cd" stroke="#000" strokeWidth="2" />
            <text x={startX + i * spacing} y={y + 5} textAnchor="middle" fontSize="12" fontWeight="bold">
              {num}
            </text>
            
            {i < sequence.length - 1 && (
              <>
                <line x1={startX + i * spacing + 15} y1={y} x2={startX + (i + 1) * spacing - 15} y2={y} 
                      stroke="#666" strokeWidth="2" markerEnd="url(#arrowhead)" />
                <text x={startX + i * spacing + 30} y={y - 20} textAnchor="middle" fontSize="10" fill="#666">
                  {rule}
                </text>
              </>
            )}
          </g>
        ))}
        
        <text x={200} y={150} textAnchor="middle" fontSize="11" fill="#666">
          Pattern: Each term increases by {rule.replace('+', '')}
        </text>
      </g>
    );
  };

  const renderIsoscelesTriangle = ({ baseAngles = 65, apexAngle = null }) => {
    const centerX = 200;
    const bottomY = 140;
    const sideLength = 80;
    const height = 70;
    const topY = bottomY - height;
    
    const calculatedApex = apexAngle || (180 - 2 * baseAngles);
    
    return (
      <g>
        <polygon
          points={`${centerX},${topY} ${centerX - sideLength/2},${bottomY} ${centerX + sideLength/2},${bottomY}`}
          fill="#e8f4fd"
          stroke="#000"
          strokeWidth="2"
          opacity="0.7"
        />
        
        {/* Equal sides markers */}
        <line x1={centerX - 10} y1={topY + 25} x2={centerX - 5} y2={topY + 20} stroke="#e53e3e" strokeWidth="2" />
        <line x1={centerX + 5} y1={topY + 20} x2={centerX + 10} y2={topY + 25} stroke="#e53e3e" strokeWidth="2" />
        
        <text x={centerX} y={topY - 10} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#e53e3e">
          {calculatedApex}°
        </text>
        <text x={centerX - sideLength/2 + 15} y={bottomY - 10} fontSize="12" fontWeight="bold" fill="#4CAF50">
          {baseAngles}°
        </text>
        <text x={centerX + sideLength/2 - 15} y={bottomY - 10} fontSize="12" fontWeight="bold" fill="#4CAF50">
          {baseAngles}°
        </text>
        
        <text x={centerX} y={bottomY + 30} textAnchor="middle" fontSize="11" fill="#666">
          Isosceles Triangle - Equal base angles
        </text>
      </g>
    );
  };

  const renderFractionBars = ({ numerator = 3, denominator = 4 }) => {
    const barWidth = 180;
    const barHeight = 30;
    const startX = 110;
    const startY = 80;
    const partWidth = barWidth / denominator;
    
    return (
      <g>
        <text x={200} y={50} textAnchor="middle" fontSize="14" fontWeight="bold">
          Fraction: {numerator}/{denominator}
        </text>
        
        <rect x={startX} y={startY} width={barWidth} height={barHeight} fill="#fff" stroke="#333" strokeWidth="2" />
        
        {Array.from({length: denominator}, (_, i) => (
          <g key={i}>
            <line x1={startX + (i + 1) * partWidth} y1={startY} x2={startX + (i + 1) * partWidth} y2={startY + barHeight} stroke="#333" strokeWidth="1" />
            <rect
              x={startX + i * partWidth + 1}
              y={startY + 1}
              width={partWidth - 2}
              height={barHeight - 2}
              fill={i < numerator ? "#4CAF50" : "#fff"}
              opacity="0.7"
            />
          </g>
        ))}
        
        <text x={200} y={startY + barHeight + 25} textAnchor="middle" fontSize="12" fill="#666">
          {numerator} out of {denominator} parts shaded
        </text>
      </g>
    );
  };

  const renderShape = () => {
    switch (shape) {
      case 'triangle_inequality':
        return renderTriangleInequality(dimensions);
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
      case 'cylinder':
        return renderCylinder(dimensions);
      case 'rectangle':
        return renderRectangle(dimensions);
      case 'triangle':
        return renderTriangle(dimensions);
      case 'circle':
        return renderCircle(dimensions);
      case 'bar_chart':
        return renderBarChart(dimensions);
      case 'coordinate_plane':
        return renderCoordinatePlane(dimensions);
      case 'trapezium':
        return renderTrapezium(dimensions);
      case 'rectangular_prism':
        return renderRectangularPrism(dimensions);
      case 'pie_chart':
        return renderPieChart(dimensions);
      case 'coordinate_points':
        return renderCoordinatePoints(dimensions);
      case 'number_sequence':
        return renderNumberSequence(dimensions);
      case 'isosceles_triangle':
        return renderIsoscelesTriangle(dimensions);
      case 'fraction_bars':
        return renderFractionBars(dimensions);
      default:
        return <text x="150" y="80" textAnchor="middle" fontSize="14">Shape not supported yet</text>;
    }
  };

  const getFormula = () => {
    switch (shape) {
      case 'triangle_inequality':
        return 'Triangle Inequality: The sum of any two sides must be greater than the third side';
      case 'angles_on_line':
        return dimensions?.isAroundPoint ? 'Angles around a point = 360°' : 'Angles on a straight line = 180°';
      case 'single_angle':
        return dimensions?.isRightAngle ? 'A right angle measures exactly 90°' : `This angle measures ${dimensions?.angle || 90}°`;
      case 'triangle_find_angle':
        return 'Sum of angles in any triangle = 180°. Use this to find missing angles.';
      case 'parallel_lines':
        return 'When parallel lines are cut by a transversal: alternate angles are equal, corresponding angles are equal';
      case 'cone':
        return 'Volume = (1/3) × π × r² × h';
      case 'cylinder':
        return 'Volume = π × r² × h';
      case 'rectangle':
        return 'Area = length × width';
      case 'triangle':
        return 'Area = (1/2) × base × height';
      case 'circle':
        return 'Area = π × r²';
      case 'bar_chart':
        return 'Bar charts compare quantities across different categories';
      case 'coordinate_plane':
        return 'The coordinate plane uses (x,y) coordinates to locate points';
      case 'trapezium':
        return 'Area = (1/2) × (a + b) × h where a and b are parallel sides';
      case 'rectangular_prism':
        return `Volume = length × width × height = ${dimensions?.length || 8} × ${dimensions?.width || 6} × ${dimensions?.height || 5}`;
      case 'pie_chart':
        return 'Pie charts show data as percentages of a whole circle (360°)';
      case 'coordinate_points':
        return 'Points are plotted using (x,y) coordinates on the Cartesian plane';
      case 'number_sequence':
        return `Arithmetic sequence: each term = previous term ${dimensions?.rule || '+6'}`;
      case 'isosceles_triangle':
        return 'Isosceles triangle: two equal sides and two equal base angles';
      case 'fraction_bars':
        return `Fraction bars show ${dimensions?.numerator || 3}/${dimensions?.denominator || 4} as parts of a whole`;
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
        <svg width="400" height="200" style={{ border: '1px solid #dee2e6', borderRadius: '4px' }}>>
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