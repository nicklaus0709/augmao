// Redirige el SDK de Base44 (import "npm:" de Deno) al mock en memoria.
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    if (specifier.startsWith('npm:@base44/sdk')) {
      return { url: ${JSON.stringify(new URL('./mock-sdk.mjs', import.meta.url).href)}, shortCircuit: true };
    }
    return next(specifier, context);
  }
`));
