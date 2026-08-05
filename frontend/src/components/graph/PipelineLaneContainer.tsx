interface Lane {
  title: string;
  subtitle: string;
  count: number;
}

interface Props {
  lanes: Lane[];
}

export function PipelineLaneContainer({ lanes }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 flex px-8 py-6 justify-around opacity-40 select-none">
      {lanes.map((lane, idx) => (
        <div
          key={idx}
          className="flex flex-col flex-1 mx-3 rounded-2xl border border-dashed border-line/40 bg-panel/10 p-4 backdrop-blur-[1px]"
        >
          <div className="flex items-center justify-between border-b border-line/30 pb-2">
            <div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-faint">
                {lane.title}
              </div>
              <div className="font-mono text-[9px] text-mute">{lane.subtitle}</div>
            </div>
            <span className="rounded-full bg-elevated px-2 py-0.5 font-mono text-[9px] font-bold text-ink border border-line/40">
              {lane.count}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
