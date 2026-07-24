// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get_stockfish') {
    fetch(chrome.runtime.getURL('stockfish.js'))
      .then(response => response.text())
      .then(text => sendResponse({ code: text }))
      .catch(err => sendResponse({ error: err.toString() }));
    return true; // Wajib: memberitahu Chrome bahwa respon akan dikirim secara asynchronous
  }
});
