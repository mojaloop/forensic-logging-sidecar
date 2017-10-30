'use strict'

const Db = require('../../lib/db')

exports.create = (batch) => {
  return Db.batches.insert(batch)
}

exports.findForService = (serviceName, startTime, endTime) => {
  return Db.batches.query(builder => {
    return builder
      .join('sidecars', 'sidecars.sidecarId', '=', 'batches.sidecarId')
      .where('sidecars.serviceName', serviceName)
      .andWhere('batches.created', '>=', startTime)
      .andWhere('batches.created', '<=', endTime)
      .select('batches.*')
      .orderBy('batches.created', 'asc')
  })
}
