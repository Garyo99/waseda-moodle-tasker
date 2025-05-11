chrome.storage.sync.get(
  ["autoRedirect", "autoDoneEvent"],
  ({ autoRedirect, autoDoneEvent }) => {
    if (autoRedirect && location.href === "https://wsdmoodle.waseda.jp/") {
      location.href = "https://wsdmoodle.waseda.jp/my";
      return;
    }

    if (autoDoneEvent) {
      const match = location.href.match(/\/mod\/assign\/view\.php\?id=(\d+)/);
      if (match && document.querySelector("td.submissionstatussubmitted")) {
        const id = Number(match[1]);
        chrome.storage.sync.get({ eventStatus: [] }, ({ eventStatus }) => {
          if (!eventStatus.some((item) => item.id === id)) {
            eventStatus.push({ id, status: 1 });
            chrome.storage.sync.set({ eventStatus });
          }
        });
      }
    }
  }
);
