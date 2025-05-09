import { useState, useEffect } from 'react';

declare global {
  interface Window {
    unisat?: {
      signPsbt: (psbtHex: string) => Promise<string>;
      on: (event: string, handler: () => void) => void;
      removeListener: (event: string) => void;
    };
  }
}

export function useWallet() {
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const checkWallet = () => {
      setIsInstalled(typeof window.unisat !== 'undefined');
    };

    checkWallet();
    window.addEventListener('load', checkWallet);

    return () => {
      window.removeEventListener('load', checkWallet);
    };
  }, []);

  return { isInstalled };
}