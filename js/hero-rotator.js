(function () {
  var rotator = document.querySelector(".almas-hero-rotator");
  if (!rotator) return;

  var slides = Array.prototype.slice.call(rotator.querySelectorAll(".almas-hero-slide"));
  if (slides.length < 2) return;

  var dots = document.createElement("div");
  dots.className = "almas-hero-rotator-dots";
  var dotButtons = slides.map(function (_, dotIndex) {
    var button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", "Show hero image " + (dotIndex + 1));
    if (dotIndex === 0) button.className = "active";
    dots.appendChild(button);
    return button;
  });
  rotator.appendChild(dots);

  function updateDots() {
    dotButtons.forEach(function (button, dotIndex) {
      button.classList.toggle("active", dotIndex === index);
    });
  }

  var index = 0;
  var timer;

  function showImage(nextIndex) {
    if (nextIndex === index) return;
    var previous = index;
    index = nextIndex;

    slides.forEach(function (slide) {
      slide.classList.remove("active", "previous");
    });

    slides[previous].classList.add("previous");
    slides[index].classList.add("active");
    updateDots();
  }

  function startTimer() {
    window.clearInterval(timer);
    timer = window.setInterval(function () {
      showImage((index + 1) % slides.length);
    }, 4500);
  }

  function pauseTimer() {
    window.clearInterval(timer);
  }

  dotButtons.forEach(function (button, dotIndex) {
    button.addEventListener("click", function () {
      showImage(dotIndex);
      startTimer();
    });
  });

  rotator.addEventListener("mouseenter", pauseTimer);
  rotator.addEventListener("mouseleave", startTimer);
  rotator.addEventListener("focusin", pauseTimer);
  rotator.addEventListener("focusout", startTimer);

  startTimer();
})();
