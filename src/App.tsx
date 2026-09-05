import { useState, useCallback, useEffect } from "react";
import type {
  NavPage, LoreBook, ScriptCard, ScenarioCard, PersonaCard, OpenDataCard,
} from "./types";
import { saveAppSettings } from "./lib/settings";
import { useAppSettings } from "./hooks/useAppSettings";
import { useCharacterCardEditor } from "./hooks/useCharacterCardEditor";
import { initBridge } from "./lib/bridgeClient";
import Sidebar from "./components/ui/Sidebar";
import CreateCard from "./components/pages/CreateCard";
import ImportPNG from "./components/pages/ImportPNG";
import DecodePNG from "./components/pages/DecodePNG";
import Templates from "./components/pages/Templates";
import Settings from "./components/pages/Settings";
import HelpAbout from "./components/pages/HelpAbout";
import Library from "./components/pages/Library";
import LoreBookEditor from "./components/pages/LoreBookEditor";
import ScriptEditor from "./components/pages/ScriptEditor";
import ScenarioEditor from "./components/pages/ScenarioEditor";
import PersonaEditor from "./components/pages/PersonaEditor";
import ConfirmModal from "./components/ui/ConfirmModal";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import { coerceCardBody } from "./shared/blankCards";

function App() {
  const [activePage, setActivePage] = useState<NavPage>("create");
  const settings = useAppSettings();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const openCreatePage = useCallback(() => setActivePage("create"), []);
  const character = useCharacterCardEditor(openCreatePage);
  // A destructive bridge call waiting on the user. The agent's RPC is parked on
  // this promise until they answer, so nothing is deleted or overwritten
  // without the same confirmation the UI itself requires.
  const [bridgeAsk, setBridgeAsk] = useState<{
    action: "delete" | "overwrite";
    cardName: string;
    decide: (approved: boolean) => void;
  } | null>(null);

  // Bumped whenever the MCP bridge mutates the library, so an open Library view
  // reloads instead of showing a stale list until the user navigates away.
  const [libraryRevision, setLibraryRevision] = useState(0);

  // ── Non-character editor state ──
  // One slot per kind, so returning to a tab restores what was last opened
  // there, and one key that remounts the editor whenever a new card arrives.
  const [editorKey, setEditorKey] = useState(0);
  const [editorInit, setEditorInit] = useState<{
    lorebook?: { card: LoreBook;     imageSrc: string | null; id?: string };
    script?:   { card: ScriptCard;   imageSrc: string | null; id?: string };
    scenario?: { card: ScenarioCard; imageSrc: string | null; id?: string };
    persona?:  { card: PersonaCard;  imageSrc: string | null; id?: string };
  }>({});

  /**
   * Open a non-character card, from wherever it came: a decoded PNG, a dropped
   * JSON file, the library, or the MCP bridge. The payload is normalised here,
   * so this is the only place that has to know what each kind is made of.
   */
  const openDataCard = useCallback<OpenDataCard>((cardType, payload, imageSrc, libraryId) => {
    // The slot is named after the kind, and coerceCardBody returns that kind's
    // own shape, so one keyed write says what four identical arms said.
    setEditorInit((prev) => ({
      ...prev,
      [cardType]: { imageSrc, id: libraryId, card: coerceCardBody(cardType, payload) },
    } as typeof prev));
    setEditorKey((k) => k + 1);
    setActivePage(cardType);
  }, []);

  // Let the MCP bridge open whatever an agent just created or edited, in the
  // editor that matches its type. Registered once; the handlers are stable.
  useEffect(() => {
    initBridge({
      onLibraryChanged: () => setLibraryRevision((n) => n + 1),
      confirmDestructive: ({ action, card }) =>
        new Promise<boolean>((resolve) => {
          setBridgeAsk({
            action,
            cardName: card.name,
            decide: (approved) => {
              setBridgeAsk(null);
              resolve(approved);
            },
          });
        }),
      openCard: (card) => {
        const image = card.imageSrc ?? null;
        if (card.cardType === "character") {
          // A record with no body opens nothing; the caller is told why rather
          // than being shown an editor holding a blank card.
          if (!card.cardData?.data) {
            return `"${card.name}" has no character data — the stored record is damaged.`;
          }
          character.loadFromLibrary(card.cardData, image, card.id);
          return null;
        }
        // Pass the library id: without it the editor would treat an agent-opened
        // card as new, and the next save would fork a duplicate record.
        openDataCard(card.cardType, card.rawData, image, card.id);
        return null;
      },
    });
  }, [character.loadFromLibrary, openDataCard]);

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      {showClearConfirm && (
        <ConfirmModal
          title="Clear current card?"
          message="All unsaved changes to the current character will be lost. This cannot be undone."
          confirmLabel="Clear Card"
          destructive
          onConfirm={() => { character.clear(); setShowClearConfirm(false); }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      {bridgeAsk && (
        <ConfirmModal
          title={bridgeAsk.action === "delete" ? "Let the agent delete this card?" : "Let the agent overwrite this card?"}
          message={
            bridgeAsk.action === "delete"
              ? `A connected coding agent wants to permanently delete "${bridgeAsk.cardName}" from your library. This cannot be undone.`
              : `A connected coding agent wants to change "${bridgeAsk.cardName}" in your library. The current version is replaced.`
          }
          confirmLabel={bridgeAsk.action === "delete" ? "Delete Card" : "Allow Change"}
          cancelLabel="Refuse"
          destructive={bridgeAsk.action === "delete"}
          onConfirm={() => bridgeAsk.decide(true)}
          onCancel={() => bridgeAsk.decide(false)}
        />
      )}

      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <main className="flex-1 overflow-hidden">
        <ErrorBoundary area="editor" key={`boundary-${activePage}`}>
        {activePage === "create" && (
          <CreateCard
            project={character.project}
            targetPlatform={character.targetPlatform}
            onUpdateCard={character.updateCard}
            onUpdateImage={character.updateImage}
            onUpdateOutputFileName={character.updateOutputFileName}
            onSavedToLibrary={character.adoptLibraryId}
            onPlatformChange={character.setTargetPlatform}
            onNewCard={() => setShowClearConfirm(true)}
          />
        )}
        {activePage === "lorebook" && (
          <LoreBookEditor
            key={editorKey}
            initialCard={editorInit.lorebook?.card}
            initialImageSrc={editorInit.lorebook?.imageSrc}
            initialLibraryId={editorInit.lorebook?.id}
          />
        )}
        {activePage === "script" && (
          <ScriptEditor
            key={editorKey}
            initialCard={editorInit.script?.card}
            initialImageSrc={editorInit.script?.imageSrc}
            initialLibraryId={editorInit.script?.id}
          />
        )}
        {activePage === "scenario" && (
          <ScenarioEditor
            key={editorKey}
            initialCard={editorInit.scenario?.card}
            initialImageSrc={editorInit.scenario?.imageSrc}
            initialLibraryId={editorInit.scenario?.id}
          />
        )}
        {activePage === "persona" && (
          <PersonaEditor
            key={editorKey}
            initialCard={editorInit.persona?.card}
            initialImageSrc={editorInit.persona?.imageSrc}
            initialLibraryId={editorInit.persona?.id}
          />
        )}
        {activePage === "import" && (
          <ImportPNG onLoad={character.loadCard} onOpenDataCard={openDataCard} />
        )}
        {activePage === "decode" && (
          <DecodePNG onLoad={character.loadCard} onOpenDataCard={openDataCard} />
        )}
        {activePage === "templates" && <Templates onLoad={character.loadCard} />}
        {activePage === "library" && (
          <Library
            libraryRevision={libraryRevision}
            onEditCard={character.loadFromLibrary}
            onOpenDataCard={openDataCard}
          />
        )}
        {activePage === "settings" && <Settings settings={settings} onSave={saveAppSettings} />}
        {activePage === "help" && <HelpAbout />}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
