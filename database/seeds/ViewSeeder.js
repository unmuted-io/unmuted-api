'use strict'

/*
|--------------------------------------------------------------------------
| ViewSeeder
|--------------------------------------------------------------------------
|
| Make use of the Factory instance to seed database with dummy data or
| make use of Lucid models directly.
|
*/

const View = use('App/Models/View')
/** @type {import('@adonisjs/lucid/src/Factory')} */
const Factory = use('Factory')

class ViewSeeder {
	async run () {
		await Factory.model('App/Models/View').createMany(10000)
	}
}

module.exports = ViewSeeder
