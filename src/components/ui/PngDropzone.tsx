import { useRef, useState, type ReactNode } from "react";

/**
 * The drop target both PNG pages use: drag state, the hidden file input, the
 * keyboard path, and the accessible wrapper.
 *
 * The keyboard handler matters — the visible target is a div and the real input
 * is hidden, so without it there is no way to import a card without a mouse.
 * Having that in one place is the point of this component.
 */

interface PngDropzoneProps {
  onFile: (file: File) => void;
  /** Describes the action for screen readers, e.g. "Choose a card PNG to import". */
  label: string;
  /** Padding and corner radius differ between the two pages. */
  className?: string;
  /** What the zone shows; receives whether a file is currently over it. */
  children: (dragging: boolean) => ReactNode;
}

export default function PngDropzone({ onFile, label, className = "rounded-xl p-8 gap-3", children }: PngDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`relative border-2 border-dashed flex flex-col items-center transition-colors cursor-pointer ${className} ${
        dragging ? "border-accent-purple bg-accent-purple/10" : "border-border hover:border-accent-purple/50 hover:bg-bg-hover"
      }`}
      role="button"
      tabIndex={0}
      aria-label={`${label}, or drop one here`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      onClick={() => inputRef.current?.click()}
    >
      {children(dragging)}
      <input
        ref={inputRef}
        type="file"
        accept=".png,image/png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          // Cleared so choosing the same file twice fires a change event again.
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
