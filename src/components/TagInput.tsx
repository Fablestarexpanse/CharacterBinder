import { useState, useEffect } from "react";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  label?: string;
}

/**
 * Tag input that lets the user type freely with commas and only parses
 * the value on blur. This prevents the trailing-comma disappearing bug
 * that occurs when splitting/filtering on every keystroke.
 */
export default function TagInput({ tags, onChange, placeholder, label }: TagInputProps) {
  const [raw, setRaw] = useState(tags.join(", "));

  // Sync display when the parent swaps in a completely different tag array
  // (e.g. loading a card from the library or resetting to blank).
  const canonical = tags.join("\x00");
  useEffect(() => {
    setRaw(tags.join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonical]);

  function commit(value: string) {
    const parsed = value.split(",").map((t) => t.trim()).filter(Boolean);
    onChange(parsed);
    setRaw(parsed.join(", "));
  }

  return (
    <div>
      {label && <label className="label-base">{label}</label>}
      <input
        className="input-base"
        placeholder={placeholder}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
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
