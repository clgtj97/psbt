/**
 * Runes protocol utility functions
 * Implementation focused on encoding/decoding rune data without crypto operations
 */

/**
 * Encodes a rune name as a base-26 integer per the Runes specification
 * A=0, Z=25, AA=26, etc.
 */
export function encodeRuneName(name: string): bigint {
  // Remove spacers and convert to uppercase
  const cleanName = name.replace(/•/g, '').toUpperCase();
  let value = 0n;
  
  for (let i = 0; i < cleanName.length; i++) {
    const charCode = cleanName.charCodeAt(i) - 65; // A=0, Z=25
    if (charCode < 0 || charCode > 25) {
      throw new Error('Invalid character in rune name');
    }
    value = value * 26n + BigInt(charCode);
  }
  
  return value;
}

/**
 * LEB128 (Little Endian Base 128) variable-length integer encoding
 */
export function encodeLeb128(value: bigint): number[] {
  const result: number[] = [];
  let more = true;

  while (more) {
    let byte = Number(value & 0x7fn);
    value >>= 7n;
    
    if ((value === 0n && (byte & 0x40) === 0) || 
        (value === -1n && (byte & 0x40) !== 0)) {
      more = false;
    } else {
      byte |= 0x80;
    }
    
    result.push(byte);
  }

  return result;
}

/**
 * Calculates the spacers bitfield based on spacer positions
 */
export function calculateSpacers(name: string): number {
  let spacers = 0;
  
  for (let i = 0; i < name.length - 1; i++) {
    if (name[i] === '•') {
      spacers |= (1 << i);
    }
  }
  
  return spacers;
}

/**
 *
 * Runestone protocol tags 
 */
export enum RunestoneTag {
  Body = 0,
  Divisibility = 1,
  Spacers = 2,
  Symbol = 3,
  Rune = 4,
  Premine = 5,
  Cap = 6,
  Amount = 7,
  HeightStart = 8,
  HeightEnd = 9,
  OffsetStart = 10,
  OffsetEnd = 11,
  Mint = 12,
  Pointer = 13,
  Cenotaph = 127
}

/**
 * Flags used in Runes protocol encoding
 */
export enum RunestoneFlag {
  Etching = 0x01,
  Terms = 0x02,
  Turbo = 0x04,
  Cenotaph = 0x80
}
/**
 * Creates a Runestone payload for etching
 */
export function createRunestonePayload(options: {
  divisibility?: number;
  premine?: bigint;
  runeName?: string;
  spacers?: number;
  symbol?: string;
  terms?: {
    amount?: bigint;
    cap?: bigint;
    heightStart?: number;
    heightEnd?: number;
    offsetStart?: number;
    offsetEnd?: number;
  };
  mint?: {
    txid: string;
    vout: number;
  };
  pointer?: number;
  turbo?: boolean;
}): Buffer {
  const fields: { tag: number; value: bigint }[] = [];
  
  // Set flags
  let flags = RunestoneFlag.Etching;
  if (options.turbo) flags |= RunestoneFlag.Turbo;
  if (options.terms) flags |= RunestoneFlag.Terms;
  
  fields.push({ tag: RunestoneTag.Body, value: BigInt(flags) });

  // Add etching fields
  if (options.divisibility !== undefined) {
    fields.push({ tag: RunestoneTag.Divisibility, value: BigInt(options.divisibility) });
  }
  
  if (options.spacers !== undefined) {
    fields.push({ tag: RunestoneTag.Spacers, value: BigInt(options.spacers) });
  }
  
  if (options.symbol) {
    fields.push({ tag: RunestoneTag.Symbol, value: BigInt(options.symbol.charCodeAt(0)) });
  }
  
  if (options.runeName) {
    fields.push({ tag: RunestoneTag.Rune, value: encodeRuneName(options.runeName) });
  }
  
  if (options.premine !== undefined) {
    fields.push({ tag: RunestoneTag.Premine, value: options.premine });
  }

  // Add terms if specified
  if (options.terms) {
    if (options.terms.amount !== undefined) {
      fields.push({ tag: RunestoneTag.Amount, value: options.terms.amount });
    }
    
    if (options.terms.cap !== undefined) {
      fields.push({ tag: RunestoneTag.Cap, value: options.terms.cap });
    }
    
    if (options.terms.heightStart !== undefined) {
      fields.push({ tag: RunestoneTag.HeightStart, value: BigInt(options.terms.heightStart) });
    }
    
    if (options.terms.heightEnd !== undefined) {
      fields.push({ tag: RunestoneTag.HeightEnd, value: BigInt(options.terms.heightEnd) });
    }
    
    if (options.terms.offsetStart !== undefined) {
      fields.push({ tag: RunestoneTag.OffsetStart, value: BigInt(options.terms.offsetStart) });
    }
    
    if (options.terms.offsetEnd !== undefined) {
      fields.push({ tag: RunestoneTag.OffsetEnd, value: BigInt(options.terms.offsetEnd) });
    }
  }

  // Add mint information if specified
  if (options.mint) {
    const mintTxid = Buffer.from(options.mint.txid, 'hex').reverse();
    const mintIdentifier = BigInt(`0x${mintTxid.toString('hex')}${options.mint.vout.toString(16).padStart(2, '0')}`);
    fields.push({ tag: RunestoneTag.Mint, value: mintIdentifier });
  }

  // Add pointer if specified
  if (options.pointer !== undefined) {
    fields.push({ tag: RunestoneTag.Pointer, value: BigInt(options.pointer) });
  }

  // Encode fields
  const payload = Buffer.concat(fields.map(field => {
    const tag = encodeLeb128(BigInt(field.tag));
    const value = encodeLeb128(field.value);
    return Buffer.concat([Buffer.from(tag), Buffer.from(value)]);
  }));

  return payload;
}

/**
 * Creates a complete Runestone envelope (ordinals compatible)
 */
export function createRunestoneEnvelope(payload: Buffer): Buffer[] {
  return [
    Buffer.from([0x00]), // OP_FALSE
    Buffer.from([0x63]), // OP_IF
    Buffer.from('ord', 'utf8'), // Protocol identifier
    Buffer.from([0x01]), // Version
    payload,
    Buffer.from([0x00]), // Empty buffer (terminator)
    Buffer.from([0x68]) // OP_ENDIF
  ];
}

/**
 * Format hex string for display
 */
export function formatHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Display information about a rune
 */
export function formatRuneInfo(options: {
  runeName: string;
  symbol: string;
  divisibility: number;
  premine: string;
  mintable: boolean;
  mintAmount?: string;
  mintCap?: string;
  spacers: boolean;
}): string {
  let info = `Rune Name: ${options.runeName}\n`;
  info += `Symbol: ${options.symbol}\n`;
  info += `Divisibility: ${options.divisibility}\n`;
  
  if (options.premine) {
    const value = BigInt(options.premine);
    if (options.divisibility > 0) {
      // Format with decimal places
      const divisor = 10n ** BigInt(options.divisibility);
      const intPart = value / divisor;
      const fracPart = value % divisor;
      const fracStr = fracPart.toString().padStart(options.divisibility, '0');
      info += `Premine: ${intPart}.${fracStr} ${options.symbol}\n`;
    } else {
      info += `Premine: ${value} ${options.symbol}\n`;
    }
  }
  
  if (options.mintable && options.mintAmount && options.mintCap) {
    const mintAmount = BigInt(options.mintAmount);
    const mintCap = BigInt(options.mintCap);
    const maxSupply = mintAmount * mintCap;
    
    info += `Mintable: Yes\n`;
    info += `Amount Per Mint: ${mintAmount} ${options.symbol}\n`;
    info += `Max Mints: ${mintCap}\n`;
    info += `Maximum Supply: ${maxSupply} ${options.symbol}\n`;
  } else {
    info += `Mintable: No\n`;
  }
  
  return info;
}