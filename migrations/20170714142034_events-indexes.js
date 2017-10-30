'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('events', (t) => {
    t.index('batchId')
    t.index('sidecarId')
    t.unique(['sidecarId', 'sequence'])
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('events', (t) => {
    t.dropIndex('batchId')
    t.dropIndex('sidecarId')
    t.dropUnique(['sidecarId', 'sequence'])
  })
}
