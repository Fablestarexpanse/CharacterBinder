import { useState, useRef } from "react";

interface ResizableTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

/**
 * Drop-in <textarea> replacement with a drag-to-resize handle.
 * The handle sits BELOW the textarea (not over it) to avoid z-index
 * fights with native form controls.
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
    <div className="flex flex-col">
      <textarea
        ref={ref}
        className={`${className} resize-none rounded-b-none`}
        style={{ ...style, ...(height !== null ? { height: `${height}px` } : {}) }}
        {...props}
      />
      {/* Resize handle bar — distinct purple tint so it's always visible */}
      <div
        onMouseDown={startResize}
        className="flex items-center justify-center h-3 rounded-b-lg cursor-s-resize select-none transition-colors"
        style={{ background: "rgba(139,92,246,0.18)", borderTop: "1px solid rgba(139,92,246,0.25)" }}
        title="Drag to resize"
      >
        <svg width="24" height="6" viewBox="0 0 24 6" fill="none">
          <line x1="3" y1="1.5" x2="21" y2="1.5" stroke="rgba(139,92,246,0.6)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="3" y1="4.5" x2="21" y2="4.5" stroke="rgba(139,92,246,0.6)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
