(function () {
  "use strict";

  const FAMILIES = ["brand", "amber", "yellow", "yellow-green", "green", "teal", "blue", "indigo", "purple", "magenta", "red"];
  const DARK_FAMILIES = FAMILIES.filter((family) => family !== "brand");
  const STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];

  function valueOf(variable) {
    return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  }

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
    const actionStates = [
      ["Default", "--fds-g-color-primary"],
      ["Hover", "--fds-g-color-primary-hover"],
      ["Active", "--fds-g-color-primary-active"],
      ["Disabled", "--fds-g-color-primary-disabled"],
    ];
    const action = `<div class="semantic-action">
      <div class="semantic-action-label"><strong>Primary action</strong><span>同一意图的四个交互状态</span></div>
      ${actionStates.map(([label, variable]) => `<div class="semantic-state" style="--demo-color: var(${variable}); --demo-foreground: ${contrastColor(valueOf(variable))}"><span>${label}</span><code>${valueOf(variable)}</code></div>`).join("")}
    </div>`;
    const statuses = [
      ["Danger", "--fds-g-color-danger", "--fds-g-color-danger-background"],
      ["Warning", "--fds-g-color-warning", "--fds-g-color-warning-background"],
      ["Success", "--fds-g-color-success", "--fds-g-color-success-background"],
      ["Info", "--fds-g-color-info", "--fds-g-color-info-background"],
    ];
    const status = `<div class="status-grid">${statuses.map(([label, color, background]) => `
      <div class="status-sample" style="--status-color: var(${color}); --status-bg: var(${background}); --status-border: var(${color})">
        <strong>${label}</strong><div></div>
      </div>`).join("")}</div>`;
    return frame("语义颜色", "先选用途，再使用对应状态组", action + status);
  }

  function paletteMarkup(mode) {
    const families = mode === "dark" ? DARK_FAMILIES : FAMILIES;
    return `<div class="palette-list">${families.map((family) => {
      const variables = STEPS.map((step) => `--fds-g-color-${family}-${mode === "dark" ? "dark-" : ""}${step}`);
      return `<section class="palette-family">
        <div class="palette-family-head"><strong>${family.replace("-", " ")}</strong><code>${variables[8]}</code></div>
        <div class="palette-ramp">${variables.map((variable, index) => {
          const color = valueOf(variable);
          return `<button class="palette-chip" type="button" data-copy-token="${variable}" title="${variable}: ${color}" style="--chip-color: var(${variable}); --chip-foreground: ${contrastColor(color)}">${STEPS[index]}</button>`;
        }).join("")}</div>
      </section>`;
    }).join("")}</div>`;
  }

  function renderPalette(container) {
    const controls = `<div class="demo-segmented" aria-label="色板模式">
      <button type="button" data-palette-mode="base" aria-pressed="true">Base</button>
      <button type="button" data-palette-mode="dark" aria-pressed="false">Dark Map</button>
    </div>`;
    container.innerHTML = frame("固定色板", "每个色系 12 阶，点击色块复制变量名", '<div data-palette-canvas></div>', controls);
    const canvas = container.querySelector("[data-palette-canvas]");
    const update = (mode) => {
      canvas.innerHTML = paletteMarkup(mode);
      container.querySelectorAll("[data-palette-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.paletteMode === mode)));
    };
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-palette-mode]");
      if (button) update(button.dataset.paletteMode);
    });
    update("base");
  }

  function renderTypography() {
    const content = `<div class="type-specimen">
      <aside class="type-index"><strong>文本角色</strong><span>Heading 1 / 页面标题</span><span>Heading 3 / 区块标题</span><span>Heading 6 / 小节标题</span><span>Text / 正文</span></aside>
      <div class="type-sheet">
        <span class="eyebrow">客户经营概览</span>
        <h2>让信息层级先于装饰</h2>
        <p>稳定的字号、行高和字重组合，让业务信息在不同页面中保持一致的阅读节奏。</p>
        <h3>本月关键数据</h3>
        <h4>核心指标</h4>
        <div class="type-metrics"><div class="type-metric"><strong>128</strong><span>活跃客户</span></div><div class="type-metric"><strong>76%</strong><span>目标完成率</span></div><div class="type-metric"><strong>24</strong><span>待跟进事项</span></div></div>
      </div>
    </div>`;
    return frame("排版角色", "同一业务片段中的标题、正文与数据", content);
  }

  function renderSpacing() {
    const scales = [["1", "4px"], ["2", "8px"], ["3", "12px"], ["4", "16px"], ["5", "20px"], ["6", "24px"], ["7", "32px"], ["8", "48px"]];
    const rows = scales.map(([token, value]) => `<div class="spacing-row"><code>spacing-${token}</code><div class="spacing-track"><div class="spacing-value" style="--space-value: var(--fds-g-spacing-${token})"></div></div><span>${value}</span></div>`).join("");
    return frame("间距", "通用页面与内容组合的留白节奏", `<div class="spacing-scale">${rows}</div>`);
  }

  function renderRadius() {
    const radii = [["None", "--fds-g-radius-0"], ["4px", "--fds-g-radius-2"], ["8px", "--fds-g-radius-4"], ["Full", "--fds-g-radius-full"]];
    const content = `<div class="radius-grid">${radii.map(([label, variable]) => `<div class="radius-sample" style="--sample-radius: var(${variable})"><strong>${label}</strong><code>${variable}</code></div>`).join("")}</div>`;
    return frame("圆角层级", "形态跟随对象职责，不按装饰偏好选择", content);
  }

  function renderEffects() {
    const shadows = [["Static", "--fds-g-shadow-none"], ["Active", "--fds-g-shadow-active"], ["Drag", "--fds-g-shadow-drag"], ["Dropdown", "--fds-g-shadow-dropdown"]];
    const opacities = [["25%", "--fds-g-opacity-25"], ["50%", "--fds-g-opacity-50"], ["65%", "--fds-g-opacity-65"], ["80%", "--fds-g-opacity-80"], ["100%", "--fds-g-opacity-100"]];
    const layers = [["Sticky", "--fds-g-layer-sticky", "100"], ["Popup", "--fds-g-layer-popup", "1000"], ["Overlay", "--fds-g-layer-overlay", "4000"], ["Modal", "--fds-g-layer-modal", "5000"], ["Feedback", "--fds-g-layer-feedback", "9000"]];
    const content = `
      <section class="effects-section"><strong>阴影表达层级</strong><div class="shadow-grid">${shadows.map(([label, variable]) => `<div class="shadow-sample" style="--sample-shadow: var(${variable})"><strong>${label}</strong><code>${variable}</code></div>`).join("")}</div></section>
      <section class="effects-section"><strong>透明度档位</strong><div class="opacity-scale">${opacities.map(([label, variable]) => `<div class="opacity-sample" style="--sample-opacity: var(${variable})">${label}</div>`).join("")}</div></section>
      <section class="effects-section"><strong>覆盖层级</strong><div class="layer-stack">${layers.map(([label, variable, start]) => `<div class="layer-row"><strong>${label}</strong><code>${variable}</code><span>${start}+</span></div>`).join("")}</div></section>`;
    return frame("效果与层级", "阴影、透明度和 z-index 各自表达不同维度", content);
  }

  function renderMotion(container) {
    const motions = [
      ["Feedback", "--fds-g-motion-feedback-duration", "--fds-g-motion-feedback-easing", "100ms"],
      ["Context", "--fds-g-motion-context-duration", "--fds-g-motion-context-enter-easing", "200ms"],
      ["Disclosure", "--fds-g-motion-disclosure-duration", "--fds-g-motion-disclosure-easing", "300ms"],
      ["Prominent", "--fds-g-motion-prominent-duration", "--fds-g-motion-prominent-enter-easing", "400ms"],
    ];
    const content = `<div class="motion-list">${motions.map(([label, duration, easing, value]) => `<div class="motion-row" style="--motion-duration: var(${duration}); --motion-easing: var(${easing})"><span>${label}</span><div class="motion-track"><div class="motion-dot"></div></div><span>${value}</span></div>`).join("")}</div>`;
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
