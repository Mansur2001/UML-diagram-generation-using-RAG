import { configureStore } from '@reduxjs/toolkit';
import diagramsReducer from './slices/diagramsSlice';
import chatReducer from './slices/chatSlice';
import uiReducer from './slices/uiSlice';
import { persistenceMiddleware } from './persistence';

// Create the store first without preloaded state
const createStore = () => configureStore({
  reducer: {
    diagrams: diagramsReducer,
    chat: chatReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'diagrams/addDiagram', 
          'diagrams/updateDiagram',
          'persist/PERSIST',
          'persist/REHYDRATE'
        ],
        ignoredPaths: ['diagrams.diagrams'],
      },
    }).concat(persistenceMiddleware.middleware),
});

export const store = createStore();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 