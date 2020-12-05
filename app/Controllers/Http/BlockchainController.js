'use strict'
const crypto = require('crypto')
const base32 = require('hi-base32')

const User = use('App/Models/User')
const Database = use('Database')
const Confirmation = use('App/Models/Confirmation')

class BlockchainController {
	// get code to include in blockchain transaction
	// as memo, to prove ownership of account
	async getBlockchainConfirmationCode({ request, response }) {
		const { accountName: telos_account_name, userId: user_id } = request.body
		let rand = await crypto.randomBytes(32)
		// make a random string
		rand = base32.encode(rand).replace(/===/i, '')
		const confirmation = await new Confirmation()
		confirmation.user_id = user_id
		confirmation.telos_account_name = telos_account_name
		confirmation.code = rand
		await confirmation.save()
		return response.json(confirmation.toJSON())
	}
}

module.exports = BlockchainController
