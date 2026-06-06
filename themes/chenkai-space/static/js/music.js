(function () {
  const COLORS = [
    "#8b5cf6", "#e040bb", "#f0408a", "#f0502a",
    "#f08020", "#f0c820", "#90c830", "#40b848",
  ];
  const LS_KEY = "music_albums_extra";

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function baseAlbums() {
    return Array.isArray(window.__MUSIC_ALBUMS__) ? window.__MUSIC_ALBUMS__ : [];
  }

  function extraAlbums() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch (e) { return []; }
  }

  function allAlbums() {
    return baseAlbums().concat(extraAlbums());
  }

  function albumEl(a, i) {
    const link = a.link && a.link !== "#" ? a.link : null;
    const el = document.createElement(link ? "a" : "div");
    el.className = "album";
    if (link) {
      el.href = link;
      el.target = "_blank";
      el.rel = "noopener noreferrer";
    }

    if (a.cover) {
      const img = document.createElement("img");
      img.src = a.cover;
      img.alt = a.title || "";
      img.loading = "lazy";
      el.appendChild(img);
    } else {
      el.classList.add("album--placeholder");
      el.style.setProperty("--tile", COLORS[i % COLORS.length]);
      const t = document.createElement("span");
      t.className = "album-ph-title";
      t.textContent = a.title || "";
      el.appendChild(t);
    }

    const cap = document.createElement("span");
    cap.className = "album-caption";
    cap.innerHTML =
      "<strong>" + escapeHtml(a.title) + "</strong>" +
      (a.artist ? "<em>" + escapeHtml(a.artist) + "</em>" : "");
    el.appendChild(cap);
    return el;
  }

  function render() {
    const albums = allAlbums();
    const empty = document.getElementById("music-empty");
    const rows = document.querySelectorAll(".music-row");

    if (empty) empty.hidden = albums.length > 0;

    rows.forEach((row) => {
      row.innerHTML = "";
      if (!albums.length) return;
      // Duplicate the set so the marquee loops seamlessly (translateX -50%).
      for (let dup = 0; dup < 2; dup++) {
        albums.forEach((a, i) => row.appendChild(albumEl(a, i)));
      }
    });
  }

  document.addEventListener("DOMContentLoaded", render);
})();
