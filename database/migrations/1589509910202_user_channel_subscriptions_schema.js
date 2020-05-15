/* global use */

'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class UserChannelSubscriptionsSchema extends Schema {
	up() {
		this.create('user_channel_subscriptions', (table) => {
			table.integer('user_id').unsigned().references('id').inTable('users')
			table.integer('channel_id').unsigned().references('id').inTable('users')
			table.unique(['user_id', 'channel_id'])
			table.increments()
			table.timestamps()
		})
	}

	down() {
		this.drop('user_channel_subscriptions')
	}
}

module.exports = UserChannelSubscriptionsSchema
