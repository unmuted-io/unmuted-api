'use strict'
const crypto = require('crypto')
const base32 = require('hi-base32')
const ffmpeg = require('fluent-ffmpeg')
const io = require('../../../ws')
const WebSocket = require('ws')
const VideoChatController = require('./VideoChatController')
const VideoChat = new VideoChatController()


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

const rooms = []

class VideoController {
	constructor () {
		console.log('in VideoController constructor')
		this.ws = new WebSocket('ws://localhost:9824')
		this.ws.on('open',  () => {
			console.log('controller connected')
		})

		this.ws.on('close', function close() {
			console.log('controllere disconnected')
		})

		this.ws.on('message', (data) => {
			console.log(`controller received messgae: ${data}`)
		})
	}
	/**
	 * Show a list of all videos.
	 * GET videos
	 *
	 * @param {object} ctx
	 * @param {Request} ctx.request
	 * @param {Response} ctx.response
	 * @param {View} ctx.view
	 */
	async index({ request, response, view }) {
		const videos = await Video.all()
		return {
			videos,
		}
	}

	async getRecommended({ params, request, response, view }) {
		const { quantity, username } = params
		const decodedUsername = decodeURI(username)
		const userRows = await Database.table('users').where('username', decodedUsername)
		const user = userRows[0]
		const limit = quantity ? quantity : 20
		let videos
		if (user) {
			// videos and their creators, with views where
			const watchedVideosSubquery = Database
				.from('views')
				.where('user_id', user.id)
				.select('video_id')
			videos = await Database.select([
				'videos.title',
				'videos.description',
				'videos.rand',
				'videos.source',
				'videos.created_at',
				'videos.duration',
				'users.username'
			])
				.from('videos')
				.sum('views.count AS count')
				.innerJoin('users', 'users.id', '=', 'videos.user_id')
				.innerJoin('views', 'views.video_id', '=', 'videos.id')
				.whereNotIn('videos.id', watchedVideosSubquery)
				.groupBy('videos.id')
				.limit(limit)
				.orderBy('videos.created_at', 'desc')
		} else {
			videos = await Database.select([
				'videos.title',
				'videos.description',
				'videos.rand',
				'videos.source',
				'videos.created_at',
				'videos.duration',
				'users.username',
			])
				.from('videos')
				.sum('views.count AS count')
				.innerJoin('users', 'users.id', '=', 'videos.user_id')
				.innerJoin('views', 'views.video_id', '=', 'videos.id')
				.groupBy('videos.id')
				.limit(limit)
				.orderBy('videos.created_at', 'desc')
		}

		return {
			videos,
		}
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
		const { description, title, username } = request.body
		const file = request.file('file')
		const userRows = await Database.table('users').where('username', username)
		const user = userRows[0]
		let rand = await crypto.randomBytes(8)
		// make a random string
		rand = base32.encode(rand).replace(/===/i, '')

		const time = new Date().getTime()
		// set the source filename
		const source = `${time}-${rand}.mp4`
		// move the file from temp to public folder
		await file.move('public/videos', {
			name: source,
			overwrite: false,
			size: '2gb',
			types: ['video'],
		})
		if (!file.moved()) {
			response.status(500).send({
				message:
					'There was an error uploading your video. Please try again later.',
			})
		}
		// create the entry in the database

		let video
		let progress = 0
		// process the movie file
		ffmpeg(`public/videos/${source}`, {
			logger: 'debug',
			stdoutLines: 1000
		})
			.videoCodec('libx264')
			.fps(29.7)
			.size('720x480')
			.autopad() // creates columns to pad dimensions (if necessary)
			// can set multiple .output('${somefile}.mp4)
			.audioBitrate('128k')
			.audioChannels(2)
			.audioCodec('libmp3lame')
			.on('start', (commandLine) => {
				console.log(`Spawned Ffmpeg with command: ${commandLine}`)
			})
			.on('codecData', (data) => {
				console.log(`Input is ${data.audio}  audio with  ${data.video} video`)
			})
			.on('progress', (newProgress) => {
				const progressNumber = parseFloat(newProgress.percent)
				if (progressNumber > progress && progressNumber < 80) {
					console.log('progress is: ', progressNumber)
					progress = progressNumber
					this.ws.send(progressNumber)
				}
			})
			.on('error', (err) => {
				console.log(`An error occurred:  ${err.message}`)
				response.status(500).send()
			})
			.on('end', async () => {
				this.ws.send(85)
				ffmpeg.ffprobe(`public/videos/processed/${source}`, async (err, metadata) => {
					console.log('metadata: ', metadata)
					this.ws.send(90)
					// should check to make sure not duplicate
					video = await Video.create({
						source,
						rand,
						duration: Math.floor(metadata.format.duration),
						user_id: user.id,
						description,
						title,
						processed: 1
					})
					this.ws.send(95)
					// create a default user 1 view entry or some joins will break
					const newView = new View()
					newView.video_id = video.id
					newView.user_id = 1
					newView.last_position = 0
					await newView.save()
					this.ws.send(100)
					this.ws.send('complete: ', + rand)
					response.status(200).send({
						video,
					})
				})
				console.log('Processing finished !')
				// create chat room now?
				// const room = io
				// 	.of(`/${rand}`)
				// 	.on('connection', (socket) => {
				// 		console.log('connected socket: ', socket)
				// 		this.rooms.push(rand)
				// 		socket.emit('message', `Hello and welcome to the video room: ${rand}`)
				// 		socket.on('userMessage', (data) => {
				// 			console.log('a userMessage has come in, data', data)
				// 			room.emit('message', {
				// 				content: `${data.content}`,
				// 				username: data.username,
				// 				amount: 0,
				// 				timestamp: Date.now(),
				// 			})
				// 		})
				// 		// when someone joins room
				// 		socket.on('joinRoom', (room) => {
				// 			// send message user?
				// 			if (this.rooms.includes(room)) {
				// 				socket.join(room)
				// 				socket.emit(
				// 					'success',
				// 					'You have successfully joined room: ' + rand
				// 				)
				// 			} else {
				// 				socket.emit('err', 'Error, no room: ' + rand)
				// 			}
				// 		})
				// 	})
			})
			.screenshots({
				count: 8,
				folder: 'public/videos/processed/thumbnails',
				size: '360x240',
				filename: '%b-360x240-%i.png'
			})
			.screenshots({
				count: 1,
				folder: 'public/videos/processed/thumbnails',
				size: '720x480',
				filename: '%b-720x480-%i.png'
			})
			.save(`public/videos/processed/${source}`)
		response.send(rand)
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
	async show({ params }) {
		const { id } = params
		const video = await Database.select([
			'videos.title',
			'videos.description',
			'videos.rand',
			'videos.source',
			'videos.created_at',
			'users.username',
		])
			.from('videos')
			.where('rand', id)
			.sum('views.count AS count')
			.innerJoin('users', 'users.id', '=', 'videos.user_id')
			.innerJoin('views', 'views.video_id', '=', 'videos.id')
			.groupBy('videos.id')
		return video[0]
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
	async edit({ params, request, response, view }) {}

	/**
	 * Update video details.
	 * PUT or PATCH videos/:id
	 *
	 * @param {object} ctx
	 * @param {Request} ctx.request
	 * @param {Response} ctx.response
	 */
	async update({ params, request, response }) {}

	/**
	 * Delete a video with id.
	 * DELETE videos/:id
	 *
	 * @param {object} ctx
	 * @param {Request} ctx.request
	 * @param {Response} ctx.response
	 */
	async destroy({ params, request, response }) {}

	// for maxed viewCount update updated_at
	async updateViewCount({ request, response }) {
		const body = request.post()
		const { rand, lastPosition, username } = body
		if (!rand || !lastPosition) {
			return response.status(400).send()
		}
		let user
		if (username) {
			const userRows = await Database.table('users').where('username', username)
			user = userRows[0]
		}

		const videoRows = await Database.table('videos').where('rand', rand)
		const video = videoRows[0]

		let viewResult = await View.findBy({
			user_id: username ? user.id : 1,
			video_id: video.id,
		})

		// if the view already exists
		let newViewCount
		let newView
		const view = viewResult
		// if there is already a view
		if (view) {
			// and user is logged in
			if (user) {
				// increase by one up to max of 4
				newViewCount = view.count < 4 ? ++view.count : 4
			} else {
				// if not logged in then just increase it
				newViewCount = ++view.count
			}

			// and save
			await View.query()
				.where('user_id', username ? user.id : 1)
				.andWhere('video_id', video.id)
				.update({
					count: newViewCount,
				})
		} else {
			// if doesn't already exist
			newView = new View()
			newView.video_id = video.id
			newView.user_id = user ? user.id : 1
			newView.last_position = user ? lastPosition : 0
			await newView.save()
		}

		const newCount = newViewCount || 1
		return response.send(newCount)
	}

	async getRecentlyViewed({ params, response }) {
		const { quantity, username } = params
		if (!username) return response.status(401).send()
		const decodedUsername = decodeURI(username)
		const userRows = await Database.table('users').where('username', decodedUsername)
		const user = userRows[0]
		const limit = quantity ? quantity : 20
		const watchedVideosSubquery = Database
			.from('views')
			.where('user_id', user.id)
			.select('video_id')
		const videos = await Database.select([
			'videos.title',
			'videos.description',
			'videos.rand',
			'videos.source',
			'videos.created_at',
			'videos.duration',
			'users.username',
			'views.updated_at',
			'views.last_position'
		])
			.from('videos')
			.sum('views.count AS count')
			.innerJoin('users', 'users.id', '=', 'videos.user_id')
			.innerJoin('views', 'views.video_id', '=', 'videos.id')
			.whereIn('videos.id', watchedVideosSubquery)
			.groupBy('videos.id')
			.limit(limit)
			.orderBy('views.updated_at', 'desc')
		return response.send(videos)
	}
}

module.exports = VideoController
