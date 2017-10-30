'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('batches', (t) => {
    t.uuid('batchId').primary()
    t.uuid('sidecarId').notNullable()
    t.foreign('sidecarId').references('sidecars.sidecarId')
    t.text('data', 'longtext').notNullable()
    t.string('signature', 128)
    t.timestamp('created').notNullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('batches')
}
