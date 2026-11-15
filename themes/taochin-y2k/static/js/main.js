(() => {
  let counted = false;

  function init() {
    const hits = document.querySelector("[data-local-hits]");
    if (hits && !counted) {
      counted = true;
      const key = "taochin-local-hits";
      const n = Number(localStorage.getItem(key) || 0) + 1;
      localStorage.setItem(key, String(n));
      hits.textContent = "Visits " + n;
    } else if (hits && counted) {
      const key = "taochin-local-hits";
      const n = Number(localStorage.getItem(key) || 0);
      hits.textContent = "Visits " + n;
    }

    document.querySelectorAll(".sleeve img, .corner-row img").forEach((img) => {
      if (img.dataset.bound === "1") return;
      img.dataset.bound = "1";
      img.addEventListener("error", () => {
        img.hidden = true;
        const wrap = img.closest(".sleeve, a");
        if (wrap) wrap.classList.add("is-bare");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("taochin:page", init);
  if (document.readyState !== "loading") init();
})();

// Pic lightbox: a .saying-pics thumbnail FLIP-zooms to a centered view;
// click or Esc plays the transition back to the thumbnail.
(() => {
  let overlay, big, startRect = null, active = false, hideTimer = 0;

  function ensure() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "pic-lightbox";
    overlay.hidden = true;
    big = document.createElement("img");
    big.alt = "";
    overlay.appendChild(big);
    document.body.appendChild(overlay);
    overlay.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && active) close();
    });
  }

  function place(rect) {
    const m = 28;
    const k = Math.min(
      (innerWidth - m * 2) / big.naturalWidth,
      (innerHeight - m * 2) / big.naturalHeight,
      3
    );
    const w = big.naturalWidth * k;
    const h = big.naturalHeight * k;
    const left = (innerWidth - w) / 2;
    const top = (innerHeight - h) / 2;
    big.style.left = left + "px";
    big.style.top = top + "px";
    big.style.width = w + "px";
    big.style.height = h + "px";
    big.style.transform =
      "translate(" + (rect.left - left) + "px," + (rect.top - top) + "px) scale(" +
      rect.width / w + "," + rect.height / h + ")";
  }

  function open(thumb) {
    ensure();
    clearTimeout(hideTimer);
    big.onload = null;
    startRect = thumb.getBoundingClientRect();
    active = true;
    big.src = thumb.currentSrc || thumb.src;
    big.style.width = startRect.width + "px";
    big.style.height = startRect.height + "px";
    big.style.left = startRect.left + "px";
    big.style.top = startRect.top + "px";
    big.style.transform = "none";
    overlay.hidden = false;
    document.body.classList.add("pic-zoom-lock");
    requestAnimationFrame(() => overlay.classList.add("is-open"));

    const zoomIn = () => {
      if (!active) return;
      place(startRect);
      // Drop the inline transform so the transition lands on the centered
      // resting state (inline style would override any class target).
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (active) big.style.transform = "";
      }));
    };
    // Right after assigning src, complete may still describe the previous
    // image — only take the fast path when it is really the clicked one.
    if (big.complete && big.naturalWidth && big.currentSrc === thumb.currentSrc) zoomIn();
    else big.onload = () => { big.onload = null; zoomIn(); };
  }

  function close() {
    if (!active || !startRect) return;
    active = false;
    place(startRect);
    overlay.classList.remove("is-open");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      overlay.hidden = true;
      document.body.classList.remove("pic-zoom-lock");
      big.removeAttribute("src");
      startRect = null;
    }, 340);
  }

  document.addEventListener("click", (e) => {
    const thumb = e.target.closest && e.target.closest(".saying-pics img");
    if (thumb) open(thumb);
  });
})();
