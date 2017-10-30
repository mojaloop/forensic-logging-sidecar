'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const KmsRequest = require(`${src}/kms/requests/request`)

Test('KMS Request', kmsReqTest => {
  let clock
  let sandbox

  kmsReqTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    clock = Sinon.useFakeTimers()
    t.end()
  })

  kmsReqTest.afterEach(t => {
    sandbox.restore()
    clock.restore()
    t.end()
  })

  kmsReqTest.test('create should', createTest => {
    createTest.test('set default properties', test => {
      let req = KmsRequest.create()

      test.equal(req.promise, undefined)
      test.equal(req._resolve, undefined)
      test.equal(req._reject, undefined)
      test.end()
    })

    createTest.end()
  })

  kmsReqTest.test('build should', buildTest => {
    buildTest.test('create pending promise', test => {
      let funcSpy = sandbox.spy()

      let req = KmsRequest.create()
      req.build(funcSpy)

      test.ok(req.promise)
      test.ok(req.promise.isPending())
      test.ok(funcSpy.called)
      test.end()
    })

    buildTest.test('should reject in case of error in function', test => {
      let req = KmsRequest.create()
      req.build(() => { throw new Error('err') })

      req.promise
        .then(() => {
          test.fail('Should have rejected')
          test.end()
        })
        .catch(e => {
          test.equal(e.message, 'err')
          test.end()
        })
    })

    buildTest.test('reject after timeout', test => {
      let timeout = 1000

      let req = KmsRequest.create()
      req.build(() => {}, timeout)

      clock.tick(timeout + 1)

      req.promise
        .then(result => {
          test.fail('Should have timed out')
          test.end()
        })
        .catch(P.TimeoutError, err => {
          test.equal(err.message, `Request timed out after ${timeout} ms`)
          test.end()
        })
    })

    buildTest.end()
  })

  kmsReqTest.test('resolve should', resolveTest => {
    resolveTest.test('resolve pending promise', test => {
      let value = 'yay'
      let req = KmsRequest.create()
      req.build(() => {})

      req.resolve(value)

      req.promise
        .then(result => {
          test.equal(result, value)
          test.end()
        })
    })

    resolveTest.test('handle no function passed in', test => {
      let req = KmsRequest.create()
      req.build()

      let value = 'stuff'
      req.resolve(value)

      req.promise
        .then(result => {
          test.equal(result, value)
          test.end()
        })
    })

    resolveTest.test('call finally function', test => {
      let finallyStub = sandbox.stub().returns(P.resolve())

      let value = 'yay'
      let req = KmsRequest.create()
      req.build(() => {}, 5000, finallyStub)
      test.notOk(finallyStub.called)

      req.resolve(value)

      req.promise
        .then(result => {
          test.ok(finallyStub.called)
          test.equal(result, value)
          test.end()
        })
    })

    resolveTest.end()
  })

  kmsReqTest.test('reject should', rejectTest => {
    rejectTest.test('reject pending promise', test => {
      let error = new Error('bad stuff')
      let req = KmsRequest.create()
      req.build(() => {})
      req.reject(error)

      req.promise
        .then(() => {
          test.fail('Should have thrown error')
          test.end()
        })
        .catch(e => {
          test.equal(e.message, error.message)
          test.end()
        })
    })

    rejectTest.test('call finally function', test => {
      let finallyStub = sandbox.stub().returns(P.resolve())

      let error = new Error('bad stuff')
      let req = KmsRequest.create()
      req.build(() => {}, 5000, finallyStub)
      test.notOk(finallyStub.called)

      req.reject(error)

      req.promise
        .then(() => {
          test.fail('Should have thrown error')
          test.end()
        })
        .catch(e => {
          test.ok(finallyStub.called)
          test.equal(e.message, error.message)
          test.end()
        })
    })

    rejectTest.end()
  })

  kmsReqTest.end()
})
