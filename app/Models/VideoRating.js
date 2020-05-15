/* global use */

'use strict'

/** @type {typeof import('@adonisjs/lucid/src/Lucid/Model')} */
const Model = use('Model')

class VideoRating extends Model {
	static get hidden () {
	  return ['id']
	}

	user () {
		return this.belongsTo('App/Models/User')
	}

	view () {
		return this.belongsTo('App/Models/Video')
	}
}

module.exports = VideoRating
