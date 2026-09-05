import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";

interface ResizableTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

const MIN_HEIGHT = 52;

/**
 * Drop-in <textarea> replacement with a drag-to-resize handle.
 *
 * The handle sits BELOW the textarea rather than over it, so it can't fight
 * with native form-control stacking. `resize-none` disables the browser's own
 * corner grip — having both is confusing, and the two write conflicting
 * inline heights.
 */
const ResizableTextArea = forwardRef<HTMLTextAreaElement, ResizableTextAreaProps>(function ResizableTextArea(
  { className = "input-base", style, ...props },
  forwardedRef
) {
  const [height, setHeight] = useState<number | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useImperativeHandle(forwardedRef, () => ref.current as HTMLTextAreaElement, []);

  // A drag still in progress at unmount would otherwise leave document-level
  // listeners behind.
  useEffect(() => () => cleanupRef.current?.(), []);

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = ref.current?.offsetHeight ?? MIN_HEIGHT;

    const onMove = (ev: PointerEvent) =>
      setHeight(Math.max(MIN_HEIGHT, startH + (ev.clientY - startY)));
    const stop = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", stop);
      document.removeEventListener("pointercancel", stop);
      cleanupRef.current = null;
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", stop);
    document.addEventListener("pointercancel", stop);
    cleanupRef.current = stop;
  }

  /** Keyboard equivalent of the drag, so resizing isn't mouse-only. */
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const current = height ?? ref.current?.offsetHeight ?? MIN_HEIGHT;
    setHeight(Math.max(MIN_HEIGHT, current + (e.key === "ArrowDown" ? 16 : -16)));
  }

  return (
    <div className="flex flex-col">
      <textarea
        ref={ref}
        className={`${className} resize-none rounded-b-none`}
        style={{ ...style, ...(height !== null ? { height: `${height}px` } : {}) }}
        {...props}
      />
      {/* Resize handle bar — purple tint so it reads as an affordance */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize field — drag, or use the up and down arrow keys"
        tabIndex={0}
        onPointerDown={startResize}
        onKeyDown={onKeyDown}
        className="flex items-center justify-center h-3 rounded-b-lg cursor-s-resize select-none transition-colors touch-none"
        style={{ background: "rgba(124,58,237,0.14)", borderTop: "1px solid rgba(124,58,237,0.28)" }}
        title="Drag to resize"
      >
        <svg width="24" height="6" viewBox="0 0 24 6" fill="none" aria-hidden="true">
          <line x1="3" y1="1.5" x2="21" y2="1.5" stroke="rgba(109,40,217,0.7)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="3" y1="4.5" x2="21" y2="4.5" stroke="rgba(109,40,217,0.7)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
});

export default ResizableTextArea;
