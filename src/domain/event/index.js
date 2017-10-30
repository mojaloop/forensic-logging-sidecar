'use strict'

const Uuid = require('uuid4')
const Moment = require('moment')
const Model = require('./model')
const Util = require('../../lib/util')
const SymmetricCrypto = require('../../crypto/symmetric')

exports.create = (sidecarId, sequence, message, signingKey) => {
  const created = Moment.utc()
  const eventId = Uuid()

  let event = { eventId, sidecarId, sequence, message, created }
  event.signature = createEventSignature(event, signingKey)

  return Model.create(event)
}

exports.getEventCountInTimespan = (sidecarId, startTime, endTime) => {
  if (!Util.isString(startTime)) {
    startTime = startTime.toISOString()
  }
  if (!Util.isString(endTime)) {
    endTime = endTime.toISOString()
  }
  return Model.getEventCount(sidecarId, { startTime, endTime })
}

exports.getUnbatchedEventsByIds = (eventIds) => {
  return Model.getUnbatchedEvents(eventIds)
}

exports.assignEventsToBatch = (events, batch) => {
  const eventIds = events.map(e => e.eventId)
  return Model.updateEvents(eventIds, { batchId: batch.batchId })
}

exports.getSignableEvent = ({ sidecarId, sequence, message, created }) => {
  return { keyId: sidecarId, sequence, message, timestamp: created.toISOString() }
}

const createEventSignature = (event, signingKey) => {
  const eventData = JSON.stringify(exports.getSignableEvent(event))
  return SymmetricCrypto.sign(eventData, signingKey)
}
