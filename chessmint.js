/**
 * 🚀 ChessMint Pro - Ultimate In-Page UI & Anti-Bug Engine
 */

(function () {
  'use strict';

  let currentOptions = {
    depth: 15,
    show_hints: true,
    auto_move: false,
    evaluation_bar: true
  };

  // --- 1. ENGINE INTEGRATION ---
  class StockfishEngine {
    constructor() {
      this.worker = null;
      this.isReady = false;
      this.onAnalysisCallback = null;
      this.initEngine();
    }

    initEngine() {
      console.log('[ChessMint Pro] Meminta Engine (Bypass CSP)...');
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'get_stockfish' }, (response) => {
          if (response && response.code) {
            try {
              const blob = new Blob([response.code], { type: 'application/javascript' });
              this.worker = new Worker(URL.createObjectURL(blob));
              this.worker.onmessage = (e) => this.handleMessage(e.data);
              this.sendCommand('uci');
              this.sendCommand('isready');
              console.log('✅ [ChessMint] Stockfish Berhasil Dimuat!');
            } catch (err) {
              console.error('[ChessMint] Gagal merakit Blob Worker:', err);
            }
          } else {
             console.error('[ChessMint] Background gagal mengirim kode:', response?.error);
          }
        });
      }
    }

    sendCommand(cmd) { if (this.worker) this.worker.postMessage(cmd); }
    stop() { this.sendCommand('stop'); }
    
    analyze(fen, depth, callback) {
      this.onAnalysisCallback = callback;
      this.stop();
      this.sendCommand(`position fen ${fen}`);
      this.sendCommand(`go depth ${depth}`);
    }

    handleMessage(msg) {
      if (typeof msg !== 'string') return;
      if (msg === 'readyok') this.isReady = true;

      if (msg.startsWith('info depth')) {
        const cpMatch = msg.match(/score cp (-?\d+)/);
        const mateMatch = msg.match(/score mate (-?\d+)/);
        const pvMatch = msg.match(/ pv ([a-h][1-8][a-h][1-8])/);

        let cpValue = 0;
        let scoreStr = '+0.0';
        if (cpMatch) {
          cpValue = parseInt(cpMatch[1], 10) / 100;
          scoreStr = cpValue >= 0 ? `+${cpValue.toFixed(1)}` : `${cpValue.toFixed(1)}`;
        } else if (mateMatch) {
          scoreStr = `M${mateMatch[1]}`;
          cpValue = parseInt(mateMatch[1], 10) > 0 ? 10 : -10;
        }

        if (this.onAnalysisCallback) {
          this.onAnalysisCallback({ type: 'info', cpValue, score: scoreStr, predictedMove: pvMatch ? pvMatch[1] : null });
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

  // --- 2. BOARD PARSER (ANTI-BUG GILIRAN) ---
  class DOMBoardParser {
    static getBoard() {
      return document.querySelector('wc-chess-board') || document.querySelector('chess-board') || document.querySelector('#board-layout-chessboard');
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
          const file = squareStr.charCodeAt(0) - 97;
          const rank = 8 - parseInt(squareStr[1], 10);
          if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
            grid[rank][file] = pieceStr[0] === 'w' ? pieceStr[1].toUpperCase() : pieceStr[1].toLowerCase();
          }
        }
      });

      let fenRows = [];
      for (let r = 0; r < 8; r++) {
        let row = '', empty = 0;
        for (let c = 0; c < 8; c++) {
          if (grid[r][c] === '') empty++;
          else {
            if (empty > 0) { row += empty; empty = 0; }
            row += grid[r][c];
          }
        }
        if (empty > 0) row += empty;
        fenRows.push(row);
      }

      // TRIK RAHASIA: Selalu analisis berdasarkan warna kita sendiri (Anti-Bug Lawan Bot)
      const myColor = boardElement.classList.contains('flipped') ? 'b' : 'w';
      return `${fenRows.join('/')} ${myColor} KQkq - 0 1`;
    }
  }

  // --- 3. SVG DRAWER ---
  class BoardDrawer {
    constructor(board) {
      this.board = board;
      this.svg = null;
      this.arrows = [];
      this.initSvg();
    }
    initSvg() {
      if (document.getElementById('cm-svg')) { this.svg = document.getElementById('cm-svg'); return; }
      this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.svg.id = 'cm-svg';
      this.svg.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:9999;';
      if (getComputedStyle(this.board).position === 'static') this.board.style.position = 'relative';

      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.id = 'cm-arrow'; marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '5'); marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '4'); marker.setAttribute('markerHeight', '4');
      marker.setAttribute('orient', 'auto-start-reverse');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M 0 2 L 10 5 L 0 8 z'); path.setAttribute('fill', '#10b981');
      marker.appendChild(path); defs.appendChild(marker); this.svg.appendChild(defs);
      this.board.appendChild(this.svg);
    }
    draw(from, to) {
      this.clear();
      if (!this.svg || !currentOptions.show_hints) return;
      const isFlipped = this.board.classList.contains('flipped');
      const w = this.board.clientWidth / 8, h = this.board.clientHeight / 8;
      
      const getC = (sq) => ({
        x: ((isFlipped ? 7 - (sq.charCodeAt(0)-97) : sq.charCodeAt(0)-97) + 0.5) * w,
        y: ((isFlipped ? 7 - (8-parseInt(sq[1])) : 8-parseInt(sq[1])) + 0.5) * h
      });

      const s = getC(from), e = getC(to);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', s.x); line.setAttribute('y1', s.y);
      line.setAttribute('x2', e.x); line.setAttribute('y2', e.y);
      line.setAttribute('stroke', '#10b981'); line.setAttribute('stroke-width', '5');
      line.setAttribute('stroke-opacity', '0.8'); line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('marker-end', 'url(#cm-arrow)');
      this.svg.appendChild(line); this.arrows.push(line);
    }
    clear() { this.arrows.forEach(el => el.remove()); this.arrows = []; }
  }

  // --- 4. AUTO MOVE ---
  class AutoMove {
    static async execute(from, to) {
      if (!currentOptions.auto_move) return;
      const fEl = document.querySelector(`[data-square="${from}"]`);
      const tEl = document.querySelector(`[data-square="${to}"]`);
      if (!fEl || !tEl) return;

      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 500) + 500));
      this.trigger(fEl, 'pointerdown'); await new Promise(r => setTimeout(r, 50)); this.trigger(fEl, 'pointerup');
      await new Promise(r => setTimeout(r, 100));
      this.trigger(tEl, 'pointerdown'); await new Promise(r => setTimeout(r, 50)); this.trigger(tEl, 'pointerup');
    }
    static trigger(el, type) {
      const rect = el.getBoundingClientRect();
      const opts = { bubbles: true, cancelable: true, clientX: rect.left + rect.width/2, clientY: rect.top + rect.height/2 };
      el.dispatchEvent(new PointerEvent(type, opts)); el.dispatchEvent(new MouseEvent(type === 'pointerdown' ? 'mousedown' : 'mouseup', opts));
    }
  }

  // --- 5. IN-PAGE UI MANAGER ---
  class UIManager {
    constructor(board) {
      this.board = board;
      this.evalScore = null; this.evalW = null; this.evalB = null;
      this.initUI();
    }
    initUI() {
      let parent = this.board.parentElement;
      if (!parent || parent === document.body) parent = this.board;
      let target = parent.parentNode || parent;

      if (!document.getElementById('cm-hud-wrapper')) {
        const wrapper = document.createElement('div');
        wrapper.id = 'cm-hud-wrapper';
        wrapper.style.cssText = 'width: 100%; margin-top: 10px; font-family: sans-serif; user-select: none;';

        // Eval Bar
        const evalBox = document.createElement('div');
        evalBox.style.cssText = 'display: flex; height: 12px; width: 100%; border-radius: 4px; overflow: hidden; background: #1e293b; margin-bottom: 8px; position: relative;';
        evalBox.innerHTML = `
          <div style="position:absolute; right:5px; top:-2px; font-size:11px; font-weight:bold; color:#10b981; z-index:10;" id="cm-sc">+0.0</div>
          <div id="cm-eb" style="background:#0f172a; width:50%; transition:width 0.3s;"></div>
          <div id="cm-ew" style="background:#f8fafc; width:50%; transition:width 0.3s;"></div>`;
        wrapper.appendChild(evalBox);

        // Tombol Toggle Aktif
        const btn = document.createElement('div');
        btn.style.cssText = 'background: #262421; color: #10b981; text-align: center; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer; border: 1px solid #10b981;';
        btn.innerHTML = `🟢 ChessMint Pro Active <span style="font-size: 11px; color: #aaa; font-weight: normal; margin-left: 5px;">(Tap to Open Menu)</span>`;

        // Menu Dropdown Dalam Papan
        const menu = document.createElement('div');
        menu.style.cssText = 'display: none; background: #262421; padding: 15px; border-radius: 6px; border: 1px solid #444; margin-top: 5px; color: #fff; font-size: 14px;';
        
        menu.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span>🧠 Engine Depth</span>
            <div style="display:flex; align-items:center; gap:10px;">
              <input type="range" id="cm-m-depth" min="1" max="25" value="${currentOptions.depth}" style="width: 80px; accent-color:#10b981;">
              <span id="cm-m-dval" style="color:#10b981; font-weight:bold; width:20px;">${currentOptions.depth}</span>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span>🎯 Show Arrows</span>
            <input type="checkbox" id="cm-m-hints" ${currentOptions.show_hints ? 'checked' : ''} style="width:18px; height:18px; accent-color: #10b981;">
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>🤖 Auto Move</span>
            <input type="checkbox" id="cm-m-auto" ${currentOptions.auto_move ? 'checked' : ''} style="width:18px; height:18px; accent-color: #10b981;">
          </div>
        `;

        btn.onclick = () => { menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; };

        wrapper.appendChild(btn); wrapper.appendChild(menu);
        if (target === parent) target.appendChild(wrapper); else target.insertBefore(wrapper, parent.nextSibling);

        // Bind Data
        this.evalScore = document.getElementById('cm-sc');
        this.evalB = document.getElementById('cm-eb');
        this.evalW = document.getElementById('cm-ew');

        document.getElementById('cm-m-depth').oninput = (e) => { 
          currentOptions.depth = e.target.value; 
          document.getElementById('cm-m-dval').innerText = e.target.value; 
        };
        document.getElementById('cm-m-hints').onchange = (e) => currentOptions.show_hints = e.target.checked;
        document.getElementById('cm-m-auto').onchange = (e) => currentOptions.auto_move = e.target.checked;
      } else {
        this.evalScore = document.getElementById('cm-sc');
        this.evalB = document.getElementById('cm-eb');
        this.evalW = document.getElementById('cm-ew');
      }
    }
    updateEval(scoreStr, cpValue) {
      if (this.evalScore) this.evalScore.innerText = scoreStr;
      const wPct = Math.min(Math.max(50 + (cpValue * 10), 5), 95);
      if (this.evalW && this.evalB) {
        this.evalW.style.width = `${wPct}%`; this.evalB.style.width = `${100 - wPct}%`;
      }
    }
  }

  // --- 6. CORE ---
  class MasterController {
    constructor() {
      this.board = null; this.drawer = null; this.ui = null;
      this.stockfish = new StockfishEngine();
      this.lastFen = '';
      this.obs = new MutationObserver(() => this.findBoard());
      this.boardObs = new MutationObserver(() => this.onBoardChange());
    }
    start() {
      this.findBoard();
      this.obs.observe(document.body, { childList: true, subtree: true });
    }
    findBoard() {
      const b = DOMBoardParser.getBoard();
      if (b && b !== this.board) {
        this.board = b; this.drawer = new BoardDrawer(b); this.ui = new UIManager(b);
        this.boardObs.disconnect();
        this.boardObs.observe(b, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        this.onBoardChange();
      }
    }
    onBoardChange() {
      const fen = DOMBoardParser.parseFen(this.board);
      if (!fen || fen === this.lastFen) return;
      this.drawer.clear(); this.lastFen = fen;
      this.stockfish.analyze(fen, currentOptions.depth, (data) => {
        if (data.type === 'info') {
          if(data.score) this.ui.updateEval(data.score, data.cpValue);
          if(data.predictedMove) this.drawer.draw(data.predictedMove.substring(0,2), data.predictedMove.substring(2,4));
        }
        if (data.type === 'bestmove') {
          this.drawer.draw(data.from, data.to);
          AutoMove.execute(data.from, data.to);
        }
      });
    }
  }

  const run = () => { new MasterController().start(); };
  if (document.readyState === 'complete') run(); else document.addEventListener('DOMContentLoaded', run);
})();
