import { useState, useCallback, useEffect } from "react";
import type { TavernCardV2, NavPage, AppSettings, MetadataInfo, CardProject, LoreBook, ScriptCard, ScenarioCard, PersonaCard } from "./types";
import type { PlatformId } from "./lib/platforms";
import { loadStoredSettings, saveSettings } from "./lib/settings";
import { registerBridgeHost, initBridge } from "./lib/bridge/client";
import { useUnsavedWarning } from "./hooks/useUnsavedWarning";
import { blankTemplate } from "./data/templates/ronalVoss";
import Sidebar from "./components/Sidebar";
import CreateCard from "./components/CreateCard";
import ImportPNG from "./components/ImportPNG";
import DecodePNG from "./components/DecodePNG";
import Templates from "./components/Templates";
import Settings from "./components/Settings";
import HelpAbout from "./components/HelpAbout";
import Library from "./components/Library";
import LoreBookEditor from "./components/LoreBookEditor";
import ScriptEditor from "./components/ScriptEditor";
import ScenarioEditor from "./components/ScenarioEditor";
import PersonaEditor from "./components/PersonaEditor";
import ConfirmModal from "./components/ConfirmModal";
import ErrorBoundary from "./components/ErrorBoundary";
import { coerceCardBody } from "./lib/blankCards";

/** Output filename derived from the character name, e.g. "Mira Vale" → "Mira_Vale_Tavern_Card.png". */
function defaultFileName(name: string): string {
  const trimmed = name.trim();
  return trimmed ? `${trimmed.replace(/\s+/g, "_")}_Tavern_Card.png` : "New_Character_Tavern_Card.png";
}

function App() {
  const [activePage, setActivePage] = useState<NavPage>("create");
  const [settings, setSettings] = useState<AppSettings>(loadStoredSettings);
  const [targetPlatform, setTargetPlatform] = useState<PlatformId>("sillytavern");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
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

  // ── Lorebook editor library-load state ──
  const [lorebookKey, setLorebookKey] = useState(0);
  const [lorebookInit, setLorebookInit] = useState<{
    book: LoreBook; imageSrc: string | null; id?: string;
  } | null>(null);

  // ── Script editor library-load state ──
  const [scriptKey, setScriptKey] = useState(0);
  const [scriptInit, setScriptInit] = useState<{
    card: ScriptCard; imageSrc: string | null; id?: string;
  } | null>(null);

  // ── Scenario editor library-load state ──
  const [scenarioKey, setScenarioKey] = useState(0);
  const [scenarioInit, setScenarioInit] = useState<{
    card: ScenarioCard; imageSrc: string | null; id?: string;
  } | null>(null);

  // ── Persona editor library-load state ──
  const [personaKey, setPersonaKey] = useState(0);
  const [personaInit, setPersonaInit] = useState<{
    card: PersonaCard; imageSrc: string | null; id?: string;
  } | null>(null);

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

  // ── Non-character library-load handlers ──
  const handleEditLorebook = useCallback((book: LoreBook, imageSrc: string | null, id: string) => {
    setLorebookInit({ book, imageSrc, id });
    setLorebookKey((k) => k + 1);
    setActivePage("lorebook");
  }, []);

  const handleEditScript = useCallback((card: ScriptCard, imageSrc: string | null, id: string) => {
    setScriptInit({ card, imageSrc, id });
    setScriptKey((k) => k + 1);
    setActivePage("script");
  }, []);

  const handleEditScenario = useCallback((card: ScenarioCard, imageSrc: string | null, id: string) => {
    setScenarioInit({ card, imageSrc, id });
    setScenarioKey((k) => k + 1);
    setActivePage("scenario");
  }, []);

  const handleEditPersona = useCallback((card: PersonaCard, imageSrc: string | null, id: string) => {
    setPersonaInit({ card, imageSrc, id });
    setPersonaKey((k) => k + 1);
    setActivePage("persona");
  }, []);

  // ── Import-from-PNG handlers (no library id yet) ──
  const handleImportLorebook = useCallback((book: LoreBook, imageSrc: string | null) => {
    setLorebookInit({ book, imageSrc });
    setLorebookKey((k) => k + 1);
    setActivePage("lorebook");
  }, []);

  const handleImportScript = useCallback((card: ScriptCard, imageSrc: string | null) => {
    setScriptInit({ card, imageSrc });
    setScriptKey((k) => k + 1);
    setActivePage("script");
  }, []);

  const handleImportScenario = useCallback((card: ScenarioCard, imageSrc: string | null) => {
    setScenarioInit({ card, imageSrc });
    setScenarioKey((k) => k + 1);
    setActivePage("scenario");
  }, []);

  const handleImportPersona = useCallback((card: PersonaCard, imageSrc: string | null) => {
    setPersonaInit({ card, imageSrc });
    setPersonaKey((k) => k + 1);
    setActivePage("persona");
  }, []);

  // Let the MCP bridge open whatever an agent just created or edited, in the
  // editor that matches its type. Registered once; the handlers are stable.
  useEffect(() => {
    registerBridgeHost({
      onLibraryChanged: () => setLibraryRevision((n) => n + 1),
      openCard: (card) => {
        const image = card.imageSrc ?? null;
        switch (card.cardType) {
          case "character":
            if (card.cardData) loadFromLibrary(card.cardData, null, image, card.id);
            break;
          case "lorebook":
            handleImportLorebook(coerceCardBody("lorebook", card.rawData), image);
            break;
          case "script":
            handleImportScript(coerceCardBody("script", card.rawData), image);
            break;
          case "scenario":
            handleImportScenario(coerceCardBody("scenario", card.rawData), image);
            break;
          case "persona":
            handleImportPersona(coerceCardBody("persona", card.rawData), image);
            break;
        }
      },
    });
    initBridge();
  }, [loadFromLibrary, handleImportLorebook, handleImportScript, handleImportScenario, handleImportPersona]);

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
            key={lorebookKey}
            initialBook={lorebookInit?.book}
            initialImageSrc={lorebookInit?.imageSrc}
            initialLibraryId={lorebookInit?.id}
          />
        )}
        {activePage === "script" && (
          <ScriptEditor
            key={scriptKey}
            initialCard={scriptInit?.card}
            initialImageSrc={scriptInit?.imageSrc}
            initialLibraryId={scriptInit?.id}
          />
        )}
        {activePage === "scenario" && (
          <ScenarioEditor
            key={scenarioKey}
            initialCard={scenarioInit?.card}
            initialImageSrc={scenarioInit?.imageSrc}
            initialLibraryId={scenarioInit?.id}
          />
        )}
        {activePage === "persona" && (
          <PersonaEditor
            key={personaKey}
            initialCard={personaInit?.card}
            initialImageSrc={personaInit?.imageSrc}
            initialLibraryId={personaInit?.id}
          />
        )}
        {activePage === "import" && (
          <ImportPNG
            onLoad={loadCard}
            onLoadLorebook={handleImportLorebook}
            onLoadScript={handleImportScript}
            onLoadScenario={handleImportScenario}
            onLoadPersona={handleImportPersona}
          />
        )}
        {activePage === "decode" && (
          <DecodePNG
            onLoad={loadCard}
            onLoadLorebook={handleImportLorebook}
            onLoadScript={handleImportScript}
            onLoadScenario={handleImportScenario}
            onLoadPersona={handleImportPersona}
          />
        )}
        {activePage === "templates" && <Templates onLoad={loadCard} />}
        {activePage === "library" && (
          <Library
            refreshToken={libraryRevision}
            onEditCard={loadFromLibrary}
            onEditLorebook={handleEditLorebook}
            onEditScript={handleEditScript}
            onEditScenario={handleEditScenario}
            onEditPersona={handleEditPersona}
          />
        )}
        {activePage === "settings" && <Settings settings={settings} onSave={(s) => { setSettings(s); saveSettings(s); }} />}
        {activePage === "help" && <HelpAbout />}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
