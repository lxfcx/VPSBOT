// Self-hosted entry only. The private Sites preview uses its own platform entry.
import app from '../dist/server/index.js';
export default {
  fetch(request, env, ctx) {
    // Never accept platform identity headers directly on a public Worker.
    const headers = new Headers(request.headers);
    for (const key of [...headers.keys()]) if (key.startsWith('oai-authenticated-')) headers.delete(key);
    if (env.AUTH_MODE !== 'token' || !env.ADMIN_TOKEN) {
      return new Response('Configure AUTH_MODE=token and ADMIN_TOKEN before use.', {status:503});
    }
    return app.fetch(new Request(request,{headers}),env,ctx);
  },
  async scheduled(controller, env, ctx) {
    if (!env.CRON_TOKEN) throw new Error('CRON_TOKEN not configured');
    // Reuse the same authenticated API and database logic without an external HTTP hop.
    const request = new Request('https://prism.internal/api/monitor/cron', {
      method:'POST', headers:{Authorization:'Bearer '+env.CRON_TOKEN,'Content-Type':'application/json'},body:'{}'
    });
    const response=await app.fetch(request,env,ctx);
    if(!response.ok)throw new Error('Prism watchdog failed: '+response.status);
  }
};
