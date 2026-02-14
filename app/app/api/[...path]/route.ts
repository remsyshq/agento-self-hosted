import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_URL || 'http://localhost:3001';

async function proxy(req: NextRequest) {
  const url = new URL(req.url);
  // Strip /api prefix to get the orchestrator path
  const path = url.pathname.replace(/^\/api/, '');
  const target = `${API_BASE}${path}${url.search}`;

  const headers = new Headers();
  // Forward relevant headers
  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  const ct = req.headers.get('content-type');
  if (ct) headers.set('content-type', ct);

  const fetchOpts: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    fetchOpts.body = await req.text();
  }

  try {
    const res = await fetch(target, fetchOpts);

    // Check if it's a streaming response
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      return new NextResponse(res.body, {
        status: res.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: {
        'Content-Type': contentType || 'application/json',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to connect to orchestrator', details: err.message },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
