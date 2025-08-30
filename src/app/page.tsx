'use client';

import React from 'react';
import { Box, Container, Paper, Typography, Alert, useTheme } from '@mui/material';
import DiagramViewer from '@/components/DiagramViewer';
import CodeEditor from '@/components/CodeEditor';
import ChatPanel from '@/components/ChatPanel';
import ContextPanel from '@/components/ContextPanel';
import Toolbar from '@/components/Toolbar';
import { useAppSelector } from '@/store/hooks';

export default function Home() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const viewMode = useAppSelector((state) => state.ui.viewMode);
  const { currentDiagram, generating, error } = useAppSelector((state) => state.diagrams);

  // Simplified loading logic - only show loading when generating and no diagram exists
  const isLoading = generating && !currentDiagram;

  const renderContextPanel = () => (
    <Paper 
      elevation={0} 
      sx={{ 
        mt: 1.5,
        borderRadius: 2, 
        overflow: 'hidden',
        background: isDark 
          ? 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
          : 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
        backdropFilter: 'blur(20px)',
        border: isDark 
          ? '1px solid rgba(255,255,255,0.1)' 
          : '1px solid rgba(0,0,0,0.1)',
        boxShadow: isDark
          ? '0 4px 16px rgba(0,0,0,0.2)'
          : '0 4px 16px rgba(0,0,0,0.08)',
      }}
    >
      <ContextPanel />
    </Paper>
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: isDark
            ? `radial-gradient(circle at 20% 50%, rgba(102, 126, 234, 0.1) 0%, transparent 50%),
               radial-gradient(circle at 80% 20%, rgba(118, 75, 162, 0.1) 0%, transparent 50%),
               radial-gradient(circle at 40% 80%, rgba(102, 126, 234, 0.05) 0%, transparent 50%)`
            : `radial-gradient(circle at 20% 50%, rgba(25, 118, 210, 0.05) 0%, transparent 50%),
               radial-gradient(circle at 80% 20%, rgba(156, 39, 176, 0.05) 0%, transparent 50%),
               radial-gradient(circle at 40% 80%, rgba(25, 118, 210, 0.03) 0%, transparent 50%)`,
          pointerEvents: 'none',
          zIndex: -1,
        }
      }}
    >
      <Container
        maxWidth="xl"
        sx={{
          minHeight: '100vh',
          p: { xs: 1, sm: 1.5 },
          maxWidth: '1440px !important',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Header */}
          <Paper 
            elevation={0} 
            sx={{ 
              p: { xs: 1.5, sm: 2 }, 
              mb: 1.5, 
              borderRadius: 2,
              background: isDark 
                ? 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)'
                : 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 100%)',
              backdropFilter: 'blur(20px)',
              border: isDark 
                ? '1px solid rgba(255,255,255,0.1)' 
                : '1px solid rgba(0,0,0,0.1)',
              boxShadow: isDark
                ? '0 4px 16px rgba(0,0,0,0.2)'
                : '0 4px 16px rgba(0,0,0,0.08)',
            }}
          >
            <Toolbar />
          </Paper>

          {/* Main Chat Interface - Always Visible */}
          <Paper 
            elevation={0} 
            sx={{ 
              flex: 1, 
              borderRadius: 2, 
              overflow: 'hidden', 
              display: 'flex', 
              flexDirection: 'column',
              background: isDark 
                ? 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
                : 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
              backdropFilter: 'blur(20px)',
              border: isDark 
                ? '1px solid rgba(255,255,255,0.1)' 
                : '1px solid rgba(0,0,0,0.1)',
              boxShadow: isDark
                ? '0 4px 16px rgba(0,0,0,0.2)'
                : '0 4px 16px rgba(0,0,0,0.08)',
            }}
          >
            <ChatPanel />
          </Paper>

          {/* Code and Diagram Windows - Always Present */}
          <Box sx={{ mt: 1.5 }}>
            {viewMode === 'split' && (
              <Box sx={{ display: 'flex', gap: 1.5, flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', gap: 1.5, minHeight: '350px' }}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      flex: 1, 
                      borderRadius: 2, 
                      overflow: 'hidden',
                      background: isDark 
                        ? 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
                        : 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
                      backdropFilter: 'blur(20px)',
                      border: isDark 
                        ? '1px solid rgba(255,255,255,0.1)' 
                        : '1px solid rgba(0,0,0,0.1)',
                      boxShadow: isDark
                        ? '0 4px 16px rgba(0,0,0,0.2)'
                        : '0 4px 16px rgba(0,0,0,0.08)',
                    }}
                  >
                    <DiagramViewer 
                      png={currentDiagram?.png ?? ''} 
                      svg={currentDiagram?.svg ?? ''} 
                      loading={isLoading} 
                      error={error || undefined}
                    />
                  </Paper>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      flex: 1, 
                      borderRadius: 2, 
                      overflow: 'hidden',
                      background: isDark 
                        ? 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
                        : 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
                      backdropFilter: 'blur(20px)',
                      border: isDark 
                        ? '1px solid rgba(255,255,255,0.1)' 
                        : '1px solid rgba(0,0,0,0.1)',
                      boxShadow: isDark
                        ? '0 4px 16px rgba(0,0,0,0.2)'
                        : '0 4px 16px rgba(0,0,0,0.08)',
                    }}
                  >
                    <CodeEditor />
                  </Paper>
                </Box>
                {renderContextPanel()}
              </Box>
            )}
            
            {viewMode === 'diagram' && (
              <Box>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    borderRadius: 2, 
                    overflow: 'hidden', 
                    minHeight: '350px',
                    background: isDark 
                      ? 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
                    backdropFilter: 'blur(20px)',
                    border: isDark 
                      ? '1px solid rgba(255,255,255,0.1)' 
                      : '1px solid rgba(0,0,0,0.1)',
                    boxShadow: isDark
                      ? '0 4px 16px rgba(0,0,0,0.2)'
                      : '0 4px 16px rgba(0,0,0,0.08)',
                  }}
                >
                  <DiagramViewer 
                    png={currentDiagram?.png ?? ''} 
                    svg={currentDiagram?.svg ?? ''} 
                    loading={isLoading} 
                    error={error || undefined}
                  />
                </Paper>
                {renderContextPanel()}
              </Box>
            )}
            
            {viewMode === 'code' && (
              <Paper 
                elevation={0} 
                sx={{ 
                  borderRadius: 2, 
                  overflow: 'hidden', 
                  minHeight: '350px',
                  background: isDark 
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
                  backdropFilter: 'blur(20px)',
                  border: isDark 
                    ? '1px solid rgba(255,255,255,0.1)' 
                    : '1px solid rgba(0,0,0,0.1)',
                  boxShadow: isDark
                    ? '0 4px 16px rgba(0,0,0,0.2)'
                    : '0 4px 16px rgba(0,0,0,0.08)',
                }}
              >
                <CodeEditor />
              </Paper>
            )}
            
            {viewMode === 'context' && (
              <Paper 
                elevation={0} 
                sx={{ 
                  borderRadius: 2, 
                  overflow: 'hidden',
                  background: isDark 
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
                  backdropFilter: 'blur(20px)',
                  border: isDark 
                    ? '1px solid rgba(255,255,255,0.1)' 
                    : '1px solid rgba(0,0,0,0.1)',
                  boxShadow: isDark
                    ? '0 4px 16px rgba(0,0,0,0.2)'
                    : '0 4px 16px rgba(0,0,0,0.08)',
                }}
              >
                <ContextPanel />
              </Paper>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
} 