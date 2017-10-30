'use strict'

const src = '../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const CryptoUtil = require(`${src}/crypto/util`)

Test('Crypto utilities', cryptoUtilTest => {
  let sandbox

  cryptoUtilTest.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()
    t.end()
  })

  cryptoUtilTest.afterEach((t) => {
    sandbox.restore()
    t.end()
  })

  cryptoUtilTest.test('hexToBuffer should', hexBufferTest => {
    hexBufferTest.test('convert hex encoded key to buffer', test => {
      let key = '107746ae1300174f7049e5988d0301dd76e57713d82b125df4161fc7be88bb780224bdab8a182a57793a465176b8ffd0546c5f171e3115185a57e95bc0ba5279'
      let keyBuffer = Buffer.from(key, 'hex')

      let k = CryptoUtil.hexToBuffer(key)
      test.ok(k.equals(keyBuffer))

      test.end()
    })

    hexBufferTest.test('return value if already buffer', test => {
      let keyBuffer = Buffer.from('107746ae1300174f7049e5988d0301dd76e57713d82b125df4161fc7be88bb780224bdab8a182a57793a465176b8ffd0546c5f171e3115185a57e95bc0ba5279', 'hex')

      let k = CryptoUtil.hexToBuffer(keyBuffer)
      test.equal(k, keyBuffer)

      test.end()
    })

    hexBufferTest.end()
  })

  cryptoUtilTest.test('uint8ArrayToHex should', uintHexTest => {
    uintHexTest.test('conver UInt8Array to hex', test => {
      let hex = '1f2f3f4f'
      let uint8 = new Uint8Array(4)
      uint8[0] = 0x1f
      uint8[1] = 0x2f
      uint8[2] = 0x3f
      uint8[3] = 0x4f

      let converted = CryptoUtil.uint8ArrayToHex(uint8)
      test.equal(converted, hex)

      test.end()
    })

    uintHexTest.end()
  })

  cryptoUtilTest.end()
})
