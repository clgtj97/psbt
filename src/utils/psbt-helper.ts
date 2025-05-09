export function inspectPSBT(psbtHex: string) {
    const psbt = bitcoin.Psbt.fromHex(psbtHex);
    return {
      inputCount: psbt.txInputs.length,
      outputCount: psbt.txOutputs.length,
      fee: psbt.getFee(),
      inputs: psbt.txInputs.map(input => ({
        txid: Buffer.from(input.hash).reverse().toString('hex'),
        vout: input.index
      })),
      outputs: psbt.txOutputs.map(output => ({
        address: bitcoin.address.fromOutputScript(output.script),
        amount: output.value
      }))
    };
  }