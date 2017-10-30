'use strict'

const TweetNacl = require('tweetnacl')
const TweetNaclUtil = require('tweetnacl-util')
const CryptoUtil = require('./util')

exports.sign = (message, signingKey) => {
  const keyBuffer = CryptoUtil.hexToBuffer(signingKey)
  const msgArray = TweetNaclUtil.decodeUTF8(message)
  return CryptoUtil.uint8ArrayToHex(TweetNacl.sign.detached(msgArray, keyBuffer))
}
