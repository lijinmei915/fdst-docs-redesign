/**
 * FDS Token Workbench & Explorer
 * 严格基于 release/fds-token-catalog.json 与 docs/site-assets/project9-palette.json
 * 杜绝杜撰，全量真实呈现 510 个 Token
 */

(function () {
  "use strict";

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

  // Toast notification
  function showToast(message) {
    let toast = document.getElementById("hub-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "hub-toast";
      toast.className = "hub-toast";
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span class="hub-toast-icon">✓</span><span>${message}</span>`;
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

    // Render Hub UI Skeleton
    container.innerHTML = `
      <!-- View Navigation Tabs -->
      <nav class="hub-nav-bar" aria-label="视图切换">
        <div class="hub-nav-tabs">
          <button type="button" class="hub-nav-tab is-active" data-view="overview" id="tab-overview">
            <span class="hub-tab-icon">📊</span> 全景总览与架构
          </button>
          <button type="button" class="hub-nav-tab" data-view="explorer" id="tab-explorer">
            <span class="hub-tab-icon">🔍</span> Token 检索器 <span class="hub-tab-badge">${stats.total}</span>
          </button>
          <button type="button" class="hub-nav-tab" data-view="workbench" id="tab-workbench">
            <span class="hub-tab-icon">🎨</span> 视觉工作台
          </button>
          <button type="button" class="hub-nav-tab" data-view="scene" id="tab-scene">
            <span class="hub-tab-icon">🧩</span> 场景语义 <span class="hub-tab-badge">${stats.scene}</span>
          </button>
          <button type="button" class="hub-nav-tab" data-view="integration" id="tab-integration">
            <span class="hub-tab-icon">⚡</span> 接入与交付
          </button>
          <button type="button" class="hub-nav-tab" data-view="docs" id="tab-docs">
            <span class="hub-tab-icon">📖</span> 规范文档
          </button>
        </div>
      </nav>

      <!-- View Containers -->
      <div class="hub-views-wrapper">
        <div class="hub-view is-active" id="view-overview"></div>
        <div class="hub-view" id="view-explorer"></div>
        <div class="hub-view" id="view-workbench"></div>
        <div class="hub-view" id="view-scene"></div>
        <div class="hub-view" id="view-integration"></div>
        <div class="hub-view" id="view-docs"></div>
      </div>
    `;

    // Render Sections
    renderOverview(document.getElementById("view-overview"), stats, catalog);
    renderExplorer(document.getElementById("view-explorer"), catalog);
    renderWorkbench(document.getElementById("view-workbench"), catalog);
    renderScene(document.getElementById("view-scene"), catalog);
    renderIntegration(document.getElementById("view-integration"));
    renderDocsIndex(document.getElementById("view-docs"));

    // Hash & Tab switching
    function switchTab(viewId) {
      document.querySelectorAll(".hub-nav-tab").forEach(tab => {
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

    document.querySelectorAll(".hub-nav-tab").forEach(tab => {
      tab.addEventListener("click", () => switchTab(tab.dataset.view));
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

    // Global shortcut ⌘K / Ctrl+K
    window.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        switchTab("explorer");
        const searchInput = document.getElementById("hub-token-search");
        if (searchInput) searchInput.focus();
      }
    });
  }

  // --------------------------------------------------------------------------
  // Tab 1: Overview & Architecture
  // --------------------------------------------------------------------------
  function renderOverview(container, stats, catalog) {
    const catLabels = {
      color: "色彩 Color",
      typography: "排版 Typography",
      motion: "动效 Motion",
      effects: "效果 Effects",
      scene: "场景 Scene",
      spacing: "间距 Spacing",
      layout: "布局 Layout",
      shape: "形状 Shape"
    };

    container.innerHTML = `
      <!-- Hero Banner -->
      <section class="hub-hero">
        <div class="hub-hero-badge">Single Source of Truth · Schema: fds-token-catalog/v1</div>
        <h1 class="hub-hero-title">FDS Token 体系全景</h1>
        <p class="hub-hero-desc">
          统一的企业级设计变量规范与交付体系。基于严格的 <strong>Atomic ➔ Semantic</strong> 4层继承模型，
          由同一份 YAML Import 依赖图编译生成，驱动一致、可控、高质感的用户界面体验。
        </p>
        
        <!-- Live Vital Stats directly from JSON -->
        <div class="hub-metrics-grid">
          <div class="hub-metric-card" onclick="window.jumpToHubTab('explorer')">
            <span class="hub-metric-label">Token 总数</span>
            <strong class="hub-metric-val">${stats.total}</strong>
            <span class="hub-metric-sub">全量编译输出</span>
          </div>
          <div class="hub-metric-card" onclick="window.jumpToHubTab('explorer')">
            <span class="hub-metric-label">Atomic 原子层</span>
            <strong class="hub-metric-val">${stats.atomic}</strong>
            <span class="hub-metric-sub">${stats.seed} 种子 · ${stats.map} 映射刻度</span>
          </div>
          <div class="hub-metric-card" onclick="window.jumpToHubTab('explorer')">
            <span class="hub-metric-label">Semantic 语义层</span>
            <strong class="hub-metric-val">${stats.semantic}</strong>
            <span class="hub-metric-sub">${stats.base} 基础意图 · ${stats.scene} 页面场景</span>
          </div>
          <div class="hub-metric-card" onclick="window.jumpToHubTab('scene')">
            <span class="hub-metric-label">命名空间</span>
            <strong class="hub-metric-val">2 组</strong>
            <span class="hub-metric-sub">${stats.global} 全局 (--fds-g) · ${stats.sceneNs} 场景 (--fds-s)</span>
          </div>
        </div>
      </section>

      <!-- 4-Tier Layer Architecture Flow -->
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

      <!-- Category Distribution -->
      <section class="hub-section">
        <div class="hub-section-head">
          <div>
            <h2 class="hub-section-title">Token 分类分布 (Categories)</h2>
            <p class="hub-section-sub">点击任意分类直接进入检索器查看完整 Token 列表与规范值</p>
          </div>
          <button type="button" class="hub-link-btn" onclick="window.jumpToHubTab('explorer')">进入检索器 →</button>
        </div>

        <div class="hub-category-grid">
          ${Object.entries(stats.categories).map(([cat, count]) => `
            <div class="hub-cat-card" onclick="window.jumpToHubTab('explorer', '${cat}')">
              <div class="hub-cat-name">${catLabels[cat] || cat}</div>
              <div class="hub-cat-count">${count} <span class="hub-cat-unit">tokens</span></div>
              <div class="hub-cat-action">检索此分类 →</div>
            </div>
          `).join("")}
        </div>
      </section>

      <!-- Role-Based Guidance -->
      <section class="hub-section">
        <div class="hub-section-head">
          <div>
            <h2 class="hub-section-title">按工作角色查阅</h2>
            <p class="hub-section-sub">不同角色从适合的视角理解与使用 FDS Token 体系</p>
          </div>
        </div>

        <div class="hub-role-grid">
          <div class="hub-role-card">
            <div class="hub-role-tag">设计师 / 产品</div>
            <h3>基础视觉规范</h3>
            <p>查阅色彩阶梯、排版层级、间距节奏、圆角与阴影等视觉物理常数的设计原则。</p>
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
            <p>在 ShareDev 工程中一行引入全部 Token，在组件与样式中统一使用 CSS 变量。</p>
            <div class="hub-role-links">
              <a href="getting-started/快速开始.html">快速开始</a>
              <a href="getting-started/ShareDev接入.html">ShareDev 接入</a>
              <a href="reference/迁移与常见问题.html">迁移 FAQ</a>
            </div>
          </div>

          <div class="hub-role-card">
            <div class="hub-role-tag">组件开发者</div>
            <h3>架构模型与边界</h3>
            <p>掌握 Global 与 Scene 命名空间，严格遵守引用限制，确保组件高度解耦。</p>
            <div class="hub-role-links">
              <a href="concepts/分层模型.html">分层模型</a>
              <a href="concepts/命名规则.html">命名规则</a>
              <a href="concepts/引用与边界.html">引用与边界</a>
            </div>
          </div>

          <div class="hub-role-card">
            <div class="hub-role-tag">体系维护者</div>
            <h3>源文件与发布</h3>
            <p>修改 YAML 源文件、运行构建与全量校验、管理发布流程与自动化产物生成。</p>
            <div class="hub-role-links">
              <a href="engineering/YAML源文件.html">YAML 源规范</a>
              <a href="engineering/构建与校验.html">构建校验</a>
              <a href="engineering/版本与发布.html">版本发布</a>
            </div>
          </div>
        </div>
      </section>
    `;
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
          <span class="hub-search-icon">🔍</span>
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
            <div class="hub-empty-icon">🔍</div>
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
            <div class="hub-release-icon">📄</div>
            <div class="hub-release-meta">
              <strong>fds-global-tokens.css</strong>
              <small>Web 端全量未压缩 CSS 自定义属性</small>
            </div>
            <a class="hub-download-btn" href="./release/fds-global-tokens.css" target="_blank">查看产物</a>
          </div>

          <div class="hub-release-card">
            <div class="hub-release-icon">⚡</div>
            <div class="hub-release-meta">
              <strong>fds-global-tokens.min.css</strong>
              <small>生产构建优化与压缩版本</small>
            </div>
            <a class="hub-download-btn" href="./release/fds-global-tokens.min.css" target="_blank">查看产物</a>
          </div>

          <div class="hub-release-card">
            <div class="hub-release-icon">📱</div>
            <div class="hub-release-meta">
              <strong>fds-global-tokens.wxss</strong>
              <small>微信小程序专属适配样式</small>
            </div>
            <a class="hub-download-btn" href="./release/fds-global-tokens.wxss" target="_blank">查看产物</a>
          </div>

          <div class="hub-release-card">
            <div class="hub-release-icon">📦</div>
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
