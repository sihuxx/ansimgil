/* 안심길 미니 런타임
 * 프로토타입의 템플릿 문법({{값}}, <sc-if>, <sc-for>, onClick)을
 * 일반 브라우저에서 그대로 그려 주는 작은 렌더러.
 */
(function () {
  "use strict";

  // ── 화면 크기 맞추기: 390px 디자인을 폰 너비에 맞춰 확대·축소 ──
  function fit() {
    var app = document.getElementById("app");
    var w = window.innerWidth, h = window.innerHeight, s, appH, left = 0;
    if (w <= 520) {               // 폰: 가로를 꽉 채우고 세로 길이는 화면에 맞춤
      s = w / 390; appH = h / s;
    } else {                      // PC: 가운데 폰 크기 미리보기
      s = Math.min(1, (h - 32) / 844); appH = 844; left = (w - 390 * s) / 2;
    }
    app.style.transform = "scale(" + s + ")";
    app.style.left = left + "px";
    app.style.top = (w <= 520 ? 0 : 16) + "px";
    app.style.setProperty("--app-h", appH + "px");
    app.style.height = appH + "px";
    document.body.classList.toggle("desktop", w > 520);
  }
  window.addEventListener("resize", fit);

  // ── 값 찾기 ──
  function lookup(scope, path) {
    path = path.trim();
    if (path === "true") return true;
    if (path === "false") return false;
    var v = scope, ks = path.split(".");
    for (var i = 0; i < ks.length; i++) { if (v == null) return undefined; v = v[ks[i]]; }
    return v;
  }
  var HOLE = /\{\{([^}]+)\}\}/g, ONLY = /^\s*\{\{([^}]+)\}\}\s*$/;
  function interp(str, scope) {
    var m = str.match(ONLY);
    if (m) return lookup(scope, m[1]);
    return str.replace(HOLE, function (_, p) { var v = lookup(scope, p); return v == null ? "" : v; });
  }
  function childScope(scope, name, val) { var s = Object.create(scope); s[name] = val; return s; }

  // ── 템플릿 → 실제 DOM ──
  function build(node, scope, out) {
    if (node.nodeType === 3) { out.push(document.createTextNode(interp(node.data, scope) + "")); return; }
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    if (tag === "sc-if") {
      if (interp(node.getAttribute("value") || "", scope)) buildKids(node, scope, out);
      return;
    }
    if (tag === "sc-for") {
      var list = interp(node.getAttribute("list") || "", scope) || [], as = node.getAttribute("as") || "item";
      for (var i = 0; i < list.length; i++) buildKids(node, childScope(scope, as, list[i]), out);
      return;
    }
    var el = document.createElementNS(node.namespaceURI, tag), h = null;
    for (var a = 0; a < node.attributes.length; a++) {
      var at = node.attributes[a], name = at.name;
      if (name.indexOf("hint-") === 0) continue;
      if (/^on[a-z]+$/i.test(name)) {
        var fn = interp(at.value, scope);
        if (typeof fn === "function") { h = h || {}; h[name.slice(2).toLowerCase()] = fn; }
        continue;
      }
      var v = interp(at.value, scope);
      if (v === undefined || v === null || v === false) continue;
      el.setAttribute(name, v === true ? "" : String(v));
    }
    el.__h = h;
    var kids = [];
    buildKids(node, scope, kids);
    for (var k = 0; k < kids.length; k++) el.appendChild(kids[k]);
    out.push(el);
  }
  function buildKids(node, scope, out) {
    var src = node.content || node; // <template> 내용 지원
    for (var c = src.firstChild; c; c = c.nextSibling) build(c, scope, out);
  }

  // ── 바뀐 부분만 고치기 (깜빡임·입력창 포커스 유지) ──
  function morph(a, b) {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName || a.namespaceURI !== b.namespaceURI) { a.parentNode.replaceChild(b, a); return; }
    if (a.nodeType === 3) { if (a.data !== b.data) a.data = b.data; return; }
    var i, at;
    for (i = a.attributes.length - 1; i >= 0; i--) { at = a.attributes[i]; if (!b.hasAttribute(at.name)) a.removeAttribute(at.name); }
    for (i = 0; i < b.attributes.length; i++) { at = b.attributes[i]; if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value); }
    a.__h = b.__h;
    if (a.tagName === "INPUT") { var nv = b.getAttribute("value") || ""; if (document.activeElement !== a && a.value !== nv) a.value = nv; }
    morphKids(a, b);
  }
  function morphKids(a, b) {
    var an = Array.prototype.slice.call(a.childNodes), bn = Array.prototype.slice.call(b.childNodes), i;
    for (i = 0; i < bn.length; i++) { if (i < an.length) morph(an[i], bn[i]); else a.appendChild(bn[i]); }
    for (i = bn.length; i < an.length; i++) a.removeChild(an[i]);
  }

  // ── 컴포넌트 기반 클래스 ──
  var comp = null, tpl = null, root = null, queued = false;
  function render() {
    queued = false;
    var vals = comp.renderVals();
    var out = [];
    buildKids(tpl, vals, out);
    var holder = document.createElement("div");
    out.forEach(function (n) { holder.appendChild(n); });
    if (!root.firstChild) { while (holder.firstChild) root.appendChild(holder.firstChild); }
    else morphKids(root, holder);
  }
  function schedule() { if (!queued) { queued = true; Promise.resolve().then(render); } }

  window.DCLogic = function DCLogic(props) { this.props = props || {}; this.state = {}; };
  window.DCLogic.prototype.setState = function (patch) {
    if (typeof patch === "function") patch = patch(this.state);
    Object.assign(this.state, patch || {});
    schedule();
  };

  // ── 이벤트 연결 (클릭·입력) ──
  function delegate(type) {
    document.addEventListener(type, function (ev) {
      for (var n = ev.target; n && n !== document; n = n.parentNode) {
        if (n.__h && n.__h[type]) { n.__h[type](ev); return; }
      }
    });
  }

  // ── 앱 설치(PWA) 버튼용 ──
  window.__installPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); window.__installPrompt = e; schedule(); });
  window.addEventListener("appinstalled", function () { window.__installPrompt = null; schedule(); });

  window.startApp = function (ComponentClass) {
    tpl = document.getElementById("app-template");
    root = document.getElementById("app");
    fit();
    delegate("click"); delegate("input");
    comp = new ComponentClass({});
    render();
  };
})();
