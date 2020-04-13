'use strict'

/*
|--------------------------------------------------------------------------
| UserSeeder
|--------------------------------------------------------------------------
|
| Make use of the Factory instance to seed database with dummy data or
| make use of Lucid models directly.
|
*/
const User = use('App/Models/User')
/** @type {import('@adonisjs/lucid/src/Factory')} */
const Factory = use('Factory')

class UserSeeder {
	async run () {
		let user = new User()
		user.username = 'captaincrypto'
		user.email = 'kylan.hurt@gmail.com'
		user.password = 'Test123456'
		user.edge_username = 'captaincrypto'
		user = await user.save()
		await Factory.model('App/Models/User').createMany(100)
	}
}

module.exports = UserSeeder
