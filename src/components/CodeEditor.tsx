'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Alert,
  Button,
  TextField,
  CircularProgress
} from '@mui/material';
import {
  ContentCopy,
  Download,
  Refresh,
  Check,
  Replay,
  PlayArrow,
  Code,

} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setCurrentCode, renderDiagram } from '@/store/slices/diagramsSlice';
import toast from 'react-hot-toast';

export default function CodeEditor() {
  const dispatch = useAppDispatch();
  const { currentDiagram, generating } = useAppSelector((state) => state.diagrams);
  
  const [localCode, setLocalCode] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (currentDiagram?.uml_code && currentDiagram.uml_code !== localCode) {
      setLocalCode(currentDiagram.uml_code);
    }
  }, [currentDiagram?.uml_code]);

  const handleCodeChange = useCallback((newCode: string) => {
    setLocalCode(newCode);
    validateCode(newCode);
    // Debounced save to Redux store
    const timeoutId = setTimeout(() => {
      dispatch(setCurrentCode(newCode));
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [dispatch]);

  const validateCode = (codeToValidate: string) => {
    const errors: string[] = [];
    
    // Basic PlantUML validation
    if (codeToValidate.includes('@startuml') && !codeToValidate.includes('@enduml')) {
      errors.push('Missing @enduml tag');
    }
    
    if (codeToValidate.includes('@enduml') && !codeToValidate.includes('@startuml')) {
      errors.push('Missing @startuml tag');
    }

    // Mermaid validation
    if (codeToValidate.includes('graph') && !codeToValidate.includes('end')) {
      errors.push('Incomplete Mermaid graph');
    }

    setValidationErrors(errors);
  };

  // Utility to extract only the first @startuml ... @enduml block
  function extractPlantUMLBlock(code: string): string {
    if (!code) return '';
    const match = code.match(/@startuml[\s\S]*?@enduml/);
    return match ? match[0] : code;
  }

  const handleRender = useCallback(async () => {
    if (!localCode.trim()) {
      setRenderError('Please enter some PlantUML code to render');
      return;
    }

    setIsRendering(true);
    setRenderError(null);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${baseUrl}/api/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uml_code: localCode
        })
      });

      if (!response.ok) {
        throw new Error(`Render request failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to render diagram');
      }

      // Update Redux store with rendered diagram
      dispatch(renderDiagram({
        uml_code: localCode,
        png: data.png,
        svg: data.svg
      }));

      console.log('✅ Diagram rendered successfully from code editor');
      
    } catch (error: any) {
      console.error('Rendering error:', error);
      setRenderError(error.message || 'Failed to render diagram');
    } finally {
      setIsRendering(false);
    }
  }, [localCode, dispatch]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(localCode);
      setCopied(true);
      toast.success('Code copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy code');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([localCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentDiagram?.uml_code || 'diagram'}.puml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    if (currentDiagram?.uml_code) {
      setLocalCode(currentDiagram.uml_code);
      setIsEditing(false);
      setValidationErrors([]);
    }
  };

  const loadExample = () => {
    const exampleCode = `@startuml
title Sample Class Diagram

class User {
    -id: String
    -username: String
    -email: String
    +login()
    +logout()
}

class Order {
    -orderId: String
    -date: Date
    -total: Double
    +calculateTotal()
    +processPayment()
}

class Product {
    -productId: String
    -name: String
    -price: Double
    +getDetails()
}

User ||--o{ Order : places
Order }o--|| Product : contains

@enduml`;
    
    setLocalCode(exampleCode);
    dispatch(setCurrentCode(exampleCode));
  };

  if (!currentDiagram) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 400,
        }}
      >
        <Typography variant="h6" color="text.secondary">
          No diagram to edit
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Generate a diagram first to edit its code
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: '100vh',
      display: 'flex', 
      flexDirection: 'column',
      p: 3,
      gap: 2,
      overflow: 'hidden'
    }}>
      {/* Header with controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Code />
          PlantUML Code Editor
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Load Example">
            <IconButton onClick={loadExample} size="small">
              <Refresh />
            </IconButton>
          </Tooltip>
          <Tooltip title="Render Diagram">
            <Button
              variant="contained"
              size="small"
              startIcon={isRendering ? <CircularProgress size={16} /> : <PlayArrow />}
              onClick={handleRender}
              disabled={isRendering || !localCode.trim()}
            >
              Render
            </Button>
          </Tooltip>
          <Tooltip title="Copy Code">
            <IconButton onClick={handleCopy} size="small">
              {copied ? <Check /> : <ContentCopy />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Download Code">
            <IconButton onClick={handleDownload} size="small">
              <Download />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset Editor">
            <IconButton onClick={handleReset} size="small">
              <Replay />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Error display */}
      {renderError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRenderError(null)}>
          {renderError}
        </Alert>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Validation Issues:
          </Typography>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Code input area */}
      <Paper sx={{ 
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0, // Important for flex children to respect overflow
        height: '100%',
        overflow: 'hidden'
      }}>
        <TextField
          fullWidth
          multiline
          variant="outlined"
          placeholder="Enter PlantUML code here... 

Example:
@startuml
class MyClass {
  +method()
}
@enduml"
          value={localCode}
          onChange={(e) => handleCodeChange(e.target.value)}
          disabled={generating}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            '& .MuiInputBase-root': {
              flex: 1,
              display: 'flex',
              alignItems: 'stretch',
              fontFamily: 'Monaco, Consolas, "Courier New", monospace',
              fontSize: '0.875rem',
              padding: 0,
              '& .MuiInputBase-input': {
                flex: 1,
                padding: '20px !important',
                overflow: 'auto !important',
                lineHeight: 1.5,
                minHeight: '100%',
                boxSizing: 'border-box',
                '&:focus': {
                  outline: 'none',
                  boxShadow: 'none'
                }
              },
              '&:before, &:after': {
                display: 'none'
              }
            },
            '& .MuiInputBase-inputMultiline': {
              height: '100% !important',
              resize: 'none',
              whiteSpace: 'pre',
              overflow: 'auto !important',
              '&::-webkit-scrollbar': {
                width: '8px',
                height: '8px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: 'transparent',
              },
            }
          }}
          InputProps={{
            style: {
              height: '100%',
              alignItems: 'flex-start',
              padding: 0
            }
          }}
        />
      </Paper>

      {/* Status and help */}
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          {localCode.length > 0 ? `${localCode.length} characters` : 'Enter PlantUML code above'}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isRendering && (
            <Typography variant="caption" color="text.secondary">
              Rendering diagram...
            </Typography>
          )}
          {currentDiagram?.uml_code && (
            <Typography variant="caption" color="success.main">
              ✅ Code saved
            </Typography>
          )}
        </Box>
      </Box>

      {/* Quick help */}
      <Box sx={{ mt: 1, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary">
          💡 <strong>Quick Tips:</strong> Start with @startuml and end with @enduml. 
          Use classes, relationships, and PlantUML syntax. Click "Render" to see your diagram!
        </Typography>
      </Box>
    </Box>
  );
} 