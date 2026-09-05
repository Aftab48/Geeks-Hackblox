"use client";

import Link from "next/link";
import { useState } from "react";
import { isAddress } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { CONTRACT_ADDRESS, EXPLORER_URL, SOULBOUND_ABI } from "@/lib/contract";

const inputClass =
  "w-full border border-rule bg-paper px-3 py-2.5 text-sm text-ink " +
  "placeholder:text-soft/60 focus:border-ink focus:outline-none";

const labelClass =
  "font-mono text-[0.62rem] uppercase tracking-[0.16em] text-soft";

type PinResult = { uri: string; pinned: boolean; reason?: string };

export function MintForm() {
  const { address } = useAccount();
  const [to, setTo] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [courseName, setCourseName] = useState("");

  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [pinInfo, setPinInfo] = useState<PinResult | null>(null);

  const { data: issuerName } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SOULBOUND_ABI,
    functionName: "issuerName",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { writeContract, data: hash, isPending, error, reset } =
    useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: Boolean(hash) },
  });

  const addressValid = isAddress(to.trim());
  const ready =
    addressValid && recipientName.trim() !== "" && courseName.trim() !== "";
  const busy = preparing || isPending || confirming;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;

    setPreparing(true);
    setPrepareError(null);
    setPinInfo(null);

    try {
      // Pin the artwork and metadata first, so the token URI is settled before
      // anything gets signed.
      const response = await fetch("/api/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: recipientName.trim(),
          courseName: courseName.trim(),
          issuerName: (issuerName as string | undefined) ?? "",
          issuerAddress: address,
        }),
      });

      const result = (await response.json()) as PinResult & { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "The record couldn't be built");
      }

      setPinInfo(result);
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: SOULBOUND_ABI,
        functionName: "issueCertificate",
        args: [
          to.trim() as `0x${string}`,
          recipientName.trim(),
          courseName.trim(),
          result.uri,
        ],
      });
    } catch (caught) {
      setPrepareError(
        caught instanceof Error ? caught.message : "The record couldn't be built"
      );
    } finally {
      setPreparing(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="border-l-2 border-ink bg-card px-6 py-6">
        <h2 className="display text-2xl">Recorded</h2>
        <p className="mt-2 text-sm text-soft">
          Written to the register for{" "}
          <span className="font-mono text-ink">{to.trim()}</span>.{" "}
          {pinInfo?.pinned
            ? "Artwork and metadata are pinned to IPFS."
            : `Metadata is stored inline instead of on IPFS (${pinInfo?.reason ?? "no pinning key"}).`}
        </p>

        <div className="mt-5 flex flex-wrap gap-5 text-sm">
          <Link
            href={`/verify/${to.trim()}`}
            className="underline decoration-rule underline-offset-4 hover:text-seal"
          >
            Open the register entry
          </Link>
          <a
            href={`${EXPLORER_URL}/tx/${hash}`}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-rule underline-offset-4 hover:text-seal"
          >
            See the transaction
          </a>
        </div>

        <button
          onClick={() => {
            reset();
            setTo("");
            setRecipientName("");
            setCourseName("");
            setPinInfo(null);
          }}
          className="mt-6 border border-rule px-5 py-2.5 font-mono text-xs uppercase
                     tracking-[0.14em] text-soft transition hover:border-ink hover:text-ink"
        >
          Record another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-rule bg-card px-6 py-7 sm:px-8">
      <h2 className="display text-2xl">Record a certificate</h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-soft">
        The register number, artwork and QR code are generated at mint. The
        token goes straight into the graduate&apos;s wallet and stays there.
      </p>

      <div className="mt-6 grid gap-5">
        <label className="grid gap-1.5">
          <span className={labelClass}>Graduate&apos;s wallet</span>
          <input
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="0x…"
            spellCheck={false}
            className={`${inputClass} font-mono ${to && !addressValid ? "border-seal" : ""}`}
          />
          {to && !addressValid && (
            <span className="text-xs text-seal">
              That&apos;s not a wallet address. They start with 0x and run 42
              characters.
            </span>
          )}
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className={labelClass}>Graduate&apos;s name</span>
            <input
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              placeholder="Ada Lovelace"
              className={inputClass}
            />
          </label>

          <label className="grid gap-1.5">
            <span className={labelClass}>Programme</span>
            <input
              value={courseName}
              onChange={(event) => setCourseName(event.target.value)}
              placeholder="Blockchain Fundamentals"
              className={inputClass}
            />
          </label>
        </div>
      </div>

      {(prepareError || error) && (
        <p className="mt-5 border-l-2 border-seal bg-seal/5 px-4 py-3 text-sm text-seal">
          {prepareError ??
            (error as { shortMessage?: string })?.shortMessage ??
            error?.message}
        </p>
      )}

      <button
        type="submit"
        disabled={!ready || busy}
        className="mt-6 border border-ink bg-ink px-7 py-3 font-mono text-xs uppercase
                   tracking-[0.16em] text-paper transition hover:border-seal hover:bg-seal
                   disabled:cursor-not-allowed disabled:opacity-35"
      >
        {preparing
          ? "Building the record"
          : isPending
            ? "Confirm in your wallet"
            : confirming
              ? "Writing to the register"
              : "Record certificate"}
      </button>
    </form>
  );
}
