"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchForm({
  initial = "",
  autoFocus = false,
}: {
  initial?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        if (!query) return;
        setPending(true);
        router.push(`/verify/${encodeURIComponent(query)}`);
      }}
      className="flex flex-col gap-2 sm:flex-row"
    >
      <label className="sr-only" htmlFor="lookup">
        Wallet address or register number
      </label>
      <input
        id="lookup"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="0x… or a register number"
        spellCheck={false}
        autoFocus={autoFocus}
        className="flex-1 border border-rule bg-card px-4 py-3 font-mono text-sm
                   text-ink placeholder:text-soft/70 focus:border-ink focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending || !value.trim()}
        className="border border-ink bg-ink px-7 py-3 font-mono text-xs uppercase
                   tracking-[0.16em] text-paper transition hover:bg-seal hover:border-seal
                   disabled:cursor-not-allowed disabled:opacity-35"
      >
        {pending ? "Looking up" : "Look up"}
      </button>
    </form>
  );
}
