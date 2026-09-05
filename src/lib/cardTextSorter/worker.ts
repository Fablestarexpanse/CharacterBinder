import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// Generation runs here so token decoding never blocks the editor UI.
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => handler.onmessage(msg);
