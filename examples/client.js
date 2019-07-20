'use strict'

const Net = require('net')
const EventEmitter = require('events')
const LargeData = require('./large-data')

const port = 5678
const SmallData = { id: 1, name: 'Test', rows: [] }

class ForensicLogger extends EventEmitter {
  constructor () {
    super()

    this._prefixSize = 4
  }

  connect (port) {
    this._client = Net.createConnection({ port }, () => {
      this.emit('open')
    })

    this._client.on('data', data => {
      this.emit('data', data)
    })

    this._client.on('end', () => this.emit('end'))
  }

  close () {
    this._client.end()
  }

  write (msg) {
    const message = Buffer.isBuffer(msg) ? msg : Buffer.from(msg)
    const length = message.length

    const buffer = Buffer.alloc(this._prefixSize + length)
    buffer.writeUInt32BE(length, 0)
    message.copy(buffer, this._prefixSize)
    this._client.write(buffer)
  }
}

const logger = new ForensicLogger()

logger.on('open', () => {
  logger.write(JSON.stringify(LargeData))
  logger.write(JSON.stringify(SmallData))
})

logger.connect(port)
