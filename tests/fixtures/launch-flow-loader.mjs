const mocks = new Set(['@/lib/prisma', '@/lib/admin-auth', '@/lib/automation/config', './config', '@/lib/automation/engine']);
export async function resolve(specifier, context, nextResolve) {
  if (mocks.has(specifier)) return { shortCircuit: true, url: new URL('./launch-flow-mocks.mjs', import.meta.url).href };
  if (specifier === 'next/server') return nextResolve('next/server.js', context);
  if (specifier.startsWith('@/')) return nextResolve(new URL('../../' + specifier.slice(2) + '.ts', import.meta.url).href, context);
  return nextResolve(specifier, context);
}
