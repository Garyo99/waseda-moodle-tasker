document.addEventListener("DOMContentLoaded", () => {
  const openSettings = document.getElementById("openSettings");
  const closeSettings = document.getElementById("closeSettings");
  const mainView = document.getElementById("mainView");
  const settingsView = document.getElementById("settingsView");
  const autoRedirectSetting = document.getElementById("autoRedirectSetting");
  const autoDoneEventSetting = document.getElementById("autoDoneEventSetting");
  const daysSettingInput = document.getElementById("daysSetting");

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
    {
      autoRedirect: false,
      autoDoneEvent: false,
      events: [],
      lastUpdate: 0,
      daysSetting: 14,
      eventStatus: [],
    },
    (res) => {
      autoRedirectSetting.checked = res.autoRedirect;
      autoDoneEventSetting.checked = res.autoDoneEvent;
      daysSettingInput.value = res.daysSetting;
      renderEvents(res.events);
      if (res.lastUpdate) {
        lastUpdateDiv.textContent =
          "最終更新: " + formatTimestamp(res.lastUpdate);
      }
    }
  );

  openSettings.addEventListener("click", () => {
    mainView.classList.add("hidden");
    settingsView.classList.remove("hidden");
  });
  closeSettings.addEventListener("click", () => {
    settingsView.classList.add("hidden");
    mainView.classList.remove("hidden");
  });

  autoRedirectSetting.addEventListener("change", () => {
    chrome.storage.sync.set({ autoRedirect: autoRedirectSetting.checked });
  });
  autoDoneEventSetting.addEventListener("change", () => {
    chrome.storage.sync.set({ autoDoneEvent: autoDoneEventSetting.checked });
    if (!autoDoneEventSetting.checked) {
      chrome.storage.sync.set({ eventStatus: [] });
      chrome.storage.sync.get({ events: [] }, (data) =>
        renderEvents(data.events)
      );
    }
  });
  daysSettingInput.addEventListener("change", () => {
    let v = parseInt(daysSettingInput.value, 10);
    if (isNaN(v) || v < 1) {
      v = 1;
      daysSettingInput.value = v;
    }
    chrome.storage.sync.set({ daysSetting: v });
  });

  function renderEvents(events) {
    if (!Array.isArray(events)) {
      console.error("renderEvents: events is not an array", events);
      eventsList.innerHTML = "<li>イベントデータが不正です</li>";
      return;
    }

    chrome.storage.sync.get({ eventStatus: [] }, (res) => {
      let eventStatus = res.eventStatus;
      if (!Array.isArray(eventStatus)) {
        console.warn("eventStatus is not an array", eventStatus);
        eventStatus = [];
      }

      const filtered = events.filter((e) => {
        if (!e || typeof e.url !== "string") {
          console.warn("invalid event", e);
          return false;
        }
        const m = e.url.match(/\bid=(\d+)/);
        if (m) {
          const id = Number(m[1]);
          return !eventStatus.some(
            (item) => item.id === id && [1, 2, 3].includes(item.status)
          );
        }
        return true;
      });

      const today0 = new Date();
      today0.setHours(0, 0, 0, 0);

      eventsList.innerHTML = filtered.length
        ? filtered
            .map((e) => {
              const m = e.date.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
              let cls = "";
              if (m) {
                const [_, Y, Mo, Da] = m;
                const d = new Date(+Y, +Mo - 1, +Da);
                const diff =
                  (d.getTime() - today0.getTime()) / (1000 * 60 * 60 * 24);
                if (diff === 0 || diff === 1) cls = "soon";
              }
              return `
                <li data-url="${e.url}">
                  <div class="event-info ${cls}">
                    <div class="event-date">${e.date}</div>
                    <div>${e.title}</div>
                    <div>${e.course}</div>
                  </div>
                  <div class="action-buttons">
                    <img src="icons/check-solid.svg" alt="完了" />
                    <img src="icons/xmark-solid.svg" alt="削除" />
                  </div>
                </li>`;
            })
            .join("")
        : "<li>イベントはありません</li>";
    });
  }

  eventsList.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-url]");
    if (!li) return;

    const url = li.dataset.url;
    const m = url.match(/\bid=(\d+)/);
    if (!m) return;
    const id = Number(m[1]);

    if (e.target.closest(".action-buttons")) {
      const alt = e.target.getAttribute("alt");
      let status = null;
      if (alt === "完了") status = 2;
      else if (alt === "削除") status = 3;

      if (status !== null) {
        chrome.storage.sync.get({ eventStatus: [] }, ({ eventStatus }) => {
          if (
            !eventStatus.some(
              (item) => item.id === id && item.status === status
            )
          ) {
            eventStatus.push({ id, status });
            chrome.storage.sync.set({ eventStatus }, () => {
              li.style.transition = "opacity 0.5s";
              li.classList.add("fade-out");
              li.addEventListener("transitionend", () => li.remove(), {
                once: true,
              });
            });
          }
        });
      }
      return;
    }

    chrome.tabs.create({ url });
  });

  updateButton.addEventListener("click", () => {
    updateButton.disabled = true;
    chrome.runtime.sendMessage({ action: "fetchEvents" }, (res) => {
      if (res.success) {
        chrome.storage.sync.set(
          { events: res.events, lastUpdate: res.lastUpdate },
          () => {
            renderEvents(res.events);
            lastUpdateDiv.textContent =
              "最終更新: " + formatTimestamp(res.lastUpdate);
            updateButton.disabled = false;
          }
        );
      } else {
        eventsList.innerHTML = `<li style=\"color:red\">取得失敗: ${res.error}</li>`;
        updateButton.disabled = false;
      }
    });
  });
});
