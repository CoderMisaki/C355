chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get_stockfish') {
    // Mengambil Stockfish langsung dari internet (Bypass lokal & CSP)
    fetch('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js')
      .then(response => response.text())
      .then(text => sendResponse({ code: text }))
      .catch(err => sendResponse({ error: err.toString() }));
    return true;
  }
});
