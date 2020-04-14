'use strict'

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
const Factory = use('Factory')
const Video = use('App/Models/Video')

class VideoSeeder {
	async run () {
		let video = new Video()
		video.title = 'My random video title'
		video.description = 'This is my random video description'
		video.source = '1586844193553-ZUBZGTYF6LQPS.mp4'
		video.rand = 'ZUBZGTYF6LQPS'
		video.user_id = 1
		video.processed = 1
		video = await video.save()
		await Factory.model('App/Models/Video').createMany(100)
	}
}

module.exports = VideoSeeder
