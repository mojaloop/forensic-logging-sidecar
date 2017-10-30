'use strict'

const src = '../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const TweetNacl = require('tweetnacl')
const TweetNaclUtil = require('tweetnacl-util')
const CryptoUtil = require(`${src}/crypto/util`)
const Asymmetric = require(`${src}/crypto/asymmetric`)

Test('Asymmetric crypto', asymmetricTest => {
  let sandbox

  asymmetricTest.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(TweetNacl)
    sandbox.stub(TweetNaclUtil, 'decodeUTF8')
    sandbox.stub(CryptoUtil, 'hexToBuffer')
    sandbox.stub(CryptoUtil, 'uint8ArrayToHex')
    t.end()
  })

  asymmetricTest.afterEach((t) => {
    sandbox.restore()
    t.end()
  })

  asymmetricTest.test('sign should', signTest => {
    signTest.test('create ED25519 signature as hex value', test => {
      let privateKey = '107746ae1300174f7049e5988d0301dd76e57713d82b125df4161fc7be88bb780224bdab8a182a57793a465176b8ffd0546c5f171e3115185a57e95bc0ba5279'
      let privateKeyBuffer = Buffer.from(privateKey, 'hex')

      let message = 'test message'
      let messageBuffer = Buffer.from(message, 'utf8')

      CryptoUtil.hexToBuffer.returns(privateKeyBuffer)
      TweetNaclUtil.decodeUTF8.returns(messageBuffer)

      let signature = 'signature'
      let hexSignature = '12bad535abf80ffc5bb40437b244e66101c8bf736e3bb22e297bbddc5a401fa5fe32dccd5b2d24a475efae51c751edaf742ee9168b4194370c7eb5097dcd0e0e35663637346231352d323339362d346635332d393961622d306234303631646265333434'

      TweetNacl.sign = { detached: sandbox.stub().returns(signature) }
      CryptoUtil.uint8ArrayToHex.returns(hexSignature)

      let s = Asymmetric.sign(message, privateKey)
      test.ok(CryptoUtil.hexToBuffer.calledWith(privateKey))
      test.ok(TweetNacl.sign.detached.calledWith(messageBuffer, privateKeyBuffer))
      test.ok(CryptoUtil.uint8ArrayToHex.calledWith(signature))
      test.equal(s, hexSignature)

      test.end()
    })
    signTest.end()
  })

  asymmetricTest.end()
})
