interface Props {
  /** Secondary status under the mark (e.g. connecting to API). */
  status?: string;
}

/** Full-viewport boot screen  -  monochrome, minimal. */
export function LoadingScreen({ status = "Connecting..." }: Props) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-canvas text-ink">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #1a1a1a 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center px-6">
        <img
          src="/logo-sm.png"
          alt="MidSphere"
          width={160}
          height={160}
          className="relative h-auto w-[min(160px,48vw)] select-none object-contain"
          draggable={false}
        />

        <div className="mt-6 h-px w-32 overflow-hidden bg-line2">
          <div className="load-bar h-full w-1/2 bg-ink/70" />
        </div>

        <p className="mt-4 text-2xs text-mute">{status}</p>
      </div>
    </div>
  );
}
