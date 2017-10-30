'use strict'

exports.hexToBuffer = (hexValue) => {
  return Buffer.isBuffer(hexValue) ? hexValue : Buffer.from(hexValue, 'hex')
}

exports.uint8ArrayToHex = (uint8Array) => {
  return Buffer.from(uint8Array).toString('hex')
}
