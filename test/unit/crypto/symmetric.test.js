'use strict'

const src = '../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const CryptoUtil = require(`${src}/crypto/util`)
const Proxyquire = require('proxyquire')

Test('Symmetric crypto', symmetricTest => {
  let sandbox
  let aesCmacStub
  let Symmetric

  symmetricTest.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(CryptoUtil, 'hexToBuffer')

    aesCmacStub = sandbox.stub()

    Symmetric = Proxyquire(`${src}/crypto/symmetric`, { 'node-aes-cmac': { aesCmac: aesCmacStub } })

    t.end()
  })

  symmetricTest.afterEach((t) => {
    sandbox.restore()
    t.end()
  })

  symmetricTest.test('sign should', createTest => {
    createTest.test('create AES CMAC signature', test => {
      let message = 'test message'
      let signingKey = 'DFDE22A3276FC520A24FBE5534EDADFE080D78375C4530E038EFCF6CA699228A'
      let signingKeyBuffer = Buffer.from(signingKey, 'hex')

      CryptoUtil.hexToBuffer.returns(signingKeyBuffer)

      let signature = 'signature'
      aesCmacStub.returns(signature)

      let s = Symmetric.sign(message, signingKey)
      test.ok(CryptoUtil.hexToBuffer.calledWith(signingKey))
      test.ok(aesCmacStub.calledWith(signingKeyBuffer, message))
      test.equal(s, signature)
      test.end()
    })

    createTest.end()
  })

  symmetricTest.end()
})
