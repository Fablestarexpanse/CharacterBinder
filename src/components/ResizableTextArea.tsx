import { useState, useRef } from "react";

interface ResizableTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

/** Three-dot diagonal grip SVG — mirrors the OS resize handle */
function ResizeGrip() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      <circle cx="6"  cy="10" r="1.5" fill="currentColor" />
      <circle cx="10" cy="6"  r="1.5" fill="currentColor" />
      <circle cx="2"  cy="10" r="1.5" fill="currentColor" />
      <circle cx="6"  cy="6"  r="1.5" fill="currentColor" />
      <circle cx="10" cy="2"  r="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Drop-in <textarea> replacement with a visible bottom-right corner
 * drag-to-resize handle. Drag down to make the field taller.
 */
export default function ResizableTextArea({ className = "input-base", style, ...props }: ResizableTextAreaProps) {
  const [height, setHeight] = useState<number | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = ref.current?.offsetHeight ?? 80;

    function onMove(ev: MouseEvent) {
      setHeight(Math.max(52, startH + (ev.clientY - startY)));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        className={`${className} resize-none block`}
        style={{ ...style, ...(height !== null ? { height: `${height}px` } : {}) }}
        {...props}
      />
      {/* Corner resize grip — sits on top of the textarea (z-10) */}
      <div
        onMouseDown={startResize}
        className="absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center rounded-br-lg cursor-s-resize select-none z-10 text-accent-purple hover:text-white transition-colors"
        style={{ background: "rgba(139,92,246,0.25)" }}
        title="Drag to resize"
      >
        <ResizeGrip />
      </div>
    </div>
  );
}
