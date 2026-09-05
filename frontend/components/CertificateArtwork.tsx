"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The pinned artwork, with the frame drawn before the bytes arrive.
 *
 * The image comes from a public IPFS gateway, which takes several seconds on
 * a cold read, so the box holds the certificate's 960x700 shape from the
 * first paint and nothing jumps when the SVG lands.
 *
 * The skeleton sits *underneath* the image rather than swapping with it. An
 * image that hasn't loaded paints nothing, so the placeholder shows through
 * on its own, and a cached one covers it on the first frame without waiting
 * for React to hydrate. The state below only stops the pulse afterwards.
 */
export function CertificateArtwork({
  src,
  alt,
  revoked,
}: {
  src: string;
  alt: string;
  revoked?: boolean;
}) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const ref = useRef<HTMLImageElement>(null);

  // The image is server-rendered markup, so it can finish loading before, during
  // or after hydration. React's onLoad misses the first two cases and the event
  // never comes again, which would leave the buried skeleton pulsing behind the
  // artwork for the life of the page. Check the element directly, then listen
  // natively for the case where it genuinely hasn't landed yet.
  useEffect(() => {
    const img = ref.current;
    if (!img) return;

    const settle = () => setState(img.naturalWidth > 0 ? "ready" : "failed");
    if (img.complete) {
      settle();
      return;
    }

    const failed = () => setState("failed");
    img.addEventListener("load", settle);
    img.addEventListener("error", failed);
    return () => {
      img.removeEventListener("load", settle);
      img.removeEventListener("error", failed);
    };
  }, []);

  // A gateway that never answers shouldn't leave a placeholder sitting there.
  if (state === "failed") return null;

  return (
    <figure className="mt-7 border border-rule bg-paper p-2">
      <div className="relative aspect-[960/700] w-full overflow-hidden">
        {state === "loading" && <Skeleton />}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={ref}
          src={src}
          alt={alt}
          className={`absolute inset-0 z-10 block h-full w-full ${
            revoked ? "opacity-40 grayscale" : ""
          }`}
        />
      </div>
    </figure>
  );
}

/** The certificate's own furniture, greyed out and breathing. */
function Skeleton() {
  return (
    <div className="absolute inset-0 z-0 bg-paper" aria-hidden>
      <div className="absolute inset-[3%] border-2 border-rule/70" />
      <div className="absolute inset-[4.5%] border border-rule/40" />

      <div className="absolute inset-x-[8%] top-[14%] animate-pulse space-y-4">
        <div className="h-[9px] w-[26%] bg-rule/50" />
        <div className="h-[26px] w-[62%] bg-rule/40" />
        <div className="h-[9px] w-[38%] bg-rule/30" />
      </div>

      <div className="absolute inset-x-[8%] top-[54%] h-px bg-rule/50" />

      <div className="absolute bottom-[12%] left-[8%] animate-pulse space-y-2.5">
        <div className="h-[9px] w-[120px] bg-rule/40" />
        <div className="h-[9px] w-[84px] bg-rule/30" />
      </div>

      <div className="absolute bottom-[11%] right-[8%] h-[11%] w-[11%] animate-pulse border border-rule/50" />

      <p className="absolute inset-x-0 top-[64%] text-center font-mono text-[0.6rem] uppercase tracking-[0.18em] text-soft/70">
        Fetching the pinned copy from IPFS
      </p>
    </div>
  );
}
