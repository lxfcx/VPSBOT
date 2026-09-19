import { api } from '@/lib/backend';
export const dynamic = 'force-dynamic';
async function handler(request: Request, context: {
    params: Promise<{
        path: string[];
    }>;
}) { try {
    const response=await api(request, (await context.params).path);response.headers.set('Cache-Control','private, no-store');return response;
}
catch (e: any) {
    const message = e?.message || '服务暂时不可用';
    return Response.json({ error: message === 'UNAUTHORIZED' ? '请登录后管理服务器' : message }, { status: message === 'UNAUTHORIZED' ? 401 : e?.name === 'ZodError' ? 400 : 503 });
} }
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
