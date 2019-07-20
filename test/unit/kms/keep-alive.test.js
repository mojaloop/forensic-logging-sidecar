'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Moment = require('moment')
const KeepAlive = require('../../../src/kms/keep-alive')

Test('KeepAlive', keepAliveTest => {
  let sandbox
  let clock

  keepAliveTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Moment, 'utc')
    clock = sandbox.useFakeTimers()
    t.end()
  })

  keepAliveTest.afterEach(t => {
    sandbox.restore()
    clock.restore()
    t.end()
  })

  keepAliveTest.test('create should', createTest => {
    createTest.test('create new pinger and set properties', test => {
      const pingInterval = 1000
      const keepAlive = KeepAlive.create(pingInterval)

      test.equal(keepAlive._pingInterval, pingInterval)
      test.notOk(keepAlive._pingTimer)
      test.end()
    })

    createTest.end()
  })

  keepAliveTest.test('start should', startTest => {
    startTest.test('create timer to send ping on interval', test => {
      const pingInterval = 5000
      const ws = { ping: sandbox.stub() }

      const now = Moment()
      Moment.utc.returns(now)

      const keepAlive = KeepAlive.create(pingInterval)

      keepAlive.start(ws)
      test.ok(keepAlive._pingTimer)
      test.notOk(ws.ping.calledOnce)

      clock.tick(pingInterval)
      test.ok(ws.ping.calledWith(JSON.stringify({ timestamp: now.toISOString() })))

      test.end()
    })

    startTest.test('do nothing if timer already started', test => {
      const timer = {}

      const keepAlive = KeepAlive.create(1000)
      keepAlive._pingTimer = timer

      keepAlive.start({})
      test.equal(keepAlive._pingTimer, timer)

      test.end()
    })

    startTest.end()
  })

  keepAliveTest.test('stop should', stopTest => {
    stopTest.test('destroy ping timer', test => {
      const pingInterval = 5000
      const ws = { ping: sandbox.stub() }

      sandbox.stub(global, 'clearInterval')

      const keepAlive = KeepAlive.create(pingInterval)

      keepAlive.start(ws)
      test.ok(keepAlive._pingTimer)

      keepAlive.stop()
      test.notOk(keepAlive._pingTimer)
      test.ok(global.clearInterval.calledOnce)

      test.end()
    })

    stopTest.test('do nothing if timer already stopped', test => {
      const pingInterval = 5000

      sandbox.stub(global, 'clearInterval')

      const keepAlive = KeepAlive.create(pingInterval)

      keepAlive.stop()
      test.notOk(global.clearInterval.calledOnce)

      test.end()
    })

    stopTest.end()
  })

  keepAliveTest.end()
})
