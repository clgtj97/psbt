import { initEccLib } from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

export function initBitcoinJS() {
  initEccLib(ecc);
}

// Call it immediately
initBitcoinJS();