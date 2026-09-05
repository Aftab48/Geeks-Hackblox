import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

// Reads only. No wallet is ever required to verify a certificate - an employer
// checking a credential should never need MetaMask installed.
// Falls back to the public Base endpoint when no RPC is configured.
export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
});
