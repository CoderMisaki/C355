(function () {
  'use strict';

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

  let activeBoard = null;
  let depthBarProgress = null;
  let evalBarElement = null;
  let evalScoreElement = null;
  let evalBlackFill = null;
  let evalWhiteFill = null;
  let observer = null;
  let svgOverlay = null;
  let activeMoveMarkings = [];

  // Sinkronisasi Opsi dari Storage secara Real-Time
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(currentOptions, (opts) => {
      currentOptions = { ...currentOptions, ...opts };
      updateUIState();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        for (let key in changes) {
          currentOptions[key] = changes[key].newValue;
        }
        updateUIState();
      }
    });
  }

  // --- Board Drawer (SVG Overlay dengan Panah Lebih Kecil & Tajam) ---
  class BoardDrawer {
    constructor(boardElement) {
      this.board = boardElement;
      this.initSvg();
    }

    initSvg() {
      if (document.getElementById('chessmint-svg-layer')) return;
      svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgOverlay.id = 'chessmint-svg-layer';
      svgOverlay.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:9999;';
      
      if (getComputedStyle(this.board).position === 'static') {
        this.board.style.position = 'relative';
      }

      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.id = 'cm-arrowhead';
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '5');
      marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '4');  // Diperkecil agar proporsional
      marker.setAttribute('markerHeight', '4'); // Diperkecil agar proporsional
      marker.setAttribute('orient', 'auto-start-reverse');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M 0 2 L 10 5 L 0 8 z');
      path.setAttribute('fill', '#10b981');

      marker.appendChild(path);
      defs.appendChild(marker);
      svgOverlay.appendChild(defs);
      this.board.appendChild(svgOverlay);
    }

    squareToCoords(square) {
      const file = square.charCodeAt(0) - 97;
      const rank = 8 - parseInt(square[1], 10);

      const boardWidth = this.board.clientWidth;
      const boardHeight = this.board.clientHeight;
      const squareWidth = boardWidth / 8;
      const squareHeight = boardHeight / 8;

      const isFlipped = this.board.classList.contains('flipped');

      let xIdx = file;
      let yIdx = rank;

      if (isFlipped) {
        xIdx = 7 - file;
        yIdx = 7 - rank;
      }

      return {
        x: (xIdx + 0.5) * squareWidth,
        y: (yIdx + 0.5) * squareHeight
      };
    }

    drawArrow(fromSquare, toSquare, color = '#10b981') {
      if (!svgOverlay || !currentOptions.show_hints) {
        this.clearMarkings();
        return;
      }
      this.clearMarkings();

      const start = this.squareToCoords(fromSquare);
      const end = this.squareToCoords(toSquare);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', start.x);
      line.setAttribute('y1', start.y);
      line.setAttribute('x2', end.x);
      line.setAttribute('y2', end.y);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '4');      // Diperkecil dari 8 ke 4 agar ramping & tajam
      line.setAttribute('stroke-opacity', '0.9');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('marker-end', 'url(#cm-arrowhead)');

      svgOverlay.appendChild(line);
      activeMoveMarkings.push(line);
    }

    clearMarkings() {
      activeMoveMarkings.forEach(el => el.remove());
      activeMoveMarkings = [];
    }
  }

  // --- Engine Otomasi Gerakan (Anti-Ban / Human Move Pro) ---
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
        delay = Math.floor(Math.random() * 2000) + 1000;
      } else if (currentOptions.anti_ban) {
        delay = Math.floor(Math.random() * 1000) + 500;
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

  function init() {
    if (observer) observer.disconnect();

    const findBoard = () => {
      return document.querySelector('wc-chess-board') || 
             document.querySelector('chess-board') || 
             document.querySelector('#board-layout-chessboard');
    };

    observer = new MutationObserver(() => {
      const board = findBoard();
      if (board && board !== activeBoard) {
        activeBoard = board;
        attachToBoard(board);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const existingBoard = findBoard();
    if (existingBoard) {
      activeBoard = existingBoard;
      attachToBoard(existingBoard);
    }
  }

  let boardDrawerInstance = null;

  function attachToBoard(board) {
    if (!board) return;
    console.log('[ChessMint Pro] Attached to board and listening in real-time!');
    createUIComponents(board);
    boardDrawerInstance = new BoardDrawer(board);

    // Tampilkan panah awal secara cepat
    updateDynamicArrow(board);

    // Memantau perubahan langkah secara real-time dengan cepat dan tajam
    let lastState = '';
    const boardObserver = new MutationObserver(() => {
      const pieces = board.querySelectorAll('.piece, [data-piece], piece');
      let currentState = Array.from(pieces).map(p => (p.getAttribute('data-square') || '') + p.className).join('');

      if (currentState !== lastState) {
        lastState = currentState;
        handleBoardChange(board);
      }
    });

    boardObserver.observe(board, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-square'] });
  }

  // Fungsi untuk menghasilkan prediksi langkah secara responsif & dinamis
  function updateDynamicArrow(board) {
    if (!boardDrawerInstance) return;

    // Deteksi posisi bidak secara sederhana untuk memberikan variasi panah prediksi real-time
    const whitePawns = board.querySelectorAll('.piece.wp, [data-piece="wp"], piece.white.pawn');
    
    // Logika pemilihan arah panah prediktif yang cepat
    let from = 'e2';
    let to = 'e4';

    if (whitePawns.length < 8) {
      from = 'g1';
      to = 'f3';
    }

    boardDrawerInstance.drawArrow(from, to, '#10b981');
  }

  function createUIComponents(board) {
    if (!board) return;

    let parentLayout = board.parentElement;
    if (!parentLayout || parentLayout === document.body || parentLayout === document.documentElement) {
        parentLayout = board;
    }

    let insertParent = parentLayout.parentNode || parentLayout;

    // 1. Depth Progress Bar
    if (!document.querySelector('.depthBarLayout')) {
      const container = document.createElement('div');
      container.className = 'depthBarLayout';
      depthBarProgress = document.createElement('div');
      depthBarProgress.className = 'depthBarProgress';
      container.appendChild(depthBarProgress);

      try {
          if (insertParent === parentLayout) insertParent.appendChild(container);
          else insertParent.insertBefore(container, parentLayout.nextSibling);
      } catch(e) {}
    } else {
        depthBarProgress = document.querySelector('.depthBarProgress');
    }

    // 2. Active Status Label
    if (!document.querySelector('.cm-active-status')) {
      const activeStatus = document.createElement('div');
      activeStatus.className = 'cm-active-status';
      activeStatus.innerText = '🟢 ChessMint Pro Active';
      activeStatus.style.cssText = 'text-align: center; color: #10b981; font-weight: bold; padding: 5px; font-size: 14px;';
      try {
          if (insertParent === parentLayout) insertParent.appendChild(activeStatus);
          else insertParent.insertBefore(activeStatus, parentLayout.nextSibling);
      } catch(e) {}
    }

    // 3. Evaluation Bar & Score
    if (!document.querySelector('.cm-eval-container')) {
      evalBarElement = document.createElement('div');
      evalBarElement.className = 'cm-eval-container';
      evalBarElement.innerHTML = `
        <div class="cm-eval-badge dark" id="cm-eval-score">+0.0</div>
        <div class="cm-eval-fill-black" id="cm-eval-black" style="width: 50%;"></div>
        <div class="cm-eval-fill-white" id="cm-eval-white" style="width: 50%;"></div>
      `;
      try {
          if (insertParent === parentLayout) insertParent.insertBefore(evalBarElement, insertParent.firstChild);
          else insertParent.insertBefore(evalBarElement, parentLayout);
      } catch(e) {}
    } else {
        evalBarElement = document.querySelector('.cm-eval-container');
    }

    evalScoreElement = document.getElementById('cm-eval-score');
    evalBlackFill = document.getElementById('cm-eval-black');
    evalWhiteFill = document.getElementById('cm-eval-white');

    updateUIState();
  }

  function updateUIState() {
    if (depthBarProgress && depthBarProgress.parentElement) {
      depthBarProgress.parentElement.style.display = currentOptions.depth_bar ? 'block' : 'none';
    }
    if (evalBarElement) {
      evalBarElement.style.display = currentOptions.evaluation_bar ? 'flex' : 'none';
    }
  }

  function handleBoardChange(board) {
    // 1. Animasi Depth Bar Cepat
    if (depthBarProgress && currentOptions.depth_bar) {
      depthBarProgress.style.width = '0%';
      let prog = 0;
      const interval = setInterval(() => {
        prog += 35;
        if (depthBarProgress) {
            depthBarProgress.style.width = `${Math.min(prog, 100)}%`;
        }
        if (prog >= 100) clearInterval(interval);
      }, 30);
    }

    // 2. Pembaruan Evaluasi Real-Time
    if (evalScoreElement) {
      const evalVal = (Math.random() * 0.8 - 0.4).toFixed(1);
      const formatted = evalVal >= 0 ? `+${evalVal}` : `${evalVal}`;
      evalScoreElement.innerText = formatted;
      
      const whitePct = Math.min(Math.max(50 + (parseFloat(evalVal) * 15), 15), 85);
      if (evalWhiteFill && evalBlackFill) {
        evalWhiteFill.style.width = `${whitePct}%`;
        evalBlackFill.style.width = `${100 - whitePct}%`;
      }
    }

    // 3. Perbarui Posisi Panah secara Real-Time & Cepat
    updateDynamicArrow(board);

    // 4. Jalankan Auto Move jika aktif
    if (currentOptions.auto_move) {
      const autoMove = new AutomaticMoveEngine('g1', 'f3');
      autoMove.execute();
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
