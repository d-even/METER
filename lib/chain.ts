import { baseSepolia } from "viem/chains";
import { PAY_TO, USDC } from "./constants";

export const CHAIN = baseSepolia;
export const CHAIN_ID = baseSepolia.id; // 84532

/** The x402 network identifier, as it appears on the wire. */
export const NETWORK = "base-sepolia" as const;
export const NETWORK_LABEL = "Base Sepolia";

export const USDC_ADDRESS = USDC as `0x${string}`;
export const USDC_DECIMALS = 6;

export { PAY_TO };

/** Ceiling the wallet will authorize for a single call. */
export const MAX_PRICE_USD = 0.001;
export const MAX_PRICE_ATOMIC = BigInt(Math.round(MAX_PRICE_USD * 1e6));

/** Cheapest a card network will move money for, for contrast. */
export const CARD_FLOOR_USD = 0.3;
export const CARD_FLOOR_LABEL = "$0.30 + 2.9%";

export const EXPLORER = "https://sepolia.basescan.org";
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER}/address/${address}`;

export const USDC_FAUCET = "https://faucet.circle.com";
export const ETH_FAUCET = "https://portal.cdp.coinbase.com/products/faucet";

export const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** 0x1234567890abcdef… → 0x1234…cdef */
export function short(value: string, lead = 6, tail = 4) {
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

/** Atomic USDC (6dp) → "$0.001000" */
export function usdcToUsd(atomic: string | bigint) {
  return Number(atomic) / 1e6;
}

export function formatUsd(usd: number, minDecimals = 6) {
  if (usd === 0) return "$0.000000";
  // Keep small amounts legible: never round a real charge down to $0.00.
  const decimals = Math.max(minDecimals, usd < 1e-5 ? 8 : minDecimals);
  return `$${usd.toFixed(decimals)}`;
}
