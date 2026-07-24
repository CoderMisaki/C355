/**
 * 🚀 ChessMint Pro - Stockfish Engine Integrated Assistant
 */

(function () {
  'use strict';

  // --- CONFIGURATION & STATE ---
  let currentOptions = {
    depth: 15,
    threads: 2,
    show_hints: true,
    move_analysis: true,
    depth_bar: true,
    evaluation_bar: true,
    auto_move: false,
    anti_ban: true,
    human_move_pro: true
  };

  // --- 1. OPTIONS MANAGER ---
  class OptionsManager {
    static init(callback) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(currentOptions, (opts) => {
          currentOptions = { ...currentOptions, ...opts };
          if (callback) callback();
        });

        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'sync') {
            for (let key in changes) {
              currentOptions[key] = changes[key].newValue;
            }
            if (callback) callback();
          }
        });
      }
    }
  }

  // --- 2. STOCKFISH ENGINE INTEGRATION ---
  class StockfishEngine {
    constructor() {
      this.worker = null;
      this.isReady = false;
      this.onAnalysisCallback = null;
      this.initEngine();
    }

    initEngine() {
      try {
        // Memuat Stockfish Worker lokal secara eksplisit
        const stockfishUrl = chrome.runtime.getURL('stockfish.js');

        // Inisialisasi Worker dari Blob agar aman dari pembatasan CSP extension
        const workerScript = `importScripts('${stockfishUrl}');`;
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        this.worker = new Worker(URL.createObjectURL(blob));

        this.worker.onmessage = (event) => this.handleEngineMessage(event.data);
        this.sendCommand('uci');
        this.sendCommand('isready');
      } catch (e) {
        console.warn('[ChessMint] WebWorker lokal gagal, mencoba direct load:', e);
        // Fallback langsung ke lokal (TIDAK MENGGUNAKAN CDN karena akan diblokir MV3)
        this.worker = new Worker(chrome.runtime.getURL('stockfish.js'));
        this.worker.onmessage = (event) => this.handleEngineMessage(event.data);
      }
    }

    sendCommand(cmd) {
      if (this.worker) {
        this.worker.postMessage(cmd);
      }
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

      if (msg === 'readyok') {
        this.isReady = true;
      }

      // Parsing evaluasi centipawn / mate & depth dari UCI output
      if (msg.startsWith('info depth')) {
        const depthMatch = msg.match(/depth (\d+)/);
        const cpMatch = msg.match(/score cp (-?\d+)/);
        const mateMatch = msg.match(/score mate (-?\d+)/);
        const pvMatch = msg.match(/ pv ([a-h][1-8][a-h][1-8])/);

        const depth = depthMatch ? parseInt(depthMatch[1], 10) : 0;
        let score = '+0.0';
        let cpValue = 0;

        if (cpMatch) {
          cpValue = parseInt(cpMatch[1], 10) / 100;
          score = cpValue >= 0 ? `+${cpValue.toFixed(1)}` : `${cpValue.toFixed(1)}`;
        } else if (mateMatch) {
          score = `M${mateMatch[1]}`;
          cpValue = parseInt(mateMatch[1], 10) > 0 ? 10 : -10;
        }

        const predictedMove = pvMatch ? pvMatch[1] : null;

        if (this.onAnalysisCallback) {
          this.onAnalysisCallback({
            type: 'info',
            depth,
            score,
            cpValue,
            predictedMove
          });
        }
      }

      // Parsing hasil akhir langkah terbaik (bestmove e2e4)
      if (msg.startsWith('bestmove')) {
        const match = msg.match(/^bestmove ([a-h][1-8])([a-h][1-8])/);
        if (match && this.onAnalysisCallback) {
          this.onAnalysisCallback({
            type: 'bestmove',
            from: match[1],
            to: match[2]
          });
        }
      }
    }
  }

  // --- 3. DOM BOARD PARSER (DOM -> FEN CONVERTER) ---
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
        let pieceStr = '';
        let squareStr = '';

        if (p.hasAttribute('data-piece')) {
          pieceStr = p.getAttribute('data-piece');
        } else {
          const match = p.className.match(/\b([bw][prnbqk])\b/i);
          if (match) pieceStr = match[1].toLowerCase();
        }

        if (p.hasAttribute('data-square')) {
          squareStr = p.getAttribute('data-square');
        } else {
          const sqMatch = p.className.match(/\bsquare-(\d)(\d)\b/);
          if (sqMatch) {
            const file = String.fromCharCode(96 + parseInt(sqMatch[1], 10));
            const rank = sqMatch[2];
            squareStr = `${file}${rank}`;
          }
        }

        if (pieceStr && squareStr && squareStr.length === 2) {
          const fileIdx = squareStr.charCodeAt(0) - 97;
          const rankIdx = 8 - parseInt(squareStr[1], 10);

          const color = pieceStr[0];
          const type = pieceStr[1].toUpperCase();
          const fenChar = color === 'w' ? type : type.toLowerCase();

          if (fileIdx >= 0 && fileIdx < 8 && rankIdx >= 0 && rankIdx < 8) {
            grid[rankIdx][fileIdx] = fenChar;
          }
        }
      });

      let fenRows = [];
      for (let r = 0; r < 8; r++) {
        let rowStr = '';
        let emptyCount = 0;
        for (let c = 0; c < 8; c++) {
          if (grid[r][c] === '') {
            emptyCount++;
          } else {
            if (emptyCount > 0) {
              rowStr += emptyCount;
              emptyCount = 0;
            }
            rowStr += grid[r][c];
          }
        }
        if (emptyCount > 0) rowStr += emptyCount;
        fenRows.push(rowStr);
      }

      // Deteksi giliran melangkah (Turn detection)
      const turn = DOMBoardParser.detectActiveTurn(boardElement);

      return `${fenRows.join('/')} ${turn} KQkq - 0 1`;
    }

    static detectActiveTurn(boardElement) {
      // Papan dibalik = Hitam (Black), standar = Putih (White)
      const isFlipped = boardElement.classList.contains('flipped');
      const highlights = boardElement.querySelectorAll('.highlight');
      if (highlights.length >= 2) {
        // Jika ada highlight gerakan terakhir, tentukan giliran dari elemen aktif
        return isFlipped ? 'b' : 'w';
      }
      return 'w';
    }
  }

  // --- 4. BOARD DRAWER (PRECISION SVG OVERLAY) ---
  class BoardDrawer {
    constructor(boardElement) {
      this.board = boardElement;
      this.svgOverlay = null;
      this.activeMarkings = [];
      this.initSvg();
    }

    initSvg() {
      if (document.getElementById('chessmint-svg-layer')) {
        this.svgOverlay = document.getElementById('chessmint-svg-layer');
        return;
      }

      this.svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.svgOverlay.id = 'chessmint-svg-layer';
      this.svgOverlay.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:9999;';

      if (getComputedStyle(this.board).position === 'static') {
        this.board.style.position = 'relative';
      }

      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.id = 'cm-arrowhead';
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '5');
      marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '3.5');
      marker.setAttribute('markerHeight', '3.5');
      marker.setAttribute('orient', 'auto-start-reverse');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M 0 2 L 10 5 L 0 8 z');
      path.setAttribute('fill', '#10b981');

      marker.appendChild(path);
      defs.appendChild(marker);
      this.svgOverlay.appendChild(defs);
      this.board.appendChild(this.svgOverlay);
    }

    squareToCoords(square) {
      const file = square.charCodeAt(0) - 97;
      const rank = 8 - parseInt(square[1], 10);

      const boardWidth = this.board.clientWidth;
      const boardHeight = this.board.clientHeight;
      const squareWidth = boardWidth / 8;
      const squareHeight = boardHeight / 8;

      const isFlipped = this.board.classList.contains('flipped');

      let xIdx = isFlipped ? 7 - file : file;
      let yIdx = isFlipped ? 7 - rank : rank;

      return {
        x: (xIdx + 0.5) * squareWidth,
        y: (yIdx + 0.5) * squareHeight
      };
    }

    drawArrow(fromSquare, toSquare, color = '#10b981') {
      this.clearMarkings();
      if (!this.svgOverlay || !currentOptions.show_hints) return;

      const start = this.squareToCoords(fromSquare);
      const end = this.squareToCoords(toSquare);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', start.x);
      line.setAttribute('y1', start.y);
      line.setAttribute('x2', end.x);
      line.setAttribute('y2', end.y);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '4');
      line.setAttribute('stroke-opacity', '0.9');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('marker-end', 'url(#cm-arrowhead)');

      this.svgOverlay.appendChild(line);
      this.activeMarkings.push(line);
    }

    clearMarkings() {
      this.activeMarkings.forEach(el => el.remove());
      this.activeMarkings = [];
    }
  }

  // --- 5. HUMAN-LIKE AUTO MOVE ENGINE ---
  class AutomaticMoveEngine {
    constructor(fromSquare, toSquare) {
      this.fromSquare = fromSquare;
      this.toSquare = toSquare;
    }

    async execute() {
      if (!currentOptions.auto_move) return;

      const fromEl = document.querySelector(`[data-square="${this.fromSquare}"]`);
      const toEl = document.querySelector(`[data-square="${this.toSquare}"]`);

      if (!fromEl || !toEl) return;

      let delay = 1000;
      if (currentOptions.human_move_pro) {
        delay = Math.floor(Math.random() * 2000) + 1200;
      } else if (currentOptions.anti_ban) {
        delay = Math.floor(Math.random() * 1000) + 600;
      }

      await new Promise(r => setTimeout(r, delay));

      this.triggerPointerEvent(fromEl, 'pointerdown');
      await new Promise(r => setTimeout(r, Math.random() * 50 + 20));
      this.triggerPointerEvent(fromEl, 'pointerup');

      await new Promise(r => setTimeout(r, Math.random() * 100 + 50));

      this.triggerPointerEvent(toEl, 'pointerdown');
      await new Promise(r => setTimeout(r, Math.random() * 50 + 20));
      this.triggerPointerEvent(toEl, 'pointerup');
    }

    triggerPointerEvent(element, eventType) {
      const rect = element.getBoundingClientRect();
      const clientX = rect.left + rect.width / 2 + (Math.random() - 0.5) * 4;
      const clientY = rect.top + rect.height / 2 + (Math.random() - 0.5) * 4;

      const opts = { bubbles: true, cancelable: true, clientX, clientY };
      element.dispatchEvent(new PointerEvent(eventType, opts));
      element.dispatchEvent(new MouseEvent(eventType === 'pointerdown' ? 'mousedown' : 'mouseup', opts));
    }
  }

  // --- 6. UI MANAGER ---
  class UIManager {
    constructor(boardElement) {
      this.board = boardElement;
      this.depthBarProgress = null;
      this.evalBarElement = null;
      this.evalScoreElement = null;
      this.evalBlackFill = null;
      this.evalWhiteFill = null;
      this.createComponents();
    }

    createComponents() {
      let parentLayout = this.board.parentElement;
      if (!parentLayout || parentLayout === document.body || parentLayout === document.documentElement) {
        parentLayout = this.board;
      }
      let insertParent = parentLayout.parentNode || parentLayout;

      // 1. Depth Bar
      if (!document.querySelector('.depthBarLayout')) {
        const container = document.createElement('div');
        container.className = 'depthBarLayout';
        this.depthBarProgress = document.createElement('div');
        this.depthBarProgress.className = 'depthBarProgress';
        container.appendChild(this.depthBarProgress);

        if (insertParent === parentLayout) insertParent.appendChild(container);
        else insertParent.insertBefore(container, parentLayout.nextSibling);
      } else {
        this.depthBarProgress = document.querySelector('.depthBarProgress');
      }

      // 2. Active Status Label
      if (!document.querySelector('.cm-active-status')) {
        const activeStatus = document.createElement('div');
        activeStatus.className = 'cm-active-status';
        activeStatus.innerText = '🟢 ChessMint Pro Active';
        activeStatus.style.cssText = 'text-align: center; color: #10b981; font-weight: bold; padding: 5px; font-size: 14px;';
        if (insertParent === parentLayout) insertParent.appendChild(activeStatus);
        else insertParent.insertBefore(activeStatus, parentLayout.nextSibling);
      }

      // 3. Evaluation Bar
      if (!document.querySelector('.cm-eval-container')) {
        this.evalBarElement = document.createElement('div');
        this.evalBarElement.className = 'cm-eval-container';
        this.evalBarElement.innerHTML = `
          <div class="cm-eval-badge dark" id="cm-eval-score">+0.0</div>
          <div class="cm-eval-fill-black" id="cm-eval-black" style="width: 50%;"></div>
          <div class="cm-eval-fill-white" id="cm-eval-white" style="width: 50%;"></div>
        `;
        if (insertParent === parentLayout) insertParent.insertBefore(this.evalBarElement, insertParent.firstChild);
        else insertParent.insertBefore(this.evalBarElement, parentLayout);
      } else {
        this.evalBarElement = document.querySelector('.cm-eval-container');
      }

      this.evalScoreElement = document.getElementById('cm-eval-score');
      this.evalBlackFill = document.getElementById('cm-eval-black');
      this.evalWhiteFill = document.getElementById('cm-eval-white');

      this.updateVisibility();
    }

    updateVisibility() {
      if (this.depthBarProgress && this.depthBarProgress.parentElement) {
        this.depthBarProgress.parentElement.style.display = currentOptions.depth_bar ? 'block' : 'none';
      }
      if (this.evalBarElement) {
        this.evalBarElement.style.display = currentOptions.evaluation_bar ? 'flex' : 'none';
      }
    }

    updateDepthProgress(currentDepth, maxDepth) {
      if (!this.depthBarProgress || !currentOptions.depth_bar) return;
      const pct = Math.min(100, Math.floor((currentDepth / maxDepth) * 100));
      this.depthBarProgress.style.width = `${pct}%`;
    }

    updateEvaluation(scoreStr, cpValue) {
      if (!currentOptions.evaluation_bar) return;
      if (this.evalScoreElement) {
        this.evalScoreElement.innerText = scoreStr;
      }

      const whitePct = Math.min(Math.max(50 + (cpValue * 10), 10), 90);
      if (this.evalWhiteFill && this.evalBlackFill) {
        this.evalWhiteFill.style.width = `${whitePct}%`;
        this.evalBlackFill.style.width = `${100 - whitePct}%`;
      }
    }
  }

  // --- 7. MASTER CONTROLLER ---
  class ChessMintController {
    constructor() {
      this.boardElement = null;
      this.boardDrawer = null;
      this.uiManager = null;
      this.stockfish = new StockfishEngine();
      this.lastFen = '';
      this.observer = null;
      this.boardObserver = null;
    }

    init() {
      OptionsManager.init(() => {
        if (this.uiManager) this.uiManager.updateVisibility();
      });

      const findAndAttach = () => {
        const board = DOMBoardParser.getBoardElement();
        if (board && board !== this.boardElement) {
          this.attachToBoard(board);
        }
      };

      this.observer = new MutationObserver(findAndAttach);
      this.observer.observe(document.body, { childList: true, subtree: true });

      findAndAttach();
    }

    attachToBoard(board) {
      this.boardElement = board;
      console.log('[ChessMint Pro] Attached to Chessboard!');

      this.boardDrawer = new BoardDrawer(board);
      this.uiManager = new UIManager(board);

      // Memantau perubahan DOM Bidak secara Real-Time
      if (this.boardObserver) this.boardObserver.disconnect();
      this.boardObserver = new MutationObserver(() => this.handleBoardChange());
      this.boardObserver.observe(board, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-square']
      });

      this.handleBoardChange();
    }

    handleBoardChange() {
      const currentFen = DOMBoardParser.parseFen(this.boardElement);
      if (!currentFen || currentFen === this.lastFen) return;

      // 1. LANGSUNG HAPUS PANAH LAMA
      this.boardDrawer.clearMarkings();
      this.lastFen = currentFen;

      // 2. JALANKAN STOCKFISH UNTUK FEN TERBARU
      this.stockfish.analyze(currentFen, currentOptions.depth, (data) => {
        if (data.type === 'info') {
          this.uiManager.updateDepthProgress(data.depth, currentOptions.depth);
          this.uiManager.updateEvaluation(data.score, data.cpValue);

          // Update panah sementara dari PV (Principal Variation) saat kalkulasi berjalan
          if (data.predictedMove && data.predictedMove.length === 4) {
            const from = data.predictedMove.substring(0, 2);
            const to = data.predictedMove.substring(2, 4);
            this.boardDrawer.drawArrow(from, to);
          }
        }

        if (data.type === 'bestmove') {
          this.boardDrawer.drawArrow(data.from, data.to);

          // Jika Auto Move Aktif, eksekusi gerakan terbaik
          if (currentOptions.auto_move) {
            const autoMove = new AutomaticMoveEngine(data.from, data.to);
            autoMove.execute();
          }
        }
      });
    }
  }

  // --- INITIALIZATION ---
  const app = new ChessMintController();
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    app.init();
  } else {
    document.addEventListener('DOMContentLoaded', () => app.init());
  }
})();
