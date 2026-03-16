import React, { useRef } from "react";
import { isValidHexColor, normalizePickerColor } from "../../../utils/ColorUtil";

const ColorInputField = ({ label, field, value, placeholder, onChange }) => {
  const colorInputRef = useRef(null);
  const hasColor = isValidHexColor(value || "");

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div className="color-input-wrapper">
        <button
          type="button"
          className="color-swatch-button"
          onClick={() => colorInputRef.current?.click()}
          aria-label={`Choose ${label.toLowerCase()}`}
        >
          <span
            className={`color-swatch ${hasColor ? "has-color" : ""}`}
            style={{ backgroundColor: hasColor ? value : undefined }}
          />
        </button>
        <input
          ref={colorInputRef}
          type="color"
          className="color-picker-native"
          value={normalizePickerColor(value || "")}
          onChange={(e) => onChange(field, e.target.value.toUpperCase())}
          tabIndex={-1}
          aria-hidden="true"
        />
        <input
          type="text"
          className="form-input color-text-input"
          placeholder={placeholder}
          value={value || ""}
          onChange={(e) => onChange(field, e.target.value)}
        />
      </div>
    </div>
  );
};

export default ColorInputField;
