"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 pb-20 pt-14">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-seal">
        Something broke
      </p>
      <h1 className="display mt-3 text-3xl">The register didn&apos;t load.</h1>
      <p className="mt-4 max-w-lg text-soft">
        This is usually the Base node refusing a request rather than anything
        wrong with the certificate itself. Try the lookup again; if it keeps
        failing, the record is still readable on Basescan.
      </p>
      <button
        onClick={reset}
        className="mt-7 border border-ink bg-ink px-7 py-3 font-mono text-xs uppercase
                   tracking-[0.16em] text-paper transition hover:border-seal hover:bg-seal"
      >
        Try again
      </button>
    </main>
  );
}
