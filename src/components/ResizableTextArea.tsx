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
      {/* Resize handle bar — lives outside the textarea, no z-index needed */}
      <div
        onMouseDown={startResize}
        className="flex items-center justify-end px-2 h-4 rounded-b-lg border border-t-0 border-border cursor-s-resize select-none bg-bg-tertiary hover:bg-accent-purple/20 transition-colors group"
        title="Drag to resize"
      >
        <svg width="16" height="6" viewBox="0 0 16 6" fill="none">
          <line x1="2" y1="1" x2="14" y2="1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-text-muted group-hover:text-accent-purple" />
          <line x1="2" y1="5" x2="14" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-text-muted group-hover:text-accent-purple" />
        </svg>
      </div>
    </div>
  );
}
