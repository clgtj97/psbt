import { useState, FormEvent } from 'react';
import { useWallet } from './hooks/useWallet';
import * as bitcoinUtils from './utils/real-bitcoin';
import './App.css';

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
  | 'fetching' 
  | 'creating' 
  | 'success' 
  | 'error';

type TransactionResult = {
  txId: string;
  totalFee: number;
  devFee: number;
  minerFee: number;
};

function App() {
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
  const [txResult, setTxResult] = useState<TransactionResult | null>(null);
  const [status, setStatus] = useState<TransactionStatus>('idle');
  const [error, setError] = useState('');

  const handleInputChange = (field: keyof RuneFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): string | null => {
    const { address, runeName, premine, mintable, mintAmount, mintCap } = formData;

    if (!address) return 'Please enter a Bitcoin address';
    if (!/^(tb1|bcrt1)[a-zA-HJ-NP-Z0-9]{25,90}$/.test(address)) {
      return 'Please enter a valid testnet bech32 address (starts with tb1)';
    }
    if (!runeName) return 'Rune name is required';
    if (!/^[A-Z•]+$/.test(runeName)) {
      return 'Rune name can only contain A-Z and • characters';
    }
    if (runeName.length > 28) return 'Rune name too long (max 28 characters)';
    if (!/^\d+$/.test(premine)) return 'Premine must be a whole number';
    
    if (mintable) {
      if (!mintAmount || !/^\d+$/.test(mintAmount)) return 'Mint amount must be a whole number';
      if (!mintCap || !/^\d+$/.test(mintCap)) return 'Mint cap must be a whole number';
    }

    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('fetching');
    setError('');
    setTxResult(null);

    const validationError = validateForm();
    if (validationError) {
      setStatus('error');
      setError(validationError);
      return;
    }

    try {
      const { runeName, symbol, divisibility, premine, mintable, mintAmount, mintCap } = formData;

      setStatus('creating');

      const result = await bitcoinUtils.createRunestoneEtching({
        runeOptions: {
          runeName: runeName.toUpperCase(),
          symbol,
          premine: BigInt(premine),
          divisibility,
          terms: mintable ? {
            amount: BigInt(mintAmount || '1000'),
            cap: BigInt(mintCap || '1000'),
            heightStart: 840000
          } : undefined
        },
        feeRate: 15,
        network: 'testnet'
      });

      console.log('Etching result:', result);
      setTxResult(result);
      setStatus('success');

    } catch (err) {
      console.error('Etching failed:', err);
      setStatus('error');
      setError(
        err instanceof Error ? err.message.replace('Error: ', '') : 'Etching failed. Please try again.'
      );
    }
  };

  if (!isInstalled) {
    return (
      <div className="wallet-prompt">
        <h2>Wallet Required</h2>
        <p>Please install <a href="https://unisat.io/" target="_blank" rel="noopener noreferrer">Unisat Wallet</a> to create Runes</p>
        <p>Testnet address entered: {formData.address || 'none'}</p>
      </div>
    );
  }

  const statusMessages = {
    idle: 'Create Runestone',
    fetching: 'Validating...',
    creating: 'Etching...',
    success: 'Success!',
    error: 'Try Again'
  };

  return (
    <div className="container">
      <h1>Create a Runestone</h1>
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label>Bitcoin Address:</label>
          <input 
            type="text"
            value={formData.address}
            onChange={(e) => handleInputChange('address', e.target.value.trim())}
            placeholder="tb1q..."
            className="input"
            required
          />
        </div>

        <div className="form-group">
          <label>Rune Name:</label>
          <input 
            type="text" 
            value={formData.runeName} 
            onChange={(e) => handleInputChange('runeName', e.target.value.toUpperCase())} 
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
            onChange={(e) => handleInputChange('symbol', e.target.value)}
            maxLength={1}
            className="input"
          />
        </div>

        <div className="form-group">
          <label>Divisibility (0-18):</label>
          <input
            type="number"
            value={formData.divisibility}
            onChange={(e) => handleInputChange('divisibility', parseInt(e.target.value) || 0)}
            min="0"
            max="18"
            className="input"
          />
        </div>

        <div className="form-group">
          <label>Premine Amount:</label>
          <input
            type="text"
            value={formData.premine}
            onChange={(e) => handleInputChange('premine', e.target.value)}
            className="input"
            required
          />
        </div>

        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={formData.mintable}
              onChange={(e) => handleInputChange('mintable', e.target.checked)}
              className="checkbox"
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
                onChange={(e) => handleInputChange('mintAmount', e.target.value)}
                className="input"
                required={formData.mintable}
              />
            </div>

            <div className="form-group">
              <label>Mint Cap:</label>
              <input
                type="text"
                value={formData.mintCap}
                onChange={(e) => handleInputChange('mintCap', e.target.value)}
                className="input"
                required={formData.mintable}
              />
            </div>
          </>
        )}

        <button 
          type="submit" 
          className="button"
          disabled={status !== 'idle' && status !== 'error'}
        >
          {statusMessages[status]}
        </button>

        {error && <div className="error">{error}</div>}

        {txResult && (
          <div className="result">
            <h2>✅ Runestone Etched!</h2>
            
            <div className="tx-info">
              <p><strong>Transaction ID:</strong> <code>{txResult.txId}</code></p>
              <p><strong>Total Fees:</strong> {txResult.totalFee} sats</p>
              <div className="fee-breakdown">
                <span>Miner Fee: {txResult.minerFee} sats</span>
                <span>Service Fee: {txResult.devFee} sats</span>
              </div>
            </div>

            <div className="action-buttons">
              <a 
                href={`https://mempool.space/testnet/tx/${txResult.txId}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="link"
              >
                View on Explorer
              </a>
              <button 
                onClick={() => navigator.clipboard.writeText(txResult.txId)}
                className="secondary-button"
              >
                Copy TXID
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

export default App;