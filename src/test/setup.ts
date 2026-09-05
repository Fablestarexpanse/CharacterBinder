import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Each test gets a fresh document; a leaked render makes the next test's
// queries ambiguous in ways that look like the component being wrong.
afterEach(cleanup);
