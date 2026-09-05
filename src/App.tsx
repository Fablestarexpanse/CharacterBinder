import { useState, useCallback, useEffect } from "react";
import type {
  TavernCardV2, NavPage, AppSettings, MetadataInfo, CardProject,
  LoreBook, ScriptCard, ScenarioCard, PersonaCard, OpenDataCard,
} from "./types";
import type { PlatformId } from "./shared/platforms";
import { getAppSettings, saveAppSettings } from "./lib/settings";
import { initBridge } from "./lib/bridge/client";
import { useUnsavedWarning } from "./hooks/useUnsavedWarning";
import { blankTemplate } from "./data/builtinTemplates";
import Sidebar from "./components/pages/Sidebar";
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
import ErrorBoundary from "./components/pages/ErrorBoundary";
import { coerceCardBody } from "./lib/blankCards";

/** Output filename derived from the character name, e.g. "Mira Vale" → "Mira_Vale_Tavern_Card.png". */
function defaultFileName(name: string): string {
  const trimmed = name.trim();
  return trimmed ? `${trimmed.replace(/\s+/g, "_")}_Tavern_Card.png` : "New_Character_Tavern_Card.png";
}

function App() {
  const [activePage, setActivePage] = useState<NavPage>("create");
  const [settings, setSettings] = useState<AppSettings>(getAppSettings);
  const [targetPlatform, setTargetPlatform] = useState<PlatformId>("sillytavern");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
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

  // ── Character card state ──
  const [project, setProject] = useState<CardProject>({
    id: "default",
    card: blankTemplate,
    imageSrc: undefined,
    outputFileName: defaultFileName(""),
    lastModified: new Date().toISOString(),
  });

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

  // Once the user edits the output filename themselves, stop deriving it from
  // the character name — otherwise the next keystroke in the Name field would
  // silently throw their filename away.
  const [fileNameTouched, setFileNameTouched] = useState(false);

  useEffect(() => {
    if (fileNameTouched) return;
    setProject((p) => ({ ...p, outputFileName: defaultFileName(p.card.data.name) }));
  }, [project.card.data.name, fileNameTouched]);

  // The editor holds plain React state until it is saved or exported, so closing
  // the tab mid-edit used to discard it silently. Only guard once there is
  // something worth losing.
  const hasUnsavedWork =
    project.id === "default" &&
    (!!project.card.data.name.trim() ||
      !!project.card.data.description.trim() ||
      !!project.card.data.personality.trim() ||
      !!project.card.data.first_mes.trim());
  useUnsavedWarning(hasUnsavedWork);

  // ── Character card handlers ──
  const updateCard = useCallback((updates: Partial<TavernCardV2["data"]>) => {
    setProject((p) => ({
      ...p,
      card: { ...p.card, data: { ...p.card.data, ...updates } },
      lastModified: new Date().toISOString(),
    }));
  }, []);

  const loadCard = useCallback((
    card: TavernCardV2,
    imageSrc?: string,
    meta?: MetadataInfo,
    sourcePlatform?: PlatformId
  ) => {
    setProject((p) => ({
      ...p,
      card,
      imageSrc,
      outputFileName: defaultFileName(card.data.name),
      lastModified: new Date().toISOString(),
      metadataInfo: meta,
    }));
    setFileNameTouched(false);
    if (sourcePlatform) setTargetPlatform(sourcePlatform);
    setActivePage("create");
  }, []);

  const loadFromLibrary = useCallback((
    card: TavernCardV2,
    _pngData: Uint8Array | null,
    imageSrc: string | null,
    libraryId: string
  ) => {
    setProject((p) => ({
      ...p,
      id: libraryId,
      card,
      imageSrc: imageSrc ?? undefined,
      outputFileName: defaultFileName(card.data.name),
      lastModified: new Date().toISOString(),
      metadataInfo: undefined,
    }));
    setFileNameTouched(false);
    setActivePage("create");
  }, []);

  const adoptLibraryId = useCallback((id: string) => {
    setProject((p) => (p.id === id ? p : { ...p, id }));
  }, []);

  const updateImage = useCallback((imageSrc: string) => {
    setProject((p) => ({ ...p, imageSrc }));
  }, []);

  const updateOutputFileName = useCallback((name: string) => {
    setFileNameTouched(true);
    setProject((p) => ({ ...p, outputFileName: name }));
  }, []);

  const clearCard = useCallback(() => {
    setProject({
      id: "default",
      card: blankTemplate,
      imageSrc: undefined,
      outputFileName: defaultFileName(""),
      lastModified: new Date().toISOString(),
      metadataInfo: undefined,
    });
    setFileNameTouched(false);
    setTargetPlatform("sillytavern");
    setActivePage("create");
    setShowClearConfirm(false);
  }, []);

  /**
   * Open a non-character card, from wherever it came: a decoded PNG, a dropped
   * JSON file, the library, or the MCP bridge. The payload is normalised here,
   * so this is the only place that has to know what each kind is made of.
   */
  const openDataCard = useCallback<OpenDataCard>((cardType, payload, imageSrc, libraryId) => {
    setEditorInit((prev) => {
      const slot = { imageSrc, id: libraryId };
      switch (cardType) {
        case "lorebook": return { ...prev, lorebook: { ...slot, card: coerceCardBody("lorebook", payload) } };
        case "script":   return { ...prev, script:   { ...slot, card: coerceCardBody("script", payload) } };
        case "scenario": return { ...prev, scenario: { ...slot, card: coerceCardBody("scenario", payload) } };
        case "persona":  return { ...prev, persona:  { ...slot, card: coerceCardBody("persona", payload) } };
      }
    });
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
          if (!card.cardData?.data) {
            // Nothing to open. Say so where the user can see it rather than
            // switching to an editor showing a blank card.
            console.error(`CharacterBinder: card ${card.id} has no character data to open.`);
            return;
          }
          loadFromLibrary(card.cardData, null, image, card.id);
          return;
        }
        // Pass the library id: without it the editor would treat an agent-opened
        // card as new, and the next save would fork a duplicate record.
        openDataCard(card.cardType, card.rawData, image, card.id);
      },
    });
  }, [loadFromLibrary, openDataCard]);

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      {showClearConfirm && (
        <ConfirmModal
          title="Clear current card?"
          message="All unsaved changes to the current character will be lost. This cannot be undone."
          confirmLabel="Clear Card"
          destructive
          onConfirm={clearCard}
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
            project={project}
            settings={settings}
            targetPlatform={targetPlatform}
            onUpdateCard={updateCard}
            onUpdateImage={updateImage}
            onUpdateOutputFileName={updateOutputFileName}
            onSavedToLibrary={adoptLibraryId}
            onPlatformChange={setTargetPlatform}
            onNewCard={() => setShowClearConfirm(true)}
          />
        )}
        {activePage === "lorebook" && (
          <LoreBookEditor
            key={editorKey}
            initialBook={editorInit.lorebook?.card}
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
          <ImportPNG onLoad={loadCard} onOpenDataCard={openDataCard} />
        )}
        {activePage === "decode" && (
          <DecodePNG onLoad={loadCard} onOpenDataCard={openDataCard} />
        )}
        {activePage === "templates" && <Templates onLoad={loadCard} />}
        {activePage === "library" && (
          <Library
            libraryRevision={libraryRevision}
            onEditCard={loadFromLibrary}
            onOpenDataCard={openDataCard}
          />
        )}
        {activePage === "settings" && <Settings settings={settings} onSave={(s) => setSettings(saveAppSettings(s))} />}
        {activePage === "help" && <HelpAbout />}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
