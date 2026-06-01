import { useState, useRef } from "react";

interface ResizableTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Override className — must include input-base or equivalent styling */
  className?: string;
}

/**
 * Drop-in replacement for <textarea> that adds a visible drag-to-resize
 * handle at the bottom. Use wherever a plain <textarea> is rendered
 * outside of the TextAreaField component.
 */
export default function ResizableTextArea({ className = "input-base", style, ...props }: ResizableTextAreaProps) {
  const [height, setHeight] = useState<number | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startH = ref.current?.offsetHeight ?? 80;

    function onMove(ev: MouseEvent) {
      setHeight(Math.max(48, startH + (ev.clientY - startY)));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return (
    <div className="relative group/resize">
      <textarea
        ref={ref}
        className={`${className} resize-none block`}
        style={{ ...style, ...(height !== null ? { height: `${height}px` } : {}) }}
        {...props}
      />
      <div
        onMouseDown={startResize}
        className="absolute bottom-0 left-0 right-0 h-3 flex items-center justify-center cursor-ns-resize rounded-b-lg select-none"
        style={{ background: "rgba(139,92,246,0.08)" }}
        title="Drag to resize"
      >
        <div className="flex gap-0.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-3 h-0.5 rounded-full bg-accent-purple/30 group-hover/resize:bg-accent-purple/70 transition-colors"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
