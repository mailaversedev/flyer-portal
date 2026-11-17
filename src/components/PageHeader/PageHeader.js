import React from "react";
import "./PageHeader.css";

const PageHeader = ({ title, description, actions }) => (
  <header className="page-header">
    <div className="page-header-copy">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {actions ? <div className="page-header-actions">{actions}</div> : null}
  </header>
);

export default PageHeader;
