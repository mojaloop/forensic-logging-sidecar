'use strict'

const EventEmitter = require('events')

class BatchTracker extends EventEmitter {
  constructor (settings) {
    super()

    this._batchSize = settings.batchSize || 64
    this._batchTimeInterval = settings.batchTimeInterval || 300000

    this._batchTimer = null
    this._unbatchedEvents = []

    this._resetTimer()
  }

  eventCreated (eventId) {
    this._unbatchedEvents.push(eventId)
    if (this._unbatchedEvents.length >= this._batchSize) {
      this._sendBatch()
    }
  }

  _sendBatch () {
    this.emit('batchReady', this._unbatchedEvents.splice(0, this._batchSize))
    this._resetTimer()
  }

  _resetTimer () {
    clearTimeout(this._batchTimer)

    this._batchTimer = setTimeout(() => {
      this._sendBatch()
    }, this._batchTimeInterval)
  }
}

exports.create = (settings) => {
  return new BatchTracker(settings || {})
}
