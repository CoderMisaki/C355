(function () {
  'use strict';

  let activeBoard = null;
  let evalBarElement = null;
  let depthBarElement = null;

  function initExtension() {
    // Gunakan MutationObserver untuk mendeteksi papan catur secara dinamis
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
    console.log('[ChessMint] Papan catur terdeteksi!');
    createUIComponents(board);

    // Karena running di MAIN world, board.game sekarang bisa diakses
    if (board.game && typeof board.game.on === 'function') {
      board.game.on('Move', () => {
        onMoveExecuted();
      });
      console.log('[ChessMint] Hook event Move berhasil terpasang.');
    } else {
      console.warn('[ChessMint] board.game tidak ditemukan atau belum siap.');
    }
  }

  function createUIComponents(board) {
    const parentLayout = board.parentElement;
    if (!parentLayout) return;

    // Bar Progress / Depth
    if (!depthBarElement) {
      const depthContainer = document.createElement('div');
      depthContainer.className = 'depthBarLayout';
      depthBarElement = document.createElement('div');
      depthBarElement.className = 'depthBarProgress';
      depthContainer.appendChild(depthBarElement);
      parentLayout.insertBefore(depthContainer, board.nextSibling);
    }

    // Bar Evaluasi
    if (!evalBarElement) {
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
  }

  function onMoveExecuted() {
    if (depthBarElement) {
      depthBarElement.style.width = '0%';
      let progress = 0;
      const timer = setInterval(() => {
        progress += 20;
        depthBarElement.style.width = `${Math.min(progress, 100)}%`;
        if (progress >= 100) clearInterval(timer);
      }, 100);
    }
  }

  // Jalankan insialisasi setelah DOM siap
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initExtension();
  } else {
    document.addEventListener('DOMContentLoaded', initExtension);
  }
})();
