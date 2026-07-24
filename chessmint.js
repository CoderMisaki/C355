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
  let observer = null;
  let svgOverlay = null;
  let activeMoveMarkings = [];

  // Ambil opsi langsung dari storage ekstensi
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

  // --- A.C.A.S Style Universal Board Drawer (SVG Overlay) ---
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
      this.board.appendChild(svgOverlay);
    }

    drawArrow(fromSquare, toSquare, color = '#10b981') {
      if (!svgOverlay) return;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '6');
      line.setAttribute('stroke-opacity', '0.8');
      line.setAttribute('stroke-linecap', 'round');
      svgOverlay.appendChild(line);
      activeMoveMarkings.push(line);
    }

    clearMarkings() {
      activeMoveMarkings.forEach(el => el.remove());
      activeMoveMarkings = [];
    }
  }

  // --- A.C.A.S Style Human-Like Move Engine (Anti-Ban) ---
  class AutomaticMoveEngine {
    constructor(fromSquare, toSquare) {
      this.fromSquare = fromSquare;
      this.toSquare = toSquare;
    }

    async execute() {
      const fromEl = document.querySelector(`[data-square="${this.fromSquare}"]`);
      const toEl = document.querySelector(`[data-square="${this.toSquare}"]`);

      if (!fromEl || !toEl) return;

      let delay = 1200;
      if (currentOptions.human_move_pro) {
        delay = Math.floor(Math.random() * 2500) + 1500;
      } else if (currentOptions.anti_ban) {
        delay = Math.floor(Math.random() * 1200) + 800;
      }

      await new Promise(r => setTimeout(r, delay));

      this.triggerPointerEvent(fromEl, 'pointerdown');
      await new Promise(r => setTimeout(r, Math.random() * 80 + 40));
      this.triggerPointerEvent(fromEl, 'pointerup');

      await new Promise(r => setTimeout(r, Math.random() * 150 + 100));

      this.triggerPointerEvent(toEl, 'pointerdown');
      await new Promise(r => setTimeout(r, Math.random() * 80 + 40));
      this.triggerPointerEvent(toEl, 'pointerup');
    }

    triggerPointerEvent(element, eventType) {
      const rect = element.getBoundingClientRect();
      const clientX = rect.left + rect.width / 2 + (Math.random() - 0.5) * 6;
      const clientY = rect.top + rect.height / 2 + (Math.random() - 0.5) * 6;

      const opts = { bubbles: true, cancelable: true, clientX, clientY };
      element.dispatchEvent(new PointerEvent(eventType, opts));
      element.dispatchEvent(new MouseEvent(eventType === 'pointerdown' ? 'mousedown' : 'mouseup', opts));
    }
  }

  function init() {
    if (observer) {
        observer.disconnect();
    }

    observer = new MutationObserver(() => {
      const board = document.querySelector('chess-board');
      if (board && board !== activeBoard) {
        activeBoard = board;
        attachToBoard(board);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const existingBoard = document.querySelector('chess-board');
    if (existingBoard) {
      activeBoard = existingBoard;
      attachToBoard(existingBoard);
    }
  }

  let boardDrawerInstance = null;

  function attachToBoard(board) {
    if (!board) return;
    console.log('[ChessMint Pro] Attached to board successfully!');
    createUIComponents(board);
    boardDrawerInstance = new BoardDrawer(board);

    const boardObserver = new MutationObserver((mutations) => {
      let changed = mutations.some(m => m.type === 'childList' || m.attributeName === 'class');
      if (changed) {
        handleMove();
      }
    });

    boardObserver.observe(board, { childList: true, subtree: true, attributes: true });
  }

  function createUIComponents(board) {
    if (!board) return;

    let parentLayout = board.parentElement;
    if (!parentLayout || parentLayout === document.body || parentLayout === document.documentElement) {
        parentLayout = board;
    }

    let insertParent = parentLayout.parentNode || parentLayout;

    if (!document.querySelector('.depthBarLayout')) {
      const container = document.createElement('div');
      container.className = 'depthBarLayout';
      depthBarProgress = document.createElement('div');
      depthBarProgress.className = 'depthBarProgress';
      container.appendChild(depthBarProgress);

      try {
          if(insertParent === parentLayout) {
             insertParent.appendChild(container);
          } else {
             insertParent.insertBefore(container, parentLayout.nextSibling);
          }
      } catch(e) {
          console.warn('[ChessMint] Failed to insert depth bar', e);
      }
    } else {
        depthBarProgress = document.querySelector('.depthBarProgress');
    }

    if (!document.querySelector('.cm-active-status')) {
      const activeStatus = document.createElement('div');
      activeStatus.className = 'cm-active-status';
      activeStatus.innerText = '🟢 ChessMint Pro Active';
      activeStatus.style.cssText = 'text-align: center; color: #10b981; font-weight: bold; padding: 5px; font-size: 14px;';
      try {
          if(insertParent === parentLayout) {
             insertParent.appendChild(activeStatus);
          } else {
             insertParent.insertBefore(activeStatus, parentLayout.nextSibling);
          }
      } catch(e) {
          console.warn('[ChessMint] Failed to insert active status', e);
      }
    }

    if (!document.querySelector('.cm-eval-container')) {
      evalBarElement = document.createElement('div');
      evalBarElement.className = 'cm-eval-container';
      evalBarElement.innerHTML = `
        <div class="cm-eval-badge dark" id="cm-eval-score">+0.0</div>
        <div class="cm-eval-fill-black" id="cm-eval-black"></div>
        <div class="cm-eval-fill-white" id="cm-eval-white"></div>
      `;
      try {
          if(insertParent === parentLayout) {
              insertParent.insertBefore(evalBarElement, insertParent.firstChild);
          } else {
              insertParent.insertBefore(evalBarElement, parentLayout);
          }
      } catch(e) {
           console.warn('[ChessMint] Failed to insert eval bar', e);
      }
    } else {
        evalBarElement = document.querySelector('.cm-eval-container');
    }

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

  function handleMove() {
    if (depthBarProgress && currentOptions.depth_bar) {
      depthBarProgress.style.width = '0%';
      let prog = 0;
      const interval = setInterval(() => {
        prog += 25;
        if(depthBarProgress) {
            depthBarProgress.style.width = `${Math.min(prog, 100)}%`;
        }
        if (prog >= 100) clearInterval(interval);
      }, 60);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
