'use strict'

function writeMessageToBuffer (msg) {
  let message = Buffer.isBuffer(msg) ? msg : Buffer.from(msg)
  let length = message.length

  let buffer = Buffer.alloc(length)
  message.copy(buffer, 0, 0, length)
  return buffer
}

function writeMessageToBufferWithLength (msg) {
  let prefixSize = 4

  let message = Buffer.isBuffer(msg) ? msg : Buffer.from(msg)
  let length = message.length

  let buffer = Buffer.alloc(prefixSize + length)
  buffer.writeUInt32BE(length, 0)
  message.copy(buffer, prefixSize, 0, length)
  return buffer
}

function appendToBuffer (existing, data) {
  return Buffer.concat([existing, data], existing.length + data.length)
}

module.exports = {
  writeMessageToBuffer,
  writeMessageToBufferWithLength,
  appendToBuffer
}
