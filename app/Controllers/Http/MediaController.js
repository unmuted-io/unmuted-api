/* global use */

'use strict'
const crypto = require('crypto')
const base32 = require('hi-base32')
const fs = require('fs')
const WebSocket = require('ws')
const ffmpeg = require('fluent-ffmpeg')
const VideoChatController = require('./VideoChatController')
const VideoChat = new VideoChatController() // instantiates websockets
const AWS = require('aws-sdk')
const CronJob = require('cron').CronJob
const videoUtils = require('../../../utils/video')
const dstorUtils = require('../../../utils/dstor')
const { getCreateJobJSON } = videoUtils
const { uploadToDstor } = dstorUtils

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
		const ongoingProcessedJson = JSON.parse(video.processed)
		if (ongoingProcessedJson.progress === 'TRANSCODING_COMPLETE') return
		const progressMap = {
			PROGRESSING: 'TRANSCODING_IN_PROGRESS',
			COMPLETED: 'TRANSCODING_COMPLETE',
		}

		ongoingProcessedJson.progress = progressMap[state]
		ongoingProcessedJson.files = {}
		video.processed = JSON.stringify(ongoingProcessedJson)
		await video.save()
		// done transcoding
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
				ongoingProcessedJson.files[file.Key] = 'TRANSCODED_FILE_REGISTERED'
				return {
					file,
					fileKey,
					progress: false,
					index,
				}
			})
			ongoingProcessedJson.progress = 'TRANSCODED_FILES_REGISTERED'
			try {
				video.processed = JSON.stringify(ongoingProcessedJson)
				await video.save()
			} catch (err) {
				console.log('video save error: ', err)
			}
			console.log('objectsToGet: ', objectsToGet)
			const getObjectAttempt = (Key, objectIndex, resultIndex) => {
				const params = {
					Bucket: process.env.S3_PROCESSED_BUCKET,
					Key,
				}
				return new Promise((resolve, reject) => {
					const getObject = async (iterator = 0) => {
						try {
							const result = await this.getObject(params)
							resolve({
								result,
								resultIndex,
								objectIndex,
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

			fs.mkdirSync(
				`public/videos/processed/stream/${Prefix}`,
				{ recursive: true },
				(err) => {
					console.log('mkdir err: ', err)
				}
			)

			let promisesToGet = []
			const finalResults = {}
			let writeIterator = 0
			const indicesToGet = objectsToGet.length - 1
			const maxIteration = indicesToGet < 4 ? indicesToGet : 4
			for (let objectIndex = 0; objectIndex < maxIteration; objectIndex++) {
				const fileKey = objectsToGet[objectIndex].file.Key
				promisesToGet.push(getObjectAttempt(fileKey, objectIndex, objectIndex))
			}
			let masterIterator = maxIteration
			let finished = 0
			while (
				promisesToGet.length > 0 &&
				writeIterator < objectsToGet.length + 1
			) {
				console.log('masterIterator: ', masterIterator)
				console.log('writeIterator: ', writeIterator)
				try {
					// await for next resolve
					const value = await Promise.race(promisesToGet)
					const { result, resultIndex, Key, objectIndex } = value
					finalResults[objectIndex] = result.Etag
					fs.writeFile(
						`public/videos/processed/stream/${Key}`,
						result.Body,
						(err) => {
							if (err) {
								console.log(`writeFile error for file ${Key}: `, err)
							} else {
								ongoingProcessedJson.files[Key] = 'TRANSCODED_FILE_DOWNLOADED'
								writeIterator++
							}
						}
					)
					finished++
					if (finished === objectsToGet.length - 1) {
						console.log('FINISHED!')
						console.log('finalResults: ', finalResults)
						return
					}
					if (masterIterator < objectsToGet.length - 1) {
						promisesToGet[resultIndex] = getObjectAttempt(
							objectsToGet[masterIterator].file.Key,
							masterIterator,
							resultIndex
						)
						masterIterator++
					} else {
						promisesToGet[resultIndex] = getObjectAttempt(
							objectsToGet[masterIterator].file.Key,
							masterIterator,
							resultIndex
						)
						const finalValues = await Promise.all(promisesToGet)
						promisesToGet = []
						finalValues.forEach((value) => {
							const { result, resultIndex, Key, objectIndex } = value
							console.log(
								'result is: ',
								result,
								'result index is: ',
								resultIndex
							)
							finalResults[objectIndex] = result.Etag
							fs.writeFile(
								`public/videos/processed/stream/${Key}`,
								result.Body,
								async (err) => {
									if (err) {
										console.log('writeFile error: ', err)
									} else {
										console.log('last files being written')
										ongoingProcessedJson.files[Key] =
											'TRANSCODED_FILE_DOWNLOADED'
										if (writeIterator === objectsToGet.length - 1) {
											console.log('last file save clause being executed')
											let fileDownloadProgress =
												'TRANSCODED_FILES_DOWNLOAD_COMPLETE'
											Object.values(ongoingProcessedJson.files).forEach(
												(status) => {
													if (status !== 'TRANSCODED_FILE_DOWNLOADED') {
														fileDownloadProgress =
															'TRANSCODED_FILES_PARTIAL_DOWNLOAD'
													}
												}
											)
											ongoingProcessedJson.progress = fileDownloadProgress
											video.processed = JSON.stringify(ongoingProcessedJson)
											await video.save()
											this.uploadVideoToDstor(rand)
										}
										writeIterator++
									}
								}
							)
							finished++
						})
					}
				} catch (err) {
					console.log(err)
				}
			}

			/////////////////////////
			// now upload to dStor //
			/////////////////////////
		}
	}

	async uploadVideoToDstor(rand) {
		const { DSTOR_API_URL } = process.env
		const video = await Video.findBy({ rand })
		const ongoingProcessedJson = JSON.parse(video.processed)
		const { files } = ongoingProcessedJson
		let allCompleted = true
		const playlist = {}

		for (const file in files) {
			const filePath = `public/videos/processed/stream/${file}`
			const fileStream = fs.readFileSync(filePath)
			if (file.includes('.m3u8')) {
				playlist.path = file
				playlist.contents = fileStream.toString()
				console.log('playlist: ', playlist)
				console.log('playlistContents: ', fileStream.toString())
			}
			try {
				const folderPathList = file.split('/')
				const fileName = folderPathList[folderPathList.length - 1]
				delete folderPathList[folderPathList.length - 1]
				const folderPath = `/${folderPathList.join('/')}`
				const Hash = await uploadToDstor(fileStream, fileName, folderPath)
				console.log('Hash is: ', Hash)
				ongoingProcessedJson.files[file] = Hash
			} catch (err) {
				console.log('dStor upload failed for ', file, 'with err: ', err)
				allCompleted = false
			}
		}
		ongoingProcessedJson.progress = allCompleted
			? 'TRANSCODED_FILES_DSTOR_UPLOAD_COMPLETE'
			: 'TRANSCODED_FILES_DSTOR_UPLOAD_INCOMPLETE'
		for (const file in ongoingProcessedJson.files) {
			const filePathSegments = file.split('/')
			const fileName = filePathSegments[filePathSegments.length - 1]
			playlist.contents = playlist.contents.replace(
				fileName,
				`${DSTOR_API_URL}/ipfs/${ongoingProcessedJson.files[file]}`
			)
		}
		try {
			fs.writeFileSync(
				`public/videos/processed/stream/${playlist.path}`,
				playlist.contents
			)
			const folderPathList = playlist.path.split('/')
			const fileName = folderPathList[folderPathList.length - 1]
			delete folderPathList[folderPathList.length - 1]
			const folderPath = `/${folderPathList.join('/')}`
			const Hash = await uploadToDstor(
				Buffer.from(playlist.contents),
				fileName,
				folderPath
			)
			console.log('Hash is: ', Hash)
			ongoingProcessedJson.files[playlist.path] = Hash
		} catch (err) {
			console.log('dStor upload failed for playlist with err: ', err)
			allCompleted = false
		}
		video.processed = JSON.stringify(ongoingProcessedJson)
		video.save()
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
			const fileStream = fs.readFileSync(`public/videos/${source}`)
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
			const ongoingProcessedJson = { progress: 'UPLOADED' }
			video = await Video.create({
				source,
				rand,
				duration: 0,
				user_id: user.id,
				description,
				title,
				processed: JSON.stringify(ongoingProcessedJson),
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
			ongoingProcessedJson.progress = 'TRANSCODING_STARTED'
			video.processed = JSON.stringify(ongoingProcessedJson)
			await video.save()
		} catch (error) {
			console.log('S3 put error: ', error)
		}
	}
}

module.exports = MediaController
