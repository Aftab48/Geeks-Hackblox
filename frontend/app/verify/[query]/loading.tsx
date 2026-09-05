export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 pb-20 pt-10">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-soft">
        Reading the register
      </p>

      <div className="mt-8 border border-rule bg-card">
        <div className="m-1.5 animate-pulse border border-rule/50 px-6 py-7 sm:px-8">
          <div className="h-3 w-32 bg-rule/70" />
          <div className="mt-4 h-9 w-3/4 bg-rule/60" />
          <div className="mt-3 h-4 w-48 bg-rule/50" />
          <div className="my-7 h-px bg-rule" />
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="h-10 bg-rule/40" />
            <div className="h-10 bg-rule/40" />
            <div className="h-10 bg-rule/40" />
          </div>
          <div className="mt-7 h-48 bg-rule/30" />
        </div>
      </div>
    </main>
  );
}
