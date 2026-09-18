(function () {
  "use strict";

  function contrastColor(value) {
    const match = value.match(/^#([0-9a-f]{6})$/i);
    if (!match) return "var(--fds-g-color-text-primary)";
    const number = Number.parseInt(match[1], 16);
    const red = number >> 16;
    const green = (number >> 8) & 255;
    const blue = number & 255;
    return (red * 299 + green * 587 + blue * 114) / 1000 > 150
      ? "var(--fds-g-color-text-primary)"
      : "var(--fds-g-color-text-inverse)";
  }

  function frame(title, detail, content, controls = "") {
    return `<div class="demo-frame">
      <div class="demo-toolbar"><div><strong>${title}</strong>${detail ? `<br><small>${detail}</small>` : ""}</div>${controls}</div>
      <div class="demo-canvas">${content}</div>
    </div>`;
  }

  function renderOverview() {
    const count = window.FDS_DOCS_META?.tokenCount || "-";
    const layers = [
      ["01", "Atomic / Seed", "保存最小输入，不直接进入业务页面"],
      ["02", "Atomic / Map", "形成固定、可复用的物理刻度"],
      ["03", "Semantic / Base", "表达跨页面稳定的使用意图"],
      ["04", "Semantic / Scene", "组合通用页面场景，不侵入组件"],
    ];
    const content = `<div class="architecture-flow">${layers.map(([number, title, description]) => `<section><span>${number}</span><strong>${title}</strong><p>${description}</p></section>`).join("")}</div>`;
    return frame("Token 分层", `${count} 个 Token 由同一 YAML import 图生成`, content);
  }

  function renderSemanticColors() {
    const actionStates = window.FDS_DEMO_DATA?.primaryColors || [];
    const statuses = window.FDS_DEMO_DATA?.statusColors || [];
    if (!actionStates.length || !statuses.length) return frame("语义颜色", "数据来自当前 Catalog", "<p>语义颜色数据未加载，请刷新页面。</p>");
    const action = `<div class="semantic-action">
      <div class="semantic-action-label"><strong>Primary action</strong><span>同一意图的四个交互状态</span></div>
      ${actionStates.map(({ name, cssVariable, resolvedValue }) => {
        const state = name.slice("color-primary-".length);
        const label = name === "color-primary" ? "Default" : state[0].toUpperCase() + state.slice(1);
        return `<div class="semantic-state" style="--demo-color: var(${cssVariable}); --demo-foreground: ${contrastColor(resolvedValue)}"><span>${label}</span><code>${resolvedValue}</code></div>`;
      }).join("")}
    </div>`;
    const status = `<div class="status-grid">${statuses.map(({ name, color, background }) => `
      <div class="status-sample" style="--status-color: var(${color.cssVariable}); --status-bg: var(${background.cssVariable}); --status-border: var(${color.cssVariable})">
        <strong>${name[0].toUpperCase() + name.slice(1)}</strong><div></div>
      </div>`).join("")}</div>`;
    return frame("语义颜色", "先选用途，再使用对应状态组", action + status);
  }

  function paletteMarkup(mode) {
    const preview = window.FDS_DEMO_DATA?.project9Palette;
    const families = preview?.palettes?.[mode] || [];
    if (!families.length) return '<p>色板数据未加载，请刷新页面。</p>';
    return `<p class="palette-source">项目9本地评审色板 · 临时预览，尚未写入公司 Token</p><div class="palette-list">${families.map(({ family, swatches }) => {
      const representativeStep = family === "brand" ? 7 : 8;
      const representative = swatches.find((swatch) => swatch.step === representativeStep) || swatches[0];
      const representativeValue = representative.cssValue || representative.resolvedValue;
      return `<section class="palette-family">
        <div class="palette-family-head"><strong>${family.replaceAll("-", " ")}</strong><code>${representative.cssVariable} · ${representativeValue.startsWith("#") ? representativeValue : "OKLCH"}</code></div>
        <div class="palette-ramp" style="--palette-steps: ${swatches.length}">${swatches.map(({ step, cssVariable, cssValue, resolvedValue }) => {
          const value = cssValue || resolvedValue;
          const foreground = value.startsWith("#") ? contrastColor(value) : ((mode === "dark" && step < 10) || (mode === "base" && step >= 9)) ? "var(--fds-g-color-text-inverse)" : "var(--fds-g-color-text-primary)";
          return `<button class="palette-chip" type="button" data-copy-token="${cssVariable}" title="${cssVariable}: ${value}" style="--chip-color: ${value}; --chip-foreground: ${foreground}">${step}</button>`;
        }).join("")}</div>
      </section>`;
    }).join("")}</div>`;
  }

  function renderPalette(container) {
    const controls = `<div class="demo-segmented" aria-label="色板模式">
      <button type="button" data-palette-mode="base" aria-pressed="true">Base</button>
      <button type="button" data-palette-mode="dark" aria-pressed="false">Dark Map</button>
    </div>`;
    container.innerHTML = frame("色阶色板", "项目9方案供评审预览，点击色块复制项目9变量名", '<div data-palette-canvas></div>', controls);
    const canvas = container.querySelector("[data-palette-canvas]");
    let mode = "base";
    const update = () => {
      canvas.innerHTML = paletteMarkup(mode);
      container.querySelectorAll("[data-palette-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.paletteMode === mode)));
    };
    container.addEventListener("click", (event) => {
      const modeButton = event.target.closest("[data-palette-mode]");
      if (modeButton) mode = modeButton.dataset.paletteMode;
      if (modeButton) update();
    });
    update();
  }

  function renderTypography() {
    const recipes = window.FDS_DEMO_DATA?.typography || [];
    if (!recipes.length) return frame("排版角色", "数据来自当前 Catalog", "<p>排版数据未加载，请刷新页面。</p>");
    const content = `<div class="type-specimen">
      <aside class="type-index"><strong>文本角色</strong>${recipes.map(({ name }) => `<span>${name === "text" ? "Text / 正文" : name.replace("heading-", "Heading ")}</span>`).join("")}</aside>
      <div class="type-sheet">
        <span class="eyebrow">客户经营概览</span>
        <h2>让信息层级先于装饰</h2>
        <p>稳定的字号、行高和字重组合，让业务信息在不同页面中保持一致的阅读节奏。</p>
        <h3>本月关键数据</h3>
        <h4>核心指标</h4>
        <div class="type-metrics"><div class="type-metric"><strong>128</strong><span>活跃客户</span></div><div class="type-metric"><strong>76%</strong><span>目标完成率</span></div><div class="type-metric"><strong>24</strong><span>待跟进事项</span></div></div>
      </div>
    </div><div class="type-recipes">${recipes.map((recipe) => `<div class="type-recipe" style="--recipe-size:var(${recipe.size.cssVariable});--recipe-line-height:var(${recipe["line-height"].cssVariable});--recipe-weight:var(${recipe.weight.cssVariable})"><strong>${recipe.name === "text" ? "Text" : recipe.name.replace("heading-", "Heading ")}</strong><span>让信息层级清晰可读</span><code>${recipe.size.resolvedValue} / ${recipe["line-height"].resolvedValue} / ${recipe.weight.resolvedValue}</code></div>`).join("")}</div>`;
    return frame("排版角色", "角色、字号、行高和字重来自当前 Catalog JSON", content);
  }

  function renderSpacing() {
    const scales = window.FDS_DEMO_DATA?.spacing || [];
    if (!scales.length) return frame("间距", "数据来自当前 Catalog", "<p>间距数据未加载，请刷新页面。</p>");
    const rows = scales.map(({ name, cssVariable, resolvedValue }) => `<div class="spacing-row"><code>${name}</code><div class="spacing-track"><div class="spacing-value" style="--space-value: var(${cssVariable})"></div></div><span>${resolvedValue}</span></div>`).join("");
    return frame("间距", "通用页面与内容组合的留白节奏", `<div class="spacing-scale">${rows}</div>`);
  }

  function renderRadius() {
    const radii = window.FDS_DEMO_DATA?.radius || [];
    if (!radii.length) return frame("圆角层级", "圆角数据来自当前 Catalog", "<p>圆角数据未加载，请刷新页面。</p>");
    const content = `<div class="radius-grid">${radii.map(({ name, cssVariable, resolvedValue }) => {
      const label = name === "radius-full" ? "Full" : resolvedValue === "0" ? "None" : resolvedValue;
      return `<div class="radius-sample" style="--sample-radius: var(${cssVariable})"><strong>${label}</strong><code>${cssVariable}</code></div>`;
    }).join("")}</div>`;
    return frame("圆角层级", "形态跟随对象职责，不按装饰偏好选择", content);
  }

  function renderEffects() {
    const shadows = window.FDS_DEMO_DATA?.shadows || [];
    const opacities = (window.FDS_DEMO_DATA?.opacity || []).filter(({ resolvedValue }) => Number(resolvedValue) > 0);
    const layers = (window.FDS_DEMO_DATA?.layers || []).filter(({ name }) => name !== "layer-base");
    if (!shadows.length || !opacities.length || !layers.length) return frame("效果与层级", "数据来自当前 Catalog", "<p>效果数据未加载，请刷新页面。</p>");
    const content = `
      <section class="effects-section"><strong>阴影表达层级</strong><div class="shadow-grid">${shadows.map(({ name, cssVariable }) => `<div class="shadow-sample" style="--sample-shadow: var(${cssVariable})"><strong>${name === "shadow-none" ? "Static" : name.slice("shadow-".length).replace(/\b\w/g, (letter) => letter.toUpperCase())}</strong><code>${cssVariable}</code></div>`).join("")}</div></section>
      <section class="effects-section"><strong>透明度档位</strong><div class="opacity-scale">${opacities.map(({ cssVariable, resolvedValue }) => `<div class="opacity-sample" style="--sample-opacity: var(${cssVariable})">${Math.round(Number(resolvedValue) * 100)}%</div>`).join("")}</div></section>
      <section class="effects-section"><strong>覆盖层级</strong><div class="layer-stack">${layers.map(({ name, cssVariable, resolvedValue }) => `<div class="layer-row"><strong>${name.slice("layer-".length).replace(/\b\w/g, (letter) => letter.toUpperCase())}</strong><code>${cssVariable}</code><span>${resolvedValue}+</span></div>`).join("")}</div></section>`;
    return frame("效果与层级", "阴影、透明度和 z-index 各自表达不同维度", content);
  }

  function renderMotion(container) {
    const motions = window.FDS_DEMO_DATA?.motions || [];
    if (!motions.length) {
      container.innerHTML = frame("语义动效", "数据来自当前 Catalog", "<p>动效数据未加载，请刷新页面。</p>");
      return;
    }
    const content = `<div class="motion-list">${motions.map(({ name, duration, easing }) => `<div class="motion-row" style="--motion-duration: var(${duration.cssVariable}); --motion-easing: var(${easing.cssVariable})"><span>${name[0].toUpperCase() + name.slice(1)}</span><div class="motion-track"><div class="motion-dot"></div></div><span>${duration.resolvedValue}</span></div>`).join("")}</div>`;
    container.innerHTML = frame("语义动效", "四类任务使用不同的时长与缓动", content, '<button class="motion-play" type="button" data-motion-play>播放</button>');
    container.querySelector("[data-motion-play]")?.addEventListener("click", () => {
      const rows = container.querySelectorAll(".motion-row");
      rows.forEach((row) => row.classList.remove("is-playing"));
      requestAnimationFrame(() => requestAnimationFrame(() => rows.forEach((row) => row.classList.add("is-playing"))));
    });
  }

  function mount(container, name) {
    if (name === "overview") container.innerHTML = renderOverview();
    if (name === "semantic-colors") container.innerHTML = renderSemanticColors();
    if (name === "palette") renderPalette(container);
    if (name === "typography") container.innerHTML = renderTypography();
    if (name === "spacing") container.innerHTML = renderSpacing();
    if (name === "radius") container.innerHTML = renderRadius();
    if (name === "effects") container.innerHTML = renderEffects();
    if (name === "motion") renderMotion(container);
    if (name === "workbench") {
      container.innerHTML = `<div class="workbench-intro"><div class="workbench-stat"><strong>${window.FDS_DOCS_META?.tokenCount || "CSS"}</strong><span>当前 Token 资产</span></div><div class="workbench-stat"><strong>4 层</strong><span>Seed / Map / Base / Scene</span></div><div class="workbench-stat"><strong>CSS</strong><span>页面与组件运行时入口</span></div></div>
        <div id="foundation" class="fds-demo" data-demo="typography"></div>
        <div class="fds-demo" data-demo="spacing"></div>
        <div class="fds-demo" data-demo="radius"></div>
        <div class="fds-demo" data-demo="effects"></div>
        <div class="fds-demo" data-demo="motion"></div>
        <div id="colors" class="fds-demo" data-demo="semantic-colors"></div>
        <div class="fds-demo" data-demo="palette"></div>`;
      container.querySelectorAll("[data-demo]").forEach((child) => mount(child, child.dataset.demo));
    }
  }

  document.querySelectorAll("[data-demo]").forEach((container) => mount(container, container.dataset.demo));

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy-token]");
    if (!button) return;
    const token = button.dataset.copyToken;
    try { await navigator.clipboard.writeText(token); } catch { /* title remains available as fallback */ }
    const previous = button.textContent;
    button.textContent = "OK";
    window.setTimeout(() => { button.textContent = previous; }, 900);
  });
})();
