import { useState, useEffect, useMemo, useRef, useId } from "react";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  label?: string;
}

const parse = (value: string) => value.split(",").map((t) => t.trim()).filter(Boolean);
const key = (tags: string[]) => tags.join("\x00");

/**
 * Comma-separated tag input.
 *
 * The raw text stays local so a half-typed "dragon, " keeps its trailing comma
 * instead of being reformatted out from under the cursor. Parsed tags are still
 * reported on every keystroke, so anything rendering them — the lorebook entry
 * list, for one — stays in step rather than waiting for a blur that may never
 * come.
 */
export default function TagInput({ tags, onChange, placeholder, label }: TagInputProps) {
  const fieldId = useId();
  const [raw, setRaw] = useState(tags.join(", "));

  // What we last sent upward. Lets us tell a genuine external change (loading a
  // card, resetting the form) from the echo of our own onChange, which must not
  // reformat the text being typed.
  const lastEmitted = useRef(key(tags));
  const canonical = useMemo(() => key(tags), [tags]);

  useEffect(() => {
    if (canonical === lastEmitted.current) return;
    setRaw(tags.join(", "));
    lastEmitted.current = canonical;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonical]);

  function handleChange(value: string) {
    setRaw(value);
    const parsed = parse(value);
    lastEmitted.current = key(parsed);
    onChange(parsed);
  }

  // Blur is where the text gets tidied — duplicate commas and stray spacing
  // collapse to the canonical form.
  function handleBlur(value: string) {
    const parsed = parse(value);
    lastEmitted.current = key(parsed);
    setRaw(parsed.join(", "));
    onChange(parsed);
  }

  return (
    <div>
      {label && <label htmlFor={fieldId} className="label-base">{label}</label>}
      <input
        id={fieldId}
        aria-label={label ? undefined : placeholder}
        className="input-base"
        placeholder={placeholder}
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={(e) => handleBlur(e.target.value)}
      />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {tags.map((t) => (
            <span key={t} className="badge-purple">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}
