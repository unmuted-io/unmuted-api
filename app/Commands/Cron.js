'use strict'

const { Command } = require('@adonisjs/ace')

class Cron extends Command {
	static get signature() {
		return 'cron'
	}

	static get description() {
		return 'Tell something helpful about this command'
	}

	async handle(args, options) {
		this.info('Dummy implementation for cron command')
	}
}

module.exports = Cron
