(() => {
  let buttons = [];
  let localAudio = null;

  function rowOf(btn) {
    return btn.closest(".track") || btn.closest(".album");
  }

  function clearButtons() {
    buttons.forEach((b) => {
      b.setAttribute("aria-pressed", "false");
      rowOf(b)?.classList.remove("is-playing");
    });
  }

  function getLocal() {
    if (!localAudio) {
      localAudio = new Audio();
      localAudio.preload = "none";
      localAudio.addEventListener("ended", () => {
        clearButtons();
        localAudio.removeAttribute("src");
        localAudio.load();
      });
    }
    return localAudio;
  }

  function stopLocal() {
    if (!localAudio) return;
    localAudio.pause();
    localAudio.removeAttribute("src");
    localAudio.load();
  }

  function stop() {
    if (window.TaoChnBgm) window.TaoChnBgm.stopTrack();
    else stopLocal();
    clearButtons();
  }

  function play(btn, pushHash) {
    const src = btn.getAttribute("data-preview");
    if (!src) return;
    const row = rowOf(btn);
    const already = btn.getAttribute("aria-pressed") === "true";
    const title = (row && row.querySelector(".track-title")?.textContent.trim()) || "";
    const artist = (row && row.querySelector(".track-artist")?.textContent.trim()) || "";
    const cover = document.querySelector(".release-cover img, .sleeve-lg img")?.getAttribute("src") || "";

    if (already) {
      stop();
      if (row && row.id) history.replaceState(null, "", location.pathname + location.search);
      return;
    }

    clearButtons();
    const onStop = () => {
      btn.setAttribute("aria-pressed", "false");
      rowOf(btn)?.classList.remove("is-playing");
    };

    if (window.TaoChnBgm) {
      const state = window.TaoChnBgm.playTrack(src, { title, artist, cover }, onStop);
      if (state === "paused") {
        if (row && row.id) history.replaceState(null, "", location.pathname + location.search);
        return;
      }
    } else {
      stopLocal();
      const audio = getLocal();
      audio.src = src;
      const start = audio.play();
      if (start && start.catch) start.catch(() => {});
    }

    btn.setAttribute("aria-pressed", "true");
    row?.classList.add("is-playing");
    if (pushHash && row && row.id) {
      history.replaceState(null, "", "#" + row.id);
    }
  }

  function bind() {
    buttons = Array.from(document.querySelectorAll(".album-play[data-preview]"));
    buttons.forEach((btn) => {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => play(btn, true));
    });
  }

  function fromHash() {
    const id = decodeURIComponent((location.hash || "").replace(/^#/, ""));
    if (!id) return;
    const row = document.getElementById(id);
    const btn = row && row.querySelector(".album-play[data-preview]");
    if (btn && btn.getAttribute("aria-pressed") !== "true") play(btn, false);
  }

  function init() {
    bind();
    fromHash();
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("taochin:page", init);
  window.addEventListener("hashchange", fromHash);
  if (document.readyState !== "loading") init();
})();
