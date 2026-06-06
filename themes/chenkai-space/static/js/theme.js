(function () {
  const stored = localStorage.getItem("theme") || "dark";
  const palette = localStorage.getItem("palette") || "midnight";
  document.documentElement.setAttribute("data-theme", stored);
  document.documentElement.setAttribute("data-palette", palette);
})();

function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
}

function setPalette(name) {
  document.documentElement.setAttribute("data-palette", name);
  localStorage.setItem("palette", name);
  document.querySelectorAll(".palette-card").forEach(el => {
    el.classList.toggle("active", el.dataset.palette === name);
  });
  document.querySelectorAll(".test-controls button[data-palette]").forEach(el => {
    el.classList.toggle("active", el.dataset.palette === name);
  });
}
