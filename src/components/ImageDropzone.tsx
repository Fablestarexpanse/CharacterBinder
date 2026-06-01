import { useRef } from "react";
import { readImageFile } from "../lib/readImageFile";

interface ImageDropzoneProps {
  imageSrc: string | null;
  onFile: (src: string) => void;
  label?: string;
  /** Extra Tailwind height class, e.g. "h-28" or "h-56 w-48". Defaults to "h-28 w-full". */
  className?: string;
}

/**
 * Shared image drop-zone used by all card editors.
 * Accepts drag-and-drop or click-to-browse; shows the image when set.
 */
export default function ImageDropzone({ imageSrc, onFile, label, className = "h-28 w-full" }: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const src = await readImageFile(file);
    onFile(src);
  }

  return (
    <div>
      {label && <label className="label-base">{label}</label>}
      <div
        className={`${className} rounded-xl border-2 border-dashed border-border hover:border-accent-purple/50 transition-colors cursor-pointer overflow-hidden relative group bg-bg-tertiary flex items-center justify-center`}
        onClick={() => inputRef.current?.click()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onDragOver={(e) => e.preventDefault()}
      >
        {imageSrc ? (
          <img src={imageSrc} alt="cover" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs text-text-muted text-center px-2">
            Drop image or click<br />
            <span className="text-[10px]">(optional)</span>
          </span>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-xs text-white">Change</span>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
      />
    </div>
  );
}
