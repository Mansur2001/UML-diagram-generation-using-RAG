import React from 'react';

interface UMLDisplayProps {
  umlCode: string;
  title?: string;
  diagramType?: string;
}

export const UMLDisplay: React.FC<UMLDisplayProps> = ({ umlCode, title, diagramType }) => {
  return (
    <div style={{ 
      border: '1px solid #ccc', 
      borderRadius: '8px', 
      padding: '16px', 
      margin: '8px 0',
      backgroundColor: 'white'
    }}>
      {title && (
        <h3 style={{ margin: '0 0 8px 0', color: '#333' }}>
          {title}
        </h3>
      )}
      {diagramType && (
        <p style={{ margin: '0 0 8px 0', color: '#666' }}>
          Type: {diagramType}
        </p>
      )}
      <pre style={{ 
        background: '#f5f5f5', 
        padding: '12px', 
        borderRadius: '4px',
        overflow: 'auto',
        fontSize: '14px',
        whiteSpace: 'pre-wrap',
        fontFamily: 'monospace'
      }}>
        {umlCode}
      </pre>
    </div>
  );
}; 