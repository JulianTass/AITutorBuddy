// src/components/GeometryCanvas.js
import React from 'react';

const GeometryCanvas = ({ shape, dimensions, onClose }) => {
  const renderShape = () => {
    switch (shape) {
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
      case 'trapezium':
        return renderTrapezium(dimensions);
      default:
        return <text x="200" y="150" textAnchor="middle" className="text-lg">Shape not supported yet</text>;
    }
  };

  const renderCone = ({ height = 5, radius = 3 }) => {
    const scale = 20;
    const svgHeight = height * scale;
    const svgRadius = radius * scale;
    const centerX = 200;
    const centerY = 50;
    const baseY = centerY + svgHeight;

    return (
      <g>
        <path
          d={`M ${centerX} ${centerY} L ${centerX - svgRadius} ${baseY} A ${svgRadius} ${svgRadius/3} 0 0 0 ${centerX + svgRadius} ${baseY} Z`}
          fill="#ff69b4"
          stroke="#000"
          strokeWidth="2"
          opacity="0.7"
        />
        <ellipse
          cx={centerX}
          cy={baseY}
          rx={svgRadius}
          ry={svgRadius/3}
          fill="none"
          stroke="#000"
          strokeWidth="2"
          strokeDasharray="5,5"
        />
        <line x1={centerX} y1={centerY} x2={centerX} y2={baseY} stroke="#000" strokeWidth="2" />
        <line x1={centerX} y1={baseY} x2={centerX + svgRadius} y2={baseY} stroke="#000" strokeWidth="2" />
        <text x={centerX - 15} y={(centerY + baseY) / 2} className="text-sm font-semibold">
          {height}cm
        </text>
        <text x={centerX + svgRadius/2} y={baseY + 20} className="text-sm font-semibold">
          {radius}cm
        </text>
        <rect x={centerX - 8} y={baseY - 8} width="8" height="8" fill="none" stroke="#000" strokeWidth="1" />
      </g>
    );
  };

  const renderCylinder = ({ height = 6, radius = 4 }) => {
    const scale = 15;
    const svgHeight = height * scale;
    const svgRadius = radius * scale;
    const centerX = 200;
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
        <text x={centerX - svgRadius - 40} y={(topY + bottomY) / 2} className="text-sm font-semibold">
          {height}cm
        </text>
        <text x={centerX + svgRadius/2} y={bottomY + 20} className="text-sm font-semibold">
          {radius}cm
        </text>
      </g>
    );
  };

  const renderRectangle = ({ length = 8, width = 5 }) => {
    const scale = 20;
    const svgLength = length * scale;
    const svgWidth = width * scale;
    const startX = (400 - svgLength) / 2;
    const startY = (300 - svgWidth) / 2;

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
        <text x={startX + svgLength/2} y={startY - 10} textAnchor="middle" className="text-sm font-semibold">
          {length}cm
        </text>
        <text x={startX - 20} y={startY + svgWidth/2} textAnchor="middle" className="text-sm font-semibold" transform={`rotate(-90, ${startX - 20}, ${startY + svgWidth/2})`}>
          {width}cm
        </text>
      </g>
    );
  };

  const renderTriangle = ({ base = 8, height = 6 }) => {
    const scale = 20;
    const svgBase = base * scale;
    const svgHeight = height * scale;
    const centerX = 200;
    const bottomY = 250;
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
        <text x={centerX} y={bottomY + 20} textAnchor="middle" className="text-sm font-semibold">
          {base}cm
        </text>
        <text x={centerX - 20} y={(topY + bottomY)/2} className="text-sm font-semibold">
          {height}cm
        </text>
        <rect x={centerX - 8} y={bottomY - 8} width="8" height="8" fill="none" stroke="#000" strokeWidth="1" />
      </g>
    );
  };

  const renderCircle = ({ radius = 5 }) => {
    const scale = 25;
    const svgRadius = radius * scale;
    const centerX = 200;
    const centerY = 150;

    return (
      <g>
        <circle cx={centerX} cy={centerY} r={svgRadius} fill="#ff9999" stroke="#000" strokeWidth="2" opacity="0.7" />
        <line x1={centerX} y1={centerY} x2={centerX + svgRadius} y2={centerY} stroke="#000" strokeWidth="2" />
        <text x={centerX + svgRadius/2} y={centerY - 10} textAnchor="middle" className="text-sm font-semibold">
          {radius}cm
        </text>
        <circle cx={centerX} cy={centerY} r="3" fill="#000" />
      </g>
    );
  };

  const renderTrapezium = ({ topBase = 4, bottomBase = 8, height = 5 }) => {
    const scale = 20;
    const svgTopBase = topBase * scale;
    const svgBottomBase = bottomBase * scale;
    const svgHeight = height * scale;
    const centerX = 200;
    const bottomY = 200;
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
        <line x1={centerX - svgBottomBase/2 - 20} y1={topY} x2={centerX - svgBottomBase/2 - 20} y2={bottomY} stroke="#000" strokeWidth="2" />
        <text x={centerX} y={topY - 10} textAnchor="middle" className="text-sm font-semibold">
          {topBase}cm
        </text>
        <text x={centerX} y={bottomY + 20} textAnchor="middle" className="text-sm font-semibold">
          {bottomBase}cm
        </text>
        <text x={centerX - svgBottomBase/2 - 40} y={(topY + bottomY)/2} className="text-sm font-semibold">
          {height}cm
        </text>
      </g>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold capitalize">
            {shape} - Visual Diagram
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <svg width="400" height="300" className="border border-gray-300 bg-white rounded">
            {renderShape()}
          </svg>
        </div>
        
        <div className="mt-4 text-sm text-gray-600">
          <p>Use this diagram to help visualize the {shape} and its dimensions.</p>
          <p className="font-medium mt-2">
            {shape === 'cone' && `Volume = (1/3) × π × r² × h`}
            {shape === 'cylinder' && `Volume = π × r² × h`}
            {shape === 'rectangle' && `Area = length × width`}
            {shape === 'triangle' && `Area = (1/2) × base × height`}
            {shape === 'circle' && `Area = π × r²`}
            {shape === 'trapezium' && `Area = (1/2) × (a + b) × h`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GeometryCanvas;