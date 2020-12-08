/* global use */

'use strict'

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
	async index() {
		const videos = await Video.all()
		return {
			videos,
		}
	}

	async getRecommended({ params }) {
		const { quantity, username } = params
		const decodedUsername = decodeURI(username)
		const userRows = await Database.table('users').where(
			'username',
			decodedUsername
		)
		const user = userRows[0]
		const limit = quantity ? quantity : 20
		let videos
		if (user) {
			// videos and their creators, with views where
			const watchedVideosSubquery = Database.from('views')
				.where('user_id', user.id)
				.select('video_id')
			videos = await Database.select([
				'videos.title',
				'videos.description',
				'videos.rand',
				'videos.source',
				'videos.created_at',
				'videos.duration',
				'videos.processed',
				'users.username',
				'users.profile',
			])
				.from('videos')
				.sum('views.count AS count')
				.innerJoin('users', 'users.id', '=', 'videos.user_id')
				.innerJoin('views', 'views.video_id', '=', 'videos.id')
				// .whereNotIn('videos.id', watchedVideosSubquery)
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
				'users.profile',
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
			'videos.processed',
			'videos.hash',
			'videos.created_at',
			'users.username',
			'users.profile',
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
	async edit() {}

	/**
	 * Update video details.
	 * PUT or PATCH videos/:id
	 *
	 * @param {object} ctx
	 * @param {Request} ctx.request
	 * @param {Response} ctx.response
	 */
	async update() {}

	/**
	 * Delete a video with id.
	 * DELETE videos/:id
	 *
	 * @param {object} ctx
	 * @param {Request} ctx.request
	 * @param {Response} ctx.response
	 */
	async destroy() {}

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
		const userRows = await Database.table('users').where(
			'username',
			decodedUsername
		)
		const user = userRows[0]
		const limit = quantity ? quantity : 20
		const watchedVideosSubquery = Database.from('views')
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
			'views.last_position',
		])
			.from('videos')
			.sum('views.count AS count')
			.innerJoin('users', 'users.id', '=', 'videos.user_id')
			.innerJoin('views', 'views.video_id', '=', 'videos.id')
			// .whereIn('videos.id', watchedVideosSubquery)
			.groupBy('videos.id')
			.limit(limit)
			.orderBy('views.updated_at', 'desc')
		return response.send(videos)
	}
}

module.exports = VideoController
