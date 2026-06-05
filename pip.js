(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const video = document.getElementById('pipvideo');
  const btn = document.getElementById('pipbtn');
  const status = document.getElementById('status');

  const supportsCapture = typeof canvas.captureStream === 'function';
  const supportsStandardPiP = Boolean(document.pictureInPictureEnabled && video.requestPictureInPicture);
  const supportsWebKitPiP = typeof video.webkitSetPresentationMode === 'function'
    && (typeof video.webkitSupportsPresentationMode !== 'function'
      || video.webkitSupportsPresentationMode('picture-in-picture'));
  const supportsPiP = supportsStandardPiP || supportsWebKitPiP;
  let streamPrimed = false;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.style.color = isError ? '#ff6b6b' : '#8fd18f';
  }

  function ensureStream() {
    if (!video.srcObject) {
      video.srcObject = canvas.captureStream(30);
    }
  }

  function isInPiP() {
    return document.pictureInPictureElement === video
      || video.webkitPresentationMode === 'picture-in-picture';
  }

  function shouldUseWebKitPiP() {
    return supportsWebKitPiP
      && (!video.requestPictureInPicture || /iPad|iPhone|iPod/.test(navigator.userAgent));
  }

  function speedText() {
    const speed = window.pipheroGame?.getSpeed?.();
    return speed ? `速度 x${speed.toFixed(2)}` : '';
  }

  function setReadyStatus(prefix) {
    const suffix = speedText();
    setStatus(suffix ? `${prefix} / ${suffix}` : prefix);
  }

  function refreshReadyStatus() {
    if (!streamPrimed) {
      setStatus('スロットをタップして開始してください');
      return;
    }

    setReadyStatus(isInPiP() ? 'PiP表示中です' : 'PiPで表示できます');
  }

  function primeVideoForPiP() {
    ensureStream();
    const playPromise = video.play();
    streamPrimed = true;
    btn.disabled = false;
    refreshReadyStatus();

    playPromise.catch((error) => {
      setStatus(`PiP準備に失敗しました: ${error.message}`, true);
    });

    return playPromise;
  }

  function changeSpeedFromMedia(delta) {
    if (delta > 0) {
      window.pipheroGame?.speedUp?.();
    } else {
      window.pipheroGame?.speedDown?.();
    }
    refreshReadyStatus();
  }

  function installMediaSessionControls() {
    if (!navigator.mediaSession) {
      return;
    }

    if ('MediaMetadata' in window) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'PiP Slot',
        artist: 'seek buttons change speed',
      });
    }

    const actions = {
      seekbackward: () => changeSpeedFromMedia(-1),
      seekforward: () => changeSpeedFromMedia(1),
      previoustrack: () => changeSpeedFromMedia(-1),
      nexttrack: () => changeSpeedFromMedia(1),
    };

    Object.entries(actions).forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {
        console.debug(`media session action unsupported: ${action}`, error.message);
      }
    });
  }

  if (!supportsCapture || !supportsPiP) {
    btn.disabled = true;
    setStatus('お使いのブラウザは Picture-in-Picture に非対応です（iOS Safari は 16 以降が必要）', true);
    return;
  }

  btn.disabled = true;
  refreshReadyStatus();
  installMediaSessionControls();

  window.addEventListener('piphero:firsttap', () => {
    try {
      primeVideoForPiP();
    } catch (error) {
      setStatus(`PiP準備に失敗しました: ${error.message}`, true);
    }
  });

  window.addEventListener('piphero:speedchange', () => {
    refreshReadyStatus();
  });

  btn.addEventListener('click', async () => {
    try {
      ensureStream();

      if (isInPiP()) {
        refreshReadyStatus();
        return;
      }

      const playPromise = video.play();
      let pipPromise = null;

      if (shouldUseWebKitPiP()) {
        video.webkitSetPresentationMode('picture-in-picture');
      } else if (video.requestPictureInPicture) {
        pipPromise = video.requestPictureInPicture();
      } else if (supportsWebKitPiP) {
        video.webkitSetPresentationMode('picture-in-picture');
      }

      await playPromise;
      if (pipPromise) {
        await pipPromise;
      }

      streamPrimed = true;
      refreshReadyStatus();
    } catch (error) {
      setStatus(`PiP起動に失敗しました: ${error.message}`, true);
    }
  });

  video.addEventListener('enterpictureinpicture', () => {
    refreshReadyStatus();
  });

  video.addEventListener('leavepictureinpicture', () => {
    refreshReadyStatus();
  });

  video.addEventListener('webkitpresentationmodechanged', () => {
    refreshReadyStatus();
  });

  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden || !video.srcObject || isInPiP()) {
      return;
    }

    try {
      if (document.pictureInPictureEnabled && video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
    } catch (error) {
      console.debug('auto PiP failed:', error.message);
    }
  });
})();
