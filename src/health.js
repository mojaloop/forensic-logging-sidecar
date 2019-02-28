'use strict'

const Hapi = require('hapi')
const Logger = require('@mojaloop/central-services-shared').Logger
const ErrorHandling = require('@mojaloop/central-services-error-handling')

const createServer = async (port) => {
  const server = await new Hapi.Server({
    port,
    routes: {
      validate: {
        options: ErrorHandling.validateRoutes()
      }
    }
  })

  await server.route({
    method: 'GET',
    path: '/health',
    config: {
      handler: function (request, reply) {
        Logger.info('Forensic Logging Sidecar health check')
        return reply.response({ status: 'OK' })
      }
    }
  })

  await server.start()
  Logger.info('Server running at: ', server.info.uri)
  return server
}

module.exports = {
  createServer
}
