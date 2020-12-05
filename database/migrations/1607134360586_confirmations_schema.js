'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class ConfirmationsSchema extends Schema {
	up() {
		this.create('confirmations', (table) => {
			table.increments()
			table.integer('user_id').unsigned().references('id').inTable('users')
			table.string('telos_account_name', 24).nullable()
			table.string('code', 64).nullable()
			table.string('transaction_id', 64)
			table.timestamps()
		})
	}

	down() {
		this.drop('confirmations')
	}
}

module.exports = ConfirmationsSchema
