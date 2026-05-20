import type { TavernCardV2 } from "../types";

interface RawPreviewProps {
  card: TavernCardV2;
}

export default function RawPreview({ card }: RawPreviewProps) {
  const jsonStr = JSON.stringify(card);
  const base64 = btoa(unescape(encodeURIComponent(jsonStr)));

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <section className="card-panel">
        <p className="section-title">Base64 Encoded (PNG tEXt chunk value)</p>
        <p className="text-xs text-text-muted mb-2">
          This is what gets embedded into the PNG file's <code className="text-accent-purple-light bg-bg-tertiary px-1 rounded">tEXt</code> chunk under the key{" "}
          <code className="text-accent-purple-light bg-bg-tertiary px-1 rounded">chara</code>.
        </p>
        <pre className="bg-bg-primary rounded-lg p-3 text-xs text-text-secondary font-mono break-all whitespace-pre-wrap overflow-hidden border border-border">
          {base64.slice(0, 500)}{base64.length > 500 ? `\n... (${base64.length} chars total)` : ""}
        </pre>
      </section>

      <section className="card-panel">
        <p className="section-title">Decoded JSON (what platforms read)</p>
        <pre className="bg-bg-primary rounded-lg p-3 text-xs text-text-secondary font-mono break-all whitespace-pre-wrap overflow-hidden border border-border max-h-64 overflow-y-auto">
          {JSON.stringify(card, null, 2)}
        </pre>
      </section>

      <section className="card-panel">
        <p className="section-title">Metadata Chunk Summary</p>
        <table className="w-full text-xs">
          <tbody className="space-y-1">
            <Row label="Chunk Type" value="tEXt" />
            <Row label="Keyword" value="chara" />
            <Row label="Encoding" value="Base64 + UTF-8" />
            <Row label="Data Length" value={`${base64.length} chars (~${Math.round(base64.length * 3 / 4 / 1024 * 100) / 100} KB)`} />
            <Row label="Spec" value={`${card.spec} ${card.spec_version}`} />
            <Row label="Fields" value={Object.keys(card.data).length + " top-level data fields"} />
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 text-text-muted w-40">{label}</td>
      <td className="py-2 text-text-primary font-mono">{value}</td>
    </tr>
  );
}
