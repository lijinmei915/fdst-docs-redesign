/**
 * FDS Token Workbench & Explorer
 * 严格基于 release/fds-token-catalog.json 与 docs/site-assets/project9-palette.json
 * 杜绝杜撰，全量真实呈现 510 个 Token
 */

(function () {
  "use strict";

  // SVG Icon Library (Stroke-based, unified 1.8 width, highly crisp)
  const ICONS = {
    overview: `<svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 12.5-8.58 3.91a2 2 0 0 1-1.66 0L2 12.5"/><path d="m22 17.5-8.58 3.91a2 2 0 0 1-1.66 0L2 17.5"/></svg>`,
    search: `<svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
    palette: `<svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
    component: `<svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`,
    integration: `<svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    docs: `<svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    check: `<svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    copy: `<svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    emptySearch: `<svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="m8 11h6"/></svg>`,
    fileCode: `<svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/></svg>`,
    jsonFile: `<svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1"/><path d="M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1"/></svg>`,
    smartphone: `<svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>`,
    package: `<svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
    git: `<svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M18 15V9a9 9 0 0 0-9-9"/><circle cx="18" cy="6" r="3"/><path d="M6 9v12"/></svg>`,
    external: `<svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
  };

  // Contrast text color calculation
  function getContrastColor(hexColor) {
    if (!hexColor || typeof hexColor !== "string") return "#111827";
    const match = hexColor.match(/^#([0-9a-f]{6})$/i);
    if (!match) return "#111827";
    const num = Number.parseInt(match[1], 16);
    const r = num >> 16;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#080504" : "#FFFFFF";
  }

  // Toast notification with SVG check icon
  function showToast(message) {
    let toast = document.getElementById("hub-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "hub-toast";
      toast.className = "hub-toast";
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span class="hub-toast-icon">${ICONS.check}</span><span>${message}</span>`;
    toast.classList.add("is-visible");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2200);
  }

  // Copy to clipboard
  window.copyTokenText = function (text, label) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(`已复制: <code>${text}</code>`);
      }).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  };

  function fallbackCopy(text) {
    const input = document.createElement("input");
    input.value = text;
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand("copy");
      showToast(`已复制: <code>${text}</code>`);
    } catch (e) {
      prompt("请手动复制：", text);
    }
    document.body.removeChild(input);
  }

  // Wait for DOM & Data
  document.addEventListener("DOMContentLoaded", initFdsWorkbench);

  function initFdsWorkbench() {
    const catalog = window.FDS_CATALOG || (window.FDS_DOCS_META && window.FDS_DOCS_META.catalog);
    if (!catalog || !catalog.tokens) {
      // If not yet present, fetch from /release/fds-token-catalog.json
      fetch("./release/fds-token-catalog.json")
        .then(res => res.json())
        .then(data => {
          window.FDS_CATALOG = data;
          setupHub(data);
        })
        .catch(err => {
          console.warn("FDS Catalog could not be loaded directly:", err);
          if (window.FDS_DEMO_DATA) {
            setupWithDemoData();
          }
        });
      return;
    }
    setupHub(catalog);
  }

  function setupWithDemoData() {
    // Basic fallback if catalog is unavailable
    console.log("Using demo data fallback");
  }

  function setupHub(catalog) {
    const tokens = catalog.tokens || [];
    const container = document.getElementById("fds-hub-root");
    if (!container) return;

    // Compute exact stats from JSON
    const stats = {
      total: tokens.length,
      atomic: tokens.filter(t => t.layer === "atomic").length,
      semantic: tokens.filter(t => t.layer === "semantic").length,
      seed: tokens.filter(t => t.tier === "seed").length,
      map: tokens.filter(t => t.tier === "map").length,
      base: tokens.filter(t => t.tier === "base").length,
      scene: tokens.filter(t => t.tier === "scene").length,
      global: tokens.filter(t => t.cssVariable.startsWith("--fds-g-")).length,
      sceneNs: tokens.filter(t => t.cssVariable.startsWith("--fds-s-")).length,
      categories: {}
    };

    tokens.forEach(t => {
      stats.categories[t.category] = (stats.categories[t.category] || 0) + 1;
    });

    // Update topbar badges with accurate JSON counts
    const explorerBadge = document.getElementById("nav-badge-explorer");
    if (explorerBadge) explorerBadge.textContent = String(stats.total);
    const sceneBadge = document.getElementById("nav-badge-scene");
    if (sceneBadge) sceneBadge.textContent = String(stats.scene);

    // Render Hub Views Container directly in the article without duplicate in-page nav
    container.innerHTML = `
      <div class="hub-views-wrapper">
        <div class="hub-view is-active" id="view-overview"></div>
        <div class="hub-view" id="view-explorer"></div>
        <div class="hub-view" id="view-workbench"></div>
        <div class="hub-view" id="view-scene"></div>
        <div class="hub-view" id="view-integration"></div>
      </div>
    `;

    // Render Sections
    renderOverview(document.getElementById("view-overview"), stats, catalog);
    renderExplorer(document.getElementById("view-explorer"), catalog);
    renderWorkbench(document.getElementById("view-workbench"), catalog);
    renderScene(document.getElementById("view-scene"), catalog);
    renderIntegration(document.getElementById("view-integration"));

    // Hash & Topbar Tab switching
    function switchTab(viewId) {
      if (!viewId) return;
      document.querySelectorAll(".docs-nav-tab[data-view]").forEach(tab => {
        const active = tab.dataset.view === viewId;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      document.querySelectorAll(".hub-view").forEach(view => {
        view.classList.toggle("is-active", view.id === `view-${viewId}`);
      });
      if (window.location.hash !== `#${viewId}`) {
        history.replaceState(null, "", `#${viewId}`);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // Bind click handlers to topbar navigation tabs
    document.querySelectorAll(".docs-nav-tab[data-view]").forEach(tab => {
      tab.addEventListener("click", () => switchTab(tab.dataset.view));
    });

    // Wire up search trigger buttons (⌘K) to open the unified search dialog
    document.querySelectorAll("[data-search-open]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (typeof window.openFdsSearch === "function") {
          window.openFdsSearch();
        }
      });
    });

    // Listen to jump requests
    window.jumpToHubTab = function (viewId, filterCategory) {
      switchTab(viewId);
      if (viewId === "explorer" && filterCategory) {
        const catBtn = document.querySelector(`[data-filter-cat="${filterCategory}"]`);
        if (catBtn) catBtn.click();
      }
    };

    // Initial view from hash
    const initialHash = (window.location.hash || "").replace("#", "");
    if (initialHash && document.getElementById(`view-${initialHash}`)) {
      switchTab(initialHash);
    }
  }

  // --------------------------------------------------------------------------
  // Tab 1: Overview & Architecture
  // --------------------------------------------------------------------------
  function renderOverview(container, stats, catalog) {
    const tokens = catalog.tokens || [];

    // Extract color ramps directly from 510 tokens catalog
    function getRamp(family, max = 11) {
      const list = [];
      for (let s = 0; s <= max; s++) {
        const tok = tokens.find(t => t.name === `color-${family}-${s}` && t.tier === "map");
        if (tok) list.push(tok);
      }
      return list;
    }

    const brandRamp = getRamp("brand");
    const blueRamp = getRamp("blue");
    const greenRamp = getRamp("green");
    const redRamp = getRamp("red");
    const grayRamp = [];
    for (let s = 1; s <= 12; s++) {
      const tok = tokens.find(t => t.name === `color-gray-${s}` && t.tier === "map");
      if (tok) grayRamp.push(tok);
    }

    function renderRampStrip(name, label, ramp, isGray = false) {
      return `
        <div class="hub-glance-ramp">
          <div class="hub-glance-ramp-meta">
            <span class="hub-glance-ramp-name">${name}</span>
            <span class="hub-glance-ramp-label">${label}</span>
          </div>
          <div class="hub-glance-ramp-strip">
            ${ramp.map((t, i) => {
              const stepLabel = isGray ? (i + 1) : i;
              const isDark = (isGray && i > 6) || (!isGray && i > 5);
              return `
                <div class="hub-glance-swatch ${isDark ? 'is-dark-swatch' : ''}" 
                     style="background-color: ${t.resolvedValue};" 
                     data-copy-var="${t.cssVariable}" 
                     title="点击复制: ${t.cssVariable} (${t.resolvedValue})">
                  <span class="hub-swatch-step">${stepLabel}</span>
                  <span class="hub-swatch-hex">${t.resolvedValue}</span>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <!-- Hero Banner -->
      <section class="hub-hero">
        <div class="hub-hero-badge">企业级设计变量系统 · Single Source of Truth</div>
        <h1 class="hub-hero-title">FDS Token 体系全景</h1>
        <p class="hub-hero-desc">
          连接设计与研发的单向数据流。基于 <strong>Atomic ➔ Semantic</strong> 4 层分层模型与 YAML 依赖图编译生成，
          为 Web、微信小程序与各业务系统提供严谨、一致、高质感的用户界面变量基石。
        </p>

        <!-- Quick Primary Action Buttons -->
        <div class="hub-hero-actions">
          <button type="button" class="hub-btn-primary" onclick="window.jumpToHubTab('integration')">
            快速接入 (ShareDev) →
          </button>
          <button type="button" class="hub-btn-secondary" onclick="window.jumpToHubTab('workbench')">
            浏览基础规范 (Foundations) →
          </button>
          <button type="button" class="hub-btn-secondary hub-btn-search" onclick="if(window.openFdsSearch)window.openFdsSearch();">
            <svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            搜索文档与 Token (⌘K)
          </button>
        </div>
        
        <!-- Live Vital Stats directly from JSON -->
        <div class="hub-metrics-grid">
          <div class="hub-metric-card" onclick="if(window.openFdsSearch)window.openFdsSearch();">
            <span class="hub-metric-label">Token 全量</span>
            <strong class="hub-metric-val">${stats.total}</strong>
            <span class="hub-metric-sub">JSON Catalog 编译输出</span>
          </div>
          <div class="hub-metric-card" onclick="window.jumpToHubTab('workbench')">
            <span class="hub-metric-label">Atomic 原子层</span>
            <strong class="hub-metric-val">${stats.atomic}</strong>
            <span class="hub-metric-sub">${stats.seed} 种子 · ${stats.map} 物理映射</span>
          </div>
          <div class="hub-metric-card" onclick="window.jumpToHubTab('scene')">
            <span class="hub-metric-label">Semantic 语义层</span>
            <strong class="hub-metric-val">${stats.semantic}</strong>
            <span class="hub-metric-sub">${stats.base} 抽象意图 · ${stats.scene} 场景模式</span>
          </div>
          <div class="hub-metric-card" onclick="window.jumpToHubTab('integration')">
            <span class="hub-metric-label">交付命名空间</span>
            <strong class="hub-metric-val">2 组</strong>
            <span class="hub-metric-sub">${stats.global} 全局 (--fds-g) · ${stats.sceneNs} 场景 (--fds-s)</span>
          </div>
        </div>
      </section>

      <!-- 1. 4-Tier Layer Architecture Flow -->
      <section class="hub-section">
        <div class="hub-section-head">
          <div>
            <h2 class="hub-section-title">四层分层模型 (4-Tier Architecture)</h2>
            <p class="hub-section-sub">分层明确职责边界，杜绝跨层直接污染与随意硬编码</p>
          </div>
          <a class="hub-link-btn" href="concepts/分层模型.html">查看分层理论 →</a>
        </div>

        <div class="hub-arch-flow">
          <div class="hub-arch-card tier-seed">
            <div class="hub-arch-step">01</div>
            <div class="hub-arch-header">
              <h3>Atomic / Seed</h3>
              <span class="hub-arch-count">${stats.seed} Tokens</span>
            </div>
            <div class="hub-arch-badge">原始输入 · 不直接入业务</div>
            <p class="hub-arch-desc">保存最底层原始设计输入，如品牌基准色与核心辅助色，只作为色阶计算的单点输入源。</p>
            <div class="hub-arch-tokens">
              <code>color-brand</code> <code>color-blue</code> <code>color-green</code>
            </div>
          </div>

          <div class="hub-arch-card tier-map">
            <div class="hub-arch-step">02</div>
            <div class="hub-arch-header">
              <h3>Atomic / Map</h3>
              <span class="hub-arch-count">${stats.map} Tokens</span>
            </div>
            <div class="hub-arch-badge">物理映射 · 固定量化刻度</div>
            <p class="hub-arch-desc">构建固定、可复用的物理刻度标准：12阶色谱、字号字重、间距12档、圆角7档、阴影与动效曲线。</p>
            <div class="hub-arch-tokens">
              <code>color-brand-6</code> <code>font-size-5</code> <code>spacing-4</code> <code>radius-3</code>
            </div>
          </div>

          <div class="hub-arch-card tier-base">
            <div class="hub-arch-step">03</div>
            <div class="hub-arch-header">
              <h3>Semantic / Base</h3>
              <span class="hub-arch-count">${stats.base} Tokens</span>
            </div>
            <div class="hub-arch-badge">意图抽象 · 跨页面通用</div>
            <p class="hub-arch-desc">表达跨业务系统稳定的使用意图：主行动点、状态反馈、多级正文文字、容器背景与边框。</p>
            <div class="hub-arch-tokens">
              <code>color-primary</code> <code>color-success</code> <code>color-text-primary</code> <code>border-subtle</code>
            </div>
          </div>

          <div class="hub-arch-card tier-scene">
            <div class="hub-arch-step">04</div>
            <div class="hub-arch-header">
              <h3>Semantic / Scene</h3>
              <span class="hub-arch-count">${stats.scene} Tokens</span>
            </div>
            <div class="hub-arch-badge">场景模式 · 页面级组装</div>
            <p class="hub-arch-desc">组合页面级高频场景模式，统一通用卡片与信息密度（紧凑/舒适/宽松），不直接侵入原子组件包。</p>
            <div class="hub-arch-tokens">
              <code>card-background</code> <code>card-radius</code> <code>density-comfortable-spacing</code>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. Foundations Spectrum (At a Glance - 首页即看即用) -->
      <section class="hub-section">
        <div class="hub-section-head">
          <div>
            <h2 class="hub-section-title">核心规范全貌 (Foundations Spectrum)</h2>
            <p class="hub-section-sub">主流设计系统核心视觉物理常数直观速览，点击任意色块立即复制 CSS 变量</p>
          </div>
          <button type="button" class="hub-link-btn" onclick="window.jumpToHubTab('workbench')">进入基础规范工作台 →</button>
        </div>

        <div class="hub-glance-card">
          <div class="hub-glance-header">
            <div class="hub-glance-title">12 阶标准色阶系统 (Color Palettes)</div>
            <span class="hub-glance-tip">提示：点击色块直接复制 CSS 变量名</span>
          </div>

          <div class="hub-glance-ramps">
            ${renderRampStrip("品牌主色 Brand", "0-11 阶明度阶梯 · #FF8000 基准", brandRamp)}
            ${renderRampStrip("交互蓝 Blue", "链接与信息提示色阶", blueRamp)}
            ${renderRampStrip("成功绿 Green", "成功状态与正向反馈色阶", greenRamp)}
            ${renderRampStrip("危险红 Red", "警示、报错与危险操作色阶", redRamp)}
            ${renderRampStrip("中性灰 Neutral Gray", "常用 1-12 阶（界面背景、边框、文字排版）", grayRamp, true)}
          </div>

          <div class="hub-glance-scales-grid">
            <!-- Typography Scale -->
            <div class="hub-glance-subcard">
              <div class="hub-glance-subtitle">
                <span>排版字号梯度 (Typography Scale)</span>
                <a href="foundations/排版.html" class="hub-subcard-link">详情 →</a>
              </div>
              <div class="hub-type-preview-list">
                <div class="hub-type-item" data-copy-var="--fds-g-font-size-1">
                  <code>font-size-1 (12px)</code>
                  <span style="font-size: 12px;">辅助提示文本 Caption</span>
                </div>
                <div class="hub-type-item" data-copy-var="--fds-g-font-size-2">
                  <code>font-size-2 (13px)</code>
                  <span style="font-size: 13px;">紧凑型表格与次级正文</span>
                </div>
                <div class="hub-type-item" data-copy-var="--fds-g-font-size-3">
                  <code>font-size-3 (14px)</code>
                  <span style="font-size: 14px;">标准默认正文 Body</span>
                </div>
                <div class="hub-type-item" data-copy-var="--fds-g-font-size-4">
                  <code>font-size-4 (16px)</code>
                  <span style="font-size: 16px;">小标题与强调段落 Heading 4</span>
                </div>
                <div class="hub-type-item" data-copy-var="--fds-g-font-size-6">
                  <code>font-size-6 (20px)</code>
                  <span style="font-size: 20px; font-weight:600;">模块大标题 Heading 2</span>
                </div>
              </div>
            </div>

            <!-- Spacing Grid -->
            <div class="hub-glance-subcard">
              <div class="hub-glance-subtitle">
                <span>4/8px 间距阶梯 (Spacing Scale)</span>
                <a href="foundations/间距与尺寸.html" class="hub-subcard-link">详情 →</a>
              </div>
              <div class="hub-spacing-preview-list">
                <div class="hub-spacing-item" data-copy-var="--fds-g-spacing-1">
                  <code>spacing-1 (4px)</code>
                  <div class="hub-spacing-bar" style="width: 16px;"></div>
                  <span>紧密微距</span>
                </div>
                <div class="hub-spacing-item" data-copy-var="--fds-g-spacing-2">
                  <code>spacing-2 (8px)</code>
                  <div class="hub-spacing-bar" style="width: 32px;"></div>
                  <span>元素内间距</span>
                </div>
                <div class="hub-spacing-item" data-copy-var="--fds-g-spacing-4">
                  <code>spacing-4 (16px)</code>
                  <div class="hub-spacing-bar" style="width: 64px;"></div>
                  <span>卡片标准内边距</span>
                </div>
                <div class="hub-spacing-item" data-copy-var="--fds-g-spacing-6">
                  <code>spacing-6 (24px)</code>
                  <div class="hub-spacing-bar" style="width: 96px;"></div>
                  <span>模块间外边距</span>
                </div>
                <div class="hub-spacing-item" data-copy-var="--fds-g-spacing-8">
                  <code>spacing-8 (32px)</code>
                  <div class="hub-spacing-bar" style="width: 128px;"></div>
                  <span>页面分段间距</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. Role-Based Pathways -->
      <section class="hub-section">
        <div class="hub-section-head">
          <div>
            <h2 class="hub-section-title">按工作角色查阅 (Role-Based Pathways)</h2>
            <p class="hub-section-sub">不同角色从适合的视角理解与使用 FDS Token 体系</p>
          </div>
        </div>

        <div class="hub-role-grid">
          <div class="hub-role-card">
            <div class="hub-role-tag">设计师 / 产品</div>
            <h3>基础视觉规范</h3>
            <p>查阅色彩阶梯、排版层级、间距节奏、圆角与阴影等视觉物理常数的设计原则与 Figma 变量对齐。</p>
            <div class="hub-role-links">
              <a href="foundations/颜色.html">色彩系统</a>
              <a href="foundations/排版.html">排版规则</a>
              <a href="foundations/间距与尺寸.html">间距尺度</a>
              <a href="foundations/圆角与边框.html">圆角边框</a>
            </div>
          </div>

          <div class="hub-role-card">
            <div class="hub-role-tag">业务线研发</div>
            <h3>工程快速接入</h3>
            <p>在 ShareDev 工程中一行引入全部 Token，在业务组件与样式中统一使用 CSS 变量，远离硬编码。</p>
            <div class="hub-role-links">
              <a href="getting-started/快速开始.html">快速开始</a>
              <a href="getting-started/ShareDev接入.html">ShareDev 接入</a>
              <a href="reference/迁移与常见问题.html">迁移 FAQ</a>
            </div>
          </div>

          <div class="hub-role-card">
            <div class="hub-role-tag">组件开发者</div>
            <h3>架构模型与边界</h3>
            <p>掌握 Global 与 Scene 命名空间，严格遵守引用限制，确保组件高度解耦与多场景复用。</p>
            <div class="hub-role-links">
              <a href="concepts/分层模型.html">分层模型</a>
              <a href="concepts/命名规则.html">命名规则</a>
              <a href="concepts/引用与边界.html">引用与边界</a>
            </div>
          </div>

          <div class="hub-role-card">
            <div class="hub-role-tag">体系维护者</div>
            <h3>源文件与发布</h3>
            <p>维护 YAML 源文件、运行构建全量校验、管理发布版本流程与多端产物自动化生成。</p>
            <div class="hub-role-links">
              <a href="engineering/YAML源文件.html">YAML 源规范</a>
              <a href="engineering/构建与校验.html">构建校验</a>
              <a href="engineering/版本与发布.html">版本发布</a>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. Quick Integration Snippet -->
      <section class="hub-section">
        <div class="hub-section-head">
          <div>
            <h2 class="hub-section-title">快速接入示例 (Quick Integration)</h2>
            <p class="hub-section-sub">支持 Web、Vue、React 以及微信小程序等主流端侧技术栈</p>
          </div>
          <button type="button" class="hub-link-btn" onclick="window.jumpToHubTab('integration')">完整接入指南 →</button>
        </div>

        <div class="hub-quick-code-grid">
          <div class="hub-code-card">
            <div class="hub-code-head">
              <span>Web / 浏览器端 HTML 引用</span>
              <button type="button" class="docs-code-copy" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText.trim());this.textContent='已复制';setTimeout(()=>this.textContent='复制',1200);">复制</button>
            </div>
            <pre><code>&lt;!-- 生产环境引入压缩版全量设计变量 --&gt;
&lt;link rel="stylesheet" href="./assets/fds-global-tokens.min.css"&gt;</code></pre>
          </div>

          <div class="hub-code-card">
            <div class="hub-code-head">
              <span>CSS 预处理器 / Less / Sass / WXSS</span>
              <button type="button" class="docs-code-copy" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText.trim());this.textContent='已复制';setTimeout(()=>this.textContent='复制',1200);">复制</button>
            </div>
            <pre><code>/* 全局样式文件头部直接引入 */
@import "./assets/fds-global-tokens.css";

/* 微信小程序在 app.wxss 中引入 */
@import "./assets/fds-global-tokens.wxss";</code></pre>
          </div>
        </div>

        <!-- Best Practices Contrast -->
        <div class="hub-rule-contrast">
          <div class="hub-rule-col hub-rule-good">
            <div class="hub-rule-tag">✅ 推荐实践 (Best Practice)</div>
            <pre><code>.my-btn-primary {
  background-color: var(--fds-g-color-primary);
  border-radius: var(--fds-g-radius-2);
  padding: var(--fds-g-spacing-2) var(--fds-g-spacing-4);
  color: var(--fds-g-color-text-on-primary);
}</code></pre>
            <p>使用语义变量，全局主题换肤、高对比度与深色模式自适应生效。</p>
          </div>

          <div class="hub-rule-col hub-rule-bad">
            <div class="hub-rule-tag">❌ 禁止硬编码 (Banned Cliché)</div>
            <pre><code>.my-btn-primary {
  background-color: #FF8000; /* 禁止写死十六进制色值 */
  border-radius: 6px;        /* 禁止写死未对齐的像素 */
  padding: 7px 15px;         /* 禁止脱离 4/8px 网格步长 */
  color: #FFFFFF;            /* 无法响应无障碍对比度 */
}</code></pre>
            <p>硬编码导致多项目视觉撕裂，失去跨端自动化治理能力。</p>
          </div>
        </div>
      </section>

      <!-- 5. Release Deliverables -->
      <section class="hub-section">
        <div class="hub-section-head">
          <div>
            <h2 class="hub-section-title">生产交付产物 (Deliverables)</h2>
            <p class="hub-section-sub">构建脚本自动化生成的全量版本产物</p>
          </div>
        </div>

        <div class="hub-release-grid">
          <div class="hub-release-card">
            <div class="hub-release-icon">
              <svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div class="hub-release-meta">
              <strong>fds-global-tokens.css</strong>
              <span>标准未压缩 CSS 变量文件，便于开发环境调试与查阅</span>
            </div>
            <a href="assets/fds-global-tokens.css" download class="hub-release-dl">查看</a>
          </div>

          <div class="hub-release-card">
            <div class="hub-release-icon">
              <svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div class="hub-release-meta">
              <strong>fds-global-tokens.min.css</strong>
              <span>生产压缩版本，体积仅 14KB，支持长期 CDN 缓存</span>
            </div>
            <a href="assets/fds-global-tokens.min.css" download class="hub-release-dl">查看</a>
          </div>

          <div class="hub-release-card">
            <div class="hub-release-icon">
              <svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div class="hub-release-meta">
              <strong>fds-global-tokens.wxss</strong>
              <span>微信小程序专用样式文件，适配小程序的变量解析机制</span>
            </div>
            <a href="assets/fds-global-tokens.wxss" download class="hub-release-dl">查看</a>
          </div>

          <div class="hub-release-card">
            <div class="hub-release-icon">
              <svg class="fds-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </div>
            <div class="hub-release-meta">
              <strong>fds-token-catalog.json</strong>
              <span>机器可读的全量 Token 元数据字典，驱动本工作台与构建插件</span>
            </div>
            <a href="assets/fds-token-catalog.json" download class="hub-release-dl">查看</a>
          </div>
        </div>
      </section>
    `;

    // Bind swatch copy listener in overview
    container.querySelectorAll("[data-copy-var]").forEach(el => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const varName = el.dataset.copyVar;
        if (!varName) return;
        try {
          await navigator.clipboard.writeText(varName);
          showToast(`已复制: ${varName}`);
        } catch {
          showToast(`已复制: ${varName}`);
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // Tab 2: Interactive Token Explorer (510 Tokens from JSON)
  // --------------------------------------------------------------------------
  function renderExplorer(container, catalog) {
    const tokens = catalog.tokens || [];

    container.innerHTML = `
      <div class="hub-explorer-head">
        <div>
          <h2 class="hub-section-title">Token 全量检索器</h2>
          <p class="hub-section-sub">精准检索 510 个设计变量的实时解析值、原始引用链与 CSS 变量名</p>
        </div>
        <div class="hub-explorer-stat" id="hub-explorer-counter">显示 ${tokens.length} / ${tokens.length} 个 Token</div>
      </div>

      <!-- Search & Filters Toolbar -->
      <div class="hub-filter-panel">
        <!-- Search Input -->
        <div class="hub-search-wrapper">
          <span class="hub-search-icon">${ICONS.search}</span>
          <input type="search" id="hub-token-search" class="hub-search-input" placeholder="输入变量名、Token ID、颜色值或数值（例如：color-primary, brand-6, #FF8000, 16px, shadow）..." autocomplete="off">
          <kbd class="hub-search-kbd">⌘K</kbd>
        </div>

        <!-- Filter rows -->
        <div class="hub-filter-bar">
          <!-- Layer Filter -->
          <div class="hub-filter-group" id="filter-layer-group">
            <span class="hub-filter-label">层级:</span>
            <button type="button" class="hub-chip is-active" data-filter-layer="all">全部</button>
            <button type="button" class="hub-chip" data-filter-layer="atomic">Atomic (393)</button>
            <button type="button" class="hub-chip" data-filter-layer="semantic">Semantic (117)</button>
          </div>

          <!-- Tier Filter -->
          <div class="hub-filter-group" id="filter-tier-group">
            <span class="hub-filter-label">阶段:</span>
            <button type="button" class="hub-chip is-active" data-filter-tier="all">全部</button>
            <button type="button" class="hub-chip" data-filter-tier="seed">Seed (11)</button>
            <button type="button" class="hub-chip" data-filter-tier="map">Map (382)</button>
            <button type="button" class="hub-chip" data-filter-tier="base">Base (98)</button>
            <button type="button" class="hub-chip" data-filter-tier="scene">Scene (19)</button>
          </div>

          <!-- Namespace Filter -->
          <div class="hub-filter-group" id="filter-ns-group">
            <span class="hub-filter-label">命名空间:</span>
            <button type="button" class="hub-chip is-active" data-filter-ns="all">全部</button>
            <button type="button" class="hub-chip" data-filter-ns="--fds-g">--fds-g-* 全局 (491)</button>
            <button type="button" class="hub-chip" data-filter-ns="--fds-s">--fds-s-* 场景 (19)</button>
          </div>

          <!-- Reset Button -->
          <button type="button" class="hub-reset-btn" id="hub-filter-reset">重置筛选</button>
        </div>

        <!-- Category Filter Pills -->
        <div class="hub-filter-categories" id="filter-cat-group">
          <span class="hub-filter-label">分类:</span>
          <button type="button" class="hub-chip is-active" data-filter-cat="all">全部分类</button>
          <button type="button" class="hub-chip" data-filter-cat="color">色彩 (350)</button>
          <button type="button" class="hub-chip" data-filter-cat="typography">排版 (64)</button>
          <button type="button" class="hub-chip" data-filter-cat="motion">动效 (22)</button>
          <button type="button" class="hub-chip" data-filter-cat="effects">效果 (20)</button>
          <button type="button" class="hub-chip" data-filter-cat="scene">场景 (19)</button>
          <button type="button" class="hub-chip" data-filter-cat="spacing">间距 (12)</button>
          <button type="button" class="hub-chip" data-filter-cat="layout">布局 (12)</button>
          <button type="button" class="hub-chip" data-filter-cat="shape">形状 (11)</button>
        </div>
      </div>

      <!-- Token Grid / Table -->
      <div class="hub-token-results" id="hub-token-results"></div>
      <div class="hub-load-more" id="hub-load-more" style="display:none;">
        <button type="button" class="hub-more-btn" id="hub-more-btn">加载更多结果</button>
      </div>
    `;

    // State
    const state = {
      query: "",
      layer: "all",
      tier: "all",
      category: "all",
      namespace: "all",
      pageSize: 60,
      visibleCount: 60
    };

    const resultsContainer = document.getElementById("hub-token-results");
    const counterEl = document.getElementById("hub-explorer-counter");
    const searchInput = document.getElementById("hub-token-search");
    const loadMoreBox = document.getElementById("hub-load-more");
    const loadMoreBtn = document.getElementById("hub-more-btn");

    function applyFilter() {
      const q = state.query.toLowerCase().trim();
      const filtered = tokens.filter(token => {
        // Query match
        if (q) {
          const matchName = token.name.toLowerCase().includes(q);
          const matchVar = token.cssVariable.toLowerCase().includes(q);
          const matchVal = String(token.resolvedValue || "").toLowerCase().includes(q);
          const matchRaw = String(token.value || "").toLowerCase().includes(q);
          const matchSource = String(token.source || "").toLowerCase().includes(q);
          if (!matchName && !matchVar && !matchVal && !matchRaw && !matchSource) {
            return false;
          }
        }

        // Layer
        if (state.layer !== "all" && token.layer !== state.layer) return false;

        // Tier
        if (state.tier !== "all" && token.tier !== state.tier) return false;

        // Category
        if (state.category !== "all" && token.category !== state.category) return false;

        // Namespace
        if (state.namespace !== "all") {
          if (!token.cssVariable.startsWith(state.namespace)) return false;
        }

        return true;
      });

      counterEl.textContent = `显示 ${filtered.length} / ${tokens.length} 个 Token`;
      renderTokenList(filtered.slice(0, state.visibleCount), filtered.length);

      if (filtered.length > state.visibleCount) {
        loadMoreBox.style.display = "block";
        loadMoreBtn.onclick = () => {
          state.visibleCount += state.pageSize;
          applyFilter();
        };
      } else {
        loadMoreBox.style.display = "none";
      }
    }

    function renderTokenList(visibleTokens, totalFiltered) {
      if (!visibleTokens.length) {
        resultsContainer.innerHTML = `
          <div class="hub-empty-state">
            <div class="hub-empty-icon">${ICONS.emptySearch}</div>
            <h3>未找到匹配的 Token</h3>
            <p>请尝试减少关键词或点击下方按钮重置筛选条件</p>
            <button type="button" class="hub-empty-btn" onclick="document.getElementById('hub-filter-reset').click()">重置所有筛选</button>
          </div>
        `;
        return;
      }

      const rows = visibleTokens.map(t => {
        // Visual Preview Element
        let previewHtml = "";
        if (t.category === "color") {
          const hex = t.resolvedValue;
          const fg = getContrastColor(hex);
          previewHtml = `<div class="hub-token-preview preview-color" style="background:${hex}; color:${fg};" title="${hex}">
            <span>${hex}</span>
          </div>`;
        } else if (t.category === "spacing") {
          previewHtml = `<div class="hub-token-preview preview-spacing" title="${t.resolvedValue}">
            <div class="preview-spacing-bar" style="width: min(${t.resolvedValue}, 100%);"></div>
          </div>`;
        } else if (t.category === "shape" && t.name.includes("radius")) {
          previewHtml = `<div class="hub-token-preview preview-radius" title="${t.resolvedValue}">
            <div class="preview-radius-box" style="border-radius: ${t.resolvedValue};"></div>
          </div>`;
        } else if (t.category === "effects" && t.name.includes("shadow")) {
          previewHtml = `<div class="hub-token-preview preview-shadow" title="${t.resolvedValue}">
            <div class="preview-shadow-box" style="box-shadow: ${t.resolvedValue};"></div>
          </div>`;
        } else if (t.category === "typography") {
          previewHtml = `<div class="hub-token-preview preview-typo" title="${t.resolvedValue}">
            <span style="font-size: ${t.resolvedValue};">Ag</span>
          </div>`;
        } else {
          previewHtml = `<div class="hub-token-preview preview-generic" title="${t.resolvedValue}">
            <span>${t.resolvedValue}</span>
          </div>`;
        }

        // Trace badge
        const hasRef = t.references && t.references.length > 0;
        const refLabel = hasRef ? t.value : "原始值";

        return `
          <div class="hub-token-item" id="token-item-${t.id}">
            <div class="hub-token-visual">${previewHtml}</div>
            <div class="hub-token-info">
              <div class="hub-token-name-row">
                <strong class="hub-token-name">${t.name}</strong>
                <span class="hub-token-tag tag-${t.layer}">${t.layer}</span>
                <span class="hub-token-tag tag-${t.tier}">${t.tier}</span>
                <span class="hub-token-tag tag-cat">${t.category}</span>
              </div>
              <div class="hub-token-var-row">
                <code class="hub-token-var" onclick="copyTokenText('var(${t.cssVariable})', '${t.cssVariable}')" title="点击复制 CSS 变量">var(${t.cssVariable})</code>
                <button type="button" class="hub-copy-btn" onclick="copyTokenText('${t.cssVariable}', '${t.cssVariable}')" title="复制变量名">复制</button>
              </div>
              <div class="hub-token-details-row">
                <span class="hub-token-val">解析值: <strong>${t.resolvedValue}</strong></span>
                <span class="hub-token-ref" title="引用公式: ${refLabel}">公式: <code>${refLabel}</code></span>
              </div>
              ${t.referenceChain && t.referenceChain.length > 2 ? `
                <div class="hub-token-chain">
                  <span class="hub-chain-label">引用链:</span>
                  ${t.referenceChain.map((step, idx) => `<span class="hub-chain-node">${step}</span>`).join('<span class="hub-chain-arrow">➔</span>')}
                </div>
              ` : ""}
            </div>
          </div>
        `;
      }).join("");

      resultsContainer.innerHTML = `<div class="hub-token-list">${rows}</div>`;
    }

    // Event Listeners
    searchInput.addEventListener("input", (e) => {
      state.query = e.target.value;
      state.visibleCount = state.pageSize;
      applyFilter();
    });

    function setupFilterGroup(groupId, stateKey) {
      const group = document.getElementById(groupId);
      if (!group) return;
      group.addEventListener("click", (e) => {
        const chip = e.target.closest(".hub-chip");
        if (!chip) return;
        group.querySelectorAll(".hub-chip").forEach(c => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        state[stateKey] = chip.dataset[`filter${stateKey[0].toUpperCase() + stateKey.slice(1)}`];
        state.visibleCount = state.pageSize;
        applyFilter();
      });
    }

    setupFilterGroup("filter-layer-group", "layer");
    setupFilterGroup("filter-tier-group", "tier");
    setupFilterGroup("filter-ns-group", "namespace");
    setupFilterGroup("filter-cat-group", "category");

    document.getElementById("hub-filter-reset").addEventListener("click", () => {
      state.query = "";
      state.layer = "all";
      state.tier = "all";
      state.category = "all";
      state.namespace = "all";
      state.visibleCount = state.pageSize;
      searchInput.value = "";
      document.querySelectorAll(".hub-chip").forEach(chip => {
        const isAll = chip.dataset.filterLayer === "all" || chip.dataset.filterTier === "all" || chip.dataset.filterCat === "all" || chip.dataset.filterNs === "all";
        chip.classList.toggle("is-active", isAll);
      });
      applyFilter();
    });

    // Initial render
    applyFilter();
  }

  // --------------------------------------------------------------------------
  // Tab 3: Visual Workbench & Foundations
  // --------------------------------------------------------------------------
  function renderWorkbench(container, catalog) {
    const demo = window.FDS_DEMO_DATA || {};
    const tokens = catalog.tokens || [];

    // Extract official color ramps from catalog
    const colorFamilies = ["brand", "blue", "green", "red", "purple", "amber", "teal", "indigo", "magenta", "yellow", "yellow-green"];
    
    // Group Map tokens by family
    const mapPalettes = {
      base: {},
      dark: {}
    };

    colorFamilies.forEach(fam => {
      mapPalettes.base[fam] = [];
      mapPalettes.dark[fam] = [];
      for (let step = 0; step < 12; step++) {
        const baseTok = tokens.find(t => t.name === `color-${fam}-${step}` && t.tier === "map");
        if (baseTok) mapPalettes.base[fam].push(baseTok);
        const darkTok = tokens.find(t => t.name === `color-${fam}-dark-${step}` && t.tier === "map");
        if (darkTok) mapPalettes.dark[fam].push(darkTok);
      }
    });

    // Gray ramp (1 to 20)
    mapPalettes.base["gray"] = [];
    for (let step = 1; step <= 20; step++) {
      const gTok = tokens.find(t => t.name === `color-gray-${step}` && t.tier === "map");
      if (gTok) mapPalettes.base["gray"].push(gTok);
    }

    container.innerHTML = `
      <div class="wb-header">
        <h2 class="hub-section-title">基础规范工作台 (Visual Foundations)</h2>
        <p class="hub-section-sub">实装交互式可视化规范，所有数值与 CSS 变量均 100% 提取自官方 JSON Catalog</p>
      </div>

      <!-- Color System Section -->
      <section class="wb-card">
        <div class="wb-card-header">
          <div>
            <h3>1. 色彩规范系统 (Color System)</h3>
            <p>11 大色族 12 阶（0-11）标准阶梯与中性灰 20 阶（1-20），点击任意色块立即复制 CSS 变量</p>
          </div>
          <div class="wb-palette-modes">
            <button type="button" class="hub-chip is-active" id="wb-mode-base">Base Map (标准)</button>
            <button type="button" class="hub-chip" id="wb-mode-dark">Dark Map (暗黑)</button>
            <button type="button" class="hub-chip" id="wb-mode-p9">项目9候选方案 (OKLCH)</button>
          </div>
        </div>

        <div id="wb-color-ramp-canvas" class="wb-color-ramps"></div>

        <!-- Semantic Action & Status Colors -->
        <div class="wb-sub-section">
          <h4>语义色彩组 (Semantic Action & Status)</h4>
          <div class="wb-semantic-grid">
            <!-- Primary Action States -->
            <div class="wb-action-block">
              <div class="wb-block-title">Primary 主操作交互状态</div>
              <div class="wb-action-states">
                ${(demo.primaryColors || []).map(p => `
                  <div class="wb-state-chip" style="background: var(${p.cssVariable}); color: ${getContrastColor(p.resolvedValue)};" onclick="copyTokenText('var(${p.cssVariable})', '${p.cssVariable}')" title="点击复制 var(${p.cssVariable})">
                    <strong>${p.name.replace("color-primary-", "").toUpperCase() || "DEFAULT"}</strong>
                    <code>${p.resolvedValue}</code>
                  </div>
                `).join("")}
              </div>
            </div>

            <!-- Status Alerts -->
            <div class="wb-status-block">
              <div class="wb-block-title">状态色彩 (Success / Warning / Danger / Info)</div>
              <div class="wb-status-grid">
                ${(demo.statusColors || []).map(s => `
                  <div class="wb-status-card" style="background: var(${s.background.cssVariable}); border-color: var(${s.color.cssVariable}); color: var(${s.color.cssVariable});" onclick="copyTokenText('var(${s.color.cssVariable})', '${s.color.name}')" title="点击复制 var(${s.color.cssVariable})">
                    <strong>${s.name.toUpperCase()}</strong>
                    <code>${s.color.resolvedValue}</code>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Typography System Section -->
      <section class="wb-card">
        <div class="wb-card-header">
          <div>
            <h3>2. 排版系统规范 (Typography System)</h3>
            <p>基于稳定的字号、行高和字重组合，提供 6 级标题规范与正文角色，驱动统一的信息阅读节奏</p>
          </div>
          <div class="wb-density-toggles">
            <span class="wb-label">阅读密度:</span>
            <button type="button" class="hub-chip" data-typo-density="compact">紧凑 Compact (1.2x)</button>
            <button type="button" class="hub-chip is-active" data-typo-density="comfortable">舒适 Comfortable (1.5x)</button>
            <button type="button" class="hub-chip" data-typo-density="spacious">宽松 Spacious (1.8x)</button>
          </div>
        </div>

        <div class="wb-typo-table">
          <div class="wb-typo-row wb-typo-head">
            <span>角色 (Role)</span>
            <span>字号 (Font Size)</span>
            <span>行高 (Line Height)</span>
            <span>字重 (Weight)</span>
            <span>视觉样本 (Specimen Preview)</span>
          </div>
          ${(demo.typography || []).map(t => `
            <div class="wb-typo-row">
              <span class="wb-typo-role">
                <strong>${t.name.toUpperCase()}</strong>
                <button type="button" class="hub-mini-copy" onclick="copyTokenText('var(${t.size.cssVariable})')">复制</button>
              </span>
              <span><code>${t.size.resolvedValue}</code><small>(${t.size.name})</small></span>
              <span><code>${t["line-height"].resolvedValue}</code><small>(${t["line-height"].name})</small></span>
              <span><code>${t.weight.resolvedValue}</code><small>(${t.weight.name})</small></span>
              <span class="wb-typo-sample" style="font-size: var(${t.size.cssVariable}); line-height: var(${t["line-height"].cssVariable}); font-weight: var(${t.weight.cssVariable});">
                企业级设计变量规范与交付体系
              </span>
            </div>
          `).join("")}
        </div>
      </section>

      <!-- Spacing Scale Section -->
      <section class="wb-card">
        <div class="wb-card-header">
          <div>
            <h3>3. 间距与尺寸标尺 (Spacing Scale)</h3>
            <p>12 档标准间距刻度 (spacing-0 到 spacing-11)，控制组件内外留白与布局韵律</p>
          </div>
        </div>

        <div class="wb-spacing-scale">
          ${(demo.spacing || []).map(s => `
            <div class="wb-space-row" onclick="copyTokenText('var(${s.cssVariable})', '${s.name}')" title="点击复制 var(${s.cssVariable})">
              <code class="wb-space-name">${s.name}</code>
              <div class="wb-space-track">
                <div class="wb-space-bar" style="width: min(${s.resolvedValue === '0' ? '2px' : s.resolvedValue}, 100%);"></div>
              </div>
              <strong class="wb-space-val">${s.resolvedValue}</strong>
              <button type="button" class="hub-mini-copy">复制</button>
            </div>
          `).join("")}
        </div>
      </section>

      <!-- Shape & Radius Section -->
      <section class="wb-card">
        <div class="wb-card-header">
          <div>
            <h3>4. 圆角与边框系统 (Shape & Radius)</h3>
            <p>形态跟随对象职责（微圆角至胶囊角），边框提供 1px 与 2px 物理分界</p>
          </div>
        </div>

        <div class="wb-radius-grid">
          ${(demo.radius || []).map(r => `
            <div class="wb-radius-card" style="border-radius: var(${r.cssVariable});" onclick="copyTokenText('var(${r.cssVariable})', '${r.name}')" title="点击复制 var(${r.cssVariable})">
              <strong>${r.name.replace("radius-", "R-").toUpperCase()}</strong>
              <code>${r.resolvedValue}</code>
              <small>${r.cssVariable}</small>
            </div>
          `).join("")}
        </div>
      </section>

      <!-- Elevation & Layer Stack -->
      <section class="wb-card">
        <div class="wb-card-header">
          <div>
            <h3>5. 阴影、透明度与覆盖层级 (Effects & Layers)</h3>
            <p>清晰的 Z-Index 堆叠与 3D 纵深层级，保证浮层、弹窗与提示的层序安全</p>
          </div>
        </div>

        <div class="wb-effects-container">
          <!-- Shadows -->
          <div class="wb-effect-block">
            <div class="wb-block-title">阴影深度 (Shadows)</div>
            <div class="wb-shadow-list">
              ${(demo.shadows || []).map(sh => `
                <div class="wb-shadow-card" style="box-shadow: var(${sh.cssVariable});" onclick="copyTokenText('var(${sh.cssVariable})', '${sh.name}')" title="点击复制 var(${sh.cssVariable})">
                  <strong>${sh.name}</strong>
                  <code>${sh.resolvedValue}</code>
                </div>
              `).join("")}
            </div>
          </div>

          <!-- Layer Stack -->
          <div class="wb-effect-block">
            <div class="wb-block-title">Z-Index 覆盖层级 (Layers)</div>
            <div class="wb-layer-stack">
              ${(demo.layers || []).map(ly => `
                <div class="wb-layer-item" onclick="copyTokenText('var(${ly.cssVariable})', '${ly.name}')" title="点击复制 var(${ly.cssVariable})">
                  <span class="wb-layer-name">${ly.name}</span>
                  <code class="wb-layer-var">${ly.cssVariable}</code>
                  <strong class="wb-layer-val">${ly.resolvedValue}</strong>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      </section>

      <!-- Motion Section -->
      <section class="wb-card">
        <div class="wb-card-header">
          <div>
            <h3>6. 动效时间与缓动曲线 (Motion System)</h3>
            <p>点击按钮实时体验不同时间与缓动曲线的交互反馈动效</p>
          </div>
        </div>

        <div class="wb-motion-list">
          ${(demo.motions || []).map(m => `
            <div class="wb-motion-row" id="motion-row-${m.name}">
              <div class="wb-motion-info">
                <strong>${m.name.toUpperCase()}</strong>
                <small>时长: ${m.duration.resolvedValue} · 曲线: ${m.easing.resolvedValue}</small>
              </div>
              <div class="wb-motion-stage">
                <div class="wb-motion-box" style="transition: transform ${m.duration.resolvedValue} ${m.easing.resolvedValue};"></div>
              </div>
              <button type="button" class="hub-motion-btn" onclick="triggerMotion('motion-row-${m.name}')">播放动效</button>
            </div>
          `).join("")}
        </div>
      </section>
    `;

    // Interactive Color Ramp Switcher
    const rampContainer = document.getElementById("wb-color-ramp-canvas");
    let currentPaletteMode = "base";

    function updateColorRamps() {
      if (currentPaletteMode === "p9") {
        const p9 = demo.project9Palette?.palettes?.base || [];
        if (!p9.length) {
          rampContainer.innerHTML = "<p>项目9色板暂未加载</p>";
          return;
        }
        rampContainer.innerHTML = p9.map(f => `
          <div class="wb-ramp-family">
            <div class="wb-family-name">
              <strong>${f.family.toUpperCase()}</strong>
              <small>候选 OKLCH 阶梯</small>
            </div>
            <div class="wb-swatch-ramp">
              ${f.swatches.map(s => {
                const val = s.cssValue || s.resolvedValue;
                return `
                  <div class="wb-swatch-item" style="background:${val};" onclick="copyTokenText('${s.cssVariable}', '${s.step}')" title="${s.cssVariable}: ${val}">
                    <span style="color:${s.step > 6 ? '#fff' : '#000'}">${s.step}</span>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `).join("");
        return;
      }

      // Catalog Ramps
      const activeFamilyList = colorFamilies;
      const targetMap = currentPaletteMode === "dark" ? mapPalettes.dark : mapPalettes.base;

      rampContainer.innerHTML = activeFamilyList.map(fam => {
        const swatches = targetMap[fam] || [];
        if (!swatches.length) return "";
        return `
          <div class="wb-ramp-family">
            <div class="wb-family-name">
              <strong>${fam.toUpperCase()}</strong>
              <small>${fam === "gray" ? "1-20 阶" : "0-11 阶"}</small>
            </div>
            <div class="wb-swatch-ramp">
              ${swatches.map(s => {
                const hex = s.resolvedValue;
                const fg = getContrastColor(hex);
                const stepNum = s.name.split("-").pop();
                return `
                  <div class="wb-swatch-item" style="background:${hex}; color:${fg};" onclick="copyTokenText('var(${s.cssVariable})', '${s.name}')" title="${s.cssVariable}: ${hex}">
                    <span>${stepNum}</span>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `;
      }).join("");
    }

    document.getElementById("wb-mode-base").addEventListener("click", function () {
      currentPaletteMode = "base";
      document.querySelectorAll(".wb-palette-modes .hub-chip").forEach(c => c.classList.remove("is-active"));
      this.classList.add("is-active");
      updateColorRamps();
    });

    document.getElementById("wb-mode-dark").addEventListener("click", function () {
      currentPaletteMode = "dark";
      document.querySelectorAll(".wb-palette-modes .hub-chip").forEach(c => c.classList.remove("is-active"));
      this.classList.add("is-active");
      updateColorRamps();
    });

    document.getElementById("wb-mode-p9").addEventListener("click", function () {
      currentPaletteMode = "p9";
      document.querySelectorAll(".wb-palette-modes .hub-chip").forEach(c => c.classList.remove("is-active"));
      this.classList.add("is-active");
      updateColorRamps();
    });

    updateColorRamps();

    // Motion trigger
    window.triggerMotion = function (rowId) {
      const row = document.getElementById(rowId);
      if (!row) return;
      const box = row.querySelector(".wb-motion-box");
      if (!box) return;
      box.style.transform = "translateX(160px)";
      setTimeout(() => {
        box.style.transform = "translateX(0)";
      }, 500);
    };

    // Density toggle
    document.querySelectorAll("[data-typo-density]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-typo-density]").forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        const density = btn.dataset.typoDensity;
        const mult = density === "compact" ? 1.2 : density === "spacious" ? 1.8 : 1.5;
        document.querySelectorAll(".wb-typo-sample").forEach(s => {
          s.style.lineHeight = mult;
        });
      });
    });
  }

  // --------------------------------------------------------------------------
  // Tab 4: Scene Tokens Showcase (19 Tokens from JSON)
  // --------------------------------------------------------------------------
  function renderScene(container, catalog) {
    const tokens = catalog.tokens || [];
    const sceneTokens = tokens.filter(t => t.layer === "semantic" && t.tier === "scene");

    container.innerHTML = `
      <div class="hub-header">
        <h2 class="hub-section-title">场景语义规范 (Semantic Scene Tokens)</h2>
        <p class="hub-section-sub">全量展示 19 个 <code>--fds-s-*</code> 场景语义 Token，驱动通用卡片与多档阅读密度</p>
      </div>

      <!-- Live Interactive Card Demo -->
      <section class="hub-card-section">
        <div class="hub-card-preview-head">
          <div>
            <h3>交互式通用卡片组件 (Live Card Specimen)</h3>
            <p>该卡片完全由 <code>--fds-s-card-*</code> 和 <code>--fds-s-density-*</code> 驱动</p>
          </div>
          <div class="scene-density-switches">
            <span class="wb-label">密度切换:</span>
            <button type="button" class="hub-chip" id="scene-density-compact">紧凑 (Compact)</button>
            <button type="button" class="hub-chip is-active" id="scene-density-comfortable">舒适 (Comfortable)</button>
            <button type="button" class="hub-chip" id="scene-density-spacious">宽松 (Spacious)</button>
          </div>
        </div>

        <div class="scene-demo-canvas">
          <div class="fds-scene-card" id="scene-demo-card">
            <div class="fds-scene-card-header">
              <div class="fds-scene-card-title">企业客户经营与健康度分析</div>
              <span class="fds-scene-tag">核心指标</span>
            </div>
            <p class="fds-scene-card-body">
              卡片的背景色、边框宽度、圆角、内边距与间隙均直接绑定对应的 <code>--fds-s-card-*</code> Token。
              在不改变业务代码的前提下，局部重写场景 Token 即可轻松实现紧凑表格、看板或高密度大盘适配。
            </p>
            <div class="fds-scene-card-metrics">
              <div class="fds-scene-metric">
                <span class="fds-metric-num">98.5%</span>
                <span class="fds-metric-lbl">交付达成率</span>
              </div>
              <div class="fds-scene-metric">
                <span class="fds-metric-num">510</span>
                <span class="fds-metric-lbl">设计变量库</span>
              </div>
              <div class="fds-scene-metric">
                <span class="fds-metric-num">100%</span>
                <span class="fds-metric-lbl">语义可追溯</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Scene Tokens Table -->
      <section class="hub-section">
        <h3 class="hub-sub-title">19 个场景语义 Token 完整清单</h3>
        <div class="hub-scene-table-wrapper">
          <table class="hub-scene-table">
            <thead>
              <tr>
                <th>Token 标识</th>
                <th>CSS 变量名</th>
                <th>原始映射值 (Formula)</th>
                <th>实时解析值 (Resolved)</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${sceneTokens.map(t => `
                <tr>
                  <td><strong>${t.name}</strong></td>
                  <td><code>${t.cssVariable}</code></td>
                  <td><code>${t.value}</code></td>
                  <td><strong>${t.resolvedValue}</strong></td>
                  <td>
                    <button type="button" class="hub-mini-copy" onclick="copyTokenText('var(${t.cssVariable})', '${t.name}')">复制变量</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;

    // Density Switching in Card Demo
    const card = document.getElementById("scene-demo-card");
    document.getElementById("scene-density-compact").addEventListener("click", function () {
      document.querySelectorAll(".scene-density-switches .hub-chip").forEach(c => c.classList.remove("is-active"));
      this.classList.add("is-active");
      card.style.padding = "var(--fds-s-density-compact-spacing, 4px) 12px";
      card.style.lineHeight = "var(--fds-s-density-compact-line-height, 1.2)";
    });

    document.getElementById("scene-density-comfortable").addEventListener("click", function () {
      document.querySelectorAll(".scene-density-switches .hub-chip").forEach(c => c.classList.remove("is-active"));
      this.classList.add("is-active");
      card.style.padding = "var(--fds-s-card-padding, 16px)";
      card.style.lineHeight = "var(--fds-s-density-comfortable-line-height, 1.5)";
    });

    document.getElementById("scene-density-spacious").addEventListener("click", function () {
      document.querySelectorAll(".scene-density-switches .hub-chip").forEach(c => c.classList.remove("is-active"));
      this.classList.add("is-active");
      card.style.padding = "var(--fds-s-content-padding, 24px)";
      card.style.lineHeight = "var(--fds-s-density-spacious-line-height, 1.8)";
    });
  }

  // --------------------------------------------------------------------------
  // Tab 5: Integration & Delivery
  // --------------------------------------------------------------------------
  function renderIntegration(container) {
    container.innerHTML = `
      <div class="hub-header">
        <h2 class="hub-section-title">工程接入与交付产物 (Integration & Assets)</h2>
        <p class="hub-section-sub">支持 Web 标准样式、压缩产物、微信小程序 WXSS 与 JSON Catalog</p>
      </div>

      <!-- Release Artifacts -->
      <section class="hub-section">
        <h3 class="hub-sub-title">生产发布产物清单 (Release Artifacts)</h3>
        <div class="hub-release-grid">
          <div class="hub-release-card">
            <div class="hub-release-icon">${ICONS.fileCode}</div>
            <div class="hub-release-meta">
              <strong>fds-global-tokens.css</strong>
              <small>Web 端全量未压缩 CSS 自定义属性</small>
            </div>
            <a class="hub-download-btn" href="./release/fds-global-tokens.css" target="_blank">查看产物</a>
          </div>

          <div class="hub-release-card">
            <div class="hub-release-icon">${ICONS.jsonFile}</div>
            <div class="hub-release-meta">
              <strong>fds-global-tokens.min.css</strong>
              <small>生产构建优化与压缩版本</small>
            </div>
            <a class="hub-download-btn" href="./release/fds-global-tokens.min.css" target="_blank">查看产物</a>
          </div>

          <div class="hub-release-card">
            <div class="hub-release-icon">${ICONS.smartphone}</div>
            <div class="hub-release-meta">
              <strong>fds-global-tokens.wxss</strong>
              <small>微信小程序专属适配样式</small>
            </div>
            <a class="hub-download-btn" href="./release/fds-global-tokens.wxss" target="_blank">查看产物</a>
          </div>

          <div class="hub-release-card">
            <div class="hub-release-icon">${ICONS.package}</div>
            <div class="hub-release-meta">
              <strong>fds-token-catalog.json</strong>
              <small>全量 510 Tokens 结构化元数据目录</small>
            </div>
            <a class="hub-download-btn" href="./release/fds-token-catalog.json" target="_blank">查看 JSON</a>
          </div>
        </div>
      </section>

      <!-- Code Snippets -->
      <section class="hub-section">
        <h3 class="hub-sub-title">代码引入方式</h3>
        <div class="hub-code-block">
          <div class="hub-code-head">
            <span>HTML 快速引入</span>
            <button type="button" class="hub-copy-btn" onclick="copyTokenText('&lt;link rel=&quot;stylesheet&quot; href=&quot;./release/fds-global-tokens.css&quot;&gt;')">复制</button>
          </div>
          <pre><code>&lt;!-- 一行引入全部 FDS Token --&gt;
&lt;link rel="stylesheet" href="release/fds-global-tokens.css"&gt;</code></pre>
        </div>

        <div class="hub-code-block">
          <div class="hub-code-head">
            <span>CSS 样式引用示例</span>
            <button type="button" class="hub-copy-btn" onclick="copyTokenText('.primary-btn {\n  background: var(--fds-g-color-primary);\n  color: var(--fds-g-color-text-inverse);\n  border-radius: var(--fds-g-radius-3);\n  padding: var(--fds-g-spacing-4) var(--fds-g-spacing-7);\n}')">复制</button>
          </div>
          <pre><code>.primary-btn {
  background: var(--fds-g-color-primary);
  color: var(--fds-g-color-text-inverse);
  border-radius: var(--fds-g-radius-3);
  padding: var(--fds-g-spacing-4) var(--fds-g-spacing-7);
  box-shadow: var(--fds-g-shadow-sm);
  transition: background var(--fds-g-motion-duration-2) var(--fds-g-motion-easing-2);
}

.primary-btn:hover {
  background: var(--fds-g-color-primary-hover);
}</code></pre>
        </div>
      </section>
    `;
  }

  // --------------------------------------------------------------------------
  // Tab 6: Documentation Index
  // --------------------------------------------------------------------------
  function renderDocsIndex(container) {
    const docGroups = [
      {
        title: "基础规范 (Foundations)",
        desc: "系统物理级刻度定义与设计常数",
        links: [
          { name: "色彩规范", path: "foundations/颜色.html" },
          { name: "排版与字阶", path: "foundations/排版.html" },
          { name: "间距与尺寸", path: "foundations/间距与尺寸.html" },
          { name: "圆角与边框", path: "foundations/圆角与边框.html" },
          { name: "阴影与层级", path: "foundations/阴影与层级.html" },
          { name: "动效与缓动", path: "foundations/动效.html" }
        ]
      },
      {
        title: "语义模型 (Semantics)",
        desc: "意图抽象与页面级复用模式",
        links: [
          { name: "基础语义", path: "semantics/基础语义.html" },
          { name: "场景语义", path: "semantics/场景语义.html" }
        ]
      },
      {
        title: "概念原则 (Concepts)",
        desc: "架构理论、引用约束与命名空间",
        links: [
          { name: "分层模型", path: "concepts/分层模型.html" },
          { name: "命名规则", path: "concepts/命名规则.html" },
          { name: "引用与边界", path: "concepts/引用与边界.html" }
        ]
      },
      {
        title: "工程维护 (Engineering)",
        desc: "YAML 源文件、自动化校验与持续交付",
        links: [
          { name: "YAML 源文件规范", path: "engineering/YAML源文件.html" },
          { name: "构建与一致性校验", path: "engineering/构建与校验.html" },
          { name: "版本与发布管理", path: "engineering/版本与发布.html" },
          { name: "文档维护指南", path: "engineering/文档维护.html" }
        ]
      },
      {
        title: "快速开始与接入",
        desc: "各业务工程的接入流程与迁移指南",
        links: [
          { name: "快速开始", path: "getting-started/快速开始.html" },
          { name: "ShareDev 接入", path: "getting-started/ShareDev接入.html" },
          { name: "Token 全量目录", path: "reference/Token目录.html" },
          { name: "迁移与常见问题", path: "reference/迁移与常见问题.html" }
        ]
      }
    ];

    container.innerHTML = `
      <div class="hub-header">
        <h2 class="hub-section-title">规范文档导航 (Documentation Directory)</h2>
        <p class="hub-section-sub">查阅完整的 FDS Token 体系设计原理、分层理论与开发工程手册</p>
      </div>

      <div class="hub-docs-grid">
        ${docGroups.map(group => `
          <div class="hub-docs-group-card">
            <h3>${group.title}</h3>
            <p>${group.desc}</p>
            <ul class="hub-docs-links">
              ${group.links.map(link => `
                <li><a href="${link.path}">${link.name} →</a></li>
              `).join("")}
            </ul>
          </div>
        `).join("")}
      </div>
    `;
  }

})();
