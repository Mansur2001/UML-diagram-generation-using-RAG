'use client';

import React from 'react';
import { Box, Paper, Typography, CircularProgress, Alert, Button, Stack, Divider } from '@mui/material';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

type Props = {
  png: string;
  svg: string;
  loading?: boolean;
  error?: string;
};

// Utility to extract only the first @startuml ... @enduml block
function extractPlantUMLBlock(code: string): string {
  if (!code) return '';
  const match = code.match(/@startuml[\s\S]*?@enduml/);
  return match ? match[0] : code;
}

const DiagramViewer: React.FC<Props> = ({ png, svg, loading, error }) => {

  const handleDownload = (type: 'svg' | 'png' | 'jpeg') => {
    if (type === 'svg') {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'diagram.svg';
      link.click();
      URL.revokeObjectURL(url);
    } else if (type === 'png') {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${png}`;
      link.download = 'diagram.png';
      link.click();
    } else if (type === 'jpeg') {
      // Convert PNG to JPEG in browser
      const img = new window.Image();
      img.src = `data:image/png;base64,${png}`;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const jpegUrl = canvas.toDataURL('image/jpeg');
          const link = document.createElement('a');
          link.href = jpegUrl;
          link.download = 'diagram.jpeg';
          link.click();
        }
      };
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Generating diagram...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Paper variant="outlined" sx={{ p: 0, minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Alert severity="error" sx={{ width: '100%', fontSize: 16, fontWeight: 500, mb: 2 }}>
          {error}
        </Alert>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Please check your PlantUML code for syntax errors or missing tags. Edit and try again.
        </Typography>
      </Paper>
    );
  }

  if (!png) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          No diagram to display
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          To generate a UML diagram:
        </Typography>
        <ul style={{ color: '#888', marginBottom: 16 }}>
          <li>Enter a prompt describing your system (e.g., "Class diagram for a hospital management system")</li>
          <li>Click <b>Generate</b> to create a diagram</li>
          <li>If you edit the code, ensure it starts with <code>@startuml</code> and ends with <code>@enduml</code></li>
          <li>If the diagram does not render, check your PlantUML code for syntax errors</li>
        </ul>
        <Typography variant="caption" color="text.secondary">
          You can edit the code in the <b>Code</b> tab and click <b>Save</b> to update the diagram.
        </Typography>
      </Box>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, minHeight: 400, overflow: 'auto' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img
          src={`data:image/png;base64,${png}`}
          alt="UML Diagram"
          style={{ maxWidth: '100%', maxHeight: 500, border: '1px solid #eee', borderRadius: 4 }}
        />
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={() => handleDownload('svg')}>Download SVG</Button>
          <Button variant="outlined" onClick={() => handleDownload('png')}>Download PNG</Button>
          <Button variant="outlined" onClick={() => handleDownload('jpeg')}>Download JPEG</Button>
        </Stack>
      </Box>
    </Paper>
  );
};

export default DiagramViewer; 