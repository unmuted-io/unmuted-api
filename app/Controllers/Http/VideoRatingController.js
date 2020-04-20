'use strict'

/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

/**
 * Resourceful controller for interacting with videoratings
 */

const VideoRating = use('App/Models/VideoRating')
const Video = use('App/Models/Video')
const User = use('App/Models/User')
const Database = use('Database')

class VideoRatingController {
	/**
   * Show a list of all videoratings.
   * GET videoratings
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {View} ctx.view
   */
	async index ({ request, response, view }) {
	}

	/**
   * Render a form to be used for creating a new videorating.
   * GET videoratings/create
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {View} ctx.view
   */
	async create ({ request, response, view }) {
	}

	/**
   * Create/save a new videorating.
   * POST videoratings
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   */
	async store ({ request, response, params, auth }) {
		const body = request.post()
		const { username, uuid, direction } = body
		console.log('body is: ', body)
		const user = await User.find({
			username
		})
		const video = await Video.find({
			rand: uuid
		})

		const result = await VideoRating.findOrCreate({
			user_id: user.id,
			video_id: video.id
		}, {
			user_id: user.id,
			video_id: video.id,
			direction
		})
		result.direction = direction
		return response.send(result)
	}

	/**
   * Display a single videorating.
   * GET videoratings/:id
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {View} ctx.view
   */
	async show ({ params, request, response, view }) {
	}

	/**
   * Render a form to update an existing videorating.
   * GET videoratings/:id/edit
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {View} ctx.view
   */
	async edit ({ params, request, response, view }) {
	}

	/**
   * Update videorating details.
   * PUT or PATCH videoratings/:id
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   */
	async update ({ params, request, response }) {
	}

	/**
   * Delete a videorating with id.
   * DELETE videoratings/:id
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   */
	async destroy ({ params, request, response }) {
	}
}

module.exports = VideoRatingController
