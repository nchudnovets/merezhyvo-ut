import QtQuick 2.12
import QtPositioning 5.12

Item {
  id: root
  property int timeoutMs: 30000

  Component.onCompleted: {
    var args = Qt.application.arguments || []
    for (var i = 0; i < args.length; i++) {
      var m = /^--timeout=(\d+)$/.exec(args[i])
      if (m) { timeoutMs = parseInt(m[1], 10) }
    }
    src.active = true
  }

  PositionSource {
    id: src
    active: false
    preferredPositioningMethods: PositionSource.SatellitePositioningMethods | PositionSource.NonSatellitePositioningMethods
    updateInterval: 0

    onPositionChanged: {
      var c = position.coordinate
      print(JSON.stringify({
        ok: true,
        latitude: c.latitude,
        longitude: c.longitude,
        accuracy: position.horizontalAccuracy
      }))
      Qt.quit()
    }

    onErrorChanged: {
      if (error !== PositionSource.NoError) {
        print(JSON.stringify({ ok: false, error: errorString }))
        Qt.quit()
      }
    }
  }

  Timer {
    interval: timeoutMs
    running: true
    repeat: false
    onTriggered: {
      print(JSON.stringify({ ok: false, error: "timeout" }))
      Qt.quit()
    }
  }
}