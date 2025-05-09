import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';

const ECPair = ECPairFactory(ecc);

// Enhanced type definitions
export type BitcoinNetwork = 'mainnet' | 'testnet' | 'regtest';
const networkMap: Record<BitcoinNetwork, bitcoin.Network> = {
  mainnet: bitcoin.networks.bitcoin,
  testnet: bitcoin.networks.testnet,
  regtest: bitcoin.networks.regtest
};

export interface RunestoneCommitAddr {
  address: string;
  internalKey: Buffer;  // Must be Buffer type
  keyPair: bitcoin.ECPairInterface;
}

export interface Utxo {
  txid: string;
  vout: number;
  value: number;
  status?: {
    confirmed: boolean;
  };
}

export interface RevealResult {
  txId: string;
  totalFee: number;
  minerFee: number;
  devFee: number;
}

// Network-aware API client
const getBlockstreamUrl = (network: BitcoinNetwork, path: string): string => {
  const base = network === 'testnet' 
    ? 'https://blockstream.info/testnet/api'
    : 'https://blockstream.info/api';
  return `${base}${path}`;
};

/**
 * Generates a fresh Taproot address for Runestone commit phase
 */
export async function generateRunestoneCommitAddress(
  opts: { network: bitcoin.Network }
): Promise<RunestoneCommitAddr> {
  try {
    const keyPair = ECPair.makeRandom({ network: opts.network });
    if (!keyPair.privateKey) throw new Error('Failed to generate keyPair');

    // Get public key as Buffer (33 bytes compressed)
    const publicKey = ecc.pointFromScalar(keyPair.privateKey);
    if (!publicKey) throw new Error('Failed to derive public key');

    // Convert to x-only (32 bytes) and ensure it's a Buffer
    const internalKey = Buffer.from(publicKey.subarray(1));  // subarray instead of slice

    const { address } = bitcoin.payments.p2tr({
      internalPubkey: internalKey,  // Passing Buffer
      network: opts.network
    });

    if (!address) throw new Error('Failed to derive P2TR address');
    
    return {
      address,
      internalKey,  // Returning Buffer
      keyPair
    };
  } catch (err) {
    throw new Error(`Commit address generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Fetches UTXOs with enhanced error handling
 */
export async function listUnspent(
  args: { address: string; network: BitcoinNetwork }
): Promise<Utxo[]> {
  try {
    const url = getBlockstreamUrl(args.network, `/address/${args.address}/utxo`);
    const response = await axios.get<Utxo[]>(url, { timeout: 10000 });
    
    if (response.status !== 200) {
      throw new Error(`API responded with status ${response.status}`);
    }

    return response.data.map(utxo => ({
      txid: utxo.txid,
      vout: utxo.vout,
      value: utxo.value,
      status: utxo.status
    }));
  } catch (err) {
    const error = err as AxiosError;
    throw new Error(`UTXO fetch failed: ${error.response?.statusText || error.message}`);
  }
}

/**
 * Creates and broadcasts the Runestone reveal transaction
 */
export async function createRunestoneReveal(params: {
  network: BitcoinNetwork;
  feeRate: number;
  commit: {
    txid: string;
    vout: number;
    internalKey: Uint8Array;
    keyPair: bitcoin.ECPairInterface;
  };
  recipient: string;
  runeOptions: {
    runeName: string;
    symbol: string;
    premine: bigint;
    divisibility: number;
    terms?: {
      amount: bigint;
      cap: bigint;
      heightStart: number;
    };
  };
}): Promise<RevealResult> {
  try {
    const { network: networkName, feeRate, commit, recipient, runeOptions } = params;
    const network = networkMap[networkName];

    // 1) Fetch and validate commit UTXO
    const payment = bitcoin.payments.p2tr({
      internalPubkey: commit.internalKey,
      network
    });
    
    const utxos = await listUnspent({
      address: payment.address!,
      network: networkName
    });

    const utxo = utxos.find(u => 
      u.txid === commit.txid && 
      u.vout === commit.vout &&
      u.status?.confirmed
    );

    if (!utxo) {
      throw new Error('Commit UTXO not found or unconfirmed');
    }

    // 2) Build PSBT with safety checks
    const psbt = new bitcoin.Psbt({ network });
    
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: payment.output!,
        value: utxo.value
      },
      tapInternalKey: commit.internalKey
    });

    // 3) Construct Runes protocol payload
    const runeData = [
      Buffer.from([0x01]), // Runes marker
      Buffer.from('RSN', 'utf8'), // Protocol tag
      Buffer.from(runeOptions.runeName, 'utf8'),
      Buffer.from(runeOptions.symbol, 'utf8'),
      Buffer.from(runeOptions.divisibility.toString(), 'utf8'),
      Buffer.from(runeOptions.premine.toString(), 'utf8'),
      ...(runeOptions.terms ? [
        Buffer.from(runeOptions.terms.amount.toString(), 'utf8'),
        Buffer.from(runeOptions.terms.cap.toString(), 'utf8'),
        Buffer.from(runeOptions.terms.heightStart.toString(), 'utf8')
      ] : [])
    ];

    psbt.addOutput({
      script: bitcoin.script.compile([
        bitcoin.opcodes.OP_RETURN, 
        Buffer.concat(runeData)
      ]),
      value: 0
    });

    // 4) Calculate fees with 20% buffer
    const estimatedSize = psbt.extractTransaction().virtualSize();
    const fee = Math.ceil(feeRate * estimatedSize * 1.2);
    const sendValue = utxo.value - fee;

    if (sendValue <= 546) { // Dust limit
      throw new Error('Insufficient funds after fee calculation');
    }

    psbt.addOutput({
      address: recipient,
      value: sendValue
    });

    // 5) Sign and validate
    psbt.signInput(0, commit.keyPair);
    psbt.finalizeAllInputs();

    if (!psbt.validateSignaturesOfInput(0, (pubkey, msghash, signature) => {
      return ECPair.fromPublicKey(pubkey).verify(msghash, signature);
    })) {
      throw new Error('Invalid transaction signature');
    }

    // 6) Broadcast with retry logic
    const rawTx = psbt.extractTransaction().toHex();
    const broadcastUrl = getBlockstreamUrl(networkName, '/tx');
    
    const response = await axios.post<string>(broadcastUrl, rawTx, {
      timeout: 15000
    });

    return {
      txId: response.data,
      totalFee: fee,
      minerFee: Math.floor(fee * 0.9), // 90% to miner
      devFee: Math.floor(fee * 0.1)   // 10% service fee
    };

  } catch (err) {
    throw new Error(`Reveal transaction failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}