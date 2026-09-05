"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BaseError,
  ContractFunctionRevertedError,
  isAddress,
  parseEventLogs,
} from "viem";
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

type PinResult = {
  uri: string;
  pinned: boolean;
  reason?: string;
  entryNumber: string;
  expectedTokenId: number | null;
};

/**
 * Pulls the real next register number out of a RegisterEntryTaken revert.
 * Returns null for every other failure, including a rejected signature.
 */
function takenEntry(error: unknown): number | null {
  if (!(error instanceof BaseError)) return null;
  const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
  if (!(reverted instanceof ContractFunctionRevertedError)) return null;
  if (reverted.data?.errorName !== "RegisterEntryTaken") return null;
  const next = reverted.data.args?.[0];
  return typeof next === "bigint" ? Number(next) : null;
}

function readable(error: unknown): string {
  if (error instanceof BaseError) return error.shortMessage || error.message;
  if (error instanceof Error) return error.message;
  return "The record couldn't be written";
}

export function MintForm() {
  const { address } = useAccount();
  const [to, setTo] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [courseName, setCourseName] = useState("");

  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [retryNote, setRetryNote] = useState<string | null>(null);
  const [pinInfo, setPinInfo] = useState<PinResult | null>(null);

  const { data: issuerName } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SOULBOUND_ABI,
    functionName: "issuerName",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { writeContractAsync, data: hash, isPending, reset } = useWriteContract();
  const {
    data: receipt,
    isLoading: confirming,
    isSuccess,
  } = useWaitForTransactionReceipt({ hash, query: { enabled: Boolean(hash) } });

  // The register number as the chain recorded it, not as we guessed it.
  const recordedEntry = useMemo(() => {
    if (!receipt) return null;
    const [issued] = parseEventLogs({
      abi: SOULBOUND_ABI,
      eventName: "CertificateIssued",
      logs: receipt.logs,
    });
    return issued ? issued.args.tokenId : null;
  }, [receipt]);

  const addressValid = isAddress(to.trim());
  const ready =
    addressValid && recipientName.trim() !== "" && courseName.trim() !== "";
  const busy = working || isPending || confirming;

  /** Builds the artwork and metadata, stamped with `entry` when we know it. */
  async function buildRecord(entry?: number): Promise<PinResult> {
    const response = await fetch("/api/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientName: recipientName.trim(),
        courseName: courseName.trim(),
        issuerName: (issuerName as string | undefined) ?? "",
        issuerAddress: address,
        to: to.trim(),
        expectedTokenId: entry,
      }),
    });

    const result = (await response.json()) as PinResult & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "The record couldn't be built");
    return result;
  }

  async function send(record: PinResult) {
    const common = [
      to.trim() as `0x${string}`,
      recipientName.trim(),
      courseName.trim(),
      record.uri,
    ] as const;

    // With a number stamped on the artwork, mint through the checked path so
    // the token can only land on that entry. Without one (the totalIssued
    // read failed), fall back to the plain mint rather than blocking.
    if (record.expectedTokenId === null) {
      return writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: SOULBOUND_ABI,
        functionName: "issueCertificate",
        args: common,
      });
    }

    return writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: SOULBOUND_ABI,
      functionName: "issueCertificateAt",
      args: [...common, BigInt(record.expectedTokenId)],
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;

    setWorking(true);
    setFailure(null);
    setRetryNote(null);
    setPinInfo(null);

    try {
      // Pin first, so the token URI is settled before anything gets signed.
      let record = await buildRecord();
      setPinInfo(record);

      // If another issuer claims the number between the pin and the signature,
      // the contract refuses the mint and hands back the real one. Rebuild
      // against that and ask for one more signature.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await send(record);
          return;
        } catch (caught) {
          const actual = takenEntry(caught);
          if (actual === null) throw caught;

          setRetryNote(
            `Entry ${record.entryNumber} went to another issuer while you were ` +
              `signing. Rebuilt as ${actual.toString().padStart(3, "0")}, ` +
              "confirm once more."
          );
          record = await buildRecord(actual);
          setPinInfo(record);
        }
      }

      throw new Error(
        "The register moved on three times while you were signing. Try again in a moment."
      );
    } catch (caught) {
      setFailure(readable(caught));
    } finally {
      setWorking(false);
    }
  }

  if (isSuccess) {
    const entry = recordedEntry?.toString();
    return (
      <div className="border-l-2 border-ink bg-card px-6 py-6">
        <h2 className="display text-2xl">Recorded</h2>
        <p className="mt-2 text-sm text-soft">
          {entry ? (
            <>
              Entry{" "}
              <span className="font-mono text-ink">{entry.padStart(3, "0")}</span>,
              written to the register for{" "}
            </>
          ) : (
            "Written to the register for "
          )}
          <span className="font-mono text-ink">{to.trim()}</span>.{" "}
          {pinInfo?.pinned
            ? "Artwork and metadata are pinned to IPFS."
            : `Metadata is stored inline instead of on IPFS (${pinInfo?.reason ?? "no pinning key"}).`}
        </p>

        <div className="mt-5 flex flex-wrap gap-5 text-sm">
          <Link
            href={`/verify/${entry ?? to.trim()}`}
            className="underline decoration-rule underline-offset-4 hover:text-seal"
          >
            Open the register entry
          </Link>
          {entry && (
            <a
              href={`/certificate/${entry}?format=pdf&download=1`}
              className="underline decoration-rule underline-offset-4 hover:text-seal"
            >
              Download the certificate
            </a>
          )}
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
            setRetryNote(null);
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
        The register number, artwork and QR code are generated at mint, and the
        contract refuses the mint if that number has been taken since. The token
        goes straight into the graduate&apos;s wallet and stays there.
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

      {retryNote && (
        <p className="mt-5 border-l-2 border-ink bg-ink/5 px-4 py-3 text-sm text-soft">
          {retryNote}
        </p>
      )}

      {failure && (
        <p className="mt-5 border-l-2 border-seal bg-seal/5 px-4 py-3 text-sm text-seal">
          {failure}
        </p>
      )}

      <button
        type="submit"
        disabled={!ready || busy}
        className="mt-6 border border-ink bg-ink px-7 py-3 font-mono text-xs uppercase
                   tracking-[0.16em] text-paper transition hover:border-seal hover:bg-seal
                   disabled:cursor-not-allowed disabled:opacity-35"
      >
        {working && !isPending
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
