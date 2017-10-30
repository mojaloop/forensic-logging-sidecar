'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('batches', (t) => {
    t.index('sidecarId')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('batches', (t) => {
    t.dropIndex('sidecarId')
  })
}
