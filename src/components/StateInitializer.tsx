'use client';

import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { setTheme, setViewMode, setSelectedTab, toggleSidebar, toggleChat } from '@/store/slices/uiSlice';
import { setCurrentCode } from '@/store/slices/diagramsSlice';
import { StateManager } from '@/store/persistence';

export default function StateInitializer() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Only run on client side and only once
    if (typeof window === 'undefined') return;

    try {
      // Check version compatibility
      const isVersionValid = StateManager.checkVersion();
      if (!isVersionValid) {
        console.log('App version changed, using default state');
        return;
      }

      // Load UI state
      const uiState = StateManager.loadUIState();
      if (uiState) {
        dispatch(setTheme(uiState.theme));
        dispatch(setViewMode(uiState.viewMode));
        dispatch(setSelectedTab(uiState.selectedTab));
        
        // Set sidebar and chat state without animation on initial load
        if (!uiState.sidebarOpen) {
          dispatch(toggleSidebar());
        }
        if (uiState.chatOpen) {
          dispatch(toggleChat());
        }
      }

      // Load current diagram
      const currentDiagram = StateManager.loadCurrentDiagram();
      if (currentDiagram && currentDiagram.uml_code) {
        // Convert old diagram format to new format and populate Redux store
        dispatch(setCurrentCode(currentDiagram.uml_code));
      }

      // Load chat messages is handled by the chat component

    } catch (error) {
      console.error('Error initializing state from cookies:', error);
      StateManager.clearAll();
    }
  }, [dispatch]);

  // This component doesn't render anything
  return null;
} 