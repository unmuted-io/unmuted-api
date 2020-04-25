'use strict'
const fs = require('fs')
const faker = require('faker')

/*
|--------------------------------------------------------------------------
| VideoSeeder
|--------------------------------------------------------------------------
|
| Make use of the Factory instance to seed database with dummy data or
| make use of Lucid models directly.
|
*/

/** @type {import('@adonisjs/lucid/src/Factory')} */
// const Factory = use('Factory')
const Video = use('App/Models/Video')

const fileList = fs.readdirSync('./public/videos')

class VideoSeeder {
	async run () {
		// fileList.forEach(async file => {
		// 	if (!file.includes('.mp4')) return
		// 	const filenameParts = file.split('-')
		// 	const rand = filenameParts[1]
		// 	const duration = Math.floor(Math.random() * 60 * 60 * 2)
		// 	let video = new Video()
		// 	video.title = faker.lorem.sentence(),
		// 	video.description = faker.lorem.paragraph(),
		// 	video.processed = 1,
		// 	video.source = file,
		// 	video.duration = duration
		// 	video.rand = rand.replace('.mp4', ''),
		// 	video.user_id = Math.floor(Math.random() * 90) + 1
		// 	await video.save()
		// })
	}
}

module.exports = VideoSeeder
