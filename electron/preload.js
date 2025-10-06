// deny VP9/AV1 by faking support checks
(function () {
  const deny = (type = "") =>
    /(webm|vp9|av01|av1)/i.test(type);

  const origMSE = globalThis.MediaSource && globalThis.MediaSource.isTypeSupported;
  if (origMSE) {
    Object.defineProperty(MediaSource, "isTypeSupported", {
      value: (type) => (!deny(type) && origMSE.call(MediaSource, type)),
      configurable: true
    });
  }

  const videoProto = HTMLMediaElement.prototype;
  const origCanPlay = videoProto.canPlayType;
  Object.defineProperty(videoProto, "canPlayType", {
    value: function (type) {
      if (deny(type)) return "";
      return origCanPlay.call(this, type);
    },
    configurable: true
  });

  try {
    const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, "userAgent");
    if (desc && desc.get) {
      const ua = desc.get.call(navigator);
    }
  } catch {}
})();
