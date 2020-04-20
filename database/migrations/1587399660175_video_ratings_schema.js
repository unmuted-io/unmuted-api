'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class VideoRatingsSchema extends Schema {
	up() {
		this.create('video_ratings', (table) => {
			table.integer('video_id').unsigned().references('id').inTable('videos')
			table.integer('user_id').unsigned().references('id').inTable('users')
			table.unique(['user_id', 'video_id'])
			table.integer('direction').notNullable().defaultTo(0)
			table.increments()
			table.timestamps()
		})
	}

	down() {
		this.drop('video_ratings')
	}
}

module.exports = VideoRatingsSchema
