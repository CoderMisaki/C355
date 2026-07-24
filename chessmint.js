/**
 * 🚀 ChessMint Pro - Cloud Engine & In-Page Menu v4.0.0
 */

(function () {
  'use strict';

  let currentOptions = {
    depth: 15,
    show_hints: true,
    auto_move: false,
    human_move_pro: true
  };

  // --- 1. STOCKFISH CLOUD ENGINE ---
  class StockfishEngine {
    constructor() {
      this.worker = null;
      this.isReady = false;
      this.onAnalysisCallback = null;
      this.initEngine();
    }

    initEngine() {
      try {
        console.log('[ChessMint Pro] Menyambungkan ke Cloud Engine...');
        
        chrome.runtime.sendMessage({ action: 'get_stockfish' }, (response) => {
          if (chrome.runtime.lastError) {
             console.error('[ChessMint] Background error:', chrome.runtime.lastError);
             return;
          }
          if (response && response.code) {
            try {
              const blob = new Blob([response.code], { type: 'application/javascript' });
              const blobUrl = URL.createObjectURL(blob);
              
              this.worker = new Worker(blobUrl);
              this.worker.onmessage = (event) => this.handleEngineMessage(event.data);
              this.sendCommand('uci');
              this.sendCommand('isready');
              console.log('✅ [ChessMint Pro] Engine berhasil dimuat & siap tempur!');
            } catch (err) {
              console.error('[ChessMint] Gagal merakit worker:', err);
            }
          } else {
            console.error('[ChessMint] Gagal koneksi ke CDN:', response?.error);
          }
        });
      } catch (e) {
        console.error('[ChessMint] Fatal Error:', e);
      }
    }

    sendCommand(cmd) {
      if (this.worker) this.worker.postMessage(cmd);
    }
    stop() {
      this.sendCommand('stop');
    }
    analyze(fen, targetDepth, onAnalysis) {
      this.onAnalysisCallback = onAnalysis;
      this.stop();
      this.sendCommand(`position fen ${fen}`);
      this.sendCommand(`go depth ${targetDepth}`);
    }

    handleEngineMessage(msg) {
      if (typeof msg !== 'string') return;
      if (msg === 'readyok') this.isReady = true;

      if (msg.startsWith('info depth')) {
        const pvMatch = msg.match(/ pv ([a-h][1-8][a-h][1-8])/);
        const predictedMove = pvMatch ? pvMatch[1] : null;

        if (this.onAnalysisCallback) {
          this.onAnalysisCallback({ type: 'info', predictedMove });
        }
      }

      if (msg.startsWith('bestmove')) {
        const match = msg.match(/^bestmove ([a-h][1-8])([a-h][1-8])/);
        if (match && this.onAnalysisCallback) {
          this.onAnalysisCallback({ type: 'bestmove', from: match[1], to: match[2] });
        }
      }
    }
  }

  // --- 2. DOM PARSER ---
  class DOMBoardParser {
    static getBoardElement() {
      return document.querySelector('wc-chess-board') ||
             document.querySelector('chess-board') ||
             document.querySelector('#board-layout-chessboard');
    }

    static parseFen(boardElement) {
      if (!boardElement) return null;
      const grid = Array(8).fill(null).map(() => Array(8).fill(''));
      const pieces = boardElement.querySelectorAll('.piece, [data-piece], piece');

      pieces.forEach(p => {
        let pieceStr = p.getAttribute('data-piece') || (p.className.match(/\b([bw][prnbqk])\b/i) || [])[1]?.toLowerCase();
        let squareStr = p.getAttribute('data-square');
        
        if (!squareStr) {
          const sqMatch = p.className.match(/\bsquare-(\d)(\d)\b/);
          if (sqMatch) squareStr = `${String.fromCharCode(96 + parseInt(sqMatch[1], 10))}${sqMatch[2]}`;
        }

        if (pieceStr && squareStr && squareStr.length === 2) {
          const fileIdx = squareStr.charCodeAt(0) - 97;
          const rankIdx = 8 - parseInt(squareStr[1], 10);
          const color = pieceStr[0];
          const type = pieceStr[1].toUpperCase();
          
          if (fileIdx >= 0 && fileIdx < 8 && rankIdx >= 0 && rankIdx < 8) {
            grid[rankIdx][fileIdx] = color === 'w' ? type : type.toLowerCase();
          }
        }
      });

      let fenRows = [];
      for (let r = 0; r < 8; r++) {
        let rowStr = '', emptyCount = 0;
        for (let c = 0; c < 8; c++) {
          if (grid[r][c] === '') emptyCount++;
          else {
            if (emptyCount > 0) { rowStr += emptyCount; emptyCount = 0; }
            rowStr += grid[r][c];
          }
        }
        if (emptyCount > 0) rowStr += emptyCount;
        fenRows.push(rowStr);
      }

      const turn = boardElement.querySelectorAll('.highlight').length >= 2 ? 
                  (boardElement.classList.contains('flipped') ? 'b' : 'w') : 'w';
      return `${fenRows.join('/')} ${turn} KQkq - 0 1`;
    }
  }

  // --- 3. SVG DRAWER ---
  class BoardDrawer {
    constructor(boardElement) {
      this.board = boardElement;
      this.svgOverlay = null;
      this.activeMarkings = [];
      this.initSvg();
    }

    initSvg() {
      if (document.getElementById('cm-svg')) {
        this.svgOverlay = document.getElementById('cm-svg');
        return;
      }
      this.svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.svgOverlay.id = 'cm-svg';
      this.svgOverlay.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:9999;';
      if (getComputedStyle(this.board).position === 'static') this.board.style.position = 'relative';

      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.id = 'cm-arrow';
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '5');
      marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '4');
      marker.setAttribute('markerHeight', '4');
      marker.setAttribute('orient', 'auto-start-reverse');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M 0 2 L 10 5 L 0 8 z');
      path.setAttribute('fill', '#10b981');

      marker.appendChild(path);
      defs.appendChild(marker);
      this.svgOverlay.appendChild(defs);
      this.board.appendChild(this.svgOverlay);
    }

    squareToCoords(sq) {
      const isFlipped = this.board.classList.contains('flipped');
      const file = sq.charCodeAt(0) - 97;
      const rank = 8 - parseInt(sq[1], 10);
      const w = this.board.clientWidth / 8, h = this.board.clientHeight / 8;
      return {
        x: ((isFlipped ? 7 - file : file) + 0.5) * w,
        y: ((isFlipped ? 7 - rank : rank) + 0.5) * h
      };
    }

    drawArrow(from, to) {
      this.clearMarkings();
      if (!this.svgOverlay || !currentOptions.show_hints) return;
      const start = this.squareToCoords(from), end = this.squareToCoords(to);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', start.x); line.setAttribute('y1', start.y);
      line.setAttribute('x2', end.x); line.setAttribute('y2', end.y);
      line.setAttribute('stroke', '#10b981');
      line.setAttribute('stroke-width', '5');
      line.setAttribute('stroke-opacity', '0.8');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('marker-end', 'url(#cm-arrow)');

      this.svgOverlay.appendChild(line);
      this.activeMarkings.push(line);
    }

    clearMarkings() {
      this.activeMarkings.forEach(el => el.remove());
      this.activeMarkings = [];
    }
  }

  // --- 4. AUTO MOVE ---
  class AutoMove {
    static async execute(from, to) {
      if (!currentOptions.auto_move) return;
      const fEl = document.querySelector(`[data-square="${from}"]`);
      const tEl = document.querySelector(`[data-square="${to}"]`);
      if (!fEl || !tEl) return;

      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 800) + 700));
      
      this.triggerEvent(fEl, 'pointerdown');
      await new Promise(r => setTimeout(r, 50));
      this.triggerEvent(fEl, 'pointerup');

      await new Promise(r => setTimeout(r, 100));

      this.triggerEvent(tEl, 'pointerdown');
      await new Promise(r => setTimeout(r, 50));
      this.triggerEvent(tEl, 'pointerup');
    }

    static triggerEvent(el, type) {
      const rect = el.getBoundingClientRect();
      const opts = { bubbles: true, cancelable: true, clientX: rect.left + rect.width/2, clientY: rect.top + rect.height/2 };
      el.dispatchEvent(new PointerEvent(type, opts));
      el.dispatchEvent(new MouseEvent(type === 'pointerdown' ? 'mousedown' : 'mouseup', opts));
    }
  }

  // --- 5. UI MANAGER (TOMBOL & MENU DI LAYAR) ---
  class UIManager {
    constructor(board) {
      this.board = board;
      this.initUI();
    }

    initUI() {
      let parent = this.board.parentElement;
      if (!parent || parent === document.body) parent = this.board;
      let target = parent.parentNode || parent;

      if (!document.getElementById('cm-hud')) {
        // Wrapper Utama
        const wrapper = document.createElement('div');
        wrapper.id = 'cm-hud';
        wrapper.style.cssText = 'width: 100%; margin-top: 8px; font-family: sans-serif; user-select: none;';

        // Tombol Aktif
        const btn = document.createElement('div');
        btn.style.cssText = 'background: #1e293b; color: #10b981; text-align: center; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; border: 1px solid #10b981; box-shadow: 0 4px 6px rgba(0,0,0,0.3);';
        btn.innerHTML = `🟢 ChessMint Pro Active <span style="font-size: 11px; color: #94a3b8; font-weight: normal; margin-left: 5px;">(Tap Menu)</span>`;

        // Panel Menu Tersembunyi
        const menu = document.createElement('div');
        menu.style.cssText = 'display: none; background: #0f172a; padding: 12px; border-radius: 6px; border: 1px solid #334155; margin-top: 5px; color: #f8fafc; font-size: 14px;';
        
        menu.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #334155;">
            <span>🎯 Show Hints (Arrow)</span>
            <input type="checkbox" id="cm-opt-hints" ${currentOptions.show_hints ? 'checked' : ''} style="width:18px; height:18px; accent-color: #10b981;">
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>🤖 Auto Move Engine</span>
            <input type="checkbox" id="cm-opt-auto" ${currentOptions.auto_move ? 'checked' : ''} style="width:18px; height:18px; accent-color: #10b981;">
          </div>
        `;

        // Logika Toggle Buka/Tutup
        btn.onclick = () => {
          menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        };

        wrapper.appendChild(btn);
        wrapper.appendChild(menu);

        if (target === parent) target.appendChild(wrapper);
        else target.insertBefore(wrapper, parent.nextSibling);

        // Listener Checkbox
        document.getElementById('cm-opt-hints').onchange = (e) => currentOptions.show_hints = e.target.checked;
        document.getElementById('cm-opt-auto').onchange = (e) => currentOptions.auto_move = e.target.checked;
      }
    }
  }

  // --- 6. CORE CONTROLLER ---
  class MasterController {
    constructor() {
      this.board = null;
      this.drawer = null;
      this.stockfish = new StockfishEngine();
      this.lastFen = '';
      this.observer = new MutationObserver(() => this.findBoard());
      this.boardObserver = new MutationObserver(() => this.onBoardChange());
    }

    start() {
      this.findBoard();
      this.observer.observe(document.body, { childList: true, subtree: true });
    }

    findBoard() {
      const b = DOMBoardParser.getBoardElement();
      if (b && b !== this.board) {
        this.board = b;
        this.drawer = new BoardDrawer(b);
        new UIManager(b);
        this.boardObserver.disconnect();
        this.boardObserver.observe(b, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        this.onBoardChange();
      }
    }

    onBoardChange() {
      const fen = DOMBoardParser.parseFen(this.board);
      if (!fen || fen === this.lastFen) return;
      
      this.drawer.clearMarkings();
      this.lastFen = fen;

      this.stockfish.analyze(fen, currentOptions.depth, (data) => {
        if (data.type === 'info' && data.predictedMove) {
          this.drawer.drawArrow(data.predictedMove.substring(0,2), data.predictedMove.substring(2,4));
        }
        if (data.type === 'bestmove') {
          this.drawer.drawArrow(data.from, data.to);
          AutoMove.execute(data.from, data.to);
        }
      });
    }
  }

  // Start Engine
  const run = () => { new MasterController().start(); };
  if (document.readyState === 'complete') run();
  else document.addEventListener('DOMContentLoaded', run);

})();
