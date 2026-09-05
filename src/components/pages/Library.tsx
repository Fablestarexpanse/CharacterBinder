import { useState, useEffect, useCallback } from "react";
import {
  Search, Archive, Trash2, Edit3, Download,
  User, BookOpen, FileCode2, Map, UserCircle,
  SortAsc, SortDesc, CheckSquare, Square,
  type LucideIcon,
} from "lucide-react";
import { CARD_TYPES, type LibraryCard, type LibraryCardType, type TavernCardV2, type OpenDataCard } from "../../types";
import { getAllCards, deleteCard } from "../../lib/library";
import { exportCardsAsZip } from "../../lib/archive";
import ConfirmModal from "../ui/ConfirmModal";
import { useStatusMessage } from "../../hooks/useStatusMessage";
import { errorMessage } from "../../shared/errorMessage";

type SortKey = "updatedAt" | "createdAt" | "name";

function getCardVersion(card: LibraryCard): string | null {
  if (card.cardType === "character") {
    const v = card.cardData?.data.character_version?.trim();
    return v || null;
  }
  const raw: { version?: string } = card.rawData;
  const v = raw?.version?.trim();
  return v || null;
}
type SortDir = "asc" | "desc";

const SECTION_META: Record<LibraryCardType, { label: string; icon: LucideIcon; color: string }> = {
  character: { label: "Character Cards",  icon: User,        color: "text-accent-purple" },
  lorebook:  { label: "Lorebooks",        icon: BookOpen,    color: "text-status-info" },
  script:    { label: "Script Cards",     icon: FileCode2,   color: "text-status-warn" },
  scenario:  { label: "Scenario Cards",   icon: Map,         color: "text-status-ok" },
  persona:   { label: "Personas",         icon: UserCircle,  color: "text-accent-purple-light" },
};


interface LibraryProps {
  /** Bumped by the MCP bridge after it mutates the library; forces a reload. */
  libraryRevision?: number;
  onEditCard: (card: TavernCardV2, imageSrc: string | null, id: string) => void;
  /** Open a lorebook, script, scenario or persona in the editor for its kind. */
  onOpenDataCard: OpenDataCard;
}

export default function Library({ libraryRevision = 0, onEditCard, onOpenDataCard }: LibraryProps) {
  const [cards, setCards] = useState<LibraryCard[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  // Deletes are irreversible and there is no undo, so both paths confirm first.
  const [pendingDelete, setPendingDelete] = useState<{ ids: string[]; label: string } | null>(null);

  const { status, setMsg } = useStatusMessage(6000);

  // IndexedDB fails for reasons the user can do something about — storage
  // blocked in a private window, a quota that is full, an upgrade blocked by
  // another tab — and none of these showed anything at all before: the list
  // simply stayed empty and the buttons stayed stuck on "Deleting…".
  const reportFailure = useCallback((what: string, err: unknown) => {
    setMsg(`${what}: ${errorMessage(err)}`, false);
  }, [setMsg]);

  const load = useCallback(async () => {
    try {
      setCards(await getAllCards());
    } catch (err) {
      reportFailure("Couldn't read your library", err);
    }
  }, [reportFailure]);

  useEffect(() => { load(); }, [load, libraryRevision]);

  const filtered = cards
    .filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.platform.toLowerCase().includes(q) ||
        c.cardType.includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      let diff = 0;
      if (sortKey === "name") diff = a.name.localeCompare(b.name);
      else diff = a[sortKey] - b[sortKey];
      return sortDir === "asc" ? diff : -diff;
    });

  // Group into sections
  const sections = CARD_TYPES
    .map((type) => ({ type, cards: filtered.filter((c) => c.cardType === type) }))
    .filter((s) => s.cards.length > 0);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { ids } = pendingDelete;
    setPendingDelete(null);
    setDeleting(ids[0] ?? null);
    const deleted: string[] = [];
    try {
      for (const id of ids) {
        await deleteCard(id);
        deleted.push(id);
      }
    } catch (err) {
      // Partway through a multi-card delete: say so, and drop only the ones
      // that actually went, so the selection still matches the library.
      reportFailure(`Deleted ${deleted.length} of ${ids.length} cards, then failed`, err);
    } finally {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of deleted) next.delete(id);
        return next;
      });
      await load();
      setDeleting(null);
    }
  }

  async function handleArchive(ids?: string[]) {
    setArchiving(true);
    const targets = ids
      ? cards.filter((c) => ids.includes(c.id))
      : selected.size > 0
      ? cards.filter((c) => selected.has(c.id))
      : cards;
    try {
      await exportCardsAsZip(targets);
    } catch (err) {
      reportFailure("Couldn't build the archive", err);
    } finally {
      setArchiving(false);
    }
  }

  function handleEdit(card: LibraryCard) {
    if (card.cardType === "character") {
      // A record written before the type was enforced, or one damaged in
      // storage, can have no card body. Clicking Edit on it used to do nothing
      // at all, which reads as the app being broken rather than the card being.
      if (!card.cardData?.data) {
        setMsg(`Can't open "${card.name}" — its character data is missing or damaged.`, false);
        return;
      }
      onEditCard(card.cardData, card.imageSrc, card.id);
      return;
    }
    onOpenDataCard(card.cardType, card.rawData, card.imageSrc, card.id);
  }

  const SortBtn = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      onClick={() => toggleSort(k)}
      className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
        sortKey === k ? "bg-accent-purple/10 text-accent-purple font-medium" : "text-text-secondary hover:text-text-primary"
      }`}
    >
      {label}
      {sortKey === k && (sortDir === "asc" ? <SortAsc size={12} /> : <SortDesc size={12} />)}
    </button>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {pendingDelete && (
        <ConfirmModal
          title={`Delete ${pendingDelete.label}?`}
          message="This permanently removes the card from your library. It cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {status && (
        <p
          role="status"
          aria-live="polite"
          className={`px-5 py-2 text-xs border-b ${
            status.ok
              ? "text-status-ok bg-status-ok-soft border-status-ok-border"
              : "text-status-danger bg-status-danger-soft border-status-danger-border"
          }`}
        >
          {status.msg}
        </p>
      )}

      {/* Header */}
      <div className="border-b border-border px-5 py-3 flex items-center gap-3 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="input-base pl-8 py-1.5 text-xs"
            placeholder="Search name, type, tag…"
            aria-label="Search the library by name, type, or tag"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-xs px-1"
            >✕</button>
          )}
        </div>

        <div className="flex items-center gap-1 ml-2">
          <span className="text-xs text-text-muted mr-1">Sort:</span>
          <SortBtn label="Modified" k="updatedAt" />
          <SortBtn label="Created"  k="createdAt" />
          <SortBtn label="Name"     k="name" />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {selected.size > 0 && (
            <>
              <span className="text-xs text-text-muted">{selected.size} selected</span>
              <button onClick={() => setPendingDelete({ ids: [...selected], label: `${selected.size} card${selected.size !== 1 ? "s" : ""}` })} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-status-danger-border text-status-danger hover:bg-status-danger-soft transition-colors">
                <Trash2 size={13} /> Delete
              </button>
              <button onClick={() => handleArchive()} disabled={archiving} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors">
                <Download size={13} /> Export ZIP
              </button>
            </>
          )}
          <button
            onClick={() => handleArchive(filtered.map((c) => c.id))}
            disabled={archiving || filtered.length === 0}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            <Archive size={13} />
            {archiving ? "Archiving…" : search ? `Archive ${filtered.length}` : "Archive All"}
          </button>
        </div>
      </div>

      {/* Body */}
      {cards.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">No cards match your search.</div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 space-y-8">
          {/* Select-all row */}
          <div className="flex items-center gap-2 -mb-4">
            <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors">
              {selected.size === filtered.length && filtered.length > 0
                ? <CheckSquare size={14} className="text-accent-purple" />
                : <Square size={14} />}
              {selected.size === filtered.length && filtered.length > 0 ? "Deselect all" : "Select all"}
            </button>
            <span className="text-xs text-text-muted ml-auto">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {sections.map(({ type, cards: sectionCards }) => {
            const meta = SECTION_META[type];
            const SectionIcon = meta.icon;
            return (
              <div key={type}>
                {/* Section header */}
                <div className="flex items-center gap-2 mb-3">
                  <SectionIcon size={15} className={meta.color} />
                  <h2 className="text-sm font-semibold text-text-primary">{meta.label}</h2>
                  <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-0.5 rounded-full">{sectionCards.length}</span>
                  <div className="flex-1 h-px bg-border ml-1" />
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {sectionCards.map((card) => (
                    <CardTile
                      key={card.id}
                      card={card}
                      selected={selected.has(card.id)}
                      deleting={deleting === card.id}
                      onToggle={() => toggleSelect(card.id)}
                      onEdit={() => handleEdit(card)}
                      onDelete={() => setPendingDelete({ ids: [card.id], label: `"${card.name}"` })}
                      onExport={() => handleArchive([card.id])}
                      onTagClick={(tag) => setSearch(tag)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CardTile({
  card, selected, deleting, onToggle, onEdit, onDelete, onExport, onTagClick,
}: {
  card: LibraryCard;
  selected: boolean;
  deleting: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
  onTagClick: (tag: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const updated = new Date(card.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const type = card.cardType;
  const meta = SECTION_META[type];
  const PlaceholderIcon = meta.icon;
  const version = getCardVersion(card);

  // Badge label: platform for characters, type name for others
  const badge = type === "character" ? card.platform : meta.label.replace(" Cards", "").replace("books", "book");

  return (
    <div
      className={`relative rounded-xl border transition-all group focus-within:border-accent-purple ${
        selected ? "border-accent-purple ring-2 ring-accent-purple/20" : "border-border hover:border-border-light"
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
            <PlaceholderIcon size={32} className={`opacity-25 ${meta.color}`} />
            <span className="text-xs opacity-50">No image</span>
          </div>
        )}

        {/* Action overlay. Kept mounted and revealed on hover *or* keyboard
            focus — these used to be conditionally rendered on a mouseenter
            state, so Edit, Export and Delete were unreachable without a mouse. */}
        <div
          className={`absolute inset-0 bg-black/50 flex items-center justify-center gap-2 transition-opacity ${
            hover ? "opacity-100" : "opacity-0 focus-within:opacity-100"
          }`}
        >
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors" title={`Edit ${card.name}`} aria-label={`Edit ${card.name}`}>
            <Edit3 size={16} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onExport(); }} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors" title={`Export ${card.name} as ZIP`} aria-label={`Export ${card.name} as ZIP`}>
            <Download size={16} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} disabled={deleting} className="p-2 rounded-lg bg-status-danger/30 hover:bg-status-danger/50 text-white transition-colors" title={`Delete ${card.name}`} aria-label={`Delete ${card.name}`}>
            <Trash2 size={16} />
          </button>
        </div>

        {/* Select checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="absolute top-2 left-2 z-10 rounded"
          role="checkbox"
          aria-checked={selected}
          aria-label={`Select ${card.name}`}
        >
          {selected
            ? <CheckSquare size={18} className="text-accent-purple drop-shadow" />
            : <Square size={18} className="text-white/70 drop-shadow opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity" />}
        </button>

        {/* Badges: type + version */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          <span className="text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded-full capitalize">
            {badge}
          </span>
          {version && (
            <span className="text-[10px] bg-black/40 text-white/80 px-1.5 py-0.5 rounded-full font-mono">
              v{version}
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="text-sm font-medium text-text-primary truncate">{card.name}</p>
        <p className="text-[11px] text-text-muted mt-0.5">{updated}</p>
        {card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {card.tags.slice(0, 3).map((t) => (
              <button
                key={t}
                onClick={(e) => { e.stopPropagation(); onTagClick(t); }}
                className="text-[10px] bg-bg-tertiary text-text-muted hover:bg-accent-purple/20 hover:text-accent-purple-light px-1.5 py-0.5 rounded-full transition-colors"
                title={`Filter by "${t}"`}
              >{t}</button>
            ))}
            {card.tags.length > 3 && <span className="text-[10px] text-text-muted">+{card.tags.length - 3}</span>}
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
          Use the <strong>Save to Library</strong> button in any editor — cards appear here organised by type.
        </p>
      </div>
    </div>
  );
}
