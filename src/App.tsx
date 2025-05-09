import { useState, FormEvent } from 'react';
import { useWallet } from './hooks/useWallet';
import * as bitcoinUtils from './utils/real-bitcoin';
import type { BitcoinNetwork } from './utils/real-bitcoin';
import './App.css';
import { networks } from 'bitcoinjs-lib';
const NETWORK = networks.testnet; // Use the actual network object

type RuneFormData = {
  address: string;
  runeName: string;
  symbol: string;
  divisibility: number;
  premine: string;
  mintable: boolean;
  mintAmount?: string;
  mintCap?: string;
};

type TransactionStatus =
  | 'idle'
  | 'waitingForPay'
  | 'fetchingUTXO'
  | 'creatingReveal'
  | 'success'
  | 'error';

export default function App() {
  const { isInstalled } = useWallet();
  const [formData, setFormData] = useState<RuneFormData>({
    address: '',
    runeName: '',
    symbol: '¤',
    divisibility: 0,
    premine: '1000',
    mintable: false,
    mintAmount: '1000',
    mintCap: '1000'
  });

  // Commit & reveal state
  const [commitAddr, setCommitAddr] = useState<string | null>(null);
  const [commitKey, setCommitKey] = useState<Uint8Array | null>(null);
  const [commitUtxo, setCommitUtxo] = useState<{ txid: string; vout: number } | null>(null);
  const [status, setStatus] = useState<TransactionStatus>('idle');
  const [error, setError] = useState<string>('');
  const [txResult, setTxResult] = useState<bitcoinUtils.RevealResult | null>(null);

  const handleInputChange = (
    field: keyof RuneFormData,
    value: string | number | boolean
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): string | null => {
    const { address, runeName, premine, mintable, mintAmount, mintCap } = formData;
    
    // Address validation
    if (!address) return 'Please enter a Bitcoin address';
    if (!/^(tb1|bcrt1)[a-z0-9]{25,90}$/i.test(address)) {
      return 'Please enter a valid bech32 address';
    }

    // Rune name validation
    if (!runeName) return 'Rune name is required';
    if (!/^[A-Z•]+$/.test(runeName)) {
      return 'Rune name can only contain A–Z and •';
    }
    if (runeName.length > 28) return 'Rune name too long (max 28 chars)';

    // Number validation
    if (!/^\d+$/.test(premine)) return 'Premine must be a whole number';
    if (mintable) {
      if (!mintAmount || !/^\d+$/.test(mintAmount)) {
        return 'Mint amount must be a whole number';
      }
      if (!mintCap || !/^\d+$/.test(mintCap)) {
        return 'Mint cap must be a whole number';
      }
    }

    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setTxResult(null);

    try {
      // Phase 1: Generate commit address
      if (!commitAddr) {
        const validationError = validateForm();
        if (validationError) {
          setError(validationError);
          setStatus('error');
          return;
        }

        setStatus('waitingForPay');
        const { address: payTo, internalKey } = await bitcoinUtils.generateRunestoneCommitAddress({
          network: NETWORK
        });
        setCommitAddr(payTo);
        setCommitKey(internalKey);
        return;
      }

      // Phase 2: Check for UTXO
      if (commitAddr && !commitUtxo) {
        setStatus('fetchingUTXO');
        const utxos = await bitcoinUtils.listUnspent({
          address: commitAddr,
          network: NETWORK
        });

        if (utxos.length === 0) {
          setError(`Waiting for ~546 sats to be sent to ${commitAddr}`);
          setStatus('error');
          return;
        }

        // Find the largest UTXO to handle cases where multiple dust payments were sent
        const largestUtxo = utxos.reduce((prev, current) => 
          (prev.value > current.value) ? prev : current
        );
        
        setCommitUtxo({ txid: largestUtxo.txid, vout: largestUtxo.vout });
        return;
      }

      // Phase 3: Create reveal transaction
      if (commitUtxo && commitKey) {
        setStatus('creatingReveal');
        const { 
          runeName, 
          symbol, 
          divisibility, 
          premine, 
          mintable, 
          mintAmount, 
          mintCap,
          address: recipient 
        } = formData;

        const revealRes = await bitcoinUtils.createRunestoneReveal({
          network: NETWORK,
          feeRate: 15,
          commit: {
            txid: commitUtxo.txid,
            vout: commitUtxo.vout,
            internalKey: commitKey
          },
          recipient,
          runeOptions: {
            runeName: runeName.toUpperCase(),
            symbol,
            premine: BigInt(premine),
            divisibility,
            terms: mintable ? {
              amount: BigInt(mintAmount!),
              cap: BigInt(mintCap!),
              heightStart: 840000
            } : undefined
          }
        });

        setTxResult(revealRes);
        setStatus('success');
      }
    } catch (err) {
      console.error('Transaction error:', err);
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStatus('error');
      
      // Reset some state on error to allow retry
      if (status === 'creatingReveal') {
        setCommitUtxo(null);
      }
    }
  };

  const statusLabels: Record<TransactionStatus, string> = {
    idle: 'Start Runestone',
    waitingForPay: 'Pay 546 sats →',
    fetchingUTXO: 'Checking for payment…',
    creatingReveal: 'Revealing Rune…',
    success: 'Done!',
    error: 'Error – Try Again'
  };

  if (!isInstalled) {
    return (
      <div className="wallet-prompt">
        <h2>Wallet Required</h2>
        <p>
          Please install{' '}
          <a href="https://unisat.io/" target="_blank" rel="noopener noreferrer">
            Unisat Wallet
          </a>{' '}
          to create Runes
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Create a Runestone</h1>
      <form onSubmit={handleSubmit} className="form">
        {!commitAddr ? (
          <>
            <div className="form-group">
              <label>Destination Address:</label>
              <input
                type="text"
                value={formData.address}
                onChange={e => handleInputChange('address', e.target.value.trim())}
                placeholder="tb1q…"
                className="input"
                required
              />
            </div>
            <div className="form-group">
              <label>Rune Name:</label>
              <input
                type="text"
                value={formData.runeName}
                onChange={e => handleInputChange('runeName', e.target.value.toUpperCase())}
                placeholder="MY•RUNE"
                className="input"
                maxLength={28}
                required
              />
            </div>
            <div className="form-group">
              <label>Symbol:</label>
              <input
                type="text"
                value={formData.symbol}
                onChange={e => handleInputChange('symbol', e.target.value)}
                className="input"
                maxLength={1}
              />
            </div>
            <div className="form-group">
              <label>Divisibility:</label>
              <input
                type="number"
                min="0"
                max="18"
                value={formData.divisibility}
                onChange={e => handleInputChange('divisibility', parseInt(e.target.value) || 0)}
                className="input"
              />
            </div>
            <div className="form-group">
              <label>Premine Amount:</label>
              <input
                type="text"
                value={formData.premine}
                onChange={e => handleInputChange('premine', e.target.value)}
                className="input"
                required
              />
            </div>
            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={formData.mintable}
                  onChange={e => handleInputChange('mintable', e.target.checked)}
                />
                Mintable?
              </label>
            </div>
            {formData.mintable && (
              <>
                <div className="form-group">
                  <label>Mint Amount:</label>
                  <input
                    type="text"
                    value={formData.mintAmount}
                    onChange={e => handleInputChange('mintAmount', e.target.value)}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label>Mint Cap:</label>
                  <input
                    type="text"
                    value={formData.mintCap}
                    onChange={e => handleInputChange('mintCap', e.target.value)}
                    className="input"
                  />
                </div>
              </>
            )}
          </>
        ) : !txResult ? (
          <div className="form-group">
            <label>Send dust to:</label>
            <input
              type="text"
              className="input readonly"
              readOnly
              value={commitAddr}
              onClick={(e) => {
                navigator.clipboard.writeText(commitAddr);
                const target = e.target as HTMLInputElement;
                target.select();
              }}
            />
            <small>Send exactly 546 sats to this address</small>
          </div>
        ) : null}

        <button
          type="submit"
          className="button"
          disabled={status === 'fetchingUTXO' || status === 'creatingReveal'}
        >
          {statusLabels[status]}
        </button>

        {error && (
          <div className="error">
            {error}
            {status === 'error' && (
              <button
                type="button"
                onClick={() => setStatus('idle')}
                className="retry-button"
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {txResult && (
          <div className="result">
            <h2>✅ Runestone Inscribed!</h2>
            <p>
              <strong>Reveal TX:</strong>{' '}
              <a
                href={`https://mempool.space/testnet/tx/${txResult.txId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tx-link"
              >
                {txResult.txId.slice(0, 10)}...{txResult.txId.slice(-10)}
              </a>
            </p>
            <p>
              <strong>Fees:</strong> {txResult.totalFee} sats
              <small> (miner: {txResult.minerFee}, service: {txResult.devFee})</small>
            </p>
            <button
              type="button"
              onClick={() => {
                setCommitAddr(null);
                setCommitKey(null);
                setCommitUtxo(null);
                setStatus('idle');
                setTxResult(null);
              }}
              className="new-rune-button"
            >
              Create Another Rune
            </button>
          </div>
        )}
      </form>
    </div>
  );
}