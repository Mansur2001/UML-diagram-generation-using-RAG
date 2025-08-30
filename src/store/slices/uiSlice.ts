import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  chatOpen: boolean;
  viewMode: 'split' | 'diagram' | 'code' | 'context';
  selectedTab: 'diagram' | 'context';
}

const initialState: UIState = {
  theme: 'dark',
  sidebarOpen: true,
  chatOpen: false,
  viewMode: 'split',
  selectedTab: 'diagram',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    toggleChat: (state) => {
      state.chatOpen = !state.chatOpen;
    },
    setViewMode: (state, action: PayloadAction<'split' | 'diagram' | 'code' | 'context'>) => {
      state.viewMode = action.payload;
    },
    setSelectedTab: (state, action: PayloadAction<'diagram' | 'context'>) => {
      state.selectedTab = action.payload;
    },
  },
});

export const { 
  toggleTheme, 
  setTheme, 
  toggleSidebar, 
  toggleChat, 
  setViewMode, 
  setSelectedTab 
} = uiSlice.actions;
export default uiSlice.reducer; 