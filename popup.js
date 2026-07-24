const defaultOptions = {
  depth: 15,
  threads: 2,
  show_hints: true,
  move_analysis: true,
  depth_bar: true,
  evaluation_bar: true,
  use_nnue: false,
  auto_move: false
};

document.addEventListener('DOMContentLoaded', () => {
  const depthInput = document.getElementById('option-depth');
  const threadsInput = document.getElementById('option-threads');
  const depthVal = document.getElementById('depth-val');
  const threadsVal = document.getElementById('threads-val');
  
  const hintsInput = document.getElementById('option-show-hints');
  const analysisInput = document.getElementById('option-move-analysis');
  const depthBarInput = document.getElementById('option-depth-bar');
  const evalBarInput = document.getElementById('option-evaluation-bar');
  const autoMoveInput = document.getElementById('option-auto-move');
  const autoMoveWarning = document.getElementById('auto-move-warning');

  function loadOptions() {
    chrome.storage.sync.get(defaultOptions, (opts) => {
      depthInput.value = opts.depth;
      threadsInput.value = opts.threads;
      depthVal.textContent = opts.depth;
      threadsVal.textContent = opts.threads;

      hintsInput.checked = opts.show_hints;
      analysisInput.checked = opts.move_analysis;
      depthBarInput.checked = opts.depth_bar;
      evalBarInput.checked = opts.evaluation_bar;
      autoMoveInput.checked = opts.auto_move;

      if (opts.auto_move) autoMoveWarning.style.display = 'block';
    });
  }

  function saveOptions() {
    const opts = {
      depth: parseInt(depthInput.value, 10),
      threads: parseInt(threadsInput.value, 10),
      show_hints: hintsInput.checked,
      move_analysis: analysisInput.checked,
      depth_bar: depthBarInput.checked,
      evaluation_bar: evalBarInput.checked,
      use_nnue: false,
      auto_move: autoMoveInput.checked
    };

    depthVal.textContent = opts.depth;
    threadsVal.textContent = opts.threads;
    autoMoveWarning.style.display = opts.auto_move ? 'block' : 'none';

    chrome.storage.sync.set(opts, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'UpdateOptions', data: opts }).catch(() => {});
        }
      });
    });
  }

  depthInput.addEventListener('input', saveOptions);
  threadsInput.addEventListener('input', saveOptions);
  hintsInput.addEventListener('change', saveOptions);
  analysisInput.addEventListener('change', saveOptions);
  depthBarInput.addEventListener('change', saveOptions);
  evalBarInput.addEventListener('change', saveOptions);
  autoMoveInput.addEventListener('change', saveOptions);

  loadOptions();
});
