'use strict'

const Model = require('./model')

exports.create = (sidecarId, serviceName, version, created) => {
  return Model.create({ sidecarId, serviceName, version, created })
}
