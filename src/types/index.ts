export interface UMLDiagram {
  id: string;
  type: 'class' | 'sequence' | 'usecase' | 'activity' | 'state';
  code: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  png?: string | null;
  svg?: string | null;
  context?: RAGContext[];
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  diagramId?: string;
}

export interface RAGContext {
  type: 'text' | 'plantuml' | 'graph';
  content: string;
  source: string;
  score: number;
  matched_terms: string[];
  description?: string;
  title?: string;
  plantuml_code?: string;
}

export interface GenerationRequest {
  prompt: string;
  diagramType: UMLDiagram['type'];
  contextCount?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerationResponse {
  success: boolean;
  diagram?: UMLDiagram;
  context?: RAGContext[];
  error?: string;
  fullResponse?: string;
}

export interface UserSession {
  id: string;
  diagrams: UMLDiagram[];
  chatHistory: ChatMessage[];
  preferences: {
    defaultDiagramType: UMLDiagram['type'];
    autoSave: boolean;
    theme: 'light' | 'dark';
  };
}

export interface ExportOptions {
  format: 'png' | 'svg' | 'plantuml' | 'mermaid';
  includeCode?: boolean;
  includeMetadata?: boolean;
}

export interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
} 