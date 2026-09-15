const mocked = new Set([
  '@/lib/prisma', '@/lib/admin-auth', '@/lib/rate-limit',
  '@/lib/automation/config', './config', './collector', './ai-extractor', './engine', './logger',
]);
export async function resolve(specifier, context, nextResolve) {
  if (mocked.has(specifier)) return { shortCircuit: true, url: new URL('./review-flow-mocks.mjs', import.meta.url).href };
  if (specifier === 'next/server') return nextResolve('next/server.js', context);
  if (specifier.startsWith('@/')) return nextResolve(new URL('../../' + specifier.slice(2) + '.ts', import.meta.url).href, context);
  return nextResolve(specifier, context);
}
