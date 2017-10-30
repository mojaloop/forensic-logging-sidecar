'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('sidecars', (t) => {
    t.uuid('sidecarId').primary()
    t.text('serviceName', 1028).notNullable()
    t.text('version', 32).notNullable()
    t.timestamp('created').notNullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('sidecars')
}
