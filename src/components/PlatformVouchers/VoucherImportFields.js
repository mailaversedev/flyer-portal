import React, { useEffect, useId, useState } from "react";
import { IMPORT_IMAGE_TYPES, parsePairCsv, validateVoucherImport } from "../../utils/VoucherImportUtil";
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
  const [reading, setReading] = useState(false);
  const errors = [batch.sourceError, ...validateVoucherImport(batch.pairs, batch.images)].filter(Boolean);

  return (
    <section className="full-width">
      <h3 id={titleId} className="platform-vouchers-import-title">{t(isEditing ? "voucherAdminPage.importAppend" : "voucherAdminPage.importTitle")}</h3>
      <fieldset className="platform-vouchers-import" aria-labelledby={titleId} disabled={disabled}>
        <div className="platform-vouchers-import-intro">
          <p>{t("voucherAdminPage.importTypeSummary")}</p>
          <p>{t("voucherAdminPage.importLimits")}</p>
          <p>{t("voucherAdminPage.importOrdering")}</p>
          <details className="platform-vouchers-import-help">
            <summary>{t("voucherAdminPage.importHelp")}</summary>
            <p>{t("voucherAdminPage.importGuidance")}</p>
            <p>{t("voucherAdminPage.csvGuidance")}</p>
          </details>
        </div>
        <VoucherFilePicker t={t} label={t("voucherAdminPage.importCsv")} accept=".csv,text/csv"
          files={csvFile ? [csvFile] : []} disabled={reading}
          onSelect={async ([file]) => {
            setCsvFile(file);
            setReading(true);
            onChange({ ...batch, pairs: [], sourceError: "csvReading" });
            try {
              const contents = await file.text();
              onChange({ ...batch, pairs: parsePairCsv(contents), sourceError: "" });
            } catch (error) {
              const sourceError = ["csvInvalid", "csvHeaderInvalid", "csvColumn"].includes(error.message)
                ? error.message : "csvReadError";
              onChange({ ...batch, pairs: [], sourceError });
            } finally {
              setReading(false);
            }
          }} />
        <VoucherFilePicker t={t} label={t("voucherAdminPage.importImages")}
          accept={IMPORT_IMAGE_TYPES.join(",")} multiple files={batch.images}
          disabled={reading} onSelect={(images) => onChange({ ...batch, images })} />
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
