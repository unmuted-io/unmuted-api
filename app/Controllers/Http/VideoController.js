'use strict'
const crypto = require('crypto')
const base32 = require('hi-base32')

/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

/**
 * Resourceful controller for interacting with videos
 */

// Bring in model

// set namespace
const Video = use('App/Models/Video')
const Database = use('Database')
const View = use('App/Models/View')

class VideoController {
	/**
   * Show a list of all videos.
   * GET videos
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {View} ctx.view
   */
	async index ({ request, response, view }) {
		const videos = await Video.all()
		return {
			videos
		}
	}

	async getRecommended ({ params, request, response, view }) {
		const { quantity } = params
		const limit = quantity ? quantity : 20
		const videos = await Database
			.select([
				'videos.title',
				'videos.description',
				'videos.rand',
				'videos.source',
				'videos.created_at',
				'users.username'
			])
			.from('videos')
			.sum('views.count AS count')
			.innerJoin('users', 'users.id', '=', 'videos.user_id')
			.innerJoin('views', 'views.video_id', '=', 'videos.id')
			.groupBy('videos.id')
			.limit(limit)
			.orderBy('videos.created_at', 'desc')
		return {
			videos
		}
	}

	/**
   * Render a form to be used for creating a new video.
   * GET videos/create
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {View} ctx.view
   */
	async create ({ request, response, view }) {

	}

	/**
   * Create/save a new video.
   * POST videos
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   */
	async store ({ request, response }) {
		const file = request.file('file')

		let rand = await crypto.randomBytes(8)
		// make a random string
		rand = base32.encode(rand).replace(/===/i, '')

		const time = (new Date()).getTime()
		// set the source filename
		const source = `${time}-${rand}.mp4`
		// move the file from temp to public folder
		await file.move('public/videos', {
			name: source,
			overwrite: false,
			size: '2gb',
			types: ['video']
		})
		if (!file.moved()) {
			response.status(500).send({
				message: 'There was an error uploading your video. Please try again later.'
			})
		}
		// create the entry in the database
		const video = await Video.create({
			...request.all(),
			source,
			rand
		})

		// process the movie file
		await ffmpeg(`public/videos/${source}`)
			.videoCodec('libx264')
			.fps(29.7)
			.size('720x480')
			.on('error', function(err) {
				console.log('An error occurred: ' + err.message)
			})
			.on('end', function() {
				console.log('Processing finished !')
				response.send({
					rand
				})
			})
			.save(`public/videos/processed/${source}`)

		response.send({
			rand
		})
	}

	/**
   * Display a single video.
   * GET videos/:rand
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {View} ctx.view
   */
	async show ({ params }) {
		const { id } = params
		const video = await Database.table('videos').where('rand', id)
		return video
	}

	/**
   * Render a form to update an existing video.
   * GET videos/:id/edit
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {View} ctx.view
   */
	async edit ({ params, request, response, view }) {
	}

	/**
   * Update video details.
   * PUT or PATCH videos/:id
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   */
	async update ({ params, request, response }) {
	}

	/**
   * Delete a video with id.
   * DELETE videos/:id
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   */
	async destroy ({ params, request, response }) {
	}

	async updateViewCount ({ request, response }) {
		const body = request.post()
		const {
			sourceRand,
			lastPosition,
			username
		} = body
		const user = await Database.table('users').where('username', username)
		const video = await Database.table('videos').where('rand', sourceRand)
		const view = new View()
		view.video_id = video.id
		view.last_position = lastPosition
		view.user_id = user.id
		await view.save()
		return response.status(200).send()
	}
}

module.exports = VideoController
