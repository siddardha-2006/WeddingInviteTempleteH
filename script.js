/**
 * Wedding Invitation Website
 * Flow:
 * 1. Starting state: Blur-themed background displaying the video's starting frame with "Tap to Begin"
 * 2. Play state: User taps button -> plays video with audio & ambient reflections
 * 3. Completion state: Video completes -> Video's last frame becomes the website background
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const tapScreen = document.getElementById('tapScreen');
  const videoScreen = document.getElementById('videoScreen');
  const finalScreen = document.getElementById('finalScreen');
  const tapToBeginBtn = document.getElementById('tapToBeginBtn');
  const replayBtn = document.getElementById('replayBtn');
  const mainVideo = document.getElementById('mainVideo');
  const bgVideo = document.getElementById('bgVideo');
  const endFrameBackdrop = document.getElementById('endFrameBackdrop');
  const bgMusic = document.getElementById('bgMusic');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const iconSoundOn = document.getElementById('iconSoundOn');
  const iconSoundOff = document.getElementById('iconSoundOff');
  const skipToDetailsBtn = document.getElementById('skipToDetailsBtn');
  const finalSoundBtn = document.getElementById('finalSoundBtn');
  const finalIconSoundOn = document.getElementById('finalIconSoundOn');
  const finalIconSoundOff = document.getElementById('finalIconSoundOff');
  const videoRestartBtn = document.getElementById('videoRestartBtn');
  const restartSiteBtn = document.getElementById('restartSiteBtn');
  const progressBar = document.getElementById('progressBar');
  const playIndicator = document.getElementById('playIndicator');
  const frameCanvas = document.getElementById('frameCanvas');
  const videoCard = document.querySelector('.video-card');

  let isPlaying = false;
  let videoFinished = false;
  let resetHeartCardStack = null;

  // ---------------------------------------------------------------------------
  // 1. Initial State Setup: Display First Frame as Background
  // ---------------------------------------------------------------------------
  function initializeStartingFrame() {
    // Force decoder to show first frame (0.01s avoids black frame bug on some mobile browsers)
    const setFirstFrame = (videoEl) => {
      if (videoEl) {
        videoEl.currentTime = 0.01;
      }
    };

    if (bgVideo.readyState >= 1) {
      setFirstFrame(bgVideo);
    } else {
      bgVideo.addEventListener('loadedmetadata', () => setFirstFrame(bgVideo), { once: true });
    }

    if (mainVideo.readyState >= 1) {
      setFirstFrame(mainVideo);
    } else {
      mainVideo.addEventListener('loadedmetadata', () => setFirstFrame(mainVideo), { once: true });
    }
  }

  initializeStartingFrame();

  // ---------------------------------------------------------------------------
  // 2. Tap to Begin: Start Video Playback
  // ---------------------------------------------------------------------------
  function startExperience() {
    if (isPlaying) return;
    isPlaying = true;
    videoFinished = false;

    // Transition overlay: hide tap screen, show video screen
    tapScreen.classList.remove('active');
    videoScreen.classList.add('active');

    // Attempt to enter immersive fullscreen (avoids browser tabs & address bar)
    try {
      const docEl = document.documentElement;
      const reqFs = docEl.requestFullscreen ||
                    docEl.webkitRequestFullscreen ||
                    docEl.mozRequestFullScreen ||
                    docEl.msRequestFullscreen;
      if (reqFs && !document.fullscreenElement && !document.webkitFullscreenElement) {
        const p = reqFs.call(docEl);
        if (p && p.then) {
          p.then(() => updateFullscreenClasses()).catch(() => {});
        } else {
          setTimeout(updateFullscreenClasses, 120);
        }
      }
    } catch (fsErr) {
      // Continue smoothly if fullscreen is restricted
    }

    // Start background music (Sita Ramam Veena) and keep main video muted
    mainVideo.muted = true;
    if (bgMusic) {
      bgMusic.muted = false;
      bgMusic.volume = 1.0;
      bgMusic.currentTime = 0;
      bgMusic.play().catch(e => console.warn('Music play error:', e));
    }
    updateSoundIcons(false);

    // Reset video positions
    mainVideo.currentTime = 0;
    bgVideo.currentTime = 0;

    // Play videos
    const playPromise = mainVideo.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          bgVideo.play().catch(e => console.warn('Ambient video autoplay restricted:', e));
        })
        .catch(err => {
          console.warn('Playback error:', err);
          mainVideo.play().catch(() => {});
          bgVideo.play().catch(() => {});
        });
    }
  }

  tapToBeginBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startExperience();
  });

  // Also allow tapping anywhere on tapScreen to start
  tapScreen.addEventListener('click', () => {
    startExperience();
  });

  // ---------------------------------------------------------------------------
  // 2b. Fullscreen State Synchronization (Mobile Notch & Cutout Safe Clearance)
  // ---------------------------------------------------------------------------
  function updateFullscreenClasses() {
    const isFs = Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    if (isFs) {
      document.documentElement.classList.add('is-fullscreen');
      document.body.classList.add('is-fullscreen');
    } else {
      document.documentElement.classList.remove('is-fullscreen');
      document.body.classList.remove('is-fullscreen');
    }
  }

  document.addEventListener('fullscreenchange', updateFullscreenClasses);
  document.addEventListener('webkitfullscreenchange', updateFullscreenClasses);
  document.addEventListener('mozfullscreenchange', updateFullscreenClasses);
  document.addEventListener('MSFullscreenChange', updateFullscreenClasses);

  // ---------------------------------------------------------------------------
  // 3. Video Progress & Synchronization
  // ---------------------------------------------------------------------------
  mainVideo.addEventListener('timeupdate', () => {
    if (!mainVideo.duration) return;

    // Update progress bar
    const progress = (mainVideo.currentTime / mainVideo.duration) * 100;
    progressBar.style.width = `${progress}%`;

    // Keep ambient background in sync (if drifted by more than 0.3s)
    if (Math.abs(bgVideo.currentTime - mainVideo.currentTime) > 0.3) {
      bgVideo.currentTime = mainVideo.currentTime;
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Guaranteed Final Frame Extraction & Website Background Setup
  // ---------------------------------------------------------------------------
  let cachedFinalFrameUrl = null;
  let isExtractingFinalFrame = false;

  function preExtractFinalFrame() {
    if (isExtractingFinalFrame || cachedFinalFrameUrl) return;
    isExtractingFinalFrame = true;

    const extractor = document.createElement('video');
    extractor.src = 'MarriageVideo.mp4';
    extractor.muted = true;
    extractor.playsInline = true;
    extractor.preload = 'auto';

    extractor.addEventListener('loadedmetadata', () => {
      // Seek to stable final frame (duration - 0.08s avoids EOF black-frame anomaly)
      const targetTime = Math.max(0, (extractor.duration || 10) - 0.08);
      extractor.currentTime = targetTime;
    }, { once: true });

    extractor.addEventListener('seeked', () => {
      try {
        if (!frameCanvas) return;
        frameCanvas.width = extractor.videoWidth || 1080;
        frameCanvas.height = extractor.videoHeight || 1920;
        const ctx = frameCanvas.getContext('2d');
        ctx.drawImage(extractor, 0, 0, frameCanvas.width, frameCanvas.height);
        const lastFrameUrl = frameCanvas.toDataURL('image/jpeg', 0.95);
        cachedFinalFrameUrl = lastFrameUrl;

        // If completion or skip was triggered before pre-extraction finished, apply immediately
        if (videoFinished && endFrameBackdrop) {
          endFrameBackdrop.style.backgroundImage = `url(${lastFrameUrl})`;
          endFrameBackdrop.classList.add('visible');
        }
      } catch (err) {
        console.warn('Final frame pre-extraction warning:', err);
      } finally {
        try {
          extractor.removeAttribute('src');
          extractor.load();
        } catch (e) {}
      }
    }, { once: true });
  }

  // Pre-extract final frame in background immediately on page load
  preExtractFinalFrame();

  function applyFinalFrameBackground() {
    const targetTime = Math.max(0, (mainVideo.duration || 10) - 0.08);

    // 1. If final frame is already cached, apply immediately with zero delay
    if (cachedFinalFrameUrl && endFrameBackdrop) {
      endFrameBackdrop.style.backgroundImage = `url(${cachedFinalFrameUrl})`;
      endFrameBackdrop.classList.add('visible');
      bgVideo.currentTime = targetTime;
      bgVideo.pause();
      mainVideo.currentTime = targetTime;
      mainVideo.pause();
      return;
    }

    // 2. If not yet cached, seek to targetTime and capture only AFTER seek completes
    let captured = false;
    const captureFromVideo = (vEl) => {
      if (captured || !vEl || !frameCanvas || !endFrameBackdrop) return;
      try {
        frameCanvas.width = vEl.videoWidth || 1080;
        frameCanvas.height = vEl.videoHeight || 1920;
        const ctx = frameCanvas.getContext('2d');
        ctx.drawImage(vEl, 0, 0, frameCanvas.width, frameCanvas.height);
        const dataUrl = frameCanvas.toDataURL('image/jpeg', 0.95);
        cachedFinalFrameUrl = dataUrl;
        endFrameBackdrop.style.backgroundImage = `url(${dataUrl})`;
        endFrameBackdrop.classList.add('visible');
        captured = true;
      } catch (err) {
        console.warn('Canvas capture fallback:', err);
        endFrameBackdrop.classList.add('visible');
      }
    };

    const onSeekedCapture = (e) => {
      captureFromVideo(e.target);
    };

    mainVideo.addEventListener('seeked', onSeekedCapture, { once: true });
    bgVideo.addEventListener('seeked', onSeekedCapture, { once: true });

    mainVideo.currentTime = targetTime;
    bgVideo.currentTime = targetTime;
    mainVideo.pause();
    bgVideo.pause();

    // Safety timeout in case seeked event is delayed
    setTimeout(() => {
      if (!captured && !cachedFinalFrameUrl) {
        captureFromVideo(bgVideo.readyState >= 2 ? bgVideo : mainVideo);
      }
    }, 180);
  }

  // Backward compatible alias
  function captureLastFrame() {
    applyFinalFrameBackground();
  }

  // ---------------------------------------------------------------------------
  // 5. Completion State: Video Ended or Skipped -> Last Frame as Website Background
  // ---------------------------------------------------------------------------
  function handleVideoCompletion() {
    if (videoFinished) return;
    videoFinished = true;
    isPlaying = false;

    // Enable completion mode on ambient container: unblurs bgVideo to be crisp website background
    const ambientContainer = document.getElementById('ambientContainer');
    if (ambientContainer) {
      ambientContainer.classList.add('completion-mode');
    }

    // Apply the guaranteed final frame to the website background (even if skipped early)
    applyFinalFrameBackground();

    // Transition from video stage to final invitation screen
    videoScreen.classList.remove('active');
    finalScreen.classList.add('active');

    // Ensure background music keeps playing on the wedding invitation
    if (bgMusic && !bgMusic.muted && bgMusic.paused) {
      bgMusic.play().catch(() => {});
    }
  }

  mainVideo.addEventListener('ended', handleVideoCompletion);

  // Safety trigger for smooth finish right before video stream closes
  let completionFired = false;
  mainVideo.addEventListener('timeupdate', () => {
    if (mainVideo.duration && mainVideo.currentTime >= mainVideo.duration - 0.12 && !completionFired) {
      completionFired = true;
      handleVideoCompletion();
    }
  });

  // ---------------------------------------------------------------------------
  // 6. Replay Functionality
  // ---------------------------------------------------------------------------
  function replayExperience() {
    videoFinished = false;
    completionFired = false;
    isPlaying = true;

    // Reset ambient background mode back to video player mode
    const ambientContainer = document.getElementById('ambientContainer');
    if (ambientContainer) {
      ambientContainer.classList.remove('completion-mode');
    }

    // Hide final screen and hide backdrop image overlay
    finalScreen.classList.remove('active');
    endFrameBackdrop.classList.remove('visible');
    videoScreen.classList.add('active');

    // Reset progress
    progressBar.style.width = '0%';
    mainVideo.currentTime = 0;
    bgVideo.currentTime = 0;

    // Play again
    mainVideo.play();
    bgVideo.play().catch(() => {});

    // Ensure background music is playing
    if (bgMusic && !bgMusic.muted && bgMusic.paused) {
      bgMusic.play().catch(() => {});
    }
  }

  if (replayBtn) {
    replayBtn.addEventListener('click', replayExperience);
  }

  // ---------------------------------------------------------------------------
  // 6b. Restart Website from Beginning Functionality
  // ---------------------------------------------------------------------------
  function restartWholeWebsite(e) {
    if (e) e.stopPropagation();

    // Pause videos and audio
    mainVideo.pause();
    bgVideo.pause();
    mainVideo.currentTime = 0.01;
    bgVideo.currentTime = 0.01;

    if (bgMusic) {
      bgMusic.pause();
      bgMusic.currentTime = 0;
    }

    // Reset state flags
    isPlaying = false;
    videoFinished = false;
    completionFired = false;

    // Reset progress bar
    if (progressBar) {
      progressBar.style.width = '0%';
    }

    // Reset ambient background mode back to initial
    const ambientContainer = document.getElementById('ambientContainer');
    if (ambientContainer) {
      ambientContainer.classList.remove('completion-mode');
    }
    if (endFrameBackdrop) {
      endFrameBackdrop.classList.remove('visible');
    }

    // Reset screen transitions: return to Tap to Begin
    finalScreen.classList.remove('active');
    videoScreen.classList.remove('active');
    tapScreen.classList.add('active');

    // Scroll website back to top
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (finalScreen) finalScreen.scrollTop = 0;
    const mobileViewport = document.querySelector('.mobile-viewport');
    if (mobileViewport) mobileViewport.scrollTop = 0;

    // Reset heart card stack if inverted
    if (typeof resetHeartCardStack === 'function') {
      resetHeartCardStack();
    }

    // Keep sound icons properly synchronized
    if (bgMusic) {
      updateSoundIcons(bgMusic.muted);
    }

    // Keep fullscreen classes in sync
    updateFullscreenClasses();
  }

  if (videoRestartBtn) {
    videoRestartBtn.addEventListener('click', restartWholeWebsite);
  }
  if (restartSiteBtn) {
    restartSiteBtn.addEventListener('click', restartWholeWebsite);
  }

  // ---------------------------------------------------------------------------
  // 7. Video Controls: Sound Toggle & Skip (Screen tap disabled during playback)
  // ---------------------------------------------------------------------------
  function updateSoundIcons(isMuted) {
    if (iconSoundOn && iconSoundOff) {
      if (isMuted) {
        iconSoundOn.classList.add('hidden');
        iconSoundOff.classList.remove('hidden');
      } else {
        iconSoundOn.classList.remove('hidden');
        iconSoundOff.classList.add('hidden');
      }
    }
    if (finalIconSoundOn && finalIconSoundOff) {
      if (isMuted) {
        finalIconSoundOn.classList.add('hidden');
        finalIconSoundOff.classList.remove('hidden');
      } else {
        finalIconSoundOn.classList.remove('hidden');
        finalIconSoundOff.classList.add('hidden');
      }
    }
    if (soundToggleBtn) {
      soundToggleBtn.setAttribute('title', isMuted ? 'Unmute Music' : 'Mute Music');
      soundToggleBtn.setAttribute('aria-label', isMuted ? 'Unmute Music' : 'Mute Music');
    }
    if (finalSoundBtn) {
      finalSoundBtn.setAttribute('title', isMuted ? 'Unmute Music' : 'Mute Music');
      finalSoundBtn.setAttribute('aria-label', isMuted ? 'Unmute Music' : 'Mute Music');
    }
  }

  function toggleMusicMute(e) {
    if (e) e.stopPropagation();
    if (bgMusic) {
      bgMusic.muted = !bgMusic.muted;
      if (!mainVideo.paused && !bgMusic.muted) {
        bgMusic.play().catch(() => {});
      }
      updateSoundIcons(bgMusic.muted);
    }
  }

  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', toggleMusicMute);
  }
  if (finalSoundBtn) {
    finalSoundBtn.addEventListener('click', toggleMusicMute);
  }

  // Skip to Details Button (immediately skips video to wedding invitation)
  if (skipToDetailsBtn) {
    skipToDetailsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleVideoCompletion();
    });
  }

  // Tapping on screen while video is playing is disabled as requested;
  // only skip and music buttons at the bottom remain active.

  // Synchronize audio with video pause/play events
  mainVideo.addEventListener('pause', () => {
    if (!videoFinished && bgMusic) {
      bgMusic.pause();
    }
  });

  mainVideo.addEventListener('play', () => {
    if (!videoFinished && bgMusic && !bgMusic.muted) {
      bgMusic.play().catch(() => {});
    }
  });

  // ---------------------------------------------------------------------------
  // 8. Minimal, Seamless, Continuous Falling Lotus, Flowers & Leaves Animation
  // ---------------------------------------------------------------------------
  const petalsCanvas = document.getElementById('fallingPetalsCanvas');
  if (petalsCanvas) {
    const pCtx = petalsCanvas.getContext('2d');
    let width = 0;
    let height = 0;

    function resizeCanvas() {
      const rect = petalsCanvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      petalsCanvas.width = width * dpr;
      petalsCanvas.height = height * dpr;
      pCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const TYPES = ['lotus-petal', 'lotus-flower', 'jasmine-flower', 'gold-leaf'];
    const COUNT = 16; // Minimal and elegant

    function createPetal(randomY) {
      const safeWidth = width || window.innerWidth || 390;
      const safeHeight = height || window.innerHeight || 800;
      return {
        x: Math.random() * safeWidth,
        y: randomY ? Math.random() * safeHeight : -30 - Math.random() * 40,
        type: TYPES[Math.floor(Math.random() * TYPES.length)],
        size: 13 + Math.random() * 9,
        speedY: 0.65 + Math.random() * 0.75, // Gentle float
        speedX: (Math.random() - 0.5) * 0.35,
        angle: Math.random() * Math.PI * 2,
        angularSpeed: (Math.random() - 0.5) * 0.02,
        flip: Math.random() * Math.PI * 2,
        flipSpeed: 0.012 + Math.random() * 0.022,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.015 + Math.random() * 0.02,
        wobbleAmp: 0.7 + Math.random() * 1.1,
        opacity: 0.65 + Math.random() * 0.3
      };
    }

    const petals = [];
    for (let i = 0; i < COUNT; i++) {
      petals.push(createPetal(true));
    }

    function drawLotusPetal(ctx, size) {
      const grad = ctx.createLinearGradient(0, -size * 0.8, 0, size * 0.8);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#fbcfe8');
      grad.addColorStop(0.7, '#f472b6');
      grad.addColorStop(1, '#fde047');
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(0, -size * 0.85);
      ctx.bezierCurveTo(size * 0.52, -size * 0.4, size * 0.52, size * 0.4, 0, size * 0.85);
      ctx.bezierCurveTo(-size * 0.52, size * 0.4, -size * 0.52, -size * 0.4, 0, -size * 0.85);
      ctx.fill();

      // Delicate golden central vein
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.65);
      ctx.lineTo(0, size * 0.65);
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    function drawLotusFlower(ctx, size) {
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 3);
        const grad = ctx.createLinearGradient(0, -size * 0.45, 0, 0);
        grad.addColorStop(0, '#f472b6');
        grad.addColorStop(0.5, '#fbcfe8');
        grad.addColorStop(1, '#ffffff');
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.ellipse(0, -size * 0.35, size * 0.18, size * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = '#fef08a';
      ctx.fill();
    }

    function drawJasmineFlower(ctx, size) {
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI * 2) / 5);
        ctx.beginPath();
        ctx.ellipse(0, -size * 0.32, size * 0.16, size * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 252, 235, 0.95)';
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.14, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15';
      ctx.fill();
    }

    function drawGoldLeaf(ctx, size) {
      const grad = ctx.createLinearGradient(0, -size * 0.85, 0, size * 0.85);
      grad.addColorStop(0, '#fef08a');
      grad.addColorStop(0.5, '#d4af37');
      grad.addColorStop(1, '#854d0e');
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(0, -size * 0.85);
      ctx.quadraticCurveTo(size * 0.42, 0, 0, size * 0.85);
      ctx.quadraticCurveTo(-size * 0.42, 0, 0, -size * 0.85);
      ctx.fill();

      // Leaf rib
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.7);
      ctx.lineTo(0, size * 0.7);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    function renderPetals() {
      if (width > 0 && height > 0) {
        pCtx.clearRect(0, 0, width, height);

        for (let i = 0; i < petals.length; i++) {
          const p = petals[i];

          // Update physics
          p.y += p.speedY;
          p.wobble += p.wobbleSpeed;
          p.x += Math.sin(p.wobble) * p.wobbleAmp + p.speedX;
          p.angle += p.angularSpeed;
          p.flip += p.flipSpeed;

          // Render particle
          pCtx.save();
          pCtx.globalAlpha = p.opacity;
          pCtx.translate(p.x, p.y);
          pCtx.rotate(p.angle);
          // 3D tumble projection
          pCtx.scale(Math.cos(p.flip), 1);

          if (p.type === 'lotus-petal') {
            drawLotusPetal(pCtx, p.size);
          } else if (p.type === 'lotus-flower') {
            drawLotusFlower(pCtx, p.size);
          } else if (p.type === 'jasmine-flower') {
            drawJasmineFlower(pCtx, p.size);
          } else {
            drawGoldLeaf(pCtx, p.size);
          }

          pCtx.restore();

          // Continuous recycle when leaving screen bottom
          if (p.y > height + 35) {
            petals[i] = createPetal(false);
          }
        }
      }

      requestAnimationFrame(renderPetals);
    }

    requestAnimationFrame(renderPetals);
  }

  // ---------------------------------------------------------------------------
  // 9. Scroll to Couple Indicator
  // ---------------------------------------------------------------------------
  const scrollToCouplePrompt = document.getElementById('scrollToCouplePrompt');
  const coupleSection = document.getElementById('coupleSection');
  if (scrollToCouplePrompt && coupleSection) {
    scrollToCouplePrompt.addEventListener('click', () => {
      coupleSection.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // ---------------------------------------------------------------------------
  // 10. Royal Heart Card (Swipe & Z-Index Inversion)
  // ---------------------------------------------------------------------------
  const heartCardStack = document.getElementById('heartCardStack');
  const layerShape = document.getElementById('layerShape');
  const layerImage = document.getElementById('layerImage');
  const coupleNamesRevealed = document.getElementById('coupleNamesRevealed');
  const recoverCardBtn = document.getElementById('recoverCardBtn');

  if (heartCardStack && layerShape && layerImage) {
    let isInverted = false; // false: Shape at top (z-index 2), true: Image at top (z-index 2)
    let isAnimating = false;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let currentDragX = 0;

    resetHeartCardStack = function() {
      isInverted = false;
      isAnimating = false;
      isDragging = false;
      currentDragX = 0;
      heartCardStack.classList.remove('is-inverted');
      layerShape.style.transition = '';
      layerShape.style.transform = '';
      layerShape.style.opacity = '1';
      layerShape.style.zIndex = '2';
      layerImage.style.transition = '';
      layerImage.style.transform = '';
      layerImage.style.opacity = '1';
      layerImage.style.zIndex = '1';
      if (coupleNamesRevealed) {
        coupleNamesRevealed.classList.remove('is-revealed');
      }
    };

    function invertLayers(direction = 'right') {
      if (isAnimating) return;
      isAnimating = true;

      // The currently active top layer swipes out
      const topLayer = isInverted ? layerImage : layerShape;
      const bottomLayer = isInverted ? layerShape : layerImage;

      // Step 1: Animate the top layer swiping to the right
      topLayer.style.transition = 'transform 0.32s cubic-bezier(0.2, 0.8, 0.25, 1), opacity 0.32s ease';
      topLayer.style.transform = 'translateX(110%) rotate(14deg)';
      topLayer.style.opacity = '0.85';

      // Step 2: At mid-swipe, invert the z-indexes!
      setTimeout(() => {
        isInverted = !isInverted;

        if (isInverted) {
          // Image now at top
          layerImage.style.zIndex = '3';
          layerShape.style.zIndex = '1';
          heartCardStack.classList.add('is-inverted');
          if (coupleNamesRevealed) coupleNamesRevealed.classList.add('is-revealed');
        } else {
          // Shape now at top
          layerShape.style.zIndex = '3';
          layerImage.style.zIndex = '1';
          heartCardStack.classList.remove('is-inverted');
          if (coupleNamesRevealed) coupleNamesRevealed.classList.remove('is-revealed');
        }

        // Step 3: Animate the former top layer sliding back under, and the new top layer scaling up
        topLayer.style.transition = 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.42s ease';
        topLayer.style.transform = 'translateX(0) scale(0.96)';
        topLayer.style.opacity = '0.75';

        bottomLayer.style.transition = 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.42s ease';
        bottomLayer.style.transform = 'translateX(0) scale(1)';
        bottomLayer.style.opacity = '1';

        setTimeout(() => {
          isAnimating = false;
        }, 450);
      }, 300);
    }

    // Click / Tap on the heart stack inverts the layers
    heartCardStack.addEventListener('click', (e) => {
      // Avoid firing if user was dragging
      if (Math.abs(currentDragX) > 10) return;
      invertLayers('right');
    });

    // Touch dragging support for intuitive finger swipe
    heartCardStack.addEventListener('touchstart', (e) => {
      if (isAnimating) return;
      isDragging = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      currentDragX = 0;
      const topLayer = isInverted ? layerImage : layerShape;
      topLayer.style.transition = 'none';
    }, { passive: true });

    heartCardStack.addEventListener('touchmove', (e) => {
      if (!isDragging || isAnimating) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (dx > 4 && dx > Math.abs(dy)) {
        currentDragX = Math.max(0, Math.min(dx, 200));
        const topLayer = isInverted ? layerImage : layerShape;
        topLayer.style.transform = `translateX(${currentDragX}px) rotate(${currentDragX * 0.06}deg)`;
        topLayer.style.opacity = `${1 - (currentDragX / 260) * 0.35}`;
      }
    }, { passive: true });

    heartCardStack.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      const topLayer = isInverted ? layerImage : layerShape;

      if (currentDragX >= 45) {
        // Swiped past threshold -> complete the inversion!
        invertLayers('right');
      } else {
        // Snap back
        topLayer.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease';
        topLayer.style.transform = 'translateX(0) scale(1)';
        topLayer.style.opacity = '1';
      }
      setTimeout(() => { currentDragX = 0; }, 50);
    });

    // Keyboard support
    heartCardStack.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        invertLayers('right');
      }
    });

    // Swap button below
    if (recoverCardBtn) {
      recoverCardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        invertLayers('right');
      });
    }

    // Scroll to Date & Time prompt button
    const scrollToVenueBtn = document.getElementById('scrollToVenueBtn');
    const eventDetailsSection = document.getElementById('eventDetailsSection');
    if (scrollToVenueBtn && eventDetailsSection) {
      scrollToVenueBtn.addEventListener('click', () => {
        eventDetailsSection.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Scroll to Venue & Map Section prompt button
    const scrollToVenueSectionBtn = document.getElementById('scrollToVenueSectionBtn');
    const venueSection = document.getElementById('venueSection');
    if (scrollToVenueSectionBtn && venueSection) {
      scrollToVenueSectionBtn.addEventListener('click', () => {
        venueSection.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }
});
