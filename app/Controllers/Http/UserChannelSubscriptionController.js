/* global use */
'use strict'

const UserChannelSubscription = use('App/Models/UserChannelSubscription')
const User = use('App/Models/User')
const Database = use('Database')

/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

/**
 * Resourceful controller for interacting with userchannelsubscriptions
 */
class UserChannelSubscriptionController {
	/**
	 * Show a list of all userchannelsubscriptions.
	 * GET userchannelsubscriptions
	 *
	 * @param {object} ctx
	 * @param {Request} ctx.request
	 * @param {Response} ctx.response
	 * @param {View} ctx.view
	 */
	async index({ request, response, view }) {}

	/**
	 * Render a form to be used for creating a new userchannelsubscription.
	 * GET userchannelsubscriptions/create
	 *
	 * @param {object} ctx
	 * @param {Request} ctx.request
	 * @param {Response} ctx.response
	 * @param {View} ctx.view
	 */
	async create({ request, response, view }) {}

	/**
	 * Create/save a new userchannelsubscription.
	 * POST userchannelsubscriptions
	 *
	 * @param {object} ctx
	 * @param {Request} ctx.request
	 * @param {Response} ctx.response
	 */
	async saveUserChannelSubscription({ request, response, params }) {
		const { isSubscribed } = request.body
		const { userId, channel: channelUsername } = params
		if ((typeof isSubscribed === 'undefined') || !userId || !channelUsername) return response.status(400).send()
		const channel = await User.findBy({ username: channelUsername })
		let subscription = await UserChannelSubscription.findBy({
			channel_id: channel.id,
			user_id: parseInt(userId)
		})
		if (subscription) {
			subscription.isSubscribed = isSubscribed
		} else {
			subscription = new UserChannelSubscription()
			subscription.channel_id = channel.id
			subscription.user_id = parseInt(userId)
			subscription.is_subscribed = isSubscribed
		}
		await subscription.save()
		return response.send(subscription)
	}

	/**
	 * Display a single userchannelsubscription.
	 * GET userchannelsubscriptions/:id
	 *
	 * @param {object} ctx
	 * @param {Request} ctx.request
	 * @param {Response} ctx.response
	 * @param {View} ctx.view
	 */
	// get user subscription status for channel
	async getUserChannelSubscription({ params, request, response, view }) {
    const { user, channel } = params
  }

	/**
	 * Render a form to update an existing userchannelsubscription.
	 * GET userchannelsubscriptions/:id/edit
	 *
	 * @param {object} ctx
	 * @param {Request} ctx.request
	 * @param {Response} ctx.response
	 * @param {View} ctx.view
	 */
	async edit({ params, request, response, view }) {}

	/**
	 * Update userchannelsubscription details.
	 * PUT or PATCH userchannelsubscriptions/:id
	 *
	 * @param {object} ctx
	 * @param {Request} ctx.request
	 * @param {Response} ctx.response
	 */
	async update({ params, request, response }) {

	}

	/**
	 * Delete a userchannelsubscription with id.
	 * DELETE userchannelsubscriptions/:id
	 *
	 * @param {object} ctx
	 * @param {Request} ctx.request
	 * @param {Response} ctx.response
	 */
	async destroy({ params, request, response }) {}
}

module.exports = UserChannelSubscriptionController
