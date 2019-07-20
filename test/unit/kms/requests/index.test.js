'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Proxyquire = require('proxyquire')
const Errors = require(`${src}/errors`)
const KmsRequest = require(`${src}/kms/requests/request`)

Test('KMS Requests', kmsReqsTest => {
  let sandbox
  let uuidStub
  let KmsRequests

  kmsReqsTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(KmsRequest, 'create')

    uuidStub = sandbox.stub()
    KmsRequests = Proxyquire(`${src}/kms/requests`, { uuid4: uuidStub })

    t.end()
  })

  kmsReqsTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  kmsReqsTest.test('create should', createTest => {
    createTest.test('create new requests and set properties', test => {
      const opts = { timeout: 1000 }
      const reqs = KmsRequests.create(opts)

      test.equal(reqs._timeout, opts.timeout)
      test.deepEqual(reqs._existing, {})
      test.end()
    })

    createTest.end()
  })

  kmsReqsTest.test('start should', startTest => {
    startTest.test('create a new request and return promise', test => {
      const id = 'id'
      const timeout = 3000

      uuidStub.returns(id)

      const buildStub = sandbox.stub()
      const req = { build: buildStub, promise: {} }
      KmsRequest.create.returns(req)

      const funcStub = sandbox.stub()
      const requests = KmsRequests.create({ timeout })

      const promise = requests.start(funcStub)

      buildStub.callArg(0)

      test.equal(promise, req.promise)
      test.ok(funcStub.calledWith(id))
      test.ok(requests._existing[id])
      test.ok(buildStub.firstCall.args[1], timeout)
      test.end()
    })

    startTest.test('remove request after finally func called', test => {
      const id = 'id'

      uuidStub.returns(id)

      const buildStub = sandbox.stub()
      const req = { build: buildStub, promise: {} }
      KmsRequest.create.returns(req)

      const funcStub = sandbox.stub()
      const requests = KmsRequests.create({ timeout: 1000 })

      requests.start(funcStub)
      test.ok(requests._existing[id])

      buildStub.callArg(2)

      test.notOk(requests._existing[id])
      test.end()
    })

    startTest.end()
  })

  kmsReqsTest.test('exists should', existsTest => {
    existsTest.test('return true if request id exists', test => {
      const id = 'id1'

      const requests = KmsRequests.create({ timeout: 1000 })
      requests._existing[id] = {}

      test.ok(requests.exists(id))
      test.end()
    })

    existsTest.test('return false if request id doesn\'t exist', test => {
      const requests = KmsRequests.create({ timeout: 1000 })
      requests._existing['id1'] = {}

      test.notOk(requests.exists('id2'))
      test.end()
    })

    existsTest.end()
  })

  kmsReqsTest.test('complete should', completeTest => {
    completeTest.test('resolve existing request with supplied value', test => {
      const id = 'id1'
      const resolveStub = sandbox.stub()

      const requests = KmsRequests.create({ timeout: 1000 })
      requests._existing[id] = { resolve: resolveStub }

      const value = 'val'
      requests.complete(id, value)

      test.ok(resolveStub.calledWith(value))
      test.end()
    })

    completeTest.test('throw error if request id doesn\'t exist', test => {
      const requests = KmsRequests.create({ timeout: 1000 })
      requests._existing['id1'] = { }

      try {
        requests.complete('id2', 'val')
        test.fail('Should have thrown error')
        test.end()
      } catch (e) {
        test.ok(e instanceof Errors.KmsRequestNotFoundError)
        test.equal(e.message, 'Request not found with id: id2')
        test.end()
      }
    })

    completeTest.end()
  })

  kmsReqsTest.end()
})
