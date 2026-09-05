import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HelpAbout from "./HelpAbout";
import pkg from "../../../package.json";

describe("HelpAbout", () => {
  it("shows the version the package actually declares", () => {
    render(<HelpAbout />);
    // Hardcoded strings here drifted behind package.json on every release,
    // which is why the version is injected at build time.
    expect(screen.getByText(new RegExp(pkg.version.replace(/\./g, "\.")))).toBeInTheDocument();
  });

  it("states the local-only promise the whole app is built around", () => {
    render(<HelpAbout />);
    expect(screen.getByText(/no data is sent to any server/i)).toBeInTheDocument();
  });
});
