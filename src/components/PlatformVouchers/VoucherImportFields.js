import React, { useEffect, useState } from "react";
import { IMPORT_IMAGE_TYPES, parseCodeCsv, parsePastedCodes, validateVoucherImport } from "../../utils/VoucherImportUtil";

const ImagePreview = ({ file }) => {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return <img className="platform-vouchers-import-image" src={url} alt={file.name} />;
};

export default function VoucherImportFields({ t, batch, onChange, disabled, isEditing }) {
  const [mode, setMode] = useState("paste");
  const [text, setText] = useState("");
  const [csvText, setCsvText] = useState("");
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
      <p>{t("voucherAdminPage.importGuidance")}</p>
      <p>{t("voucherAdminPage.importLimits")}</p>
      <p>{t("voucherAdminPage.importOrdering")}</p>
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
          <label>
            <span>{t("voucherAdminPage.importCsv")}</span>
            <input type="file" accept=".csv,text/csv" disabled={reading} onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
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
            }} />
          </label>
          <label className="platform-vouchers-import-checkbox">
            <input type="checkbox" checked={hasHeader} disabled={reading} onChange={(event) => {
              setHasHeader(event.target.checked);
              updateCodes(csvText, "csv", event.target.checked);
            }} />
            <span>{t("voucherAdminPage.csvHeader")}</span>
          </label>
        </>
      )}
      <label>
        <span>{t("voucherAdminPage.importImages")}</span>
        <input type="file" multiple accept={IMPORT_IMAGE_TYPES.join(",")} disabled={reading} onChange={(event) => {
          onChange({ ...batch, images: Array.from(event.target.files || []) });
          event.target.value = "";
        }} />
      </label>
      <p>{t("voucherAdminPage.importImageSelection")}</p>
      {batch.images.length > 0 && <button type="button" disabled={reading} onClick={() => onChange({ ...batch, images: [] })}>
        {t("voucherAdminPage.importClearImages")}
      </button>}
      <h3>{t("voucherAdminPage.importPreview", { count: batch.codes.length + batch.images.length })}</h3>
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
