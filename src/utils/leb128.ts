/**
 * Encodes a BigInt into a LEB128 (Little Endian Base 128) variable-length integer
 * Used for Bitcoin Runes encoding
 * 
 * @param value - The value to encode
 * @returns Uint8Array containing the LEB128 encoded value
 */
export function encodeLeb128(value: bigint): Uint8Array {
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

  return new Uint8Array(result);
}

/**
 * Decodes a LEB128 (Little Endian Base 128) variable-length integer to a BigInt
 * 
 * @param bytes - The Uint8Array containing the LEB128 encoded value
 * @returns The decoded BigInt value
 */
export function decodeLeb128(bytes: Uint8Array): bigint {
  let result = 0n;
  let shift = 0n;
  
  for (let i = 0; i < bytes.length; i++) {
    // Extract the 7 least significant bits
    const byte = BigInt(bytes[i] & 0x7F);
    
    // Add the bits at the correct position
    result |= byte << shift;
    
    // If the high bit is not set, this is the last byte
    if ((bytes[i] & 0x80) === 0) {
      break;
    }
    
    // Move to the next 7 bits
    shift += 7n;
  }
  
  return result;
}