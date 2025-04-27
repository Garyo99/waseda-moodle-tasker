document.addEventListener("DOMContentLoaded", () => {
  const autoRedirectCheckbox = document.getElementById("autoRedirect");
  const eventsList = document.getElementById("eventsList");
  const updateButton = document.getElementById("updateButton");
  const lastUpdateDiv = document.getElementById("lastUpdate");

  function formatTimestamp(ts) {
    const d = new Date(ts);
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, "0");
    const D = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${Y}/${M}/${D} ${h}:${m}:${s}`;
  }

  chrome.storage.sync.get(
    { autoRedirect: false, events: [], lastUpdate: 0 },
    (res) => {
      autoRedirectCheckbox.checked = res.autoRedirect;
      renderEvents(res.events);
      if (res.lastUpdate) {
        lastUpdateDiv.textContent =
          "最終更新: " + formatTimestamp(res.lastUpdate);
      }
    }
  );

  autoRedirectCheckbox.addEventListener("change", () => {
    chrome.storage.sync.set({ autoRedirect: autoRedirectCheckbox.checked });
  });

  function renderEvents(events) {
    const now = new Date();
    const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    eventsList.innerHTML =
      events && events.length
        ? events
            .map((e) => {
              const m = e.date.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
              let cls = "";
              if (m) {
                const [_, Y, Mo, Da] = m;
                const eventDay = new Date(
                  Number(Y),
                  Number(Mo) - 1,
                  Number(Da)
                );
                const diffDays =
                  (eventDay.getTime() - today0.getTime()) /
                  (1000 * 60 * 60 * 24);
                if (diffDays === 0 || diffDays === 1) {
                  cls = "soon";
                }
              }
              return `
                    <li class="${cls}" data-url="${e.url}">
                      <div class="event-date">${e.date}</div>
                      <div>${e.title}</div>
                      <div>${e.course}</div>
                    </li>`;
            })
            .join("")
        : "<li>イベントはありません</li>";
  }

  function saveAndRender(events, lastUpdate) {
    chrome.storage.sync.set({ events, lastUpdate }, () => {
      renderEvents(events);
      lastUpdateDiv.textContent = "最終更新: " + formatTimestamp(lastUpdate);
    });
  }

  eventsList.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-url]");
    if (!li) return;
    chrome.tabs.create({ url: li.getAttribute("data-url") });
  });

  updateButton.addEventListener("click", () => {
    updateButton.disabled = true;
    chrome.runtime.sendMessage({ action: "fetchEvents" }, (res) => {
      if (res.success) {
        saveAndRender(res.events, res.lastUpdate);
      } else {
        eventsList.innerHTML = `<li style="color:red">取得失敗: ${res.error}</li>`;
      }
      updateButton.disabled = false;
    });
  });
});
