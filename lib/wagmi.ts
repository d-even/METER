import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// Only used to read the USDC balance. The public default is rate limited, so
// point NEXT_PUBLIC_RPC_URL at your own endpoint if the balance stops loading.
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http(rpcUrl),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
