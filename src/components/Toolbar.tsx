'use client';

import {
  Box,
  Typography,
  IconButton,
  Button,
  ButtonGroup,
  Tooltip,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button as MuiButton,
  useTheme,
} from '@mui/material';
import {
  ViewColumn,
  ViewModule,
  Code,
  Chat,
  Lightbulb,
  DarkMode,
  Settings,
  Help,
  AttachFile,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { 
  setViewMode, 
  setSelectedTab, 
  toggleTheme,
  toggleChat 
} from '@/store/slices/uiSlice';
import React, { useState } from 'react';

export default function Toolbar() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const dispatch = useAppDispatch();
  const { viewMode, selectedTab, theme: themeMode } = useAppSelector((state: any) => state.ui);

  // Dialog state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const handleViewModeChange = (mode: 'split' | 'diagram' | 'code') => {
    dispatch(setViewMode(mode));
  };

  const handleTabChange = (tab: 'diagram' | 'context') => {
    dispatch(setSelectedTab(tab));
  };

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        position: 'relative',
      }}
    >
      {/* Left Section - App Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {/* App Icon */}
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.5,
              background: isDark
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isDark
                ? '0 2px 8px rgba(102, 126, 234, 0.3)'
                : '0 2px 8px rgba(79, 172, 254, 0.3)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M3,3V21H21V3H3M5,5H19V19H5V5M7,7V9H9V7H7M11,7V9H17V7H11M7,11V13H9V11H7M11,11V13H17V11H11M7,15V17H9V15H7M11,15V17H17V15H11Z" />
            </svg>
          </Box>
          
          <Box>
            <Typography 
              variant="subtitle1" 
              sx={{ 
                fontWeight: 700, 
                fontSize: '1.1rem',
                background: isDark
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.1,
              }}
            >
              UML Diagram Generator
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'text.secondary',
                fontWeight: 500,
                display: 'block',
                lineHeight: 1,
                fontSize: '0.7rem',
              }}
            >
              AI-Powered Generation
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Center Section - View Mode Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(event, newValue) => {
            if (newValue !== null) {
              dispatch(setViewMode(newValue));
              if (newValue === 'context') {
                dispatch(setSelectedTab('context'));
              } else {
                dispatch(setSelectedTab('diagram'));
              }
            }
          }}
          size="small"
          sx={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            borderRadius: 1.5,
            padding: 0.25,
            border: isDark 
              ? '1px solid rgba(255,255,255,0.1)' 
              : '1px solid rgba(0,0,0,0.1)',
            '& .MuiToggleButton-root': {
              border: 'none',
              borderRadius: 1,
              margin: 0.25,
              paddingX: 1.5,
              paddingY: 0.5,
              minWidth: 75,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              transition: 'all 0.2s ease',
              '&.Mui-selected': {
                backgroundColor: isDark ? '#667eea' : '#1976d2',
                color: '#fff',
                boxShadow: isDark
                  ? '0 1px 4px rgba(102, 126, 234, 0.4)'
                  : '0 1px 4px rgba(25, 118, 210, 0.3)',
                '&:hover': {
                  backgroundColor: isDark ? '#5a6fd8' : '#1565c0',
                },
              },
              '&:not(.Mui-selected)': {
                backgroundColor: 'transparent',
                color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
                '&:hover': {
                  backgroundColor: isDark 
                    ? 'rgba(102,126,234,0.1)' 
                    : 'rgba(25,118,210,0.08)',
                  color: isDark ? '#667eea' : '#1976d2',
                },
              },
            },
          }}
        >
          <ToggleButton value="split">
            <ViewColumn sx={{ mr: 0.5, fontSize: 16 }} /> Split
          </ToggleButton>
          <ToggleButton value="diagram">
            <ViewModule sx={{ mr: 0.5, fontSize: 16 }} /> Diagram
          </ToggleButton>
          <ToggleButton value="code">
            <Code sx={{ mr: 0.5, fontSize: 16 }} /> Code
          </ToggleButton>
          <ToggleButton value="context">
            <Chat sx={{ mr: 0.5, fontSize: 16 }} /> Context
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Right Section - Actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title={`Switch to ${themeMode === 'light' ? 'Dark' : 'Light'} Mode`} arrow>
          <IconButton 
            onClick={() => dispatch(toggleTheme())} 
            size="small"
            sx={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              border: isDark 
                ? '1px solid rgba(255,255,255,0.1)' 
                : '1px solid rgba(0,0,0,0.1)',
              borderRadius: 1.5,
              width: 32,
              height: 32,
              '&:hover': {
                backgroundColor: isDark 
                  ? 'rgba(255,255,255,0.1)' 
                  : 'rgba(0,0,0,0.08)',
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.2s ease',
            }}
          >
            {themeMode === 'light' ? 
              <DarkMode sx={{ fontSize: 16 }} /> : 
              <Lightbulb sx={{ fontSize: 16 }} />
            }
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Settings" arrow>
          <IconButton 
            onClick={() => setSettingsOpen(true)}
            size="small"
            sx={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              border: isDark 
                ? '1px solid rgba(255,255,255,0.1)' 
                : '1px solid rgba(0,0,0,0.1)',
              borderRadius: 1.5,
              width: 32,
              height: 32,
              '&:hover': {
                backgroundColor: isDark 
                  ? 'rgba(255,255,255,0.1)' 
                  : 'rgba(0,0,0,0.08)',
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.2s ease',
            }}
          >
            <Settings sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Help & Documentation" arrow>
          <IconButton 
            onClick={() => setHelpOpen(true)}
            size="small"
            sx={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              border: isDark 
                ? '1px solid rgba(255,255,255,0.1)' 
                : '1px solid rgba(0,0,0,0.1)',
              borderRadius: 1.5,
              width: 32,
              height: 32,
              '&:hover': {
                backgroundColor: isDark 
                  ? 'rgba(255,255,255,0.1)' 
                  : 'rgba(0,0,0,0.08)',
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.2s ease',
            }}
          >
            <Help sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Settings Dialog */}
      <Dialog 
        open={settingsOpen} 
        onClose={() => setSettingsOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            minWidth: 400,
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>
          ⚙️ Settings
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary">
            Settings panel coming soon. Here you'll be able to customize:
          </Typography>
          <Box component="ul" sx={{ mt: 2, pl: 3 }}>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              Default diagram types and templates
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              Export preferences and formats
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              AI model configurations
            </Typography>
            <Typography component="li" variant="body2">
              Interface customization options
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => setSettingsOpen(false)}
            variant="contained"
            sx={{ borderRadius: 2 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Help Dialog */}
      <Dialog 
        open={helpOpen} 
        onClose={() => setHelpOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            minWidth: 500,
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>
          📚 Help & Documentation
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Quick guide to get you started with UML Diagram Generator:
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
              🚀 Getting Started
            </Typography>
            <Typography variant="body2" color="text.secondary">
              1. Describe your system in the chat (e.g., "Create a class diagram for an e-commerce system")<br/>
              2. Click Send or press Enter<br/>
              3. Review the generated diagram and code<br/>
              4. Edit the code if needed and save changes
            </Typography>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
              🔧 View Modes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • <strong>Split:</strong> See diagram and code side by side<br/>
              • <strong>Diagram:</strong> Focus on the generated diagram<br/>
              • <strong>Code:</strong> View and edit PlantUML code<br/>
              • <strong>Context:</strong> See RAG context used for generation
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
              💡 Tips
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Be specific about the type of diagram you want<br/>
              • Mention design patterns for better results<br/>
              • Use the reset button to start fresh<br/>
              • Toggle between light and dark themes
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => setHelpOpen(false)}
            variant="contained"
            sx={{ borderRadius: 2 }}
          >
            Got it!
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 