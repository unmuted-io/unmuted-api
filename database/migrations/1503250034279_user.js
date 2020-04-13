'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class UserSchema extends Schema {
	up () {
		this.create('users', (table) => {
			table.increments()
			table.string('username', 80).unique().nullable()
			table.string('email', 254).unique().nullable()
			table.string('edge_username', 254).unique().nullable()
			table.string('password', 60).nullable()
			table.timestamps()
		})
	}

	down () {
		this.drop('users')
	}
}

module.exports = UserSchema
