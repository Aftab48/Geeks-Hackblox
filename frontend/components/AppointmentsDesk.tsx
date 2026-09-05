"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BaseError, isAddress } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { CONTRACT_ADDRESS, SOULBOUND_ABI } from "@/lib/contract";
import { same, shorten, type Officer } from "@/lib/roll";
import { Roll } from "./Roll";

const contract = { address: CONTRACT_ADDRESS, abi: SOULBOUND_ABI } as const;

const inputClass =
  "w-full border border-rule bg-paper px-3 py-2.5 text-sm text-ink " +
  "placeholder:text-soft/60 focus:border-ink focus:outline-none";

const labelClass =
  "font-mono text-[0.62rem] uppercase tracking-[0.16em] text-soft";

type Office = "registrar" | "issuer";

/** A register entry, flattened for the trip across the server boundary. */
export type Entry = {
  tokenId: string;
  courseName: string;
  recipientName: string;
  issuer: `0x${string}`;
  issuerName: string;
  issuedAt: number;
  revoked: boolean;
};

export function AppointmentsDesk({
  officers,
  certificates,
  partial,
}: {
  officers: Officer[];
  certificates: Entry[];
  partial: boolean;
}) {
  const router = useRouter();
  const { address, isConnected, chainId } = useAccount();

  // Wallet state differs between server and client render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [office, setOffice] = useState<Office>("issuer");
  const [to, setTo] = useState("");
  const [name, setName] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const { data: adminRole } = useReadContract({
    ...contract,
    functionName: "DEFAULT_ADMIN_ROLE",
  });
  const { data: isAdmin } = useReadContract({
    ...contract,
    functionName: "hasRole",
    args: address && adminRole ? [adminRole, address] : undefined,
    query: { enabled: Boolean(address && adminRole) },
  });
  const { data: isRegistrar } = useReadContract({
    ...contract,
    functionName: "isRegistrar",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { writeContractAsync, data: hash, reset } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: Boolean(hash) },
  });

  // A confirmed write changes the roll, and the roll is server data.
  useEffect(() => {
    if (!isSuccess) return;
    setPending(null);
    setTo("");
    setName("");
    reset();
    router.refresh();
  }, [isSuccess, reset, router]);

  const entryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cert of certificates) {
      const key = cert.issuer.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [certificates]);

  // Certificates recorded by the issuers this wallet appointed. Its own
  // entries are the desk's business, not the office's.
  const supervised = useMemo(() => {
    if (!address) return [];
    const mine = new Set(
      officers
        .filter((o) => same(o.appointedBy, address) && !same(o.address, address))
        .map((o) => o.address.toLowerCase())
    );
    return certificates.filter((cert) => mine.has(cert.issuer.toLowerCase()));
  }, [address, officers, certificates]);

  const canAppoint = Boolean(isAdmin || isRegistrar);
  const bothOffices = Boolean(isAdmin && isRegistrar);
  const onRightChain = chainId === baseSepolia.id;

  // Fix the office to whichever one this wallet can actually fill.
  useEffect(() => {
    if (isAdmin && !isRegistrar) setOffice("registrar");
    if (!isAdmin && isRegistrar) setOffice("issuer");
  }, [isAdmin, isRegistrar]);

  async function write(
    key: string,
    call: () => Promise<`0x${string}`>
  ): Promise<void> {
    setFailure(null);
    setPending(key);
    try {
      await call();
    } catch (caught) {
      setPending(null);
      setFailure(
        caught instanceof BaseError
          ? caught.shortMessage || caught.message
          : caught instanceof Error
            ? caught.message
            : "That didn't go through"
      );
    }
  }

  async function appoint(event: React.FormEvent) {
    event.preventDefault();
    const wallet = to.trim();
    if (!isAddress(wallet) || name.trim() === "") return;

    await write("appoint", () =>
      writeContractAsync({
        ...contract,
        functionName: office === "registrar" ? "addRegistrar" : "addIssuer",
        args: [wallet as `0x${string}`, name.trim()],
      })
    );
  }

  function canRemove(officer: Officer, held: Office): boolean {
    if (!address) return false;
    if (same(officer.address, address)) return false;
    if (held === "registrar") return Boolean(isAdmin);
    return Boolean(isAdmin) || same(officer.appointedBy, address);
  }

  function remove(officer: Officer, held: Office) {
    void write(`${held}:${officer.address}`, () =>
      writeContractAsync({
        ...contract,
        functionName: held === "registrar" ? "removeRegistrar" : "removeIssuer",
        args: [officer.address],
      })
    );
  }

  function revoke(tokenId: string) {
    void write(`revoke:${tokenId}`, () =>
      writeContractAsync({
        ...contract,
        functionName: "revoke",
        args: [BigInt(tokenId)],
      })
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="display text-2xl">The roll</h2>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-soft">
            {officers.length === 1 ? "1 officer" : `${officers.length} officers`}
          </p>
        </div>

        {partial && (
          <p className="mt-4 border-l-2 border-seal bg-seal/5 px-4 py-3 text-sm text-seal">
            The node wouldn&apos;t serve the role history, so this roll is
            incomplete. Reload, or point{" "}
            <code className="font-mono text-xs">
              NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL
            </code>{" "}
            at an endpoint that answers log queries.
          </p>
        )}

        <div className="mt-5 border border-rule bg-card px-6 py-5 sm:px-8">
          {officers.length === 0 ? (
            <p className="text-sm text-soft">
              Nobody holds an office yet, which shouldn&apos;t be possible: the
              wallet that deployed the contract is admin, registrar and issuer
              from its first block.
            </p>
          ) : (
            <Roll
              officers={officers}
              you={address}
              entryCounts={entryCounts}
              canRemove={mounted && onRightChain ? canRemove : undefined}
              onRemove={remove}
              pending={pending}
            />
          )}
        </div>
      </section>

      {failure && (
        <p className="border-l-2 border-seal bg-seal/5 px-4 py-3 text-sm text-seal">
          {failure}
        </p>
      )}

      <section>
        <h2 className="display text-2xl">Appoint someone</h2>

        {!mounted || !isConnected ? (
          <p className="mt-4 border-l-2 border-ink bg-card px-6 py-5 text-sm text-soft">
            Appointments are signed. Connect the wallet that holds the office
            above the one you&apos;re filling.
          </p>
        ) : !onRightChain ? (
          <p className="mt-4 border-l-2 border-seal bg-card px-6 py-5 text-sm text-soft">
            The register lives on Base Sepolia. Switch networks and this comes
            back.
          </p>
        ) : !canAppoint ? (
          <p className="mt-4 border-l-2 border-ink bg-card px-6 py-5 text-sm text-soft">
            <span className="font-mono text-ink">{shorten(address ?? "")}</span>{" "}
            holds no office, so it can&apos;t appoint anyone. An admin appoints
            registrars; a registrar appoints issuers. If you only need to record
            certificates, the <Link href="/issue" className="underline decoration-rule underline-offset-4 hover:text-seal">issuing desk</Link> is where that happens.
          </p>
        ) : (
          <form
            onSubmit={appoint}
            className="mt-4 border border-rule bg-card px-6 py-6 sm:px-8"
          >
            {bothOffices ? (
              <fieldset>
                <legend className={labelClass}>Office</legend>
                <div className="mt-2.5 flex flex-wrap gap-3">
                  <OfficeChoice
                    value="issuer"
                    current={office}
                    onPick={setOffice}
                    label="Issuer"
                    hint="records certificates"
                  />
                  <OfficeChoice
                    value="registrar"
                    current={office}
                    onPick={setOffice}
                    label="Registrar"
                    hint="appoints issuers"
                  />
                </div>
              </fieldset>
            ) : (
              <p className="text-sm text-soft">
                {office === "registrar"
                  ? "As admin, you appoint registrars. Each one then appoints its own issuers."
                  : "As registrar, you appoint issuers. They record certificates under your name and you can strip them again."}
              </p>
            )}

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className={labelClass}>Their wallet</span>
                <input
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  placeholder="0x…"
                  spellCheck={false}
                  className={`${inputClass} font-mono ${
                    to && !isAddress(to.trim()) ? "border-seal" : ""
                  }`}
                />
              </label>

              <label className="grid gap-1.5">
                <span className={labelClass}>
                  {office === "registrar" ? "Faculty or office" : "Department"}
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={
                    office === "registrar"
                      ? "Faculty of Science"
                      : "Dept of Computer Science"
                  }
                  className={inputClass}
                />
              </label>
            </div>

            <p className="mt-3 text-xs text-soft">
              This name is printed on every certificate they issue, so write it
              the way it should appear on the document.
            </p>

            <button
              type="submit"
              disabled={
                pending === "appoint" ||
                !isAddress(to.trim()) ||
                name.trim() === ""
              }
              className="mt-6 border border-ink bg-ink px-7 py-3 font-mono text-xs uppercase
                         tracking-[0.16em] text-paper transition hover:border-seal hover:bg-seal
                         disabled:cursor-not-allowed disabled:opacity-35"
            >
              {pending === "appoint"
                ? "Confirm in your wallet"
                : `Appoint as ${office}`}
            </button>
          </form>
        )}
      </section>

      {mounted && isConnected && isRegistrar && (
        <section>
          <h2 className="display text-2xl">Entries you supervise</h2>
          <p className="mt-2 max-w-lg text-sm text-soft">
            Recorded by issuers you appointed. You can revoke any of them, the
            same as the issuer can.
          </p>

          <div className="mt-5 border border-rule bg-card px-6 py-5 sm:px-8">
            {supervised.length === 0 ? (
              <p className="text-sm text-soft">
                Nothing yet. Appoint an issuer and whatever they record shows up
                here.
              </p>
            ) : (
              <ul className="divide-y divide-rule">
                {supervised.map((cert) => (
                  <li
                    key={cert.tokenId}
                    className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className="font-mono text-xs text-soft">
                          {cert.tokenId.padStart(3, "0")}
                        </span>{" "}
                        <span
                          className={
                            cert.revoked ? "text-soft line-through" : ""
                          }
                        >
                          {cert.courseName}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-soft">
                        {cert.recipientName} &middot; {cert.issuerName} &middot;{" "}
                        {new Date(cert.issuedAt * 1000).toLocaleDateString("en-GB", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <Link
                        href={`/verify/${cert.tokenId}`}
                        className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-soft
                                   underline decoration-rule underline-offset-4 hover:text-ink"
                      >
                        Open
                      </Link>

                      {cert.revoked ? (
                        <span
                          className="border border-seal/60 px-3 py-1.5 font-mono text-[0.65rem]
                                     uppercase tracking-[0.14em] text-seal"
                        >
                          Revoked
                        </span>
                      ) : (
                        <button
                          onClick={() => revoke(cert.tokenId)}
                          disabled={pending === `revoke:${cert.tokenId}`}
                          className="border border-rule px-3 py-1.5 font-mono text-[0.65rem]
                                     uppercase tracking-[0.14em] text-soft transition
                                     hover:border-seal hover:text-seal disabled:opacity-40"
                        >
                          {pending === `revoke:${cert.tokenId}`
                            ? "Revoking"
                            : "Revoke"}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function OfficeChoice({
  value,
  current,
  onPick,
  label,
  hint,
}: {
  value: Office;
  current: Office;
  onPick: (office: Office) => void;
  label: string;
  hint: string;
}) {
  const picked = value === current;
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      aria-pressed={picked}
      className={`border px-4 py-2.5 text-left transition ${
        picked
          ? "border-ink bg-ink text-paper"
          : "border-rule text-soft hover:border-ink hover:text-ink"
      }`}
    >
      <span className="block font-mono text-xs uppercase tracking-[0.14em]">
        {label}
      </span>
      <span
        className={`mt-0.5 block text-xs ${picked ? "text-paper/70" : "text-soft"}`}
      >
        {hint}
      </span>
    </button>
  );
}
