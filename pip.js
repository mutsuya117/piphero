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

  if (!supportsCapture || !supportsPiP) {
    btn.disabled = true;
    setStatus('お使いのブラウザは Picture-in-Picture に非対応です（iOS Safari は 16 以降が必要）', true);
    return;
  }

  setStatus('');

  btn.addEventListener('click', async () => {
    try {
      ensureStream();
      await video.play();

      if (isInPiP()) {
        setStatus('PiP表示中です');
        return;
      }

      if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      } else if (supportsWebKitPiP) {
        video.webkitSetPresentationMode('picture-in-picture');
      }

      setStatus('PiP表示中です');
    } catch (error) {
      setStatus(`PiP起動に失敗しました: ${error.message}`, true);
    }
  });

  video.addEventListener('enterpictureinpicture', () => {
    setStatus('PiP表示中です');
  });

  video.addEventListener('leavepictureinpicture', () => {
    setStatus('');
  });

  video.addEventListener('webkitpresentationmodechanged', () => {
    setStatus(isInPiP() ? 'PiP表示中です' : '');
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
