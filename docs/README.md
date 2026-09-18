---
layer: knowledge
type: index
last_verified: 2026-09-18
teaches: "FDS Token 的角色入口、色板预览、分层架构与 CSS 接入方式"
use_when: "查询颜色、排版、间距、圆角、阴影、动效或接入 FDS CSS 时"
---

<section class="proto-hero" markdown="1">

# FDS Token

统一的设计 Token 体系。从种子色到场景语义，四层架构驱动一致的用户体验。

</section>

<section class="proto-role-grid" aria-label="按角色开始">
  <div class="proto-role-card">
    <div class="proto-role-tag">设计师 / 产品</div>
    <h2>视觉规范</h2>
    <p>了解颜色、排版、间距等基础规范的设计原则和使用场景。</p>
    <div class="proto-role-links">
      <a class="proto-role-link" href="foundations/颜色.html">颜色</a>
      <a class="proto-role-link" href="foundations/排版.html">排版</a>
      <a class="proto-role-link" href="foundations/间距与尺寸.html">间距</a>
    </div>
  </div>
  <div class="proto-role-card">
    <div class="proto-role-tag">业务开发者</div>
    <h2>快速接入</h2>
    <p>一行 CSS 引入全部 Token，在 ShareDev 工程中直接使用。</p>
    <div class="proto-role-links">
      <a class="proto-role-link" href="getting-started/快速开始.html">快速开始</a>
      <a class="proto-role-link" href="getting-started/ShareDev接入.html">ShareDev 接入</a>
    </div>
  </div>
  <div class="proto-role-card">
    <div class="proto-role-tag">组件开发者</div>
    <h2>架构理解</h2>
    <p>理解 Global、Scene、组件 Token 的职责边界和引用规则。</p>
    <div class="proto-role-links">
      <a class="proto-role-link" href="concepts/分层模型.html">分层模型</a>
      <a class="proto-role-link" href="concepts/引用与边界.html">引用与边界</a>
    </div>
  </div>
  <div class="proto-role-card">
    <div class="proto-role-tag">维护者</div>
    <h2>工程维护</h2>
    <p>修改 YAML 源文件、构建校验、版本管理和发布流程。</p>
    <div class="proto-role-links">
      <a class="proto-role-link" href="engineering/YAML源文件.html">YAML 源文件</a>
      <a class="proto-role-link" href="engineering/构建与校验.html">构建与校验</a>
    </div>
  </div>
</section>

<section class="proto-preview-section" aria-labelledby="palette-preview">
  <div class="proto-preview-header">
    <h2 id="palette-preview">色板预览</h2>
    <a href="reference/Token目录.html">查看完整目录 →</a>
  </div>
  <!-- fds-catalog-table:homepalette -->
</section>

<section class="proto-specs" aria-label="体系概览">
  <div class="proto-spec-card">
    <h2>架构层级</h2>
    <div class="proto-spec-row"><span>Atomic / Seed</span><span>种子色值</span></div>
    <div class="proto-spec-row"><span>Atomic / Map</span><span>色阶映射与原子值</span></div>
    <div class="proto-spec-row"><span>Semantic / Base</span><span>语义基础</span></div>
    <div class="proto-spec-row"><span>Semantic / Scene</span><span>场景语义</span></div>
  </div>
  <div class="proto-spec-card">
    <h2>命名空间</h2>
    <div class="proto-spec-row"><span>Global Token</span><span>--fds-g-*</span></div>
    <div class="proto-spec-row"><span>Scene Token</span><span>--fds-s-*</span></div>
    <div class="proto-spec-row"><span>Component</span><span>组件包维护</span></div>
    <div class="proto-spec-row"><span>Private</span><span>业务作用域</span></div>
  </div>
</section>

<pre class="proto-code-block"><code><span class="comment">/* 一行引入，即可使用全部 Token */</span>
<span class="keyword">&lt;link</span> <span class="prop">rel=</span><span class="string">"stylesheet"</span> <span class="prop">href=</span><span class="string">"<a href="https://git.firstshare.cn/fx/fdst/-/blob/master/release/fds-global-tokens.css">fds-global-tokens.css</a>"</span><span class="keyword">&gt;</span>

<span class="comment">/* 在样式中直接使用 */</span>
.button {
  <span class="prop">background</span>: <span class="string">var(--fds-g-color-primary)</span>;
  <span class="prop">color</span>: <span class="string">var(--fds-g-color-text-inverse)</span>;
  <span class="prop">border-radius</span>: <span class="string">var(--fds-g-radius-3)</span>;
}</code></pre>

<footer class="proto-footer">FDS Token · 设计系统文档</footer>
