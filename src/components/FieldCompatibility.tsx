import { PLATFORMS, type PlatformId } from "../lib/platforms";
import type { FieldSupport } from "../lib/platforms";

interface FieldCompatibilityProps {
  platformId: PlatformId;
  compact?: boolean;
}

const SUPPORT_CONFIG = {
  full:    { dot: "bg-accent-green",  label: "Supported",  text: "text-accent-green" },
  renamed: { dot: "bg-yellow-400",    label: "Renamed",    text: "text-yellow-400" },
  partial: { dot: "bg-orange-400",    label: "Partial",    text: "text-orange-400" },
  none:    { dot: "bg-red-500",       label: "Not supported", text: "text-red-400" },
};

export default function FieldCompatibility({ platformId, compact = false }: FieldCompatibilityProps) {
  const platform = PLATFORMS[platformId];
  const losses = platform.fields.filter((f) => f.support === "none");
  const partials = platform.fields.filter((f) => f.support === "partial" || f.support === "renamed");
  const full = platform.fields.filter((f) => f.support === "full");

  if (compact) {
    return (
      <div className="space-y-1">
        {losses.length > 0 && (
          <div>
            <p className="text-xs font-medium text-red-400 mb-1">Not exported ({losses.length})</p>
            <div className="flex flex-wrap gap-1">
              {losses.map((f) => (
                <FieldChip key={f.field} field={f} />
              ))}
            </div>
          </div>
        )}
        {partials.length > 0 && (
          <div>
            <p className="text-xs font-medium text-yellow-400 mb-1">Mapped / partial ({partials.length})</p>
            <div className="flex flex-wrap gap-1">
              {partials.map((f) => (
                <FieldChip key={f.field} field={f} />
              ))}
            </div>
          </div>
        )}
        {losses.length === 0 && partials.length === 0 && (
          <p className="text-xs text-accent-green">All {full.length} fields fully supported</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {platform.fields.map((f) => {
        const cfg = SUPPORT_CONFIG[f.support];
        return (
          <div key={f.field} className="flex items-start gap-2 py-1 border-b border-border/50 last:border-0">
            <span className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0 mt-1`} />
            <div className="flex-1 min-w-0">
              <span className="text-xs text-text-primary">{f.label}</span>
              {f.note && (
                <span className="text-xs text-text-muted ml-1.5">— {f.note}</span>
              )}
            </div>
            <span className={`text-xs shrink-0 ${cfg.text}`}>{cfg.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function FieldChip({ field }: { field: FieldSupport }) {
  const cfg = SUPPORT_CONFIG[field.support];
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${cfg.text} border-current/30 bg-current/5`}
      title={field.note}
    >
      {field.label.split(" →")[0]}
    </span>
  );
}
