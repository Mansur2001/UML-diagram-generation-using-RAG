import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const backendResp = await fetch(`${BACKEND_URL}/api/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await backendResp.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      // backend returned non-json (e.g., Python exception); wrap it
      return new Response(
        JSON.stringify({ success: false, error: `Upstream non-JSON: ${text}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!backendResp.ok || !data.success) {
      return new Response(
        JSON.stringify({ success: false, error: data.detail || data.error || 'Render failed' }),
        { status: backendResp.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Proxy render error:', e);
    return new Response(
      JSON.stringify({ success: false, error: e.message || 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
