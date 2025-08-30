import { NextRequest, NextResponse } from 'next/server';
import { GenerationRequest, GenerationResponse, UMLDiagram } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: GenerationRequest = await request.json();
    
    // Validate request
    if (!body.prompt) {
      return NextResponse.json(
        { error: 'Missing required field: prompt' },
        { status: 400 }
      );
    }

    // Call Python backend for code generation
    const pythonResponse = await fetch('http://localhost:8000/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: body.prompt,
        diagram_type: body.diagramType || 'class',
        context_count: body.contextCount || 3,
        temperature: body.temperature || 0.2,
        max_tokens: body.maxTokens || 1024,
      }),
    });

    if (!pythonResponse.ok) {
      throw new Error(`Python backend error: ${pythonResponse.statusText}`);
    }

    const pythonData = await pythonResponse.json();
    let png = null;
    let svg = null;
    let uml_code = pythonData.uml_code || pythonData.diagram?.code || '';

    // Only if code is present, call /api/render to get images
    if (uml_code) {
      try {
        const renderRes = await fetch('http://localhost:8000/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uml_code }),
        });
        if (renderRes.ok) {
          const renderData = await renderRes.json();
          png = renderData.png || null;
          svg = renderData.svg || null;
        } else {
          // If rendering fails, log and continue with code only
          const errText = await renderRes.text();
          console.error('PlantUML rendering failed:', errText);
        }
      } catch (renderError) {
        console.error('Error calling /api/render:', renderError);
      }
    }

    // Transform response to frontend format
    const response: GenerationResponse = {
      success: true,
      diagram: {
        id: Date.now().toString(),
        type: body.diagramType,
        code: uml_code,
        description: body.prompt,
        createdAt: new Date(),
        updatedAt: new Date(),
        png,
        svg,
      },
      context: pythonData.context || [],
      error: pythonData.error,
      fullResponse: pythonData.full_response,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Generation API error:', error);
    
    // Check if it's a connection error
    if (error instanceof Error && error.message.includes('fetch failed')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'The AI model service is currently unavailable. Please contact the developer to activate the backend service.' 
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
} 