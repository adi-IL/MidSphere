interface Props {
  /** Secondary status under the mark (e.g. connecting to API). */
  status?: string;
}

/**
 * Full-viewport boot screen — monochrome Command Center language.
 * Used while the first job artifact loads.
 */
export function LoadingScreen({ status = "Initializing Command Center…" }: Props) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-canvas text-ink">
      {/* Soft grid (matches React Flow canvas vibe, static) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #1a1a1a 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Center glow */}
      <div
        className="pointer-events-none absolute h-64 w-64 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(0,112,243,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center px-6">
        {/* Full project logo (wordmark + circuit sphere) */}
        <div className="relative mb-2 flex items-center justify-center">
          <span className="absolute inset-[-10px] rounded-full border border-line/40 load-ring" />
          <img
            src="/logo-sm.png"
            alt="MidSphere"
            width={200}
            height={200}
            className="relative h-auto w-[min(200px,58vw)] select-none object-contain"
            draggable={false}
          />
        </div>

        {/* Progress bar */}
        <div className="mt-6 h-px w-40 overflow-hidden rounded-full bg-line2">
          <div className="load-bar h-full w-1/2 bg-ink/80" />
        </div>

        <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-faint">
          {status}
        </p>

        {/* Stage dots — decorative pipeline hint */}
        <div className="mt-6 flex items-center gap-1.5">
          {["Audit", "Cascade", "Break", "Fix", "MBOM"].map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className="load-dot h-1 w-1 rounded-full bg-mute"
                style={{ animationDelay: `${i * 0.18}s` }}
                title={label}
              />
              {i < 4 && <span className="h-px w-3 bg-line2" />}
            </div>
          ))}
        </div>
        <p className="mt-2 font-mono text-[9px] tracking-wide text-faint/80">
          closed loop
        </p>
      </div>
    </div>
  );
}
