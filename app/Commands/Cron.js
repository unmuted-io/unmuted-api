'use strict'

const { Command } = require('@adonisjs/ace')
const Database = use('Database')
const axios = require('axios')

class Cron extends Command {
	static get signature() {
		return 'cron'
	}

	static get description() {
		return 'Tell something helpful about this command'
	}

	async handle(args, options) {
		const { TELOS_RPC_ENDPOINT, TLOS_APP_ACCOUNT_NAME } = process.env
		this.info('Executing cron')
		const now = new Date()
		const nowTimestamp = now.getTime()
		const oneHourAgo = nowTimestamp - 60 * 1000 * 60
		console.log('oneHourAgo: ', oneHourAgo)
		const url = `${TELOS_RPC_ENDPOINT}/v2/history/get_actions?transfer.to=unmutediodap&transfer.symbol=TLOS&limit=1000`
		console.log('url: ', url)
		const response = await axios({
			method: 'GET',
			url,
			data: JSON.stringify({
				account_name: TLOS_APP_ACCOUNT_NAME,
				after: oneHourAgo,
			}),
		})

		for (const action of response.data.actions) {
			const tx = action.act.data
			const { from, memo } = tx
			const confirmationRow = await Database.table('confirmations')
				.where('telos_account_name', from)
				.andWhere('code', memo)
			console.log('confirmationRow: ', confirmationRow)
			if (confirmationRow[0]) {
				await Database.table('users')
					.where('id', confirmationRow[0].user_id)
					.update({ telos_account_name: from })
				await Database.table('confirmations')
					.where('id', confirmationRow[0].user_id)
					.del()
			}
		}
	}
}

module.exports = Cron
