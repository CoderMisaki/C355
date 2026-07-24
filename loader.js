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

  function injectScript(file) {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(file);
      script.onload = function() {
        this.remove();
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      console.error('[ChessMint] Failed to inject script:', e);
    }
  }

  window.addEventListener('ChessMintGetOptions', () => {
    try {
      if (chrome && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(defaultOptions, (opts) => {
          window.dispatchEvent(new CustomEvent('ChessMintSendOptions', { detail: opts }));
        });
      } else {
        window.dispatchEvent(new CustomEvent('ChessMintSendOptions', { detail: defaultOptions }));
      }
    } catch (e) {
      console.error('[ChessMint] Error accessing chrome.storage:', e);
      window.dispatchEvent(new CustomEvent('ChessMintSendOptions', { detail: defaultOptions }));
    }
  });

  if (chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'UpdateOptions') {
        window.dispatchEvent(new CustomEvent('ChessMintUpdateOptions', { detail: request.data }));
      }
    });
  }

  injectScript('chessmint.js');
})();
