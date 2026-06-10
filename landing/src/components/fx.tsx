"use client";

import { useEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────
   Lightweight 3D/scroll FX primitives — pure CSS transforms driven by
   pointer + scroll. No WebGL, no deps; safe for SSR (effects run client-side).
   ──────────────────────────────────────────────────────────────────────── */

/** Wraps children in a perspective container that tilts toward the cursor. */
export function HeroTilt({
  children,
  className = "",
  maxX = 8,
  maxY = 12,
}: {
  children: React.ReactNode;
  className?: string;
  maxX?: number;
  maxY?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-py * maxX).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(px * maxY).toFixed(2)}deg`);
  }
  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{ perspective: "1400px" }}
    >
      <div
        className="preserve-3d transition-transform duration-300 ease-out will-change-transform"
        style={{ transform: "rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))" }}
      >
        {children}
      </div>
    </div>
  );
}

/** A card that tilts in 3D toward the cursor with a moving light highlight. */
export function TiltCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--tx", `${(-py * 7).toFixed(2)}deg`);
    el.style.setProperty("--ty", `${(px * 9).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${((px + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${((py + 0.5) * 100).toFixed(1)}%`);
  }
  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tx", "0deg");
    el.style.setProperty("--ty", "0deg");
  }

  return (
    <div style={{ perspective: "900px" }} className="h-full">
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className={`group relative h-full preserve-3d transition-transform duration-200 ease-out will-change-transform ${className}`}
        style={{ transform: "rotateX(var(--tx, 0deg)) rotateY(var(--ty, 0deg))" }}
      >
        {children}
        {/* cursor-following sheen */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(420px circle at var(--mx,50%) var(--my,50%), rgba(96,165,250,.14), transparent 65%)",
          }}
        />
      </div>
    </div>
  );
}

/** Reveals children with a 3D rise/rotate animation when scrolled into view. */
export function Reveal({
  children,
  className = "",
  delay = 0,
  from = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  from?: "up" | "left" | "right" | "deep";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hidden: Record<string, string> = {
    up: "translateY(48px) rotateX(10deg)",
    left: "translateX(-48px) rotateY(-8deg)",
    right: "translateX(48px) rotateY(8deg)",
    deep: "translateZ(-120px) scale(.92)",
  };

  return (
    <div style={{ perspective: "1000px" }} className={className}>
      <div
        ref={ref}
        className="preserve-3d will-change-transform"
        style={{
          transform: shown ? "none" : hidden[from],
          opacity: shown ? 1 : 0,
          transition: `transform .9s cubic-bezier(.2,.65,.25,1) ${delay}ms, opacity .9s ease ${delay}ms`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Translates children along Y as the page scrolls — floating depth layers. */
export function ParallaxFloat({
  children,
  speed = 0.12,
  className = "",
}: {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `translate3d(0, ${(window.scrollY * speed).toFixed(1)}px, 0)`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [speed]);

  return (
    <div ref={ref} className={`will-change-transform ${className}`}>
      {children}
    </div>
  );
}

/** A slow-spinning wireframe cube — ambient 3D decoration. */
export function WireCube({ size = 64, className = "" }: { size?: number; className?: string }) {
  const half = size / 2;
  const face = `absolute inset-0 rounded-[6px] border border-brand/30 bg-brand/[.03]`;
  return (
    <div className={className} style={{ width: size, height: size, perspective: "600px" }} aria-hidden>
      <div className="preserve-3d animate-cube relative h-full w-full">
        <div className={face} style={{ transform: `translateZ(${half}px)` }} />
        <div className={face} style={{ transform: `translateZ(-${half}px)` }} />
        <div className={face} style={{ transform: `rotateY(90deg) translateZ(${half}px)` }} />
        <div className={face} style={{ transform: `rotateY(-90deg) translateZ(${half}px)` }} />
        <div className={face} style={{ transform: `rotateX(90deg) translateZ(${half}px)` }} />
        <div className={face} style={{ transform: `rotateX(-90deg) translateZ(${half}px)` }} />
      </div>
    </div>
  );
}

/** Animated voice waveform bars. */
export function Waveform({ bars = 14, className = "" }: { bars?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-current animate-wave"
          style={{
            height: `${10 + ((i * 7) % 14)}px`,
            animationDelay: `${(i % 7) * 0.12}s`,
            animationDuration: `${0.9 + (i % 4) * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
}
