'use strict'

const Moment = require('moment')
const EventService = require('./domain/event')

class HealthCheck {
  ping (sidecar) {
    const current = Moment.utc()
    const uptime = current.diff(sidecar.startTime)

    return EventService.getEventCountInTimespan(sidecar.id, Moment.utc(current).subtract(1, 'hour'), current)
      .then(eventCountLastHour => {
        return { id: sidecar.id, version: sidecar.version, current: current.toISOString(), uptime, eventCountLastHour }
      })
  }
}

module.exports = new HealthCheck()
