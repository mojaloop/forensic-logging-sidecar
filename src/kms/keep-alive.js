'use strict'

const Moment = require('moment')

class KeepAlive {
  constructor (pingInterval) {
    this._pingTimer = null
    this._pingInterval = pingInterval
  }

  start (ws) {
    if (!this._pingTimer) {
      this._pingTimer = setInterval(() => {
        ws.ping(JSON.stringify({ timestamp: Moment.utc().toISOString() }))
      }, this._pingInterval)
    }
  }

  stop () {
    if (this._pingTimer) {
      clearInterval(this._pingTimer)
      this._pingTimer = null
    }
  }
}

exports.create = (pingInterval) => {
  return new KeepAlive(pingInterval)
}
