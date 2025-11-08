import QtQuick 2.4
import QtPositioning 5.12

QtObject {
  id: root

  // Read --timeout=NNN from CLI args (default 8000 ms)
  property int timeoutMs: 8000
  Component.onCompleted: {
    var args = Qt.application.arguments || []
    for (var i = 0; i < args.length; i++) {
      var a = args[i]
      if (typeof a === "string" && a.indexOf("--timeout=") === 0) {
        var v = parseInt(a.substring("--timeout=".length))
        if (!isNaN(v) && v > 0) timeoutMs = v
      }
    }
    // start positioning
    src.active = true
    // safety timeout
    timer.interval = timeoutMs
    timer.running = true
  }

  function finishWithPosition(pos) {
    // Print one JSON line to STDOUT and quit
    // Using print(), not console.log() -> stdout
    if (pos) {
      var fix = {
        latitude:  pos.coordinate.latitude,
        longitude: pos.coordinate.longitude,
        // QtPositioning may not expose accuracy uniformly → optional
        accuracy:  0,
        timestamp: Date.now()
      }
      print("__MZR_FIX__" + JSON.stringify(fix))
    } else {
      print("__MZR_FIX__null")
    }
    Qt.quit()
  }

  Timer {
    id: timer
    repeat: false
    onTriggered: root.finishWithPosition(null)
  }

  PositionSource {
    id: src
    active: false
    updateInterval: 1000
    onPositionChanged: {
      // Got first fix → return and quit
      root.finishWithPosition(position)
    }
    onSourceErrorChanged: {
      // Keep trying until timeout; do nothing here
    }
  }
}