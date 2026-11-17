import React, { useId, useRef } from "react";

export default function VoucherFilePicker({
  t, label, accept, files = [], onSelect, multiple = false, disabled = false, existingUrl = "",
}) {
  const inputRef = useRef(null);
  const inputId = useId();
  const selected = files.length > 1
    ? t("voucherAdminPage.filesSelected", { count: files.length })
    : files.length === 1
      ? t("voucherAdminPage.selectedFile", { name: files[0].name })
      : "";

  return (
    <div className="platform-vouchers-file-control">
      <label htmlFor={inputId}>{label}</label>
      <div className="platform-vouchers-file-field">
        <div className="platform-vouchers-file-description" aria-live="polite">
          {selected ? <span className="platform-vouchers-file-selected">{selected}</span> : null}
          {existingUrl ? (
            <a className="platform-vouchers-file-url" href={existingUrl} target="_blank" rel="noreferrer" title={existingUrl}>
              {existingUrl}
            </a>
          ) : !selected ? <span className="platform-vouchers-file-placeholder">{t("voucherAdminPage.noFileSelected")}</span> : null}
        </div>
        <button
          type="button"
          className="platform-vouchers-file-button"
          disabled={disabled}
          aria-label={t("voucherAdminPage.chooseFileFor", { field: label })}
          onClick={() => inputRef.current?.click()}
        >
          {t(multiple ? "voucherAdminPage.chooseFiles" : "voucherAdminPage.chooseFile")}
        </button>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="platform-vouchers-file-input"
          onChange={(event) => {
            const selectedFiles = Array.from(event.target.files || []);
            event.target.value = "";
            if (selectedFiles.length) onSelect(selectedFiles);
          }}
        />
      </div>
    </div>
  );
}
