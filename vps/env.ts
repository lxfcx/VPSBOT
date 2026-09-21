// The standalone server initializes these bindings before importing the backend.
export const env = (globalThis as typeof globalThis & {VPS_ENV: Record<string, unknown>}).VPS_ENV;
