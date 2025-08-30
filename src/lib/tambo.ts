/**
 * @file tambo.ts
 * @description Central configuration file for Tambo components and tools
 */

import type { TamboComponent, TamboTool } from "@tambo-ai/react";
import { z } from "zod";
import { UMLDisplay } from "../components/UMLDisplay";

/**
 * Components Array - Components that Tambo can control and generate
 */
export const components: TamboComponent[] = [
  {
    name: "UMLDisplay",
    description: "A component that displays UML diagrams with PlantUML code. Can show class diagrams, sequence diagrams, activity diagrams, use case diagrams, and more.",
    component: UMLDisplay,
    propsSchema: z.object({
      umlCode: z.string().describe("PlantUML code for the diagram"),
      title: z.string().optional().describe("Optional title for the diagram"),
      diagramType: z.string().optional().describe("Type of UML diagram (class, sequence, activity, etc.)")
    })
  }
];

/**
 * Tools Array - Functions that Tambo can call to perform actions
 */
export const tools: TamboTool[] = [
  {
    name: "generateUMLDiagram",
    description: "Generate a UML diagram based on user requirements using the RAG system with web search enabled",
    tool: async (params: { prompt: string; diagramType?: string }) => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: params.prompt,
            webSearchEnabled: true,
            diagram_type: params.diagramType
          })
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error('Failed to generate diagram');
        }

        return {
          success: true,
          umlCode: data.uml_code,
          fullResponse: data.full_response,
          context: data.context,
          generationMethod: data.generation_method
        };
      } catch (error) {
        console.error('UML generation error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },
    toolSchema: z.function().args(
      z.object({
        prompt: z.string().describe("User's request for UML diagram generation"),
        diagramType: z.string().optional().describe("Specific type of UML diagram requested (class, sequence, activity, etc.)")
      })
    )
  }
]; 