'use client';

import React from 'react';
import { Inter } from 'next/font/google';
import { Provider } from 'react-redux';
import { Theme } from '@mui/material/styles';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Toaster } from 'react-hot-toast';
import dynamic from 'next/dynamic';

const TamboProvider = dynamic(
  () => import('@tambo-ai/react').then(mod => mod.TamboProvider),
  { ssr: false }
);

import { store } from '@/store/store';
import ErrorBoundary from '@/components/ErrorBoundary';
import StateInitializer from '@/components/StateInitializer';
import { components, tools } from '@/lib/tambo';
import { useAppSelector } from '@/store/hooks';
import type { PaletteMode } from '@mui/material';

// Initialize Inter font with specific subsets
const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// Add font variable to the document
if (typeof document !== 'undefined') {
  document.documentElement.classList.add(inter.variable);
}

function getInitialThemeMode(): PaletteMode {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark' || attr === 'light') return attr as PaletteMode;
  }
  return 'light';
}



// Dynamic theme provider that reads from Redux state
const DynamicThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const mode = useAppSelector((state) => state.ui.theme);
  const isDark = mode === 'dark';
  
  const theme = React.useMemo(() => {
    // Create a base theme first
    const baseTheme = createTheme({
      palette: {
        mode,
        primary: {
          main: isDark ? '#667eea' : '#1976d2',
          light: isDark ? '#8e9ff5' : '#42a5f5',
          dark: isDark ? '#4d5ed4' : '#1565c0',
          contrastText: '#FFFFFF',
        },
        secondary: {
          main: isDark ? '#764ba2' : '#9c27b0',
          light: isDark ? '#9b6bc4' : '#ba68c8',
          dark: isDark ? '#5a2d8a' : '#7b1fa2',
          contrastText: '#FFFFFF',
        },
        background: {
          default: isDark ? '#121212' : '#F5F9FF',
          paper: isDark ? '#1E1A2C' : '#FFFFFF',
        },
        text: {
          primary: isDark ? '#E1E1FF' : '#0A1929',
          secondary: isDark ? '#B8B8D1' : '#4A5568',
          disabled: isDark ? '#6B7280' : '#A0AEC0',
        },
        divider: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      },
    });

    // Then extend it with components
    return createTheme(baseTheme, {
      typography: {
        fontFamily: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
        ].join(','),
        h1: {
          color: isDark ? '#E1E1FF' : '#0A1929',
        },
        h2: {
          color: isDark ? '#D1D1FF' : '#1A365D',
        },
        h3: {
          color: isDark ? '#C1C1FF' : '#2C5282',
        },
        body1: {
          color: isDark ? '#E1E1FF' : '#2D3748',
        },
        body2: {
          color: isDark ? '#B8B8D1' : '#4A5568',
        },
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: (theme: Theme) => ({
            body: {
              transition: 'all 0.2s ease-in-out',
              scrollbarWidth: 'thin',
              scrollbarColor: isDark ? '#667eea80' : '#b3b3b3 transparent',
              '&::-webkit-scrollbar': {
                width: '6px',
                height: '6px',
              },
              '&::-webkit-scrollbar-track': {
                background: isDark ? 'rgba(30, 26, 44, 0.7)' : 'rgba(0, 0, 0, 0.02)',
              },
              '&::-webkit-scrollbar-thumb': {
                background: isDark ? 'rgba(102, 126, 234, 0.5)' : 'rgba(0, 0, 0, 0.1)',
                borderRadius: '3px',
                border: isDark ? 'none' : '1px solid rgba(0, 0, 0, 0.05)',
                '&:hover': {
                  background: isDark ? 'rgba(102, 126, 234, 0.7)' : 'rgba(0, 0, 0, 0.15)',
                },
              },
            },
            // Specific elements
            '.MuiInputBase-input, .MuiCode-root, pre, code, .MuiPaper-root, .MuiList-root, .MuiPopover-paper': {
              '&::-webkit-scrollbar': {
                width: '6px',
                height: '6px',
              },
              '&::-webkit-scrollbar-track': {
                background: isDark ? 'rgba(30, 26, 44, 0.7)' : 'rgba(0, 0, 0, 0.02)',
              },
              '&::-webkit-scrollbar-thumb': {
                background: isDark ? 'rgba(102, 126, 234, 0.5)' : 'rgba(0, 0, 0, 0.1)',
                borderRadius: '3px',
                '&:hover': {
                  background: isDark ? 'rgba(102, 126, 234, 0.7)' : 'rgba(0, 0, 0, 0.15)',
                },
              },
            },
          }),
        },
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              fontWeight: 500,
              borderRadius: 8,
              padding: '8px 16px',
              '&.MuiButton-contained': {
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: `0 4px 12px ${isDark ? 'rgba(126, 87, 194, 0.3)' : 'rgba(33, 150, 243, 0.3)'}`,
                },
              },
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              boxShadow: isDark 
                ? '0 4px 20px -2px rgba(0, 0, 0, 0.3)' 
                : '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              background: isDark ? '#1E1A2C' : '#FFFFFF',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            },
          },
        },
      },
    });
  }, [isDark, mode]);

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

interface ClientLayoutProps {
  children: React.ReactNode;
}

function ClientLayout({ children }: ClientLayoutProps) {
  const apiKey = process.env.NEXT_PUBLIC_TAMBO_API_KEY || '';
  const initialTheme = getInitialThemeMode();

  return (
    <div className="app-container flex flex-col min-h-screen">
      <Provider store={store}>
        <TamboProvider
          apiKey={apiKey}
          components={components}
          tools={tools}
          // @ts-ignore - initialTheme is a valid prop but not in the type definition
          initialTheme={initialTheme}
          // @ts-ignore - themeStorageKey is a valid prop but not in the type definition
          themeStorageKey="tambo-theme"
        >
          <DynamicThemeProvider>
            <CssBaseline />
            <ErrorBoundary>
              <StateInitializer />
              <main className="flex-1 flex flex-col">
                {children}
              </main>
              <Toaster position="bottom-right" />
            </ErrorBoundary>
          </DynamicThemeProvider>
        </TamboProvider>
      </Provider>
    </div>
  );
}

export default ClientLayout;
