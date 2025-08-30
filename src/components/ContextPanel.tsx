'use client';

import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Paper,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Info,
  Source,
  Score,
  ContentCopy,
} from '@mui/icons-material';
import { useAppSelector } from '@/store/hooks';
import { RAGContext } from '@/types';
import toast from 'react-hot-toast';

export default function ContextPanel() {
  const { currentDiagram } = useAppSelector((state) => state.diagrams);
  const contextList: RAGContext[] = (currentDiagram && 'context' in currentDiagram && Array.isArray((currentDiagram as any).context))
    ? (currentDiagram as any).context
    : [];


  const handleCopyContext = (context: RAGContext) => {
    const textToCopy = context.type === 'plantuml' 
      ? context.content 
      : context.description || context.content;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast.success('Context copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy context');
    });
  };

  const getContextIcon = (type: RAGContext['type'] | undefined) => {
    switch (type) {
      case 'plantuml':
        return '📊';
      case 'text':
        return '📝';
      case 'graph':
        return '🕸️';
      default:
        return '📄';
    }
  };

  const getContextColor = (type: RAGContext['type'] | undefined) => {
    switch (type) {
      case 'plantuml':
        return 'primary';
      case 'text':
        return 'secondary';
      case 'graph':
        return 'success';
      default:
        return 'default';
    }
  };

  const getContextType = (context: any): string => {
    // Handle different possible context structures from backend
    if (context.type) {
      return context.type.toString().toUpperCase();
    }
    if (context.uml_type) {
      return context.uml_type.toString().toUpperCase();
    }
    return 'UNKNOWN';
  };

  const getContextTypeForIcon = (context: any): RAGContext['type'] | undefined => {
    if (context.type && ['text', 'plantuml', 'graph'].includes(context.type)) {
      return context.type as RAGContext['type'];
    }
    if (context.uml_type) {
      return 'plantuml'; // Assume UML types are plantuml
    }
    return undefined;
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
          color: 'text.secondary',
        }}
      >
        <Info sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
        <Typography variant="h6" gutterBottom>
          No Context Available
        </Typography>
        <Typography variant="body2" textAlign="center">
          Generate a diagram to see the RAG context used
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: 'background-color 0.3s, color 0.3s, border-color 0.3s' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', transition: 'background-color 0.3s, color 0.3s, border-color 0.3s' }}>
        <Typography variant="h6">
          RAG Context
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Knowledge base sources used for generation
        </Typography>
      </Box>

      {/* Context List */}
      <Box sx={{ flex: 1, overflow: 'auto', transition: 'background-color 0.3s, color 0.3s, border-color 0.3s' }}>
        <List sx={{ p: 0 }}>
          {contextList.map((context, index) => {
            const contextType = getContextTypeForIcon(context);
            const displayType = getContextType(context);
            const score = context.score || 0.5; // Default score if not provided
            
            return (
              <Box key={index} sx={{ transition: 'background-color 0.3s, color 0.3s, border-color 0.3s' }}>
                <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start', p: 2, transition: 'background-color 0.3s, color 0.3s, border-color 0.3s' }}>
                  {/* Header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', mb: 1, transition: 'background-color 0.3s, color 0.3s, border-color 0.3s' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, transition: 'background-color 0.3s, color 0.3s, border-color 0.3s' }}>
                      <Typography variant="h6" sx={{ fontSize: '1.2rem' }}>
                        {getContextIcon(contextType)}
                      </Typography>
                      <Chip
                        label={displayType}
                        size="small"
                        color={getContextColor(contextType) as any}
                        variant="outlined"
                        sx={{ transition: 'background-color 0.3s, color 0.3s, border-color 0.3s' }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, transition: 'background-color 0.3s, color 0.3s, border-color 0.3s' }}>
                      <Tooltip title="Score">
                        <Chip
                          label={`${(score * 100).toFixed(0)}%`}
                          size="small"
                          variant="outlined"
                          icon={<Score />}
                          sx={{ transition: 'background-color 0.3s, color 0.3s, border-color 0.3s' }}
                        />
                      </Tooltip>
                      <Tooltip title="Copy Context">
                        <IconButton
                          size="small"
                          onClick={() => handleCopyContext(context)}
                          sx={{ transition: 'background-color 0.3s, color 0.3s, border-color 0.3s' }}
                        >
                          <ContentCopy />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Source */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, transition: 'background-color 0.3s, color 0.3s, border-color 0.3s' }}>
                    <Source sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {context.source || context.title || 'Unknown Source'}
                    </Typography>
                  </Box>

                  {/* Content */}
                  <Typography
                    variant="body2"
                    sx={{
                      mb: 1,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: contextType === 'plantuml' ? 120 : 80,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      transition: 'background-color 0.3s, color 0.3s, border-color 0.3s',
                    }}
                  >
                    {contextType === 'plantuml' 
                      ? context.content || context.content || 'No content available'
                      : context.description || context.content || 'No description available'
                    }
                  </Typography>

                  {/* Matched Terms */}
                  {context.matched_terms && context.matched_terms.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', transition: 'background-color 0.3s, color 0.3s, border-color 0.3s' }}>
                      {context.matched_terms.map((term, termIndex) => (
                        <Chip
                          key={termIndex}
                          label={term}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', transition: 'background-color 0.3s, color 0.3s, border-color 0.3s' }}
                        />
                      ))}
                    </Box>
                  )}
                </ListItem>
                {index < contextList.length - 1 && <Divider />}
              </Box>
            );
          })}
        </List>
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.default', transition: 'background-color 0.3s, color 0.3s, border-color 0.3s' }}>
        <Typography variant="caption" color="text.secondary">
          Context sources: {contextList.length} items
        </Typography>
      </Box>
    </Box>
  );
} 