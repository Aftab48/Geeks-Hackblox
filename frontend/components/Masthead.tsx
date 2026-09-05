import Link from "next/link";

export function Masthead() {
  return (
    <header className="border-b border-rule/70">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-6 py-5">
        <Link href="/" className="group">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-soft">
            University of Calcutta
          </p>
          <p className="display text-xl leading-tight group-hover:text-seal">
            Certificate Register
          </p>
        </Link>

        <nav className="flex items-baseline gap-5 font-mono text-[0.7rem] uppercase tracking-[0.14em]">
          <Link href="/" className="text-soft hover:text-seal">
            Look up
          </Link>
          <Link href="/issue" className="text-soft hover:text-seal">
            Registrar
          </Link>
        </nav>
      </div>
      <div className="mx-auto max-w-4xl px-6">
        <div className="h-px bg-rule/60" />
      </div>
    </header>
  );
}
