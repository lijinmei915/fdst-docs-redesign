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
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const matches = terms.length
      ? records.filter((record) => {
        const haystack = `${record.title} ${record.group} ${record.summary} ${record.text}`.toLocaleLowerCase();
        return terms.every((term) => haystack.includes(term));
      }).slice(0, 12)
      : records.slice(0, 8);
    searchResults.innerHTML = matches.length
      ? matches.map((record) => `
        <a class="docs-search-result" href="${escapeHtml(pageHref(record))}">
          <small>${escapeHtml(record.group)}</small>
          <strong>${escapeHtml(record.title)}</strong>
          <span>${escapeHtml(record.summary)}</span>
        </a>`).join("")
      : '<div class="docs-search-empty">没有匹配的文档</div>';
  }

  function openSearch() {
    if (!searchDialog?.open) searchDialog?.showModal();
    renderSearch(searchInput?.value || "");
    window.setTimeout(() => searchInput?.focus(), 0);
  }

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
