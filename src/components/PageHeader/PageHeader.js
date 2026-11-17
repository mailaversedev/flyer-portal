import React from "react";
import "./PageHeader.css";

const PageHeader = ({ description, actions }) => (
  <header className="page-header">
    <div className="page-header-copy">
      <p>{description}</p>
    </div>
    {actions ? <div className="page-header-actions">{actions}</div> : null}
  </header>
);

export default PageHeader;
