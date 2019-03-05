'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Proxyquire = require('proxyquire')

Test('Health', serverTest => {
  let sandbox
  let Setup
  let HapiStub
  let serverStub
  let responseStub

  serverTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    responseStub = {
      response: sandbox.stub()
    }

    serverStub = {
      start: sandbox.stub(),
      info: {
        uri: sandbox.stub()
      },
      route: sandbox.stub().callsFake((opt) => {
        opt.config.handler(sandbox.stub(), responseStub)
      })

    }
    HapiStub = {
      Server: sandbox.stub().returns(serverStub)
    }
    Setup = Proxyquire('../../src/health', {
      'hapi': HapiStub
    })
    test.end()
  })

  serverTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  serverTest.test('createServer should', createServerTest => {
    createServerTest.test('start the server', test => {
      Setup.createServer(1234)
      test.ok(HapiStub.Server.called)
      test.end()
    })

    createServerTest.end()
  })

  serverTest.end()
})
