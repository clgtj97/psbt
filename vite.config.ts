import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'crypto'],
      globals: {
        Buffer: true,
        process: true,
      }
    }),
    wasm(),
    topLevelAwait()
  ],
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
  },
  resolve: {
    alias: {
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      buffer: 'buffer/'
    }
  },
  optimizeDeps: {
    include: [
      'buffer',
      'crypto-browserify',
      'bitcoinjs-lib',
      'ecpair',
      'tiny-secp256k1'
    ],
    esbuildOptions: {
      target: 'es2020',
      define: {
        global: 'globalThis'
      },
      supported: {
        bigint: true
      }
    }
  },
  build: {
    target: 'es2020',
    commonjsOptions: {
      transformMixedEsModules: true
    }
  }
});