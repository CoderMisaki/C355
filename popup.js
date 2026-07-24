const defaultOptions = {
  depth: 15,
  threads: 2,
  show_hints: true,
  move_analysis: true,
  depth_bar: true,
  evaluation_bar: true,
  auto_move: false
};

document.addEventListener('DOMContentLoaded', () => {
  const depthInput = document.getElementById('option-depth');
  const depthVal = document.getElementById('depth-val');
  const hintsInput = document.getElementById('option-show-hints');
  const depthBarInput = document.getElementById('option-depth-bar');
  const evalBarInput = document.getElementById('option-evaluation-bar');
  const autoMoveInput = document.getElementById('option-auto-move');

  function loadOptions() {
    chrome.storage.sync.get(defaultOptions, (opts) => {
      depthInput.value = opts.depth;
      depthVal.textContent = opts.depth;
      hintsInput.checked = opts.show_hints;
      depthBarInput.checked = opts.depth_bar;
      evalBarInput.checked = opts.evaluation_bar;
      autoMoveInput.checked = opts.auto_move;
    });
  }

  function saveOptions() {
    const opts = {
      depth: parseInt(depthInput.value, 10),
      threads: 2,
      show_hints: hintsInput.checked,
      move_analysis: true,
      depth_bar: depthBarInput.checked,
      evaluation_bar: evalBarInput.checked,
      auto_move: autoMoveInput.checked
    };

    depthVal.textContent = opts.depth;

    chrome.storage.sync.set(opts, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'UpdateOptions', data: opts }).catch(() => {});
        }
      });
    });
  }

  depthInput.addEventListener('input', saveOptions);
  hintsInput.addEventListener('change', saveOptions);
  depthBarInput.addEventListener('change', saveOptions);
  evalBarInput.addEventListener('change', saveOptions);
  autoMoveInput.addEventListener('change', saveOptions);

  loadOptions();
});
