'use strict'

const src = '../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Moment = require('moment')
const EventService = require(`${src}/domain/event`)
const HealthCheck = require(`${src}/health-check`)

Test('HealthCheck', healthCheckTest => {
  let sandbox

  healthCheckTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Moment, 'utc')
    sandbox.stub(EventService, 'getEventCountInTimespan')
    t.end()
  })

  healthCheckTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  healthCheckTest.test('ping should', pingTest => {
    pingTest.test('perform a ping health check and return results', test => {
      let eventCount = 50

      let now = Moment()
      Moment.utc.returns(now)
      let startTime = Moment(now).subtract(1, 'hour')

      EventService.getEventCountInTimespan.returns(P.resolve(eventCount))

      let sidecar = { id: 'sidecar-id', version: '0.0.1', startTime }

      HealthCheck.ping(sidecar)
        .then(hc => {
          test.ok(EventService.getEventCountInTimespan.calledWith(sidecar.id, startTime, now))
          test.equal(hc.id, sidecar.id)
          test.equal(hc.version, sidecar.version)
          test.equal(hc.current, now.toISOString())
          test.equal(hc.uptime, 60 * 60 * 1000)
          test.equal(hc.eventCountLastHour, eventCount)
          test.end()
        })
    })

    pingTest.end()
  })

  healthCheckTest.end()
})
