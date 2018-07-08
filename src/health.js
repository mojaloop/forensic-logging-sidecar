'use strict'

const Hapi = require('hapi')
const Logger = require('@mojaloop/central-services-shared').Logger
const EventEmitter = require('events')

class Health extends EventEmitter {
  constructor (port) {
    super()
    this.server = new Hapi.Server()
    this.healthPort = port
    this._startHealthCheck()
  }

  _startHealthCheck () {
    this.server.connection({
      port: this.healthPort
    })
    Logger.info('Starting health server')
    this.server.route({
      method: 'GET',
      path: '/health',
      handler: function (request, reply) {
        Logger.info('Forensic Logging Sidecar health check')
        return reply({status: 'OK'})
      }
    })
    this.server.start((err) => {
      if (err) {
        throw err
      }
      Logger.info('Server running at:', this.server.info.uri)
    })
  }
}

exports.create = (port) => {
  return new Health(port)
}
