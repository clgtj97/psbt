/**
 * LOCAL USAGE EXAMPLE
 * This file shows how to use the Runes etching implementation in a local project.
 */

import * as bitcoinUtils from './utils/real-bitcoin';
import * as runesUtils from './utils/runes';

// Example function to create and broadcast a Rune
export async function createAndBroadcastRune() {
  try {
    // Replace with an actual testnet private key with funds
    // IMPORTANT: Never hardcode private keys in production code
    const privateKey = 'cQHrby5nuaLSEFratRUSFrmz4hLgCvNvnTAvV5QCZLxykRCSRtQm';
    
    // Create the transaction
    const txResult = await bitcoinUtils.createRuneEtchingPSBT({
      privateKey,
      runeOptions: {
        runeName: 'EXAMPLERUNE',
        symbol: '¤',
        divisibility: 2,
        premine: '1000',
        mintable: true,
        mintAmount: '100',
        mintCap: '10'
      },
      feeRate: 2, // 2 sats/byte
      network: 'testnet'
    });
    
    console.log('Transaction created with ID:', txResult.txId);
    console.log('Transaction fee:', txResult.fee, 'sats');
    console.log('Change amount:', txResult.changeAmount, 'sats');
    
    // Broadcast the transaction
    // Uncomment the next line when you're ready to broadcast
    // const txid = await bitcoinUtils.broadcastTransaction(txResult.txHex, 'testnet');
    // console.log('Transaction broadcast! View at https://mempool.space/testnet/tx/' + txid);
    
    return txResult.txId;
  } catch (error) {
    console.error('Error creating or broadcasting Rune:', error);
    throw error;
  }
}

// Example function to verify a transaction on the blockchain
export async function checkTransaction(txid: string) {
  try {
    const isConfirmed = await bitcoinUtils.verifyTransaction(txid, 'testnet');
    if (isConfirmed) {
      console.log(`Transaction ${txid} is confirmed on the blockchain!`);
    } else {
      console.log(`Transaction ${txid} is not yet confirmed. It might be in the mempool or not broadcast.`);
    }
    return isConfirmed;
  } catch (error) {
    console.error('Error checking transaction:', error);
    throw error;
  }
}

// Example of how to set up a React component for this (pseudocode)
/*
import React, { useState } from 'react';
import { createAndBroadcastRune, checkTransaction } from './local-usage-example';

function RuneCreator() {
  const [privateKey, setPrivateKey] = useState('');
  const [runeName, setRuneName] = useState('');
  const [symbol, setSymbol] = useState('¤');
  const [divisibility, setDivisibility] = useState(0);
  const [premine, setPremine] = useState('1000');
  const [mintable, setMintable] = useState(false);
  const [txid, setTxid] = useState('');
  const [status, setStatus] = useState('idle');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('creating');
    
    try {
      const result = await bitcoinUtils.createRuneEtchingPSBT({
        privateKey,
        runeOptions: {
          runeName,
          symbol,
          divisibility,
          premine,
          mintable,
          mintAmount: mintable ? '100' : undefined,
          mintCap: mintable ? '10' : undefined,
        },
        feeRate: 2,
        network: 'testnet'
      });
      
      setStatus('broadcasting');
      const broadcastTxid = await bitcoinUtils.broadcastTransaction(result.txHex, 'testnet');
      setTxid(broadcastTxid);
      setStatus('success');
    } catch (error) {
      console.error('Error:', error);
      setStatus('error');
    }
  };

  return (
    <div>
      <h1>Create a Rune</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Private Key (WIF format):</label>
          <input 
            type="password" 
            value={privateKey} 
            onChange={(e) => setPrivateKey(e.target.value)} 
          />
        </div>
        <div>
          <label>Rune Name:</label>
          <input 
            type="text" 
            value={runeName} 
            onChange={(e) => setRuneName(e.target.value.toUpperCase())} 
          />
        </div>
        {/* Add other form fields *//*}
        <button type="submit" disabled={status === 'creating' || status === 'broadcasting'}>
          {status === 'idle' ? 'Create Rune' : 
           status === 'creating' ? 'Creating...' : 
           status === 'broadcasting' ? 'Broadcasting...' : 
           status === 'success' ? 'Success!' : 'Error'}
        </button>
      </form>
      
      {txid && (
        <div>
          <h2>Transaction Broadcast!</h2>
          <p>Transaction ID: {txid}</p>
          <a href={`https://mempool.space/testnet/tx/${txid}`} target="_blank" rel="noopener noreferrer">
            View on Block Explorer
          </a>
        </div>
      )}
    </div>
  );
}
*/

/**
 * SETUP INSTRUCTIONS FOR LOCAL ENVIRONMENT:
 * 
 * 1. Create a new project:
 *    npm create vite@latest my-runes-app -- --template react-ts
 *    cd my-runes-app
 * 
 * 2. Install dependencies:
 *    npm install bitcoinjs-lib ecpair tiny-secp256k1 axios buffer
 *    npm install -D vite-plugin-wasm vite-plugin-top-level-await
 * 
 * 3. Update vite.config.ts:
 *    ```typescript
 *    import { defineConfig } from 'vite'
 *    import react from '@vitejs/plugin-react'
 *    import wasm from 'vite-plugin-wasm'
 *    import topLevelAwait from 'vite-plugin-top-level-await'
 *    
 *    export default defineConfig({
 *      plugins: [
 *        react(),
 *        wasm(),
 *        topLevelAwait()
 *      ],
 *      optimizeDeps: {
 *        esbuildOptions: {
 *          target: 'es2020',
 *          supported: {
 *            bigint: true, // Required for bitcoinjs-lib
 *          },
 *        },
 *      },
 *      build: {
 *        target: 'es2020',
 *      },
 *    })
 *    ```
 * 
 * 4. Copy runes.ts and real-bitcoin.ts to your src/utils/ folder
 * 
 * 5. Create your UI components and import the functions as needed
 * 
 * 6. Get testnet coins from a faucet:
 *    - https://coinfaucet.eu/en/btc-testnet/
 *    - https://bitcoinfaucet.uo1.net/
 */