"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import type { Certificate } from "@/lib/certificates";
import { CONTRACT_ADDRESS, SOULBOUND_ABI } from "@/lib/contract";

const contract = {
  address: CONTRACT_ADDRESS,
  abi: SOULBOUND_ABI,
} as const;

export function IssuedList({ issuer }: { issuer: `0x${string}` }) {
  const { data: total, refetch: refetchTotal } = useReadContract({
    ...contract,
    functionName: "totalIssued",
  });

  const ids = total
    ? Array.from({ length: Number(total) }, (_, index) => BigInt(index + 1))
    : [];

  const { data: results, refetch: refetchCerts } = useReadContracts({
    contracts: ids.map((tokenId) => ({
      ...contract,
      functionName: "getCertificate" as const,
      args: [tokenId] as const,
    })),
    query: { enabled: ids.length > 0 },
  });

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: Boolean(hash) },
  });

  useEffect(() => {
    if (isSuccess) {
      refetchTotal();
      refetchCerts();
    }
  }, [isSuccess, refetchTotal, refetchCerts]);

  const mine = (results ?? [])
    .map((entry) =>
      entry.status === "success" ? (entry.result as unknown as Certificate) : null
    )
    .filter((cert): cert is Certificate => cert !== null)
    .filter((cert) => cert.issuer.toLowerCase() === issuer.toLowerCase());

  return (
    <div className="border border-rule bg-card px-6 py-7 sm:px-8">
      <h2 className="display text-2xl">Entries you&apos;ve recorded</h2>

      {error && (
        <p className="mt-4 border-l-2 border-seal bg-seal/5 px-4 py-3 text-sm text-seal">
          {(error as { shortMessage?: string }).shortMessage ?? error.message}
        </p>
      )}

      {mine.length === 0 ? (
        <p className="mt-3 text-sm text-soft">
          Nothing yet. Anything you record shows up here.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-rule border-t border-rule">
          {mine.map((cert) => (
            <li
              key={cert.tokenId.toString()}
              className="flex flex-wrap items-center justify-between gap-4 py-4"
            >
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-mono text-xs text-soft">
                    {cert.tokenId.toString().padStart(3, "0")}
                  </span>{" "}
                  <span className={cert.revoked ? "line-through text-soft" : ""}>
                    {cert.courseName}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-soft">
                  {cert.recipientName} &middot;{" "}
                  {new Date(Number(cert.issuedAt) * 1000).toLocaleDateString(
                    "en-GB",
                    { year: "numeric", month: "short", day: "numeric" }
                  )}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <Link
                  href={`/verify/${cert.tokenId.toString()}`}
                  className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-soft
                             underline decoration-rule underline-offset-4 hover:text-ink"
                >
                  Open
                </Link>

                {cert.revoked ? (
                  <span className="border border-seal/60 px-3 py-1.5 font-mono text-[0.65rem]
                                   uppercase tracking-[0.14em] text-seal">
                    Revoked
                  </span>
                ) : (
                  <button
                    onClick={() =>
                      writeContract({
                        ...contract,
                        functionName: "revoke",
                        args: [cert.tokenId],
                      })
                    }
                    disabled={isPending || confirming}
                    className="border border-rule px-3 py-1.5 font-mono text-[0.65rem]
                               uppercase tracking-[0.14em] text-soft transition
                               hover:border-seal hover:text-seal disabled:opacity-40"
                  >
                    {isPending || confirming ? "Revoking" : "Revoke"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
