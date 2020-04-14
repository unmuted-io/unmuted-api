'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class ViewsSchema extends Schema {
	up () {
		this.create('views', (table) => {
			table.integer('video_id').unsigned().references('id').inTable('videos')
      table.integer('user_id').unsigned().references('id').inTable('users')
      table.integer('last_position').unsigned()
			table.integer('count').unsigned()
			table.increments()
			table.timestamps()
		})
	}

	down () {
		this.drop('views')
	}
}

module.exports = ViewsSchema
