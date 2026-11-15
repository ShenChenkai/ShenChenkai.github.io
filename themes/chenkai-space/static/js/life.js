// Life photo lightbox: click a photo to zoom it to a centered overlay;
// click anywhere outside the image (or press Esc) to close.
(function () {
  var photos = document.querySelectorAll(".life-gallery a.life-photo");
  if (!photos.length) return;

  var overlay = document.createElement("div");
  overlay.className = "life-lightbox";
  overlay.setAttribute("hidden", "");
  var big = document.createElement("img");
  big.alt = "";
  overlay.appendChild(big);
  document.body.appendChild(overlay);

  function open(src) {
    big.src = src;
    overlay.removeAttribute("hidden");
    document.body.classList.add("life-lightbox-lock");
    // Next frame so the transition runs from the hidden state.
    requestAnimationFrame(function () { overlay.classList.add("is-open"); });
  }

  function close() {
    overlay.classList.remove("is-open");
    document.body.classList.remove("life-lightbox-lock");
    var onEnd = function (e) {
      if (e.target !== overlay) return;      // ignore the image's own transition
      if (overlay.classList.contains("is-open")) return; // reopened mid-close
      overlay.setAttribute("hidden", "");
      big.removeAttribute("src");
      overlay.removeEventListener("transitionend", onEnd);
    };
    overlay.addEventListener("transitionend", onEnd);
  }

  photos.forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      open(a.getAttribute("href"));
    });
  });

  // Clicking outside the image closes; clicking the image itself keeps it open.
  overlay.addEventListener("click", function (e) {
    if (e.target !== big) close();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !overlay.hasAttribute("hidden")) close();
  });
})();
