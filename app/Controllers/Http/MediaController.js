/* global use */

'use strict'
const crypto = require('crypto')
const base32 = require('hi-base32')
const ffmpeg = require('fluent-ffmpeg')
const FormData = require('form-data')
const fs = require('fs')
const WebSocket = require('ws')
const axios = require('axios')
const VideoChatController = require('./VideoChatController')
const VideoChat = new VideoChatController() // instantiates websockets
const Drive = use('Drive')
const AWS = require('aws-sdk')

const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_KEY,
	secretAccessKey: process.env.AWS_SECRET,
})

// set namespace
const Video = use('App/Models/Video')
const Database = use('Database')
const View = use('App/Models/View')

class MediaController {
	constructor() {
		const { AWS_ID, AWS_SECRET, AWS_BUCKET_NAME } = process.env
		this.AWS_ID = AWS_ID
		this.AWS_SECRET = AWS_SECRET
		this.AWS_BUCKET_NAME = AWS_BUCKET_NAME

		console.log('in VideoController constructor')
		this.ws = new WebSocket('ws://localhost:9824')
		this.ws.on('open', () => {
			console.log('controller connected')
		})

		this.ws.on('close', function close() {
			console.log('controller disconnected')
		})

		this.ws.on('error', (error) => {
			console.log('controller ereror: ', error)
		})

		this.ws.on('message', (data) => {
			// console.log(`controller received messgae: ${data}`)
		})
	}

	/**
	 * Create/save a new video.
	 * POST videos
	 *
	 * @param {object} ctx
	 * @param {Request} ctx.request
	 * @param {Response} ctx.response
	 */

	async store({ request, response }) {
		const { DSTOR_ACCESS_TOKEN, DSTOR_API_URL } = process.env
		const { description, title, username } = request.body
		const file = request.file('file')
		const userRows = await Database.table('users').where('username', username)
		const user = userRows[0]
		let rand = await crypto.randomBytes(8)
		// make a random string
		rand = base32.encode(rand).replace(/===/i, '')

		const time = new Date().getTime()
		// set the source filename
		const sourceAndRand = `${time}-${rand}`
		const source = `${sourceAndRand}.mp4`
		console.log('file: ', file)
		// move the file from temp to public folder
		console.log('source: ', source)
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

		try {
			const fileStream = fs.readFileSync(`public/videos/${source}`)
			console.log('fileStream: ', fileStream)
			const params = {
				Bucket: process.env.S3_BUCKET,
				Key: `${user.id}/${source}`,
				Body: fileStream,
			}
			// const putResponse = await Drive.put('hello.txt', )
			const putResponse = s3.putObject(params, (err, data) => {
				if (err) console.log('err: ', err)
				console.log('data: ', data)
			})
			console.log('putResponse: ', putResponse)
		} catch (error) {
			console.log('S3 put error: ', error)
		}

		// create entry in db
		video = await Video.create({
			source,
			rand,
			duration: 0,
			user_id: user.id,
			description,
			title,
			processed: 0.1,
			hash: '',
		})
		this.ws.send(50)

		const newView = new View()
		newView.video_id = video.id
		newView.user_id = 1
		newView.last_position = 0
		await newView.save()
		this.ws.send(100)
		this.ws.send('complete: ', +rand)
		response.status(200).send({
			video,
		})

		return response.send(rand)
	}
}

module.exports = MediaController
