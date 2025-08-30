import { createListenerMiddleware } from '@reduxjs/toolkit';
import Cookies from 'js-cookie';
import type { RootState } from './store';

// Cookie configuration
const COOKIE_OPTIONS = {
  expires: 30, // 30 days
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

// Keys for different state parts
const COOKIE_KEYS = {
  UI_STATE: 'uml-rag-ui-state',
  CURRENT_DIAGRAM: 'uml-rag-current-diagram',
  CHAT_MESSAGES: 'uml-rag-chat-messages',
  APP_VERSION: 'uml-rag-version',
} as const;

// Current app version (increment when state structure changes)
const APP_VERSION = '1.0.0';

// Helper functions for safe JSON operations
const safeStringify = (obj: any): string => {
  try {
    return JSON.stringify(obj);
  } catch {
    return '';
  }
};

const safeParse = <T>(str: string | undefined, fallback: T): T => {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

// State persistence utilities
export const StateManager = {
  // Save UI state to cookies
  saveUIState: (state: RootState['ui']) => {
    const stateToSave = {
      theme: state.theme,
      viewMode: state.viewMode,
      selectedTab: state.selectedTab,
      sidebarOpen: state.sidebarOpen,
      chatOpen: state.chatOpen,
    };
    Cookies.set(COOKIE_KEYS.UI_STATE, safeStringify(stateToSave), COOKIE_OPTIONS);
  },

  // Load UI state from cookies
  loadUIState: () => {
    const savedState = Cookies.get(COOKIE_KEYS.UI_STATE);
    return safeParse(savedState, {
      theme: 'dark' as const,
      viewMode: 'split' as const,
      selectedTab: 'diagram' as const,
      sidebarOpen: true,
      chatOpen: false,
    });
  },

  // Save current diagram to cookies (only metadata, not images)
  saveCurrentDiagram: (diagram: RootState['diagrams']['currentDiagram']) => {
    if (!diagram) {
      Cookies.remove(COOKIE_KEYS.CURRENT_DIAGRAM);
      return;
    }

    // Only save essential data, not large binary images
    const diagramToSave = {
      id: diagram.id,
      type: diagram.type,
      uml_code: diagram.uml_code,
      timestamp: diagram.timestamp,
      prompt: diagram.prompt,
      generation_method: diagram.generation_method,
      png: diagram.png || '',
      svg: diagram.svg || '',
    };
    
    Cookies.set(COOKIE_KEYS.CURRENT_DIAGRAM, safeStringify(diagramToSave), COOKIE_OPTIONS);
  },

  // Load current diagram from cookies
  loadCurrentDiagram: () => {
    const savedDiagram = Cookies.get(COOKIE_KEYS.CURRENT_DIAGRAM);
    const diagram = safeParse(savedDiagram, null);
    
    if (diagram && typeof diagram === 'object' && 'id' in diagram) {
      // Add empty png/svg since we don't store them in cookies
      return {
        id: (diagram as any).id,
        uml_code: (diagram as any).uml_code,
        type: (diagram as any).type,
        timestamp: (diagram as any).timestamp,
        prompt: (diagram as any).prompt,
        generation_method: (diagram as any).generation_method,
        png: (diagram as any).png || '',
        svg: (diagram as any).svg || '',
      };
    }
    
    return null;
  },

  // Save recent chat messages (last 10)
  saveChatMessages: (messages: RootState['chat']['messages']) => {
    // Only save last 10 messages to keep cookie size reasonable
    const recentMessages = messages.slice(-10);
    Cookies.set(COOKIE_KEYS.CHAT_MESSAGES, safeStringify(recentMessages), COOKIE_OPTIONS);
  },

  // Load chat messages from cookies
  loadChatMessages: () => {
    const savedMessages = Cookies.get(COOKIE_KEYS.CHAT_MESSAGES);
    return safeParse(savedMessages, []);
  },

  // Check if we need to clear state due to version change
  checkVersion: () => {
    const savedVersion = Cookies.get(COOKIE_KEYS.APP_VERSION);
    if (savedVersion !== APP_VERSION) {
      // Version mismatch, clear all cookies
      Object.values(COOKIE_KEYS).forEach(key => Cookies.remove(key));
      Cookies.set(COOKIE_KEYS.APP_VERSION, APP_VERSION, COOKIE_OPTIONS);
      return false; // State was cleared
    }
    return true; // State is valid
  },

  // Clear all persisted state
  clearAll: () => {
    Object.values(COOKIE_KEYS).forEach(key => Cookies.remove(key));
  },
};

// Create listener middleware for automatic state persistence
export const persistenceMiddleware = createListenerMiddleware();

// Listen for UI state changes
persistenceMiddleware.startListening({
  predicate: (action) => action.type.startsWith('ui/'),
  effect: (action, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    StateManager.saveUIState(state.ui);
  },
});

// Listen for diagram state changes
persistenceMiddleware.startListening({
  predicate: (action) => 
    action.type === 'diagrams/setCurrentDiagram' || 
    action.type === 'diagrams/generateDiagram/fulfilled',
  effect: (action, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    StateManager.saveCurrentDiagram(state.diagrams.currentDiagram);
  },
});

// Listen for chat message changes
persistenceMiddleware.startListening({
  predicate: (action) => action.type.startsWith('chat/'),
  effect: (action, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    StateManager.saveChatMessages(state.chat.messages);
  },
});

// Initialize state from cookies
export const initializeStateFromCookies = (): Partial<RootState> => {
  // Check version compatibility first
  const isVersionValid = StateManager.checkVersion();
  if (!isVersionValid) {
    console.log('App version changed, state cleared');
    return {}; // Return empty state if version changed
  }

  try {
    return {
      ui: StateManager.loadUIState(),
      diagrams: {
        currentDiagram: StateManager.loadCurrentDiagram(),
        history: [],
        generating: false,
        error: null,
      },
      chat: {
        messages: StateManager.loadChatMessages(),
        loading: false,
        error: null,
      },
    };
  } catch (error) {
    console.error('Error loading state from cookies:', error);
    StateManager.clearAll(); // Clear corrupted state
    return {};
  }
}; 