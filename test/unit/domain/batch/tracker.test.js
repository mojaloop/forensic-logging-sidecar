'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Uuid = require('uuid4')
const BatchTracker = require(`${src}/domain/batch/tracker`)

Test('BatchTracker', trackerTest => {
  let clock
  let sandbox

  trackerTest.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()
    clock = sandbox.useFakeTimers()
    t.end()
  })

  trackerTest.afterEach((t) => {
    sandbox.restore()
    clock.restore()
    t.end()
  })

  trackerTest.test('create should', createTest => {
    createTest.test('create new batch tracker and setup', test => {
      let settings = { batchSize: 50, batchTimeInterval: 60000 }
      let tracker = BatchTracker.create(settings)

      test.equal(tracker._batchSize, settings.batchSize)
      test.equal(tracker._batchTimeInterval, settings.batchTimeInterval)
      test.deepEqual(tracker._unbatchedEvents, [])
      test.ok(tracker._batchTimer)
      test.end()
    })

    createTest.test('use default settings', test => {
      let tracker = BatchTracker.create()

      test.equal(tracker._batchSize, 64)
      test.equal(tracker._batchTimeInterval, 300000)
      test.end()
    })

    createTest.end()
  })

  trackerTest.test('eventCreated should', eventCreatedTest => {
    eventCreatedTest.test('add event to list', test => {
      let tracker = BatchTracker.create()

      let eventId = Uuid()

      tracker.eventCreated(eventId)

      test.equal(tracker._unbatchedEvents.length, 1)
      test.deepEqual(tracker._unbatchedEvents, [eventId])
      test.end()
    })

    eventCreatedTest.test('emit batchReady event if unbatched length equal to batch size', test => {
      let eventId1 = Uuid()
      let eventId2 = Uuid()
      let batchSize = 2
      let batchReadySpy = sandbox.spy()

      let tracker = BatchTracker.create({ batchSize })
      tracker.on('batchReady', batchReadySpy)

      tracker.eventCreated(eventId1)
      test.notOk(batchReadySpy.called)

      tracker.eventCreated(eventId2)
      test.ok(batchReadySpy.calledWith(sandbox.match([eventId1, eventId2])))
      test.equal(tracker._unbatchedEvents.length, 0)

      test.end()
    })

    eventCreatedTest.test('emit batchReady event if unbatched length greater than batch size', test => {
      let eventId1 = Uuid()
      let eventId2 = Uuid()
      let eventId3 = Uuid()
      let batchSize = 2
      let batchReadySpy = sandbox.spy()

      let tracker = BatchTracker.create({ batchSize })
      tracker._unbatchedEvents.push(eventId1)
      tracker._unbatchedEvents.push(eventId2)
      tracker.on('batchReady', batchReadySpy)

      tracker.eventCreated(eventId3)
      test.ok(batchReadySpy.calledWith(sandbox.match([eventId1, eventId2])))
      test.equal(tracker._unbatchedEvents.length, 1)

      test.end()
    })

    eventCreatedTest.test('not emit batchReady event if unbatched length less than batch size', test => {
      let eventId1 = Uuid()
      let batchSize = 2
      let batchReadySpy = sandbox.spy()

      let tracker = BatchTracker.create({ batchSize })
      tracker.on('batchReady', batchReadySpy)

      tracker.eventCreated(eventId1)
      test.notOk(batchReadySpy.called)
      test.equal(tracker._unbatchedEvents.length, 1)

      test.end()
    })

    eventCreatedTest.test('reset batch timer', test => {
      let eventId1 = Uuid()
      let eventId2 = Uuid()
      let batchSize = 2
      let batchReadySpy = sandbox.spy()

      let tracker = BatchTracker.create({ batchSize })
      tracker.on('batchReady', batchReadySpy)

      let origBatchTimer = tracker._batchTimer

      tracker.eventCreated(eventId1)
      tracker.eventCreated(eventId2)

      test.ok(batchReadySpy.called)
      test.notEqual(tracker._batchTimer, origBatchTimer)

      test.end()
    })

    eventCreatedTest.end()
  })

  trackerTest.test('batch timer elapsed should', batchTimerTest => {
    batchTimerTest.test('emit batchReady event and reset timer', test => {
      let eventId1 = Uuid()
      let eventId2 = Uuid()
      let batchSize = 5
      let batchTimeInterval = 5000
      let batchReadySpy = sandbox.spy()

      let tracker = BatchTracker.create({ batchSize, batchTimeInterval })
      tracker._unbatchedEvents.push(eventId1)
      tracker._unbatchedEvents.push(eventId2)
      tracker.on('batchReady', batchReadySpy)

      let origBatchTimer = tracker._batchTimer

      clock.tick(batchTimeInterval)

      test.ok(batchReadySpy.calledWith(sandbox.match([eventId1, eventId2])))
      test.notEqual(tracker._batchTimer, origBatchTimer)
      test.equal(tracker._unbatchedEvents.length, 0)

      test.end()
    })

    batchTimerTest.test('emit batchReady event if no events pending', test => {
      test.end()
    })

    batchTimerTest.end()
  })

  trackerTest.end()
})
