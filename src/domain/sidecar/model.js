'use strict'

const Db = require('../../lib/db')

exports.create = (sidecar) => {
  return Db.sidecars.insert(sidecar)
}
