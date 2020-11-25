/* global use */

'use strict'
const crypto = require('crypto')
const base32 = require('hi-base32')
const FormData = require('form-data')
const fs = require('fs').promises
const WebSocket = require('ws')
const axios = require('axios')
const VideoChatController = require('./VideoChatController')
const VideoChat = new VideoChatController() // instantiates websockets
const AWS = require('aws-sdk')
const utils = require('../../../utils/video')
const { getCreateJobJSON } = utils

// Use bluebird implementation of Promise
if (typeof Promise === 'undefined') {
	console.log('using bluebird')
	AWS.config.setPromisesDependency(require('bluebird'))
}

const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_KEY,
	secretAccessKey: process.env.AWS_SECRET,
})

const transcoder = new AWS.ElasticTranscoder({ region: process.env.S3_REGION })

// set namespace
const Video = use('App/Models/Video')
const Database = use('Database')
const View = use('App/Models/View')

class MediaController {
	constructor() {
		console.log('MediaController onstructor being called')
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

	getObject(params) {
		return new Promise((resolve, reject) => {
			s3.getObject(params, (err, data) => {
				if (err) reject(err)
				resolve(data)
			})
		})
	}

	async message({ request, response }) {
		const rawBody = request.raw()
		const body = JSON.parse(rawBody)
		const { Message } = body
		const { userMetadata, state } = JSON.parse(Message)
		const { rand, time } = userMetadata
		const video = await Video.findBy({ rand })
		const processedJSON = JSON.parse(video.processed)
		const COMPLETED = 0.8
		if (processedJSON.progress === COMPLETED) return
		const progressMap = {
			PROGRESSING: 0.7,
			COMPLETED: 0.8,
		}
		video.processed = JSON.stringify({
			...processedJSON,
			progress: progressMap[state],
		})
		await video.save()
		if (state === 'COMPLETED') {
			console.log('COMPLETED')
			const Prefix = `a/${video.user_id}/${time}-${rand}/400k`
			const listObjects = () => {
				return new Promise((resolve, reject) => {
					s3.listObjects(
						{
							Bucket: process.env.S3_PROCESSED_BUCKET,
							Prefix,
						},
						(err, data) => {
							if (err) reject(err)
							resolve(data)
						}
					)
				})
			}

			const bucketObjects = await listObjects()
			console.log('completed bucketObjects: ', bucketObjects)

			/////////////////////////
			const { Contents } = bucketObjects

			const objectsToGet = Contents.map((file, index) => {
				const fileKey = file.Key.replace(Prefix, '')
				return {
					file,
					fileKey,
					progress: false,
					index,
				}
			})
			console.log('objectsToGet: ', objectsToGet)
			const getObjectAttempt = (Key, index) => {
				const params = {
					Bucket: process.env.S3_PROCESSED_BUCKET,
					Key,
				}
				return new Promise((resolve, reject) => {
					const getObject = async (iterator = 0) => {
						try {
							const result = await this.getObject(params)
							console.log('result is: ', result)
							resolve({
								result,
								index,
								Key,
							})
						} catch (err) {
							console.log('getObject error: ', err)
							if (iterator < 10) {
								setTimeout(() => getObject(iterator), 1000)
								iterator++
							} else {
								reject(false)
							}
						}
					}
					getObject()
				})
			}

			let promisesToGet = []
			const finalResults = {}
			const maxIteration =
				// indexes to get
				objectsToGet.length - 1 < 4 ? objectsToGet.length - 1 : 4
			for (let i = 0; i < maxIteration + 1; i++) {
				const fileKey = objectsToGet[i].file.Key
				promisesToGet.push(getObjectAttempt(fileKey, i))
			}
			let masterIterator = maxIteration
			let finished = 0
			while (promisesToGet.length > 0) {
				console.log('masterIterator: ', masterIterator)
				try {
					const value = await Promise.race(promisesToGet)
					const { result, index, Key } = value
					finalResults[index] = result.Etag
					const [prefix, userId, folder, bitrate] = Key.split('/')
					finished++
					if (finished === objectsToGet.length) {
						console.log('FINISHED!')
						console.log('finalResults: ', finalResults)
						return
					}
					if (masterIterator < objectsToGet.length - 1) {
						masterIterator++
						promisesToGet[index] = getObjectAttempt(
							objectsToGet[masterIterator].file.Key,
							masterIterator
						)
					} else {
						delete promisesToGet[index]
					}
					const createFiles = async () => {
						await fs.mkdir(
							`public/videos/processed/stream/${prefix}/${userId}/${folder}/${bitrate}`,
							{ recursive: true }
						)
						await fs.writeFile(
							`public/videos/processed/stream/${Key}`,
							result.Body
						)
					}
					createFiles()
					console.log('completed index: ', index)
				} catch (err) {
					console.log(err)
					return
				}
			}

			/////////////////////////
			// now upload to dStor //
			/////////////////////////
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

	async store({ request, response }) {
		const { DSTOR_ACCESS_TOKEN, DSTOR_API_URL } = process.env
		const { description, title, username } = request.body
		const file = request.file('file')
		console.log('attached file: ', file)
		const userRows = await Database.table('users').where('username', username)
		const user = userRows[0]
		let rand = await crypto.randomBytes(8)
		// make a random string
		rand = base32.encode(rand).replace(/===/i, '')

		const time = new Date().getTime()
		// set the source filename
		const timeAndRand = `${time}-${rand}`
		const source = `${timeAndRand}.mp4`
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
		this.ws.send(10)
		// create the entry in the database
		let video
		let progress = 0

		try {
			const fileStream = await fs.readFile(`public/videos/${source}`)
			const params = {
				Bucket: process.env.S3_BUCKET,
				Key: `a/${user.id}/${source}`,
				Body: fileStream,
			}

			const putFile = () => {
				return new Promise((resolve, reject) => {
					s3.putObject(params, (err, data) => {
						if (err) reject(err)
						resolve(data)
					})
				})
			}

			const data = await putFile()
			console.log('putFile data: ', data)

			const getObjectParams = {
				Bucket: process.env.S3_BUCKET,
				Key: `a/${user.id}/${source}`,
			}

			const getObjectData = await this.getObject(getObjectParams)
			console.log('getObjectData: ', getObjectData)
			this.ws.send(20)
			// create entry in db
			video = await Video.create({
				source,
				rand,
				duration: 0,
				user_id: user.id,
				description,
				title,
				processed: JSON.stringify({ progress: 0.1 }),
				hash: rand,
			})
			this.ws.send(50)
			console.log('video: ', video.toJSON())
			const newView = new View()
			newView.video_id = video.id
			newView.user_id = 1
			newView.last_position = 0
			await newView.save()
			this.ws.send(60)
			this.ws.send('complete: ', rand)
			response.status(200).send({
				video,
			})

			response.send(rand)
			const createJobInput = getCreateJobJSON({
				userId: user.id,
				time,
				source,
				rand,
			})

			const createJob = () => {
				return new Promise((resolve, reject) => {
					transcoder.createJob(createJobInput, (err, data) => {
						if (err) reject(err)
						resolve(data)
					})
				})
			}

			await createJob()
			const processedJSON = JSON.parse(video.processed)
			video.processed = JSON.stringify({
				...processedJSON,
				progress: 0.6,
			})
			await video.save()
		} catch (error) {
			console.log('S3 put error: ', error)
		}
	}
}

module.exports = MediaController
