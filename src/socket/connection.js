'use strict'

const BitSyntax = require('bitsyntax')
const EventEmitter = require('events')

class TcpConnection extends EventEmitter {
  constructor (socket) {
    super()

    let self = this
    self._socket = socket
    self._matcher = BitSyntax.matcher('len:32/big-unsigned, message:len/binary, rest/binary')

    let buffer = Buffer.alloc(0)

    self._socket.on('data', data => {
      buffer = appendToBuffer(buffer, data)
      while (true) {
        let parsed = self._matcher(buffer)
        if (!parsed) break

        self.emit('message', parsed.message)
        buffer = parsed.rest
      }
    })
    self._socket.on('end', () => self.emit('end'))
    self._socket.on('error', (err) => self.emit('error', err))
  }

  close () {
    this._socket.end()
  }

  pause () {
    this._socket.pause()
  }

  resume () {
    this._socket.resume()
  }
}

const appendToBuffer = (existing, data) => {
  return Buffer.concat([existing, data], existing.length + data.length)
}

exports.create = (socket) => {
  return new TcpConnection(socket)
}
