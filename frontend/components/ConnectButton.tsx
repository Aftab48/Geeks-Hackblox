"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { baseSepolia } from "wagmi/chains";

const buttonClass =
  "border border-ink bg-ink px-5 py-2.5 font-mono text-xs uppercase " +
  "tracking-[0.14em] text-paper transition hover:border-seal hover:bg-seal " +
  "disabled:cursor-not-allowed disabled:opacity-40";

export function ConnectButton() {
  // Wallet state differs between server and client render, so hold the control
  // until after mount rather than hydrating a mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!mounted) {
    return <div className="h-10 w-40 animate-pulse border border-rule bg-card" />;
  }

  if (!isConnected) {
    const connector = connectors[0];
    return (
      <button
        onClick={() => connector && connect({ connector })}
        disabled={isPending || !connector}
        className={buttonClass}
      >
        {isPending ? "Connecting" : "Connect wallet"}
      </button>
    );
  }

  if (chainId !== baseSepolia.id) {
    return (
      <button
        onClick={() => switchChain({ chainId: baseSepolia.id })}
        className="border border-seal bg-seal px-5 py-2.5 font-mono text-xs uppercase
                   tracking-[0.14em] text-paper transition hover:opacity-90"
      >
        Switch to Base Sepolia
      </button>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span className="font-mono text-xs text-soft">
        {address?.slice(0, 6)}&hellip;{address?.slice(-4)}
      </span>
      <button
        onClick={() => disconnect()}
        className="border border-rule px-4 py-2 font-mono text-[0.7rem] uppercase
                   tracking-[0.14em] text-soft transition hover:border-ink hover:text-ink"
      >
        Disconnect
      </button>
    </div>
  );
}
