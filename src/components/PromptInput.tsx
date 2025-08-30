'use client';

import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  CircularProgress,
} from '@mui/material';
import { PlayArrow } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { generateDiagram } from '@/store/slices/diagramsSlice';
import toast from 'react-hot-toast';

const examplePrompts = [
  // Core UML diagram types
  'Create a class diagram for an e-commerce system',
  'Design a sequence diagram for user authentication',
  'Generate an activity diagram for order processing',
  'Create a use case diagram for a banking app',
  'Show a component diagram for microservices',
  'Draw a deployment diagram for a cloud-based app',
  'Build a state diagram for a traffic light system'
];

export default function PromptInput() {
  const renderExamplePrompts = () => (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        overflowX: 'auto',
        flexWrap: 'nowrap',
        pb: 1,
        maxWidth: '100%',
        whiteSpace: 'nowrap',
        border: '1px solid #333',
        borderRadius: 1,
        background: 'rgba(255,255,255,0.03)',
      }}
      data-testid="example-prompts-scroll"
    >
      {examplePrompts.map((example, index) => (
        <Button
          key={index}
          variant="outlined"
          size="small"
          onClick={() => handleExampleClick(example)}
          sx={{
            textTransform: 'none',
            flex: '0 0 auto',
            maxWidth: 320,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {example}
        </Button>
      ))}
    </Box>
  );

  const dispatch = useAppDispatch();
  const { generating, error } = useAppSelector((state) => state.diagrams);
  
  const [prompt, setPrompt] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    try {
      await dispatch(generateDiagram({
        prompt: prompt.trim(),
        webSearchEnabled: false,
        embeddedFile: null,
      })).unwrap();
      
      toast.success('UML diagram generated successfully!');
    } catch (error: any) {
      toast.error('Failed to generate diagram');
    }
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
  };

  return (
    <Box>
      
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          fullWidth
          multiline
          rows={3}
          variant="outlined"
          placeholder="What UML diagram would you like me to create for you?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleGenerate();
            }
          }}
        />

        <Button 
          variant="contained"
          size="large"
          onClick={handleGenerate}
          disabled={!prompt.trim() || generating}
          startIcon={generating ? <CircularProgress size={20} /> : <PlayArrow />}
          sx={{ 
            minWidth: 140,
            textTransform: 'none',
            borderRadius: 2,
            px: 3
          }}
        >
          {generating ? 'Creating...' : 'Create Diagram'}
        </Button>
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Example Prompts
        </Typography>
        {renderExamplePrompts()}
      </Paper>
    </Box>
  );
} 