import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface DiagramState {
  currentDiagram: {
    id: string;
    uml_code: string;
    type: string;
    png?: string;
    svg?: string;
    timestamp: string;
    prompt?: string;
    generation_method?: string;
  } | null;
  generating: boolean;
  error: string | null;
  history: Array<{
    id: string;
    uml_code: string;
    type: string;
    png?: string;
    svg?: string;
    timestamp: string;
    prompt?: string;
  }>;
}

const initialState: DiagramState = {
  currentDiagram: null,
  generating: false,
  error: null,
  history: []
};

// Async thunk for generating diagrams
export const generateDiagram = createAsyncThunk(
  'diagrams/generateDiagram',
  async (params: {
    prompt: string;
    webSearchEnabled: boolean;
    embeddedFile: File | null;
    diagramType?: string;
  }) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: params.prompt,
        webSearchEnabled: params.webSearchEnabled,
        diagram_type: params.diagramType
      })
    });

    if (!response.ok) {
      throw new Error(`Generation failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Generation failed');
    }

    // Backend might return {uml_code, ...} or {diagram: {code: ...}}
    const umlCode: string | undefined = data.uml_code ?? data.diagram?.code;

    if (!umlCode) {
      throw new Error('Backend returned no UML code');
    }

    return {
      uml_code: umlCode,
      full_response: data.full_response ?? data,
      context: data.context ?? [],
      generation_method: data.generation_method ?? data.diagram?.type ?? 'unknown',
      prompt: params.prompt
    };
  }
);

// Async thunk for rendering diagrams
export const renderDiagramAsync = createAsyncThunk(
  'diagrams/renderDiagram',
  async (umlCode: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    const response = await fetch(`${baseUrl}/api/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uml_code: umlCode
      })
    });

    if (!response.ok) {
      throw new Error(`Rendering failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error('Rendering failed');
    }

    return {
      uml_code: umlCode,
      png: data.png,
      svg: data.svg
    };
  }
);

const diagramsSlice = createSlice({
  name: 'diagrams',
  initialState,
  reducers: {
    setCurrentCode: (state, action: PayloadAction<string>) => {
      if (state.currentDiagram) {
        state.currentDiagram.uml_code = action.payload;
      } else {
        state.currentDiagram = {
          id: Date.now().toString(),
          uml_code: action.payload,
          type: 'unknown',
          timestamp: new Date().toISOString()
        };
      }
    },
    
    renderDiagram: (state, action: PayloadAction<{
      uml_code: string;
      png?: string;
      svg?: string;
    }>) => {
      const { uml_code, png, svg } = action.payload;
      
      if (state.currentDiagram) {
        state.currentDiagram.uml_code = uml_code;
        state.currentDiagram.png = png;
        state.currentDiagram.svg = svg;
        state.currentDiagram.timestamp = new Date().toISOString();
      } else {
        state.currentDiagram = {
          id: Date.now().toString(),
          uml_code,
          type: 'unknown',
          png,
          svg,
          timestamp: new Date().toISOString()
        };
      }
    },
    
    clearCurrentDiagram: (state) => {
      state.currentDiagram = null;
      state.error = null;
    },
    
    addToHistory: (state, action: PayloadAction<{
      id: string;
      uml_code: string;
      type: string;
      timestamp: string;
      png?: string;
      svg?: string;
      prompt?: string;
    }>) => {
      state.history.unshift(action.payload);
      // Keep only last 20 items
      if (state.history.length > 20) {
        state.history = state.history.slice(0, 20);
      }
    },
    
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Generate diagram cases
      .addCase(generateDiagram.pending, (state) => {
        state.generating = true;
        state.error = null;
      })
      .addCase(generateDiagram.fulfilled, (state, action) => {
        state.generating = false;
        
        const diagram = {
          id: Date.now().toString(),
          uml_code: action.payload.uml_code,
          type: action.payload.generation_method || 'unknown',
          timestamp: new Date().toISOString(),
          prompt: action.payload.prompt,
          generation_method: action.payload.generation_method
        };
        
        state.currentDiagram = diagram;
        
        // Add to history
        state.history.unshift({
          id: diagram.id,
          uml_code: diagram.uml_code,
          type: diagram.type,
          timestamp: diagram.timestamp,
          prompt: diagram.prompt
        });
        
        // Auto-render the generated diagram
        renderDiagramAsync(action.payload.uml_code);
      })
      .addCase(generateDiagram.rejected, (state, action) => {
        state.generating = false;
        state.error = action.error.message || 'Generation failed';
      })
      
      // Render diagram cases
      .addCase(renderDiagramAsync.pending, (state) => {
        // Don't set generating=true for renders, only for generations
      })
      .addCase(renderDiagramAsync.fulfilled, (state, action) => {
        if (state.currentDiagram) {
          state.currentDiagram.png = action.payload.png;
          state.currentDiagram.svg = action.payload.svg;
          state.currentDiagram.timestamp = new Date().toISOString();
        }
      })
      .addCase(renderDiagramAsync.rejected, (state, action) => {
        state.error = action.error.message || 'Rendering failed';
      });
  }
});

export const { 
  setCurrentCode, 
  renderDiagram, 
  clearCurrentDiagram, 
  addToHistory, 
  clearError 
} = diagramsSlice.actions;

export default diagramsSlice.reducer; 