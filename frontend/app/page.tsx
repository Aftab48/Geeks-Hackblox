import Link from "next/link";
import { RegisterStrip } from "@/components/RegisterStrip";
import { SearchForm } from "@/components/SearchForm";
import { getRecentCertificates } from "@/lib/certificates";
import {
  CONTRACT_ADDRESS,
  EXPLORER_URL,
  GENESIS_ISSUER_NAME,
} from "@/lib/contract";

// Re-read the register periodically so the front page reflects new entries
// without going fully dynamic on every request.
export const revalidate = 30;

export default async function Home() {
  const recent = await getRecentCertificates(4);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 pb-20 pt-14">
      <h1 className="display max-w-2xl text-4xl leading-[1.15] sm:text-5xl">
        Check a certificate against the register.
      </h1>
      <p className="mt-5 max-w-xl text-soft">
        {GENESIS_ISSUER_NAME} writes every certificate it awards to Base, a
        public blockchain. Paste the graduate&apos;s wallet address, or type the
        register number printed on the document.
      </p>

      <div className="mt-9 max-w-xl">
        <SearchForm autoFocus />
      </div>

      <div className="mt-14">
        <RegisterStrip entries={recent} />
      </div>

      <div className="my-14 h-px bg-rule" />

      <p className="max-w-2xl leading-relaxed">
        Every entry was written by the university&apos;s own wallet, and nothing
        here can be edited after the fact. The certificates themselves
        can&apos;t be sold or handed on; they stay with the graduate for good.
        Revoke one and it doesn&apos;t disappear, it just reads as revoked.
      </p>

      <footer className="mt-16 border-t border-rule pt-6 font-mono text-xs text-soft">
        <p>
          Register contract{" "}
          <a
            href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-rule underline-offset-4 hover:text-seal"
          >
            {CONTRACT_ADDRESS}
          </a>
        </p>
        <p className="mt-1.5">
          Base Sepolia &middot;{" "}
          <Link
            href="/issue"
            className="underline decoration-rule underline-offset-4 hover:text-seal"
          >
            Registrar&apos;s desk
          </Link>
        </p>
      </footer>
    </main>
  );
}
