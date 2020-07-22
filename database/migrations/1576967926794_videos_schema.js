'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class VideosSchema extends Schema {
	up () {
		this.create('videos', (table) => {
			table.string('title').notNullable()
			table.string('description', 5000)
			table.string('source').unique().notNullable()
			table.string('rand').unique().notNullable()
			table.string('hash').unique()
			table.unique(['source', 'rand'])
			table.integer('user_id').unsigned().references('id').inTable('users').notNullable()
			table.integer('duration').unsigned().notNullable().defaultTo(0)
			table.boolean('processed').defaultTo(false)
			table.increments()
			table.timestamps()
		})
	}

	down () {
		this.drop('videos')
	}
}

module.exports = VideosSchema
