"use client";

import { useAccount, useReadContract } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { ConnectButton } from "@/components/ConnectButton";
import { IssuedList } from "@/components/IssuedList";
import { MintForm } from "@/components/MintForm";
import { CONTRACT_ADDRESS, SOULBOUND_ABI } from "@/lib/contract";

export default function IssuePage() {
  const { address, isConnected, chainId } = useAccount();

  const { data: isIssuer, isLoading: checkingRole } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SOULBOUND_ABI,
    functionName: "isIssuer",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const onRightChain = chainId === baseSepolia.id;
  const cleared = isConnected && onRightChain && !checkingRole && isIssuer;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 pb-20 pt-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="display text-4xl leading-tight">Registrar&apos;s desk</h1>
          <p className="mt-2 max-w-md text-soft">
            Write a certificate into the register, or revoke one that shouldn&apos;t
            stand.
          </p>
        </div>
        <ConnectButton />
      </div>

      <div className="mt-10 flex flex-col gap-7">
        {!isConnected && (
          <Notice heading="Connect your wallet">
            Only wallets on the issuer list can write to the register. Connect
            and it&apos;ll check yours.
          </Notice>
        )}

        {isConnected && !onRightChain && (
          <Notice heading="Wrong network" tone="seal">
            The register lives on Base Sepolia. Use the switch button above and
            your wallet will offer to add it.
          </Notice>
        )}

        {isConnected && onRightChain && checkingRole && (
          <Notice heading="Checking your permissions">
            Reading your role off the contract.
          </Notice>
        )}

        {isConnected && onRightChain && !checkingRole && !isIssuer && (
          <Notice heading="This wallet can’t write to the register" tone="seal">
            <span className="font-mono text-ink">{address}</span> isn&apos;t on
            the issuer list. An administrator has to add it first.
          </Notice>
        )}

        {cleared && address && (
          <>
            <MintForm />
            <IssuedList issuer={address} />
          </>
        )}
      </div>
    </main>
  );
}

function Notice({
  heading,
  children,
  tone = "ink",
}: {
  heading: string;
  children: React.ReactNode;
  tone?: "ink" | "seal";
}) {
  return (
    <div
      className={`border-l-2 bg-card px-6 py-5 ${
        tone === "seal" ? "border-seal" : "border-ink"
      }`}
    >
      <h2 className="display text-xl">{heading}</h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-soft">{children}</p>
    </div>
  );
}
