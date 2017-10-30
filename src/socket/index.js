'use strict'

const P = require('bluebird')
const Net = require('net')
const EventEmitter = require('events')
const TcpConnection = require('./connection')

class SocketListener extends EventEmitter {
  constructor () {
    super()

    let self = this
    self._bound = false
    self._paused = false
    self._connections = []

    self._server = Net.createServer()
    self._server.on('connection', socket => {
      let tcpConnection = TcpConnection.create(socket)
      self._connections.push(tcpConnection)

      tcpConnection.on('message', self._onConnectionMessage.bind(self))
      tcpConnection.on('end', () => self._disconnectConnection(tcpConnection))
      tcpConnection.on('error', e => self._disconnectConnection(tcpConnection))
    })
    self._server.on('close', () => self.close())
    self._server.on('error', err => self.emit('error', err))
  }

  close () {
    if (this._bound) {
      this._bound = false

      this._connections.forEach(c => {
        c.close()
      })

      this._connections.length = 0

      this._server.close(() => {
        this.emit('close')
      })
    }
  }

  listen (port, address) {
    return new P((resolve, reject) => {
      this._server.once('listening', () => {
        this._bound = true
        resolve()
      })

      this._server.listen(port, address)
    })
  }

  pause () {
    return new P((resolve, reject) => {
      this._paused = true

      this._connections.forEach(c => {
        c.pause()
      })

      resolve()
    })
  }

  resume () {
    return new P((resolve, reject) => {
      if (this._paused) {
        this._paused = false

        this._connections.forEach(c => {
          c.resume()
        })
      }
      resolve()
    })
  }

  _disconnectConnection (tcpConnection) {
    this._connections.splice(this._connections.indexOf(tcpConnection), 1)
    this.emit('disconnect', tcpConnection)
  }

  _onConnectionMessage (msg) {
    this.emit('message', msg.toString('utf8'))
  }
}

exports.create = () => {
  return new SocketListener()
}
