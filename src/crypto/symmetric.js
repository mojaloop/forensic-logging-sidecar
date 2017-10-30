'use strict'

const AesCmac = require('node-aes-cmac').aesCmac
const CryptoUtil = require('./util')

exports.sign = (message, signingKey) => {
  const keyBuffer = CryptoUtil.hexToBuffer(signingKey)
  return AesCmac(keyBuffer, message)
}
