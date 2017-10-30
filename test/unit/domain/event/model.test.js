'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Moment = require('moment')
const Db = require(`${src}/lib/db`)
const Model = require(`${src}/domain/event/model`)

Test('Events model', modelTest => {
  let sandbox

  modelTest.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()

    Db.events = {
      insert: sandbox.stub(),
      count: sandbox.stub(),
      find: sandbox.stub(),
      update: sandbox.stub()
    }

    t.end()
  })

  modelTest.afterEach((t) => {
    sandbox.restore()
    t.end()
  })

  modelTest.test('create should', createTest => {
    createTest.test('save payload and return new event', test => {
      let payload = { eventId: 'event-id', sidecarId: 'sidecar-id', sequence: 1, message: 'test message', signature: 'test' }
      let insertedEvent = { eventId: payload.eventId }

      Db.events.insert.returns(P.resolve(insertedEvent))

      Model.create(payload)
        .then(s => {
          test.ok(Db.events.insert.withArgs(payload).calledOnce)
          test.equal(s, insertedEvent)
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.test('getUnbatchedEvents should', getUnbatchedEventsTest => {
    getUnbatchedEventsTest.test('find unbatched events for array of ids and order by sequence', test => {
      let eventIds = [1, 2]
      let events = [{ eventId: eventIds[0] }, { eventId: eventIds[1] }]

      Db.events.find.returns(P.resolve(events))

      Model.getUnbatchedEvents(eventIds)
        .then(found => {
          test.equal(found, events)
          test.ok(Db.events.find.calledWith({ eventId: eventIds, batchId: null }, { order: 'sequence asc' }))
          test.end()
        })
    })

    getUnbatchedEventsTest.end()
  })

  modelTest.test('getEventCount should', getEventCountTest => {
    getEventCountTest.test('get count of events for a sidecar id', test => {
      let count = 5
      let sidecarId = 'sidecar-id'

      Db.events.count.returns(P.resolve(count))

      Model.getEventCount(sidecarId)
        .then(c => {
          test.equal(c, count)
          test.ok(Db.events.count.calledWith(sandbox.match({ sidecarId }), '*'))
          test.end()
        })
    })

    getEventCountTest.test('get count of sidecar events for a timespan', test => {
      let count = 5
      let now = Moment.utc()
      let start = Moment.utc(now).subtract(5, 'minutes')
      let sidecarId = 'sidecar-id'

      let startTime = start.toISOString()
      let endTime = now.toISOString()

      Db.events.count.returns(P.resolve(count))

      Model.getEventCount(sidecarId, { startTime, endTime })
        .then(c => {
          test.equal(c, count)
          test.ok(Db.events.count.calledWith(sandbox.match({ sidecarId, 'created >=': startTime, 'created <=': endTime }), '*'))
          test.end()
        })
    })

    getEventCountTest.end()
  })

  modelTest.test('updateEvents should', updateEventsTest => {
    updateEventsTest.test('update multiple events', test => {
      let batchId = 1
      let eventIds = [1, 2]
      let fields = { batchId }
      let updatedEvents = [{ eventId: eventIds[0], batchId }, { eventId: eventIds[1], batchId }]

      Db.events.update.returns(P.resolve(updatedEvents))

      Model.updateEvents(eventIds, fields)
        .then(found => {
          test.equal(found, updatedEvents)
          test.ok(Db.events.update.calledWith({ eventId: eventIds }, fields))
          test.end()
        })
    })

    updateEventsTest.end()
  })

  modelTest.end()
})
