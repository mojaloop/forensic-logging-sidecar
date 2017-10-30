'use strict'

const Db = require('../../lib/db')

exports.create = (event) => {
  return Db.events.insert(event)
}

exports.getUnbatchedEvents = (eventIds) => {
  return Db.events.find({ 'eventId': eventIds, 'batchId': null }, { order: 'sequence asc' })
}

exports.getEventCount = (sidecarId, { startTime = null, endTime = null } = {}) => {
  let criteria = { sidecarId }

  if (startTime) {
    criteria['created >='] = startTime
  }
  if (endTime) {
    criteria['created <='] = endTime
  }

  return Db.events.count(criteria, '*')
}

exports.updateEvents = (eventIds, fields) => {
  return Db.events.update({ 'eventId': eventIds }, fields)
}
