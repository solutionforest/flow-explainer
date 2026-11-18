/*! Flow Explainer embed loader
 * https://github.com/solutionforest/flow-explainer
 * Drop on any site: <script async src="…/embed.js" data-c="…" data-text="0"></script>
 * Builds an iframe to the player. data-c is the same payload as a client link’s #c=.
 */
(function () {
  'use strict';
  var s = document.currentScript;
  if (!s || !s.getAttribute) return;
  var d = s.dataset || {};
  var c = d.c || d.payload || '';
  if (!c) {
    if (typeof console !== 'undefined') console.warn('[flow-explainer] data-c is required');
    return;
  }
  var view = String(d.view || '2d').toLowerCase() === '3d' ? '3d' : '2d';
  var host = (d.host || '').replace(/\/+$/, '');
  var scriptUrl = null;
  try {
    if (s.src) scriptUrl = new URL(s.src, location.href);
  } catch (e) {
    scriptUrl = null;
  }

  function playerBase(origin, pathDir, staticHost) {
    var dir = (pathDir || '').replace(/\/+$/, '');
    if (staticHost) return origin + dir + (view === '3d' ? '/3d.html' : '/index.html') + '?embed=1';
    return origin + (view === '3d' ? '/embed/3d' : '/embed');
  }

  var base;
  try {
    if (host) {
      var hu = new URL(/:\/\//.test(host) ? host : 'https://' + host);
      var hDir = hu.pathname.replace(/\/+$/, '');
      if (hDir === '/') hDir = '';
      base = playerBase(hu.origin, hDir, /\.github\.io$/i.test(hu.hostname));
    } else if (scriptUrl) {
      var dir = scriptUrl.pathname.replace(/\/[^/]*$/, '');
      base = playerBase(scriptUrl.origin, dir, /\.github\.io$/i.test(scriptUrl.hostname));
    } else {
      if (typeof console !== 'undefined') console.warn('[flow-explainer] cannot resolve host');
      return;
    }
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[flow-explainer] bad host', e);
    return;
  }

  var hash = '#c=' + c;
  if (d.s) hash += '&s=' + encodeURIComponent(d.s);
  if (d.i === '0') hash += '&i=0';
  // Default: hide step text (diagram + controls only). Pass data-text="1" to show it.
  if (d.text !== '1') hash += '&t=0';
  if (d.switch === '0' || d.v === '0') hash += '&v=0';

  var title = d.title || 'Flow Explainer';
  var size = d.size || 'r';
  var iframe = document.createElement('iframe');
  iframe.src = base + hash;
  iframe.title = title;
  iframe.loading = 'lazy';
  iframe.allow = 'fullscreen; clipboard-write';
  iframe.setAttribute('allowfullscreen', '');

  var node;
  var m = /^(\d+)x(\d+)$/.exec(size);
  if (m) {
    iframe.width = m[1];
    iframe.height = m[2];
    iframe.style.cssText = 'border:0;border-radius:12px;max-width:100%';
    node = iframe;
  } else {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:100%;aspect-ratio:16/10';
    iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:12px';
    wrap.appendChild(iframe);
    node = wrap;
  }
  if (s.parentNode) s.parentNode.insertBefore(node, s.nextSibling);
})();
