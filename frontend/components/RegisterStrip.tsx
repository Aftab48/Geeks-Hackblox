import Link from "next/link";
import type { Certificate } from "@/lib/certificates";

function formatDate(seconds: bigint) {
  return new Date(Number(seconds) * 1000).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function RegisterStrip({ entries }: { entries: Certificate[] }) {
  if (entries.length === 0) return null;

  return (
    <section>
      <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-soft">
        Latest in the register
      </h2>

      <ul className="mt-4 border-t border-rule">
        {entries.map((entry) => (
          <li key={entry.tokenId.toString()} className="border-b border-rule">
            <Link
              href={`/verify/${entry.tokenId.toString()}`}
              className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5"
            >
              <span className="w-8 shrink-0 font-mono text-xs text-soft">
                {entry.tokenId.toString().padStart(3, "0")}
              </span>
              <span
                className={`display flex-1 basis-40 text-lg group-hover:text-seal ${
                  entry.revoked ? "text-soft line-through decoration-seal/60" : ""
                }`}
              >
                {entry.courseName}
              </span>
              <span className="flex w-full items-baseline justify-between gap-4 pl-12 sm:w-auto sm:pl-0">
                <span className="text-sm text-soft">{entry.recipientName}</span>
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-soft">
                  {entry.revoked ? (
                    <span className="text-seal">Revoked</span>
                  ) : (
                    formatDate(entry.issuedAt)
                  )}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
