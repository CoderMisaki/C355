// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get_stockfish') {
    // Rencana A: Ambil file lokal stockfish.js
    fetch(chrome.runtime.getURL('stockfish.js'))
      .then(res => {
        if (!res.ok) throw new Error("Local fetch failed");
        return res.text();
      })
      .then(text => sendResponse({ code: text }))
      .catch(err => {
        console.warn("[Background] Lokal gagal, mengambil dari Cloud CDN...");
        // Rencana B: Ambil dari Cloud CDN
        fetch('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js')
          .then(res => res.text())
          .then(text => sendResponse({ code: text }))
          .catch(err2 => sendResponse({ error: err2.toString() }));
      });
    return true; // Wajib untuk asynchronous response
  }
});
