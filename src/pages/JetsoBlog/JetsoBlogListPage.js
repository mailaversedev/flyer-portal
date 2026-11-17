import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useTranslation } from "react-i18next";
import { isSuperAdmin } from "../../utils/AuthUtil";
import ApiService from "../../services/ApiService";
import PageHeader from "../../components/PageHeader/PageHeader";
import { getJetsoPostUrl } from "./blogUtils";
import "./JetsoBlog.css";

const JetsoBlogListPage = () => {
  const { t } = useTranslation();
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPosts = useCallback(async (after = null, append = false) => {
    setLoading(true);
    setError("");
    try {
      const response = await ApiService.getJetsoBlogPosts(after, 20);
      const data = response?.data || [];
      setPosts((current) => append ? [...current, ...data] : data);
      setNextCursor(response?.pagination?.nextCursor || null);
    } catch (loadError) {
      setError(loadError.message || t("jetsoBlog.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isSuperAdmin()) loadPosts();
  }, [loadPosts]);

  if (!isSuperAdmin()) return <Navigate to="/platform-admin" replace />;

  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  };

  return (
    <main className="jetso-blog-page jetso-blog-list-page">
      <PageHeader
        title={t("jetsoBlog.title")}
        description={t("jetsoBlog.description")}
        actions={
          <Link className="page-header-button page-header-button--primary" to="/jetso-blog/new">
            {t("jetsoBlog.newPost")}
          </Link>
        }
      />

      {error && <div className="jetso-blog-message error" role="alert">{error}</div>}
      <section className="jetso-blog-list-panel" aria-label={t("jetsoBlog.posts")}>
        {loading && posts.length === 0 ? (
          <p className="jetso-blog-empty">{t("jetsoBlog.loading")}</p>
        ) : posts.length === 0 ? (
          <div className="jetso-blog-empty">
            <h3>{t("jetsoBlog.noPosts")}</h3>
            <p>{t("jetsoBlog.noPostsDescription")}</p>
          </div>
        ) : (
          <div className="jetso-blog-table-wrap">
            <table className="jetso-blog-table">
              <thead>
                <tr>
                  <th>{t("jetsoBlog.article")}</th>
                  <th>{t("jetsoBlog.status")}</th>
                  <th>{t("jetsoBlog.updated")}</th>
                  <th>{t("jetsoBlog.published")}</th>
                  <th>{t("jetsoBlog.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <div className="jetso-blog-list-title">{post.draft?.header || t("jetsoBlog.untitled")}</div>
                      <div className="jetso-blog-list-subtitle">{post.draft?.excerpt || post.draft?.bodyText || ""}</div>
                    </td>
                    <td><span className={`jetso-blog-status jetso-blog-status-${post.status}`}>{t(`jetsoBlog.statusLabels.${post.status}`, post.status)}</span></td>
                    <td>{formatDate(post.updatedAt)}</td>
                    <td>{post.publishedAt ? formatDate(post.publishedAt) : post.draft?.scheduledAt ? `${t("jetsoBlog.scheduled")} ${formatDate(post.draft.scheduledAt)}` : "—"}</td>
                    <td className="jetso-blog-row-actions">
                      <Link to={`/jetso-blog/${encodeURIComponent(post.id)}/edit`}>{t("jetsoBlog.edit")}</Link>
                      {post.status === "published" && <a href={getJetsoPostUrl(post.id)} target="_blank" rel="noreferrer">{t("jetsoBlog.openPublic")}</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {loading && posts.length > 0 && <p className="jetso-blog-loading-more">{t("jetsoBlog.loading")}</p>}
        {!loading && nextCursor && (
          <button type="button" className="jetso-blog-secondary-button" onClick={() => loadPosts(nextCursor, true)}>
            {t("jetsoBlog.loadMore")}
          </button>
        )}
      </section>
    </main>
  );
};

export default JetsoBlogListPage;
