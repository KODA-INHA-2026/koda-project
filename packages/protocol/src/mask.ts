// Partial addresses still narrow the candidate set, so show only the fixed type prefix and the last characters.
const ADDRESS_PREFIXES = ['bc1q', 'bc1p', 'tb1q', 'tb1p', '0x'];
export function maskAddress(address: string, keep = 4): string {
  const prefix = ADDRESS_PREFIXES.find(p => address.toLowerCase().startsWith(p)) ?? '';
  const body = address.slice(prefix.length);
  return prefix + '…' + (body.length > keep * 2 ? body.slice(-keep) : '');
}
