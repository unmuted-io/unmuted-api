'use strict'

/*
|--------------------------------------------------------------------------
| Factory
|--------------------------------------------------------------------------
|
| Factories are used to define blueprints for database tables or Lucid
| models. Later you can use these blueprints to seed your database
| with dummy data.
|
*/

/** @type {import('@adonisjs/lucid/src/Factory')} */
const crypto = require('crypto')
const Factory = use('Factory')
const base32 = require('hi-base32')

// Factory.blueprint('App/Models/User', (faker) => {
//   return {
//     username: faker.username()
//   }
// })

Factory.blueprint('App/Models/User', async (faker) => {
	return {
		username: faker.username(),
		email: faker.email(),
		password: faker.password()
	}
})

Factory.blueprint('App/Models/Video', async (faker) => {
	// let rand = await crypto.randomBytes(8)
	// make a random string
	// rand = base32.encode(rand).replace(/===/i, '')

	// const time = (new Date()).getTime()
	// set the source filename
	// const source = `${time}-${rand}.mp4`
	return {
		title: faker.sentence(),
		description: faker.paragraph(),
		processed: 1,
		source: '1578534374949-K37ZNFRO56CHI.mp4',
		rand: 'K37ZNFRO56CHI',
		user_id: Math.floor(Math.random() * 90) + 1

	}
})

let user_id = 1
let video_id = 1
Factory.blueprint('App/Models/View', async (faker) => {
	let last_position = Math.floor(Math.random() * 20)
	let count = Math.floor(Math.random() * 4)
	if (user_id === 1) {
		count = Math.floor(Math.random() * 70)
	}
	const output = {
		video_id,
		user_id,
		last_position,
		count
	}
	if (user_id < 100) {
		user_id++
	} else {
		user_id = 1
		video_id++
	}

	return output
})