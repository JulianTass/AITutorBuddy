// InlineDiagramConfirm.js - Full diagram with inline confirmation
import React from 'react';
import InlineGeometryCanvas from './InlineGeometryCanvas';

const InlineDiagramConfirm = ({ 
  shape, 
  dimensions, 
  detection, 
  collapsed, 
  confirmed,
  pendingMessage,
  onConfirm, 
  onDismiss, 
  onCollapse,
  messageId 
}) => {
  if (collapsed) {
    // Collapsed state - small summary bar
    return (
      <div style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '6px',
        padding: '8px 12px',
        margin: '8px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        maxWidth: '320px'
      }}>
        <div 
          onClick={() => onCollapse(messageId)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: 1
          }}
        >
          <div style={{
            width: '20px',
            height: '20px',
            backgroundColor: confirmed ? '#d4edda' : '#e3f2fd',
            borderRadius: '3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px'
          }}>
            {confirmed ? '✓' : '📊'}
          </div>
          <span style={{ fontSize: '13px', fontWeight: '500', color: '#495057' }}>
            {shape.charAt(0).toUpperCase() + shape.slice(1).replace('_', ' ')} diagram
            {confirmed ? ' (confirmed)' : ''}
          </span>
        </div>
        <button
          onClick={() => onCollapse(messageId)}
          style={{
            background: 'none',
            border: 'none',
            color: '#6c757d',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ▼
        </button>
      </div>
    );
  }

  // Full diagram display
  return (
    <div style={{
      backgroundColor: '#f8f9fa',
      border: '1px solid #e9ecef',
      borderRadius: '8px',
      padding: '16px',
      margin: '8px 0',
      maxWidth: '500px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <div style={{
          fontSize: '15px',
          fontWeight: '600',
          color: '#495057'
        }}>
          {detection.prompt}
        </div>
        <button
          onClick={() => onCollapse(messageId)}
          style={{
            background: 'none',
            border: '1px solid #6c757d',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#6c757d'
          }}
        >
          ▲ Collapse
        </button>
      </div>
      
      <div style={{
        backgroundColor: 'white',
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'center',
        border: '1px solid #dee2e6'
      }}>
        <InlineGeometryCanvas 
          shape={shape} 
          dimensions={dimensions} 
        />
      </div>
      
      {!confirmed && (
        <div style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button 
            onClick={() => onConfirm(messageId, pendingMessage)}
            style={{
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '14px'
            }}
          >
            Use this diagram & continue
          </button>
          
          <button 
            onClick={() => onDismiss(messageId, pendingMessage)}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Continue without diagram
          </button>
        </div>
      )}

      {confirmed && (
        <div style={{
          textAlign: 'center',
          color: '#28a745',
          fontSize: '13px',
          fontWeight: '500'
        }}>
          ✓ Diagram confirmed - sent to StudyBuddy
        </div>
      )}
      
      <div style={{
        marginTop: '8px',
        fontSize: '11px',
        color: '#6c757d',
        textAlign: 'center'
      }}>
        Confidence: {Math.round(detection.confidence * 100)}% match
      </div>
    </div>
  );
};

export default InlineDiagramConfirm;