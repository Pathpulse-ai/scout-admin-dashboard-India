import { NextRequest, NextResponse } from 'next/server';

const SCOUT_BACKEND = process.env.SCOUT_BACKEND;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

type RouteContext = { params: Promise<{ slug: string[] }> };

async function proxyRequest(request: NextRequest, context: RouteContext) {
    if (!SCOUT_BACKEND) {
        return NextResponse.json(
            { error: 'SCOUT_BACKEND is not configured in environment' },
            { status: 500 }
        );
    }

    const { slug } = await context.params;
    const subPath = slug.join('/');
    const url = new URL(request.url);
    const targetUrl = `${SCOUT_BACKEND.replace(/\/+$/, '')}/${subPath}${url.search}`;

    const headers: Record<string, string> = {
        'Accept': 'application/json',
    };

    if (ADMIN_API_KEY) {
        headers['x-admin-api-key'] = ADMIN_API_KEY;
        headers['Authorization'] = `Bearer ${ADMIN_API_KEY}`;
    }

    const contentType = request.headers.get('content-type');
    if (contentType) {
        headers['content-type'] = contentType;
    }

    const fetchOptions: RequestInit = {
        method: request.method,
        headers,
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
        try {
            const body = await request.text();
            if (body) {
                fetchOptions.body = body;
            }
        } catch {
            // No body
        }
    }

    try {
        const response = await fetch(targetUrl, fetchOptions);
        const data = await response.text();

        return new NextResponse(data, {
            status: response.status,
            headers: {
                'content-type': response.headers.get('content-type') || 'application/json',
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to proxy request to backend';
        return NextResponse.json(
            { error: message },
            { status: 502 }
        );
    }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
