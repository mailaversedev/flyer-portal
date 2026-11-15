import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import ApiService from "../../services/ApiService";

const EMPTY_PRODUCT = {
  name: "",
  currency: "HKD",
  price: "",
  active: true,
  url: "",
  image: "",
  description: "",
};

const MerchantProducts = () => {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageInputKey, setImageInputKey] = useState(0);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return undefined;
    }

    const preview = URL.createObjectURL(imageFile);
    setImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [imageFile]);

  const loadProducts = useCallback(async (cursor = null, replace = false) => {
    setLoading(true);
    setError("");
    try {
      const response = await ApiService.getMerchantProducts(cursor);
      if (!response.success || !Array.isArray(response.data)) {
        throw new Error(response.message || t("profilePage.productsLoadFailed"));
      }

      setProducts((current) =>
        replace ? response.data : [...current, ...response.data],
      );
      setNextCursor(response.pagination?.nextCursor || null);
      setHasLoaded(true);
    } catch (loadError) {
      setError(loadError.message || t("profilePage.productsLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadProducts(null, true);
  }, [loadProducts]);

  const clearImageSelection = () => {
    setImageFile(null);
    setImageInputKey((key) => key + 1);
  };

  const resetForm = () => {
    setForm(EMPTY_PRODUCT);
    setEditingId(null);
    clearImageSelection();
  };

  const handleEdit = (product) => {
    setEditingId(product.id);
    setForm({
      name: product.name || "",
      currency: product.currency || "HKD",
      price: String(product.price ?? ""),
      active: product.active === true,
      url: product.url || "",
      image: product.image || "",
      description: product.description || "",
    });
    clearImageSelection();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      let image = form.image;
      if (imageFile) {
        const upload = await ApiService.uploadFile(imageFile, "merchantProduct");
        if (!upload.success || !upload.url) {
          throw new Error(upload.message || t("profilePage.productImageUploadFailed"));
        }
        image = upload.url;
      }

      const payload = {
        ...form,
        name: form.name.trim(),
        currency: form.currency.trim().toUpperCase(),
        price: form.price.trim(),
        url: form.url.trim(),
        image,
        description: form.description.trim(),
      };
      const response = editingId
        ? await ApiService.updateMerchantProduct(editingId, payload)
        : await ApiService.createMerchantProduct(payload);
      if (!response.success) {
        throw new Error(response.message || t("profilePage.productSaveFailed"));
      }

      toast.success(t(editingId ? "profilePage.productUpdated" : "profilePage.productCreated"));
      resetForm();
      await loadProducts(null, true);
    } catch (saveError) {
      toast.error(saveError.message || t("profilePage.productSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="profile-card product-management-card">
      <div className="profile-header">
        <div>
          <h2>{t("profilePage.productsTitle")}</h2>
          <p className="form-hint">{t("profilePage.productsHint")}</p>
        </div>
      </div>

      <form
        aria-label={t("profilePage.productsTitle")}
        className="profile-form product-form"
        onSubmit={handleSubmit}
      >
        <div className="product-form-grid">
          <div className="form-group">
            <label htmlFor="productName">{t("profilePage.productName")}</label>
            <input
              id="productName"
              maxLength={120}
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="productCurrency">{t("profilePage.productCurrency")}</label>
            <input
              id="productCurrency"
              maxLength={3}
              pattern="[A-Za-z]{3}"
              placeholder="HKD"
              required
              value={form.currency}
              onChange={(event) =>
                setForm({ ...form, currency: event.target.value.toUpperCase() })
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="productPrice">{t("profilePage.productPrice")}</label>
            <input
              id="productPrice"
              inputMode="decimal"
              min="0"
              required
              type="number"
              step="any"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="productUrl">{t("profilePage.productUrl")}</label>
            <input
              id="productUrl"
              required
              type="url"
              value={form.url}
              onChange={(event) => setForm({ ...form, url: event.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="productDescription">{t("profilePage.productDescription")}</label>
          <textarea
            id="productDescription"
            maxLength={2000}
            rows={3}
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </div>

        <div className="form-group">
          <label htmlFor="productImage">{t("profilePage.productImage")}</label>
          <input
            id="productImage"
            key={imageInputKey}
            accept="image/*"
            required={!form.image}
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              if (file && !file.type.startsWith("image/")) {
                toast.error(t("profilePage.productImageInvalid"));
                clearImageSelection();
                return;
              }
              setImageFile(file);
            }}
          />
          {(imagePreview || form.image) && (
            <img
              className="product-image-preview"
              src={imagePreview || form.image}
              alt={t("profilePage.productImagePreview")}
            />
          )}
        </div>

        <label className="product-active-toggle">
          <input
            checked={form.active}
            type="checkbox"
            onChange={(event) => setForm({ ...form, active: event.target.checked })}
          />
          {t("profilePage.productActive")}
        </label>

        <div className="product-form-actions">
          <button className="save-button" disabled={saving} type="submit">
            {saving ? t("common.saving") : t(editingId ? "profilePage.productUpdate" : "profilePage.productCreate")}
          </button>
          {editingId && (
            <button
              className="product-cancel-button"
              disabled={saving}
              type="button"
              onClick={resetForm}
            >
              {t("common.cancel")}
            </button>
          )}
        </div>
      </form>

      <div className="product-list-heading">
        <h3>{t("profilePage.productsList")}</h3>
        <button
          className="product-refresh-button"
          disabled={loading}
          type="button"
          onClick={() => loadProducts(null, true)}
        >
          {t("profilePage.productsRefresh")}
        </button>
      </div>
      {error && <p className="product-list-error" role="alert">{error}</p>}
      {hasLoaded && products.length === 0 && !loading && (
        <p className="form-hint">{t("profilePage.productsEmpty")}</p>
      )}
      <div className="merchant-product-list">
        {products.map((product) => (
          <article className="merchant-product-row" key={product.id}>
            <img src={product.image} alt="" />
            <div className="merchant-product-summary">
              <strong>{product.name}</strong>
              <span>{product.currency} {product.price}</span>
              {product.description && <small>{product.description}</small>}
            </div>
            <span className={`merchant-product-status ${product.active ? "is-active" : "is-inactive"}`}>
              {t(product.active ? "profilePage.productActive" : "profilePage.productInactive")}
            </span>
            <button type="button" onClick={() => handleEdit(product)}>
              {t("profilePage.productEdit")}
            </button>
          </article>
        ))}
      </div>
      {loading && <p className="form-hint">{t("common.loading")}</p>}
      {nextCursor && !loading && (
        <button
          className="product-load-more"
          type="button"
          onClick={() => loadProducts(nextCursor)}
        >
          {t("profilePage.productsLoadMore")}
        </button>
      )}
    </section>
  );
};

export default MerchantProducts;
