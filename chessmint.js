(function () {
  'use strict';

  let currentOptions = {
    depth: 15,
    threads: 2,
    show_hints: true,
    move_analysis: true,
    depth_bar: true,
    evaluation_bar: true,
    auto_move: false
  };

  let activeBoard = null;
  let depthBarProgress = null;
  let evalBarElement = null;

  // Minta konfigurasi awal dari loader.js
  window.addEventListener('ChessMintSendOptions', (e) => {
    currentOptions = { ...currentOptions, ...e.detail };
    updateUIState();
  });

  window.addEventListener('ChessMintUpdateOptions', (e) => {
    currentOptions = { ...currentOptions, ...e.detail };
    updateUIState();
  });

  window.dispatchEvent(new CustomEvent('ChessMintGetOptions'));

  // Deteksi elemen <chess-board>
  function init() {
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
    console.log('[ChessMint] Attached to board!');
    createUIComponents(board);

    // Buka proteksi objek game catur
    const game = board.game || board.controller;
    if (game && typeof game.on === 'function') {
      game.on('Move', () => {
        handleMove(game);
      });
      console.log('[ChessMint] Event Move Listener Ready.');
    }
  }

  function createUIComponents(board) {
    const parentLayout = board.parentElement || board;

    // Progress Bar Depth
    if (!depthBarProgress) {
      const container = document.createElement('div');
      container.className = 'depthBarLayout';
      depthBarProgress = document.createElement('div');
      depthBarProgress.className = 'depthBarProgress';
      container.appendChild(depthBarProgress);
      parentLayout.parentNode.insertBefore(container, parentLayout.nextSibling);
    }

    // Evaluation Bar
    if (!evalBarElement) {
      evalBarElement = document.createElement('div');
      evalBarElement.className = 'cm-eval-container';
      evalBarElement.innerHTML = `
        <div class="cm-eval-badge dark" id="cm-eval-score">+0.0</div>
        <div class="cm-eval-fill-black" id="cm-eval-black"></div>
        <div class="cm-eval-fill-white" id="cm-eval-white"></div>
      `;
      parentLayout.parentNode.insertBefore(evalBarElement, parentLayout);
    }

    updateUIState();
  }

  function updateUIState() {
    if (depthBarProgress?.parentElement) {
      depthBarProgress.parentElement.style.display = currentOptions.depth_bar ? 'block' : 'none';
    }
    if (evalBarElement) {
      evalBarElement.style.display = currentOptions.evaluation_bar ? 'flex' : 'none';
    }
  }

  function handleMove(game) {
    if (depthBarProgress && currentOptions.depth_bar) {
      depthBarProgress.style.width = '0%';
      let prog = 0;
      const interval = setInterval(() => {
        prog += 20;
        depthBarProgress.style.width = `${Math.min(prog, 100)}%`;
        if (prog >= 100) clearInterval(interval);
      }, 80);
    }

    // Fitur Auto Move untuk Bot Testing
    if (currentOptions.auto_move && game) {
      setTimeout(() => {
        if (typeof game.getLegalMoves === 'function') {
          const legalMoves = game.getLegalMoves();
          if (legalMoves && legalMoves.length > 0) {
            // Pilih langkah acak/legal dari game controller
            const selectedMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
            selectedMove.userGenerated = true;
            if (typeof game.move === 'function') {
              game.move(selectedMove);
            }
          }
        }
      }, 600);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
