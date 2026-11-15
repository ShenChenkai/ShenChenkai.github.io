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
