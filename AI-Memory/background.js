chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  if (command === "jump_to_start") {
    chrome.tabs.sendMessage(tab.id, {
      type: "cbt-command",
      command: "jump_to_start",
    });
  } else if (command === "jump_to_first_omitted") {
    chrome.tabs.sendMessage(tab.id, {
      type: "cbt-command",
      command: "jump_to_first_omitted",
    });
  } else if (command === "toggle_highlights") {
    chrome.tabs.sendMessage(tab.id, {
      type: "cbt-command",
      command: "toggle_highlights",
    });
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  chrome.tabs.sendMessage(tab.id, {
    type: "cbt-command",
    command: "toggle_panel",
  });
});
