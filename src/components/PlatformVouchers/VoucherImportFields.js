import React, { useEffect, useId, useState } from "react";
import {
  IMPORT_IMAGE_TYPES,
  parsePairCsv,
  parseVoucherCodeLines,
  validateVoucherImport,
} from "../../utils/VoucherImportUtil";
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

export default function VoucherImportFields({ t, batch, onChange, disabled, isEditing }) {
  const titleId = useId();
  const [csvFile, setCsvFile] = useState(null);
  const [entryMethod, setEntryMethod] = useState("csv");
  const [manualCodes, setManualCodes] = useState("");
  const [csvPairs, setCsvPairs] = useState(batch.pairs);
  const [csvError, setCsvError] = useState(batch.sourceError);
  const [reading, setReading] = useState(false);
  const errors = [batch.sourceError, ...validateVoucherImport(batch.pairs, batch.images)].filter(Boolean);

  const handleEntryMethodChange = (event) => {
    const nextMethod = event.target.value;
    setEntryMethod(nextMethod);
    if (nextMethod === "csv") {
      onChange({ ...batch, pairs: csvPairs, sourceError: csvError });
    } else {
      onChange({
        ...batch,
        pairs: parseVoucherCodeLines(manualCodes, batch.images),
        sourceError: "",
      });
    }
  };

  const handleImagesChange = (images) => {
    onChange({
      ...batch,
      images,
      pairs: entryMethod === "manual" ? parseVoucherCodeLines(manualCodes, images) : batch.pairs,
    });
  };

  return (
    <section className="full-width">
      <h3 id={titleId} className="platform-vouchers-import-title">{t(isEditing ? "voucherAdminPage.importAppend" : "voucherAdminPage.importTitle")}</h3>
      <fieldset className="platform-vouchers-import" aria-labelledby={titleId} disabled={disabled}>
        <div className="platform-vouchers-import-intro">
          <p>{t("voucherAdminPage.importTypeSummary")}</p>
          <p>{t("voucherAdminPage.importLimits")}</p>
          <p>{t(entryMethod === "csv" ? "voucherAdminPage.importCsvOrdering" : "voucherAdminPage.importManualOrdering")}</p>
          <details className="platform-vouchers-import-help">
            <summary>{t("voucherAdminPage.importHelp")}</summary>
            <p>{t("voucherAdminPage.importGuidance")}</p>
            <p>{t(entryMethod === "csv" ? "voucherAdminPage.csvGuidance" : "voucherAdminPage.manualCodeGuidance")}</p>
          </details>
        </div>
        <label className="platform-vouchers-import-method">
          <span>{t("voucherAdminPage.importEntryMethod")}</span>
          <select value={entryMethod} onChange={handleEntryMethodChange}>
            <option value="csv">{t("voucherAdminPage.importMethodCsv")}</option>
            <option value="manual">{t("voucherAdminPage.importMethodManual")}</option>
          </select>
        </label>
        {entryMethod === "csv" ? (
          <VoucherFilePicker t={t} label={t("voucherAdminPage.importCsv")} accept=".csv,text/csv"
            files={csvFile ? [csvFile] : []} disabled={reading}
            onSelect={async ([file]) => {
              setCsvFile(file);
              setCsvPairs([]);
              setCsvError("csvReading");
              setReading(true);
              onChange({ ...batch, pairs: [], sourceError: "csvReading" });
              try {
                const contents = await file.text();
                const pairs = parsePairCsv(contents);
                setCsvPairs(pairs);
                setCsvError("");
                onChange({ ...batch, pairs, sourceError: "" });
              } catch (error) {
                const sourceError = ["csvInvalid", "csvHeaderInvalid", "csvColumn"].includes(error.message)
                  ? error.message : "csvReadError";
                setCsvPairs([]);
                setCsvError(sourceError);
                onChange({ ...batch, pairs: [], sourceError });
              } finally {
                setReading(false);
              }
            }} />
        ) : (
          <label className="platform-vouchers-import-codes">
            <span>{t("voucherAdminPage.manualCodes")}</span>
            <textarea
              rows="8"
              value={manualCodes}
              onChange={(event) => {
                const codes = event.target.value;
                setManualCodes(codes);
                onChange({
                  ...batch,
                  pairs: parseVoucherCodeLines(codes, batch.images),
                  sourceError: "",
                });
              }}
            />
          </label>
        )}
        <VoucherFilePicker t={t} label={t("voucherAdminPage.importImages")}
          accept={IMPORT_IMAGE_TYPES.join(",")} multiple files={batch.images}
          disabled={reading} onSelect={handleImagesChange} />
        <p>{t("voucherAdminPage.importImageSelection")}</p>
        {batch.images.length > 0 && <button type="button" className="platform-vouchers-import-clear" disabled={reading} onClick={() => onChange({ ...batch, images: [] })}>
          {t("voucherAdminPage.importClearImages")}
        </button>}
        <h3 className="platform-vouchers-import-preview-title">{t("voucherAdminPage.importPreview", { count: batch.pairs.length })}</h3>
        {errors.map((key) => <div role="alert" className="platform-vouchers-message error" key={key}>{t(`voucherAdminPage.${key}`)}</div>)}
        <ol className="platform-vouchers-import-preview">
          {batch.pairs.map(({ code, imageFilename }, index) => {
            const file = batch.images.find((image) => image.name === imageFilename);
            return <li key={index}>
              <code>{JSON.stringify(code)}</code>
              {file && IMPORT_IMAGE_TYPES.includes(file.type) && <ImagePreview file={file} />}
              <span>{imageFilename}</span>
            </li>;
          })}
        </ol>
      </fieldset>
    </section>
  );
}
