'use strict'

const WS = require('ws')
const Moment = require('moment')
const EventEmitter = require('events')
const Logger = require('@mojaloop/central-services-shared').Logger
const KeepAlive = require('./keep-alive')

class WebSocket extends EventEmitter {
  constructor (settings) {
    super()

    this._url = settings.url
    this._pingInterval = settings.pingInterval
    this._connectTimeout = settings.connectTimeout
    this._reconnectInterval = settings.reconnectInterval

    this._connected = false
    this._keepAlive = KeepAlive.create(this._pingInterval)

    this._ws = null
    this._connectTimerId = null
    this._reconnectTimerId = null
  }

  connect () {
    if (this.isConnected()) {
      this.emit('open')
      return
    }

    // Start the connection timeout.
    this._connectTimerId = setTimeout(this._connectTimedOut.bind(this), this._connectTimeout)

    this._connect()
  }

  send (data) {
    if (this.isConnected()) {
      this._ws.send(data)
    }
  }

  close () {
    if (this.isConnected()) {
      this._cleanup()
    }
  }

  isConnected () {
    return this._connected
  }

  _connect () {
    const connectErrorListener = (err) => {
      this._ws.removeAllListeners()

      switch (err.code) {
        case 'ECONNREFUSED':
          Logger.info(`Error connecting to KMS, attempting to connect after sleeping ${this._reconnectInterval}ms`)

          const self = this
          this._reconnectTimerId = setTimeout(() => {
            self._connect()
          }, this._reconnectInterval)
          break
        default:
          this._cleanup()
          this.emit('error', err)
      }
    }

    // Connect to the websocket.
    this._ws = new WS(this._url, {
      perMessageDeflate: false
    })

    this._ws.once('open', () => {
      this._connected = true

      this._clearConnectionTimers()

      // Remove listener only used for connect problems.
      this._ws.removeListener('error', connectErrorListener)

      // Attach the regular event listeners.
      this._ws.on('close', this._onClose.bind(this))
      this._ws.on('error', this._onError.bind(this))
      this._ws.on('message', this._onMessage.bind(this))

      // Setup ping/pong.
      this._ws.on('ping', this._onPing.bind(this))
      this._ws.on('pong', this._onPong.bind(this))

      this._keepAlive.start(this._ws)

      this.emit('open')
    })

    this._ws.once('error', connectErrorListener)
  }

  _connectTimedOut () {
    this._cleanup()
    this.emit('error', new Error(`Unable to connect to KMS within ${this._connectTimeout}ms`))
  }

  _clearConnectionTimers () {
    clearTimeout(this._connectTimerId)
    this._connectTimerId = null

    clearTimeout(this._reconnectTimerId)
    this._reconnectTimerId = null
  }

  _cleanup () {
    this._keepAlive.stop()

    this._clearConnectionTimers()

    this._ws.removeAllListeners()
    this._ws.close()
    this._ws = null

    this._connected = false
  }

  // Websocket event handlers
  _onPing (data) {
    this._ws.pong(data)
  }

  _onPong (data) {
    const timestamp = Moment(JSON.parse(data).timestamp)
    const elapsed = Moment.utc().diff(timestamp)
    Logger.info(`Received pong, elapsed ${elapsed}ms`)
  }

  _onMessage (data) {
    this.emit('message', data)
  }

  _onError (err) {
    this._cleanup()
    this.emit('error', err)
  }

  _onClose (code, reason) {
    this._cleanup()
    this.emit('close', code, reason)
  }
}

exports.create = (settings) => {
  return new WebSocket(settings)
}
