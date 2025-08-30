import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    // Call our Python backend instead of OpenAI directly
    const response = await fetch('http://localhost:8000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    const assistantResponse = data.response || 'I can help you with UML diagrams!';

    return NextResponse.json({ 
      response: assistantResponse,
      success: true 
    });

  } catch (error: any) {
    console.error('Chat API error:', error);
    
    // Return intelligent fallback response that doesn't loop
    return NextResponse.json({ 
      response: 'I\'m an expert UML diagram assistant! I can help you create class diagrams, sequence diagrams, activity diagrams, component diagrams, and use case diagrams with intelligent pattern detection. What type of diagram would you like me to create?',
      success: false,
      error: error.message 
    });
  }
} 