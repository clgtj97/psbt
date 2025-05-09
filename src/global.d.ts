/// <reference types="vite/client" />

declare module 'crypto-browserify'
declare module 'stream-browserify'
declare module 'util'

interface Window {
  global: typeof globalThis
  Buffer: typeof Buffer
  process: {
    env: {
      NODE_ENV: 'development' | 'production'
    }
  }
}