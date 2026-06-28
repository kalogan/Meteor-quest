import { type CSSProperties } from "react";

/**
 * [hud] A small reusable filter/search box for the heavy panels (Research / Command / Journal),
 * so finding content stays easy as the game grows. Controlled; the host owns the query string +
 * does the filtering. Accessible: a real search input with an accessible name + a labelled clear
 * button that only appears when there's text.
 */
export function PanelSearch({
  value,
  onChange,
  placeholder,
  label,
  testid,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** Accessible name for the input (defaults to the placeholder). */
  label?: string;
  testid?: string;
}) {
  return (
    <div style={wrapStyle}>
      <span aria-hidden="true" style={{ color: "#7f8aa3", fontSize: 13 }}>⌕</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        data-testid={testid}
        style={inputStyle}
      />
      {value !== "" && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          data-testid={testid ? `${testid}-clear` : undefined}
          style={clearStyle}
        >
          ✕
        </button>
      )}
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "#0d1525",
  border: "1px solid #2a3a5e",
  borderRadius: 7,
  padding: "4px 8px",
  marginBottom: 8,
};

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: "none",
  border: "none",
  outline: "none",
  color: "#e8edf6",
  font: "500 13px/1.3 system-ui, sans-serif",
};

const clearStyle: CSSProperties = {
  background: "none",
  border: "none",
  color: "#aeb8cc",
  cursor: "pointer",
  fontSize: 12,
  lineHeight: 1,
  padding: 2,
};
