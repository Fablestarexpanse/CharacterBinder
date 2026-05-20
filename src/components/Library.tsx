import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Archive,
  Trash2,
  Edit3,
  Download,
  User,
  SortAsc,
  SortDesc,
  CheckSquare,
  Square,
} from "lucide-react";
import type { LibraryCard, TavernCardV2 } from "../types";
import { getAllCards, deleteCard } from "../lib/library";
import { exportCardsAsZip } from "../lib/archive";

type SortKey = "updatedAt" | "createdAt" | "name";
type SortDir = "asc" | "desc";

interface LibraryProps {
  onEditCard: (card: TavernCardV2, pngData: Uint8Array | null, imageSrc: string | null, libraryId: string) => void;
}

export default function Library({ onEditCard }: LibraryProps) {
  const [cards, setCards] = useState<LibraryCard[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(async () => {
    const all = await getAllCards();
    setCards(all.reverse());
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = cards
    .filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.platform.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      let diff = 0;
      if (sortKey === "name") diff = a.name.localeCompare(b.name);
      else diff = a[sortKey] - b[sortKey];
      return sortDir === "asc" ? diff : -diff;
    });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    await deleteCard(id);
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    await load();
    setDeleting(null);
  }

  async function handleDeleteSelected() {
    for (const id of selected) await deleteCard(id);
    setSelected(new Set());
    await load();
  }

  async function handleArchive(ids?: string[]) {
    setArchiving(true);
    const targets = ids
      ? cards.filter((c) => ids.includes(c.id))
      : selected.size > 0
      ? cards.filter((c) => selected.has(c.id))
      : cards;
    await exportCardsAsZip(targets);
    setArchiving(false);
  }

  const SortBtn = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      onClick={() => toggleSort(k)}
      className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
        sortKey === k
          ? "bg-accent-purple/10 text-accent-purple font-medium"
          : "text-text-secondary hover:text-text-primary"
      }`}
    >
      {label}
      {sortKey === k && (sortDir === "asc" ? <SortAsc size={12} /> : <SortDesc size={12} />)}
    </button>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-5 py-3 flex items-center gap-3 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="input-base pl-8 py-1.5 text-xs"
            placeholder="Search by name, platform, tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 ml-2">
          <span className="text-xs text-text-muted mr-1">Sort:</span>
          <SortBtn label="Modified" k="updatedAt" />
          <SortBtn label="Created" k="createdAt" />
          <SortBtn label="Name" k="name" />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {selected.size > 0 && (
            <>
              <span className="text-xs text-text-muted">{selected.size} selected</span>
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={13} /> Delete
              </button>
              <button
                onClick={() => handleArchive()}
                disabled={archiving}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors"
              >
                <Download size={13} /> Export ZIP
              </button>
            </>
          )}
          <button
            onClick={() => handleArchive(cards.map((c) => c.id))}
            disabled={archiving || cards.length === 0}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            <Archive size={13} />
            {archiving ? "Archiving…" : "Archive All"}
          </button>
        </div>
      </div>

      {/* Body */}
      {cards.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
          No cards match your search.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5">
          {/* Select all row */}
          <div className="flex items-center gap-2 mb-3">
            <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors">
              {selected.size === filtered.length && filtered.length > 0
                ? <CheckSquare size={14} className="text-accent-purple" />
                : <Square size={14} />}
              {selected.size === filtered.length && filtered.length > 0 ? "Deselect all" : "Select all"}
            </button>
            <span className="text-xs text-text-muted ml-auto">{filtered.length} card{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                selected={selected.has(card.id)}
                deleting={deleting === card.id}
                onToggle={() => toggleSelect(card.id)}
                onEdit={() => onEditCard(card.cardData, card.pngData, card.imageSrc, card.id)}
                onDelete={() => handleDelete(card.id)}
                onExport={() => handleArchive([card.id])}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CardTile({
  card, selected, deleting, onToggle, onEdit, onDelete, onExport,
}: {
  card: LibraryCard;
  selected: boolean;
  deleting: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const [hover, setHover] = useState(false);
  const updated = new Date(card.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div
      className={`relative rounded-xl border transition-all cursor-pointer group ${
        selected
          ? "border-accent-purple ring-2 ring-accent-purple/20"
          : "border-border hover:border-border-light"
      } bg-bg-card overflow-hidden`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Thumbnail */}
      <div className="aspect-[3/4] bg-bg-tertiary flex items-center justify-center overflow-hidden relative">
        {card.imageSrc ? (
          <img src={card.imageSrc} alt={card.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-text-muted">
            <User size={32} className="opacity-30" />
            <span className="text-xs opacity-50">No image</span>
          </div>
        )}

        {/* Hover overlay */}
        {hover && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Edit"
            >
              <Edit3 size={16} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onExport(); }}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Export ZIP"
            >
              <Download size={16} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              disabled={deleting}
              className="p-2 rounded-lg bg-red-500/30 hover:bg-red-500/50 text-white transition-colors"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}

        {/* Select checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="absolute top-2 left-2 z-10"
        >
          {selected
            ? <CheckSquare size={18} className="text-accent-purple drop-shadow" />
            : <Square size={18} className="text-white/70 drop-shadow opacity-0 group-hover:opacity-100 transition-opacity" />}
        </button>

        {/* Platform badge */}
        <span className="absolute top-2 right-2 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded-full capitalize">
          {card.platform}
        </span>
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="text-sm font-medium text-text-primary truncate">{card.name}</p>
        <p className="text-[11px] text-text-muted mt-0.5">{updated}</p>
        {card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {card.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-[10px] bg-bg-tertiary text-text-muted px-1.5 py-0.5 rounded-full">{t}</span>
            ))}
            {card.tags.length > 3 && (
              <span className="text-[10px] text-text-muted">+{card.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-bg-tertiary flex items-center justify-center">
        <User size={28} className="text-text-muted opacity-40" />
      </div>
      <div>
        <p className="text-base font-semibold text-text-primary">Your library is empty</p>
        <p className="text-sm text-text-muted mt-1 max-w-xs">
          Save a character from the editor using the <strong>Save to Library</strong> button — it'll appear here.
        </p>
      </div>
    </div>
  );
}
