/**
 * Runestone Protocol Implementation
 * 
 * This implementation follows the structure seen in your example transaction:
 * bc1p92k0xxdt77gddvvp0x4tt5l4nwzra7vlcep9g58dwlp4xukfjpssha86xt
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import axios from 'axios';

// Initialize ECC library
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// Network configurations
const networks = {
  mainnet: bitcoin.networks.bitcoin,
  testnet: bitcoin.networks.testnet,
};

// Constants
const RUNESTONE_HEADER = Buffer.from('Runestone', 'utf8'); // As seen in your example
const DUST_THRESHOLD = 546;
const BASE_TX_SIZE = 150;

/**
 * Creates a Runestone etching transaction following the protocol from your example
 */
export async function createRunestoneEtching(options: {
  runeOptions: {
    runeName: string;
    premine: bigint;
    divisibility?: number;
    symbol?: string;
    terms?: {
      amount?: bigint;
      cap?: bigint;
      heightStart?: number;
      heightEnd?: number;
    };
  };
  feeRate: number;
  network?: 'mainnet' | 'testnet';
}): Promise<{ txId: string; totalFee: number; devFee: number; minerFee: number }> {
  const network = options.network || 'testnet';
  const bitcoinNetwork = networks[network];

  // Dev fee constants (adjust these as needed)
  const MIN_DEV_FEE = 1500; // Minimum 1500 sats
  const MAX_DEV_FEE = 4999; // Maximum 4999 sats
  const DEV_FEE_ADDRESS = 'tb1pehxzgzc6t7fdtttszuv9fu3aprzct56s244yqel65kujru74d3qskg9564'; // Replace with your actual address

  // Get address from Unisat
  const [address] = await window.unisat.getAccounts();
  if (!address) throw new Error('No address found in Unisat');

  // Fetch UTXOs
  const utxos = await fetchUTXOs(address, network);
  const confirmedUtxos = utxos.filter(utxo => utxo.status?.confirmed);
  if (confirmedUtxos.length === 0) throw new Error('No confirmed UTXOs available');

  // Select largest UTXO
  const selectedUtxo = confirmedUtxos.sort((a, b) => b.value - a.value)[0];

  const psbt = new bitcoin.Psbt({ network: bitcoinNetwork });
  
  // Add input
  psbt.addInput({
    hash: selectedUtxo.txid,
    index: selectedUtxo.vout,
    witnessUtxo: {
      script: bitcoin.address.toOutputScript(address, bitcoinNetwork),
      value: selectedUtxo.value,
    },
    sequence: 0xfffffffd
  });

  // Create Runestone payload
  const runestonePayload = createRunestonePayload(options.runeOptions);

  // Add Runestone output (OP_RETURN)
  psbt.addOutput({
    script: bitcoin.script.compile([
      bitcoin.opcodes.OP_RETURN,
      Buffer.from('Runestone', 'utf8'),
      Buffer.from([0x01]), // Version byte
      runestonePayload
    ]),
    value: 0
  });

  // Calculate base miner fee
  const baseTxSize = BASE_TX_SIZE + runestonePayload.length;
  let minerFee = Math.ceil(baseTxSize * options.feeRate);

  // Calculate dev fee (capped between min/max)
  let devFee = Math.min(MAX_DEV_FEE, Math.max(MIN_DEV_FEE, minerFee * 0.1)); // 10% of miner fee

  // Add dev fee output
  psbt.addOutput({
    address: DEV_FEE_ADDRESS,
    value: devFee
  });

  // Recalculate total fee including dev fee output size
  const totalTxSize = baseTxSize + 34; // +34 bytes for dev fee output
  const totalFee = Math.ceil(totalTxSize * options.feeRate);
  let changeAmount = selectedUtxo.value - totalFee - devFee;

  // Add change output if remaining amount is above dust threshold
  if (changeAmount > DUST_THRESHOLD) {
    psbt.addOutput({
      address: address,
      value: changeAmount
    });
  } else if (changeAmount > 0) {
    // If small remaining amount, add to miner fee
    minerFee += changeAmount;
  }

  // Final verification
  const requiredTotal = totalFee + devFee;
  if (selectedUtxo.value < requiredTotal) {
    throw new Error(`Insufficient funds. Need ${requiredTotal} sats (${minerFee} miner + ${devFee} dev fee), have ${selectedUtxo.value}`);
  }

  // Sign and broadcast
  const unsignedPSBT = psbt.toHex();
  const signedPSBT = await window.unisat.signPsbt(unsignedPSBT);
  const txid = await window.unisat.pushPsbt(signedPSBT);
  
  return { 
    txId: txid, 
    totalFee: minerFee + devFee,
    devFee,
    minerFee
  };
}

/**
 * Creates a Runestone payload matching the structure from your example
 */
function createRunestonePayload(options: {
  runeName: string;
  premine: bigint;
  divisibility?: number;
  symbol?: string;
  terms?: {
    amount?: bigint;
    cap?: bigint;
    heightStart?: number;
    heightEnd?: number;
  };
}): Buffer {
  const buffers: Buffer[] = [];

  // Add premine (required)
  buffers.push(Buffer.from([0x01])); // Premine tag
  buffers.push(Buffer.from(options.premine.toString(16).padStart(16, '0'), 'hex'));

  // Add rune name (required)
  buffers.push(Buffer.from([0x02])); // Rune name tag
  buffers.push(Buffer.from(options.runeName, 'utf8'));

  // Add divisibility if specified
  if (options.divisibility !== undefined) {
    buffers.push(Buffer.from([0x03])); // Divisibility tag
    buffers.push(Buffer.from([options.divisibility]));
  }

  // Add symbol if specified
  if (options.symbol) {
    buffers.push(Buffer.from([0x04])); // Symbol tag
    buffers.push(Buffer.from(options.symbol, 'utf8'));
  }

  // Add terms if specified
  if (options.terms) {
    if (options.terms.amount !== undefined) {
      buffers.push(Buffer.from([0x05])); // Amount tag
      buffers.push(Buffer.from(options.terms.amount.toString(16).padStart(16, '0'), 'hex'));
    }
    if (options.terms.cap !== undefined) {
      buffers.push(Buffer.from([0x06])); // Cap tag
      buffers.push(Buffer.from(options.terms.cap.toString(16).padStart(16, '0'), 'hex'));
    }
    if (options.terms.heightStart !== undefined) {
      buffers.push(Buffer.from([0x07])); // Height start tag
      buffers.push(Buffer.from(options.terms.heightStart.toString(16).padStart(8, '0'), 'hex'));
    }
    if (options.terms.heightEnd !== undefined) {
      buffers.push(Buffer.from([0x08])); // Height end tag
      buffers.push(Buffer.from(options.terms.heightEnd.toString(16).padStart(8, '0'), 'hex'));
    }
  }

  // Combine all buffers
  return Buffer.concat(buffers);
}


// Helper function to fetch UTXOs (same as before)
async function fetchUTXOs(address: string, network: 'mainnet' | 'testnet'): Promise<any[]> {
  const baseUrl = network === 'mainnet' 
    ? 'https://blockstream.info/api' 
    : 'https://blockstream.info/testnet/api';
  
  const response = await axios.get(`${baseUrl}/address/${address}/utxo`);
  return response.data;
}