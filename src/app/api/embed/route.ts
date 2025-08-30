import { NextRequest, NextResponse } from 'next/server';

// Allowed file types for embedding
const ALLOWED_TYPES = [
  'text/plain',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/json',
  'application/xml',
  'text/csv',
  'text/markdown',
  'text/x-python',
  'text/x-java-source',
  'text/x-c',
  'text/x-c++',
  'text/x-go',
  'text/x-rustsrc',
  'text/x-typescript',
  'text/x-javascript',
  'text/x-shellscript',
  'text/x-sql',
  'text/x-yaml',
  'text/x-plantuml',
  'text/x-mermaid',
];

export async function POST(request: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { error: 'No file uploaded.' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 415 }
      );
    }

    // Prepare to stream file to Python backend
    const pythonBackendUrl = 'http://localhost:8000/embed';
    let pythonResponse;
    try {
      pythonResponse = await fetch(pythonBackendUrl, {
        method: 'POST',
        body: file.stream(),
      });
    } catch (backendError) {
      console.error('Embed API backend error:', backendError);
      return NextResponse.json(
        {
          success: false,
          error: 'The embedding service is currently unavailable. Please contact the developer to activate the backend service.',
        },
        { status: 503 }
      );
    }

    if (!pythonResponse.ok) {
      const errorText = await pythonResponse.text();
      return NextResponse.json(
        {
          success: false,
          error: `Python backend error: ${pythonResponse.statusText} - ${errorText}`,
        },
        { status: 500 }
      );
    }

    // Parse backend response
    let backendData;
    try {
      backendData = await pythonResponse.json();
    } catch (parseError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse backend response.',
        },
        { status: 500 }
      );
    }

    // Return backend response to frontend
    return NextResponse.json({
      success: true,
      message: backendData.message || 'File embedded successfully!',
      embedding: backendData.embedding || null,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      context: backendData.context || null,
      diagram: backendData.diagram || null,
    });
  } catch (error) {
    console.error('Embed API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
} 