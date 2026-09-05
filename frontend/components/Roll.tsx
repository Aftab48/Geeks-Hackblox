"use client";

import { EXPLORER_URL } from "@/lib/contract";
import { isZero, same, shorten, type Officer } from "@/lib/roll";

/**
 * Who holds what, drawn the way the contract stores it.
 *
 * appointedBy is the whole point of the hierarchy, so the page shows it
 * structurally: an issuer sits indented under the registrar that appointed
 * them, joined by a rule. A role column on a flat table would have said the
 * same thing in less time and taught nobody the shape of the register.
 */
export function Roll({
  officers,
  you,
  entryCounts,
  canRemove,
  onRemove,
  pending,
}: {
  officers: Officer[];
  you?: `0x${string}`;
  entryCounts: Map<string, number>;
  canRemove?: (officer: Officer, office: "registrar" | "issuer") => boolean;
  onRemove?: (officer: Officer, office: "registrar" | "issuer") => void;
  pending?: string | null;
}) {
  const registrars = officers.filter((o) => o.isRegistrar);
  const issuers = officers.filter((o) => o.isIssuer);

  // Issuers with nobody above them: the genesis issuer, and anyone whose
  // appointing registrar has since been stripped. They'd vanish from an
  // indented list, and an issuer you can't see is an issuer you can't remove.
  // A registrar that also issues is skipped, since its own line covers it.
  const unattached = issuers.filter(
    (issuer) =>
      !issuer.isRegistrar &&
      (isZero(issuer.appointedBy) ||
        !registrars.some((r) => same(r.address, issuer.appointedBy)))
  );

  return (
    <div className="font-mono text-sm">
      {registrars.map((registrar) => {
        const under = issuers.filter((i) => same(i.appointedBy, registrar.address));
        return (
          <div key={registrar.address} className="border-t border-rule py-5 first:border-t-0">
            <Line
              officer={registrar}
              office="registrar"
              you={you}
              count={entryCounts.get(registrar.address.toLowerCase())}
              canRemove={canRemove}
              onRemove={onRemove}
              pending={pending}
            />

            {under.length > 0 && (
              <ul className="mt-4 ml-3 border-l border-rule pl-6">
                {under.map((issuer) => (
                  <li key={issuer.address} className="relative py-2.5">
                    <span
                      className="absolute -left-6 top-[1.15rem] h-px w-4 bg-rule"
                      aria-hidden
                    />
                    <Line
                      officer={issuer}
                      office="issuer"
                      you={you}
                      count={entryCounts.get(issuer.address.toLowerCase())}
                      canRemove={canRemove}
                      onRemove={onRemove}
                      pending={pending}
                    />
                  </li>
                ))}
              </ul>
            )}

            {under.length === 0 && (
              <p className="mt-3 ml-3 border-l border-rule/60 py-1 pl-6 text-xs text-soft">
                No issuers appointed yet.
              </p>
            )}
          </div>
        );
      })}

      {unattached.length > 0 && (
        <div className="border-t border-rule pt-5">
          <p className="text-[0.65rem] uppercase tracking-[0.18em] text-soft">
            Issuing without a registrar above them
          </p>
          <ul className="mt-3">
            {unattached.map((issuer) => (
              <li key={issuer.address} className="py-2.5">
                <Line
                  officer={issuer}
                  office="issuer"
                  you={you}
                  count={entryCounts.get(issuer.address.toLowerCase())}
                  canRemove={canRemove}
                  onRemove={onRemove}
                  pending={pending}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Line({
  officer,
  office,
  you,
  count,
  canRemove,
  onRemove,
  pending,
}: {
  officer: Officer;
  office: "registrar" | "issuer";
  you?: `0x${string}`;
  count?: number;
  canRemove?: (officer: Officer, office: "registrar" | "issuer") => boolean;
  onRemove?: (officer: Officer, office: "registrar" | "issuer") => void;
  pending?: string | null;
}) {
  const yours = same(officer.address, you);
  const busy = pending === `${office}:${officer.address}`;

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span
            className={`font-sans text-base ${
              office === "registrar" ? "text-ink" : "text-ink/85"
            }`}
          >
            {officer.name || "Unnamed"}
          </span>
          {yours && (
            <span className="text-[0.6rem] uppercase tracking-[0.18em] text-seal">
              your wallet
            </span>
          )}
        </p>
        <a
          href={`${EXPLORER_URL}/address/${officer.address}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-soft underline decoration-rule underline-offset-2 hover:text-seal"
        >
          {shorten(officer.address)}
        </a>
      </div>

      <div className="flex items-baseline gap-5 text-xs text-soft">
        <span>{roleWord(officer, office)}</span>
        {(office === "issuer" || officer.isIssuer) && (
          <span>{count === 1 ? "1 entry" : `${count ?? 0} entries`}</span>
        )}
        {onRemove && canRemove?.(officer, office) && (
          <button
            onClick={() => onRemove(officer, office)}
            disabled={busy}
            className="uppercase tracking-[0.14em] text-soft underline decoration-rule
                       underline-offset-4 transition hover:text-seal disabled:opacity-40"
          >
            {busy ? "Removing" : "Remove"}
          </button>
        )}
      </div>
    </div>
  );
}

/** Everything this wallet may do, in the order the hierarchy runs. */
function roleWord(officer: Officer, office: "registrar" | "issuer"): string {
  if (office === "issuer") return "issuer";

  const held = [];
  if (officer.isAdmin) held.push("admin");
  if (officer.isRegistrar) held.push("registrar");
  if (officer.isIssuer) held.push("issuer");
  return held.join(", ");
}
