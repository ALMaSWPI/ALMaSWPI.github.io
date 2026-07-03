(function () {
  var video = document.querySelector(".almas-hero-bg-video");
  var hero = document.querySelector("#almas-hero");
  var toggle = document.querySelector(".almas-video-toggle");

  if (!video || !hero || !toggle) return;

  var playlist = [
    "Videos/1.mov",
    "Videos/2.mp4",
    "Videos/4.mp4",
    "Videos/5.mp4",
    "Videos/6.mp4",
    "Videos/7.mov",
    "Videos/8.mov"
  ];
  var currentVideo = 0;
  var isAdvancing = false;
  var userPaused = false;
  var fadeSeconds = 0.18;
  var fadeMilliseconds = 160;
  var toggleIcon = toggle.querySelector("i");

  function setVideoFraming() {
    var aspectRatio = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
    var hasDifferentRatio = Math.abs(aspectRatio - (16 / 9)) > 0.04;
    video.classList.toggle("crop-bottom", hasDifferentRatio);
  }

  function setToggleState() {
    var isPaused = video.paused;
    toggle.setAttribute("aria-label", isPaused ? "Play background video" : "Pause background video");
    toggle.setAttribute("title", isPaused ? "Play video" : "Pause video");
    if (toggleIcon) {
      toggleIcon.className = isPaused ? "fa fa-play" : "fa fa-pause";
    }
  }

  function ensurePlaying() {
    if (!userPaused && video.paused) {
      video.play();
    }
  }

  function playCurrentVideo() {
    video.src = playlist[currentVideo];
    video.currentTime = 0;
    video.load();
  }

  function advanceVideo() {
    if (isAdvancing) return;
    isAdvancing = true;
    hero.classList.add("is-video-fading");

    window.setTimeout(function () {
      currentVideo = (currentVideo + 1) % playlist.length;
      playCurrentVideo();
    }, fadeMilliseconds);
  }

  toggle.addEventListener("click", function () {
    if (video.paused) {
      userPaused = false;
      video.play();
    } else {
      userPaused = true;
      video.pause();
    }
    setToggleState();
  });

  video.addEventListener("loadedmetadata", setVideoFraming);
  video.addEventListener("canplay", function () {
    if (!isAdvancing) return;
    ensurePlaying();
    window.setTimeout(function () {
      hero.classList.remove("is-video-fading");
      isAdvancing = false;
      setToggleState();
    }, 50);
  });
  video.addEventListener("timeupdate", function () {
    if (isAdvancing || !video.duration) return;
    if (video.currentTime >= video.duration - fadeSeconds) {
      advanceVideo();
    }
  });
  video.addEventListener("ended", advanceVideo);
  video.addEventListener("play", function () {
    userPaused = false;
    setToggleState();
  });
  video.addEventListener("pause", setToggleState);
  window.setInterval(function () {
    if (!isAdvancing) ensurePlaying();
  }, 1000);

  setVideoFraming();
  setToggleState();
})();
