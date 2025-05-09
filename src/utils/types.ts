export type Network = 'mainnet' | 'testnet';

export interface RuneOptions {
  divisibility?: number;
  premine?: string;
  runeName: string;
  symbol?: string;
  mintable?: boolean;
  mintAmount?: string;
  mintCap?: string;
}

export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status: {
    confirmed: boolean;
    block_height?: number;
  };
}