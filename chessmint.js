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
  let observer = null;

  window.addEventListener('ChessMintSendOptions', (e) => {
    currentOptions = { ...currentOptions, ...(e.detail || {}) };
    updateUIState();
  });

  window.addEventListener('ChessMintUpdateOptions', (e) => {
    currentOptions = { ...currentOptions, ...(e.detail || {}) };
    updateUIState();
  });

  window.dispatchEvent(new CustomEvent('ChessMintGetOptions'));

  function init() {
    if (observer) {
        observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
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
    if (!board) return;
    console.log('[ChessMint] Attached to board!');
    createUIComponents(board);

    const game = board.game || board.controller || (board.getGame && board.getGame());

    if (game && typeof game.on === 'function') {
      try {
        game.on('Move', () => {
          handleMove(game);
        });
        console.log('[ChessMint] Event Move Listener Ready.');
      } catch(e) {
          console.warn('[ChessMint] Error hooking move event:', e);
      }
    } else {
        console.warn('[ChessMint] game object not found on board element.');
    }
  }

  function createUIComponents(board) {
    if (!board) return;

    // Fallback to board if parentElement is missing or document
    let parentLayout = board.parentElement;
    if (!parentLayout || parentLayout === document.body || parentLayout === document.documentElement) {
        parentLayout = board;
    }

    // We want to insert the UI near the board, typically before or after
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

  function handleMove(game) {
    if (depthBarProgress && currentOptions.depth_bar) {
      depthBarProgress.style.width = '0%';
      let prog = 0;
      const interval = setInterval(() => {
        prog += 20;
        if(depthBarProgress) {
            depthBarProgress.style.width = `${Math.min(prog, 100)}%`;
        }
        if (prog >= 100) clearInterval(interval);
      }, 80);
    }

    if (currentOptions.auto_move && game) {
      setTimeout(() => {
        try {
            if (typeof game.getLegalMoves === 'function') {
              const legalMoves = game.getLegalMoves();
              if (legalMoves && legalMoves.length > 0) {
                const selectedMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
                selectedMove.userGenerated = true;
                if (typeof game.move === 'function') {
                  game.move(selectedMove);
                }
              }
            }
        } catch(e) {
            console.warn('[ChessMint] Auto-move failed:', e);
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
