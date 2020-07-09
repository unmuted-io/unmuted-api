'use strict'

const User = use('App/Models/User')
const Video = use('App/Models/Video')
const slugify = require('slugify')

// Define resolvers
const resolvers = {
	Query: {
		// Fetch all users
		async allUsers() {
			const users = await User.all()
			return users.toJSON()
		},
		// Get a user by its ID
		async fetchUser(_, { id }) {
			const user = await User.find(id)
			return user.toJSON()
		},
		// Fetch all videos
		async allVideos() {
			const videos = await Video.all()
			return videos.toJSON()
		},
		// Get a video by its ID
		async fetchVideo(_, { id }) {
			const video = await Video.find(id)
			return video.toJSON()
		}
	},
	User: {
		// Fetch all videos created by a user
		async videos(userInJson) {
			// Convert JSON to model instance
			const user = new User()
			user.newUp(userInJson)

			const videos = await user.videos().fetch()
			return videos.toJSON()
		},
	},
	Video: {
		// Fetch the author of a particular video
		async user(videoInJson) {
			// Convert JSON to model instance
			const video = new Video()
			video.newUp(videoInJson)

			const user = await video.user().fetch()
			return user.toJSON()
		},
	},
}

module.exports = resolvers