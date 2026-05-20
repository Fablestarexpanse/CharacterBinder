import { PLATFORM_LIST, type PlatformId, type PlatformDef } from "../lib/platforms";
import { Check, Image, FileJson } from "lucide-react";

interface PlatformSelectorProps {
  selected: PlatformId;
  onChange: (id: PlatformId) => void;
  compact?: boolean;
}

export default function PlatformSelector({ selected, onChange, compact = false }: PlatformSelectorProps) {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {PLATFORM_LIST.map((p) => (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
              selected === p.id
                ? `${p.color} ${p.textColor} ${p.borderColor}`
                : "bg-bg-tertiary border-border text-text-muted hover:border-border-light hover:text-text-secondary"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {PLATFORM_LIST.map((p) => (
        <PlatformCard
          key={p.id}
          platform={p}
          selected={selected === p.id}
          onSelect={() => onChange(p.id)}
        />
      ))}
    </div>
  );
}

function PlatformCard({
  platform,
  selected,
  onSelect,
}: {
  platform: PlatformDef;
  selected: boolean;
  onSelect: () => void;
}) {
  const lossCount = platform.fields.filter((f) => f.support === "none").length;
  const partialCount = platform.fields.filter((f) => f.support === "partial" || f.support === "renamed").length;

  return (
    <button
      onClick={onSelect}
      className={`relative text-left p-3 rounded-xl border transition-all ${
        selected
          ? `${platform.color} ${platform.borderColor} ring-1 ring-inset ring-current`
          : "bg-bg-card border-border hover:border-border-light hover:bg-bg-hover"
      }`}
    >
      {selected && (
        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-accent-green flex items-center justify-center">
          <Check size={10} className="text-white" />
        </span>
      )}
      <p className={`text-sm font-semibold mb-0.5 ${selected ? platform.textColor : "text-text-primary"}`}>
        {platform.name}
      </p>
      <p className="text-xs text-text-muted leading-tight mb-2 line-clamp-2">
        {platform.description}
      </p>
      <div className="flex items-center gap-2 text-xs">
        {platform.pngSupport && (
          <span className="flex items-center gap-0.5 text-accent-green">
            <Image size={10} /> PNG
          </span>
        )}
        {platform.jsonSupport && (
          <span className="flex items-center gap-0.5 text-text-muted">
            <FileJson size={10} /> JSON
          </span>
        )}
        {lossCount > 0 && (
          <span className="ml-auto text-red-400">{lossCount} lost</span>
        )}
        {lossCount === 0 && partialCount > 0 && (
          <span className="ml-auto text-yellow-400">{partialCount} mapped</span>
        )}
        {lossCount === 0 && partialCount === 0 && (
          <span className="ml-auto text-accent-green">Full</span>
        )}
      </div>
    </button>
  );
}
