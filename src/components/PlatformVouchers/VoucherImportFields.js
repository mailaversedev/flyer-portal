import React, { useEffect, useState } from "react";
import { IMPORT_IMAGE_TYPES, parseCodeCsv, parsePastedCodes, validateVoucherImport } from "../../utils/VoucherImportUtil";
import VoucherFilePicker from "./VoucherFilePicker";

const ImagePreview = ({ file }) => {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return <img className="platform-vouchers-import-image" src={url} alt={file.name} />;
};

export default function VoucherImportFields({ t, batch, onChange, disabled, isEditing, importKind }) {
  const [kind, setKind] = useState(importKind || (batch.images.length ? "image" : "code"));
  const [mode, setMode] = useState("paste");
  const [text, setText] = useState("");
  const [csvText, setCsvText] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const [hasHeader, setHasHeader] = useState(false);
  const [reading, setReading] = useState(false);

  const updateCodes = (source, nextMode, header) => {
    try {
      const codes = nextMode === "csv" ? parseCodeCsv(source, header) : parsePastedCodes(source);
      onChange({ ...batch, codes, sourceError: "" });
    } catch (error) {
      onChange({ ...batch, codes: [], sourceError: error.message });
    }
  };
  const errors = [batch.sourceError, ...validateVoucherImport(batch.codes, batch.images)].filter(Boolean);

  return (
    <fieldset className="full-width platform-vouchers-import" disabled={disabled}>
      <legend>{t(isEditing ? "voucherAdminPage.importAppend" : "voucherAdminPage.importTitle")}</legend>
      <div className="platform-vouchers-import-intro">
        <p>{t("voucherAdminPage.importTypeSummary")}</p>
        <p>{t("voucherAdminPage.importLimits")}</p>
        <p>{t("voucherAdminPage.importOrdering")}</p>
        <details className="platform-vouchers-import-help">
          <summary>{t("voucherAdminPage.importHelp")}</summary>
          <p>{t("voucherAdminPage.importGuidance")}</p>
        </details>
      </div>
      <label>
        <span>{t("voucherAdminPage.importInventoryType")}</span>
        <select value={kind} disabled={reading || Boolean(importKind)} onChange={(event) => {
          if ((text || csvText || batch.codes.length || batch.images.length || batch.sourceError) &&
              !window.confirm(t("voucherAdminPage.importSwitchConfirm"))) return;
          setKind(event.target.value);
          setText("");
          setCsvText("");
          setCsvFile(null);
          setHasHeader(false);
          setMode("paste");
          onChange({ ...batch, codes: [], images: [], sourceError: "" });
        }}>
          <option value="code">{t("voucherAdminPage.importInventoryCodes")}</option>
          <option value="image">{t("voucherAdminPage.importInventoryImages")}</option>
        </select>
      </label>
      {importKind ? <p>{t("voucherAdminPage.importInventoryTypeLocked")}</p> : null}
      {kind === "code" ? (
        <>
          <label>
            <span>{t("voucherAdminPage.importSource")}</span>
            <select value={mode} disabled={reading} onChange={(event) => {
              setMode(event.target.value);
              updateCodes(event.target.value === "csv" ? csvText : text, event.target.value, hasHeader);
            }}>
              <option value="paste">{t("voucherAdminPage.importPaste")}</option>
              <option value="csv">{t("voucherAdminPage.importCsv")}</option>
            </select>
          </label>
          {mode === "paste" ? (
            <label>
              <span>{t("voucherAdminPage.importPaste")}</span>
              <textarea rows="6" value={text} onChange={(event) => {
                setText(event.target.value);
                updateCodes(event.target.value, "paste", false);
              }} />
            </label>
          ) : (
            <>
              <p>{t("voucherAdminPage.csvGuidance")}</p>
              <VoucherFilePicker
                t={t}
                label={t("voucherAdminPage.importCsv")}
                accept=".csv,text/csv"
                files={csvFile ? [csvFile] : []}
                disabled={reading}
                onSelect={async ([file]) => {
                  setCsvFile(file);
                  setReading(true);
                  onChange({ ...batch, codes: [], sourceError: "csvReading" });
                  try {
                    const contents = await file.text();
                    setCsvText(contents);
                    updateCodes(contents, "csv", hasHeader);
                  } catch (_error) {
                    onChange({ ...batch, codes: [], sourceError: "csvReadError" });
                  } finally {
                    setReading(false);
                  }
                }}
              />
              <label className="platform-vouchers-import-checkbox">
                <input type="checkbox" checked={hasHeader} disabled={reading} onChange={(event) => {
                  setHasHeader(event.target.checked);
                  updateCodes(csvText, "csv", event.target.checked);
                }} />
                <span>{t("voucherAdminPage.csvHeader")}</span>
              </label>
            </>
          )}
        </>
      ) : (
        <>
          <VoucherFilePicker t={t} label={t("voucherAdminPage.importImages")}
            accept={IMPORT_IMAGE_TYPES.join(",")} multiple files={batch.images}
            disabled={reading} onSelect={(images) => onChange({ ...batch, images })} />
          <p>{t("voucherAdminPage.importImageSelection")}</p>
          {batch.images.length > 0 && <button type="button" className="platform-vouchers-import-clear" disabled={reading} onClick={() => onChange({ ...batch, images: [] })}>
            {t("voucherAdminPage.importClearImages")}
          </button>}
        </>
      )}
      <h3 className="platform-vouchers-import-preview-title">{t("voucherAdminPage.importPreview", { count: batch.codes.length + batch.images.length })}</h3>
      {errors.map((key) => <div role="alert" className="platform-vouchers-message error" key={key}>{t(`voucherAdminPage.${key}`)}</div>)}
      <ol className="platform-vouchers-import-preview">
        {batch.codes.map((code, index) => <li key={`code-${index}`}><code>{JSON.stringify(code)}</code></li>)}
        {batch.images.map((file, index) => <li key={`image-${index}`}>
          {IMPORT_IMAGE_TYPES.includes(file.type) && <ImagePreview file={file} />}
          <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
        </li>)}
      </ol>
    </fieldset>
  );
}
