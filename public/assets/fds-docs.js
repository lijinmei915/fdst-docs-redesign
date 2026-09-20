(function () {
  "use strict";

  const body = document.body;
  const sidebar = document.querySelector("[data-sidebar]");
  const menuToggle = document.querySelector("[data-menu-toggle]");
  const menuBackdrop = document.querySelector("[data-menu-backdrop]");
  const searchDialog = document.querySelector("[data-search-dialog]");
  const searchInput = document.querySelector("[data-search-input]");
  const searchResults = document.querySelector("[data-search-results]");
  const rootPrefix = body.dataset.root || ".";

  function setMenu(open) {
    body.classList.toggle("is-menu-open", open);
    menuToggle?.setAttribute("aria-expanded", String(open));
    if (menuBackdrop) menuBackdrop.hidden = !open;
  }

  menuToggle?.addEventListener("click", () => setMenu(!body.classList.contains("is-menu-open")));
  menuBackdrop?.addEventListener("click", () => setMenu(false));
  sidebar?.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenu(false);
  });

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;",
    })[character]);
  }

  function pageHref(record) {
    return `${rootPrefix}/${record.href}`.replace(/\/\.\//g, "/");
  }

  function renderSearch(query) {
    const records = window.FDS_DOCS_SEARCH_INDEX || [];
    const tokens = window.FDS_CATALOG?.tokens || [];
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);

    if (!terms.length) {
      // Empty query: Show recommended quick links and popular tokens
      const popularTokens = [
        tokens.find(t => t.name === "color-brand-6") || { cssVariable: "--fds-g-color-brand-6", resolvedValue: "#FF8000", tier: "map", type: "color", category: "color" },
        tokens.find(t => t.name === "color-primary") || { cssVariable: "--fds-g-color-primary", resolvedValue: "#FF8000", tier: "base", type: "color", category: "color" },
        tokens.find(t => t.name === "spacing-4") || { cssVariable: "--fds-g-spacing-4", resolvedValue: "16px", tier: "map", type: "dimension", category: "spacing" },
        tokens.find(t => t.name === "radius-3") || { cssVariable: "--fds-g-radius-3", resolvedValue: "8px", tier: "map", type: "dimension", category: "shape" },
        tokens.find(t => t.name === "card-background") || { cssVariable: "--fds-s-card-background", resolvedValue: "#FFFFFF", tier: "scene", type: "color", category: "scene" }
      ];

      const featuredDocs = records.slice(0, 5);

      searchResults.innerHTML = `
        <div class="docs-search-suggest-box">
          <div class="docs-search-section-header">
            <span>常用规范文档</span>
          </div>
          <div class="docs-search-doc-list">
            ${featuredDocs.map((record) => `
              <a class="docs-search-result" href="${escapeHtml(pageHref(record))}">
                <small>${escapeHtml(record.group)}</small>
                <strong>${escapeHtml(record.title)}</strong>
                <span>${escapeHtml(record.summary)}</span>
              </a>`).join("")}
          </div>

          <div class="docs-search-section-header" style="margin-top: 16px;">
            <span>高频设计变量 (点击复制)</span>
          </div>
          <div class="docs-search-token-list">
            ${popularTokens.map(t => renderTokenSearchItem(t)).join("")}
          </div>
        </div>
      `;
      return;
    }

    // Filter tokens
    const tokenMatches = tokens.filter(t => {
      const hay = `${t.id || ""} ${t.name || ""} ${t.cssVariable || ""} ${t.resolvedValue || ""} ${t.value || ""} ${t.category || ""} ${t.tier || ""}`.toLowerCase();
      return terms.every(term => hay.includes(term));
    }).slice(0, 10);

    // Filter docs
    const docMatches = records.filter(record => {
      const hay = `${record.title} ${record.group} ${record.summary} ${record.text}`.toLowerCase();
      return terms.every(term => hay.includes(term));
    }).slice(0, 6);

    if (!tokenMatches.length && !docMatches.length) {
      searchResults.innerHTML = `<div class="docs-search-empty">没有匹配到相关规范文档或 Token 变量（支持搜索变量名、色值、间距或拼音）</div>`;
      return;
    }

    let html = "";

    // Render tokens if matched
    if (tokenMatches.length > 0) {
      html += `
        <div class="docs-search-section-header">
          <span>匹配设计变量 Token (${tokenMatches.length})</span>
          <small>点击直接复制 CSS 变量名</small>
        </div>
        <div class="docs-search-token-list">
          ${tokenMatches.map(t => renderTokenSearchItem(t)).join("")}
        </div>
      `;
    }

    // Render docs if matched
    if (docMatches.length > 0) {
      html += `
        <div class="docs-search-section-header" style="${tokenMatches.length ? 'margin-top: 16px;' : ''}">
          <span>匹配规范手册文档 (${docMatches.length})</span>
        </div>
        <div class="docs-search-doc-list">
          ${docMatches.map((record) => `
            <a class="docs-search-result" href="${escapeHtml(pageHref(record))}">
              <small>${escapeHtml(record.group)}</small>
              <strong>${escapeHtml(record.title)}</strong>
              <span>${escapeHtml(record.summary)}</span>
            </a>`).join("")}
        </div>
      `;
    }

    searchResults.innerHTML = html;
  }

  function renderTokenSearchItem(token) {
    const isColor = token.type === "color" || String(token.resolvedValue || "").startsWith("#") || String(token.name || "").includes("color");
    const swatch = isColor
      ? `<span class="docs-search-swatch" style="background-color: ${escapeHtml(token.resolvedValue || '#ccc')}"></span>`
      : `<span class="docs-search-type-badge">${escapeHtml(token.category || 'token')}</span>`;

    return `
      <div class="docs-search-token-item" data-copy-var="${escapeHtml(token.cssVariable || '')}">
        <div class="docs-search-token-left">
          ${swatch}
          <div class="docs-search-token-meta">
            <div class="docs-search-token-var">
              <code>${escapeHtml(token.cssVariable || token.name)}</code>
              <span class="hub-tier-badge tier-${escapeHtml(token.tier || 'map')}">${escapeHtml(token.tier || 'map')}</span>
            </div>
            <div class="docs-search-token-val">
              ${token.value && token.value !== token.resolvedValue ? `<span class="docs-search-raw">${escapeHtml(token.value)} →</span> ` : ''}
              <strong>${escapeHtml(String(token.resolvedValue || ''))}</strong>
            </div>
          </div>
        </div>
        <button type="button" class="docs-search-copy-btn" title="点击复制变量名">复制</button>
      </div>
    `;
  }

  function openSearch() {
    if (!searchDialog?.open) searchDialog?.showModal();
    renderSearch(searchInput?.value || "");
    window.setTimeout(() => searchInput?.focus(), 0);
  }

  window.openFdsSearch = openSearch;

  // Delegate copy action inside search results
  searchResults?.addEventListener("click", (event) => {
    const copyTarget = event.target.closest("[data-copy-var]");
    if (copyTarget) {
      const varName = copyTarget.dataset.copyVar;
      const btn = copyTarget.querySelector(".docs-search-copy-btn");
      if (varName && btn) {
        copyText(varName, btn);
      }
    }
  });

  document.querySelectorAll("[data-search-open]").forEach((button) => button.addEventListener("click", openSearch));
  searchInput?.addEventListener("input", () => renderSearch(searchInput.value));
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
      event.preventDefault();
      openSearch();
    }
    if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
      event.preventDefault();
      openSearch();
    }
  });

  document.querySelectorAll(".docs-article table").forEach((table) => {
    if (table.parentElement?.classList.contains("docs-table-wrap")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "docs-table-wrap";
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });

  async function copyText(value, button) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    const previous = button.textContent;
    button.textContent = "已复制";
    window.setTimeout(() => { button.textContent = previous; }, 1200);
  }

  document.querySelectorAll(".docs-article pre").forEach((pre) => {
    const button = document.createElement("button");
    button.className = "docs-code-copy";
    button.type = "button";
    button.textContent = "复制";
    button.addEventListener("click", () => copyText(pre.innerText.replace(/复制$/, "").trim(), button));
    pre.appendChild(button);
  });

  const tocLinks = [...document.querySelectorAll(".docs-toc a")];
  if (tocLinks.length && "IntersectionObserver" in window) {
    const byId = new Map(tocLinks.map((link) => [decodeURIComponent(link.hash.slice(1)), link]));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      tocLinks.forEach((link) => link.classList.toggle("is-active", link === byId.get(visible.target.id)));
    }, { rootMargin: "-72px 0px -70%" });
    byId.forEach((_, id) => {
      const heading = document.getElementById(id);
      if (heading) observer.observe(heading);
    });
  }
})();
