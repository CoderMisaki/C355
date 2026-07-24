(function () {
  'use strict';

  const defaultOptions = {
    depth: 15,
    threads: 2,
    show_hints: true,
    move_analysis: true,
    depth_bar: true,
    evaluation_bar: true,
    auto_move: false
  };

  // 1. Suntikkan chessmint.js ke Main World halaman web
  function injectScript(file) {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(file);
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();
  }

  // 2. Kirim data opsi dari storage ke script halaman web
  window.addEventListener('ChessMintGetOptions', () => {
    chrome.storage.sync.get(defaultOptions, (opts) => {
      window.dispatchEvent(new CustomEvent('ChessMintSendOptions', { detail: opts }));
    });
  });

  // 3. Teruskan update live dari popup ke halaman web
  chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'UpdateOptions') {
      window.dispatchEvent(new CustomEvent('ChessMintUpdateOptions', { detail: request.data }));
    }
  });

  injectScript('chessmint.js');
})();
