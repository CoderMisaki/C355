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

  let currentOptions = { ...defaultOptions };
  let activeBoard = null;
  let evalBarElement = null;
  let depthBarElement = null;

  // Retrieve Options from Chrome Sync Storage
  chrome.storage.sync.get(defaultOptions, (opts) => {
    currentOptions = { ...currentOptions, ...opts };
    initExtension();
  });

  // Listen for Live Option Updates from Popup
  chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'UpdateOptions') {
      currentOptions = { ...currentOptions, ...request.data };
      updateUIState();
    }
  });

  function initExtension() {
    const observer = new MutationObserver(() => {
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

  function attachToBoard(board) {
    console.log('[ChessMint] Attached to chess board.');
    createUIComponents(board);

    if (board.game) {
      board.game.on('Move', () => {
        onMoveExecuted();
      });
    }
  }

  function createUIComponents(board) {
    const parentLayout = board.parentElement;
    if (!parentLayout) return;

    // Depth / Progress Bar
    if (currentOptions.depth_bar && !depthBarElement) {
      const depthContainer = document.createElement('div');
      depthContainer.className = 'depthBarLayout';
      depthBarElement = document.createElement('div');
      depthBarElement.className = 'depthBarProgress';
      depthContainer.appendChild(depthBarElement);
      parentLayout.insertBefore(depthContainer, board.nextSibling);
    }

    // Evaluation Bar Container
    if (currentOptions.evaluation_bar && !evalBarElement) {
      evalBarElement = document.createElement('div');
      evalBarElement.className = 'cm-eval-container';
      evalBarElement.innerHTML = `
        <div class="cm-eval-badge dark" id="cm-eval-score">+0.0</div>
        <div class="cm-eval-fill-black" id="cm-eval-black"></div>
        <div class="cm-eval-fill-white" id="cm-eval-white"></div>
      `;

      let evalLayout = parentLayout.querySelector('#board-layout-evaluation');
      if (!evalLayout) {
        evalLayout = document.createElement('div');
        evalLayout.id = 'board-layout-evaluation';
        evalLayout.style.marginRight = '8px';
        parentLayout.insertBefore(evalLayout, parentLayout.firstElementChild);
      }
      evalLayout.innerHTML = '';
      evalLayout.appendChild(evalBarElement);
    }

    updateUIState();
  }

  function updateUIState() {
    if (depthBarElement?.parentElement) {
      depthBarElement.parentElement.style.display = currentOptions.depth_bar ? 'block' : 'none';
    }
    if (evalBarElement) {
      evalBarElement.style.display = currentOptions.evaluation_bar ? 'flex' : 'none';
    }
  }

  function onMoveExecuted() {
    if (!activeBoard?.game) return;

    // Simulate analysis evaluation visual update
    if (currentOptions.depth_bar && depthBarElement) {
      depthBarElement.style.width = '0%';
      let progress = 0;
      const timer = setInterval(() => {
        progress += 25;
        depthBarElement.style.width = `${Math.min(progress, 100)}%`;
        if (progress >= 100) clearInterval(timer);
      }, 100);
    }

    // Safe toaster notification invocation
    if (window.toaster && typeof window.toaster.add === 'function') {
      window.toaster.add({
        id: 'chessmint-move',
        duration: 1500,
        icon: 'circle-info',
        content: 'ChessMint Analyzed Move'
      });
    }
  }
})();
