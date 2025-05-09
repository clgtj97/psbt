import { Buffer as BufferPolyfill } from 'buffer';

// Global type extensions
declare global {
  interface Window {
    Buffer: typeof BufferPolyfill;
    global: typeof globalThis;
  }
}

// Initialize immediately
if (typeof window !== 'undefined') {
  window.Buffer = BufferPolyfill;
  window.global = window;
}

// Export utilities
export const Buffer = BufferPolyfill;
export const toHex = (data: Uint8Array) => Buffer.from(data).toString('hex');
export const fromHex = (hex: string) => Buffer.from(hex, 'hex');

export default BufferPolyfill;