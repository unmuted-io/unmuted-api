'use strict'
const crypto = require('crypto')
const base32 = require('hi-base32')
const ffmpeg = require('fluent-ffmpeg')
const WebSocket = require('ws')
const { spawn } = require('child_process')
const fs = require('fs')

// set namespace
const Video = use('App/Models/Video')
const Database = use('Database')
const View = use('App/Models/View')

let instances = 0

class MediaController {
	constructor() {
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
			console.log(`controller received messgae: ${data}`)
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
		console.log('inside store')
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
		// handle duplicates
		ffmpeg.ffprobe(`public/videos/${source}`, async (error, metadata) => {
			if (error) console.error('ffprobe error: ', error)
			console.log('input metatdata: ', metadata)
			const { format } = metadata
			const { duration } = format

			let thumbnailRate = 1 // one per second
			if (duration < 7) {
				thumbnailRate = duration / 7
			}
			const totalFrames = duration * 30 // approximation
			// console.log('about to create ffmpeg')
			const cleanedFfmpegCommandArray = [
				'-ss',
				'1',
				'-i',
				`public/videos/${source}`,
				'-y',
				'-filter_complex',
				"scale=w='if(gt(a,1.5),360,trunc(240*a/2)*2)':h='if(lt(a,1.5),240,trunc(360/a/2)*2)'[size0];[size0]pad=w=360:h=240:x='if(gt(a,1.5),0,(360-iw)/2)':y='if(lt(a,1.5),0,(240-ih)/2)':color=black[out]",
				'-b:a',
				'128k',
				'-ac',
				'2',
				'-acodec',
				'libmp3lame',
				'-vcodec',
				'libx264',
				'-r',
				'30000/1001',
				`public/videos/processed/${source}`,
				'-map',
				'[out]',
				'-r',
				`${thumbnailRate}`,
				'-vframes',
				'8',
				'-start_number',
				'1',
				`public/images/videos/thumbnails/${source}-360x240-%d.png`
			]
			const ffmpeg = spawn('ffmpeg', cleanedFfmpegCommandArray)

			ffmpeg.stdout.on('data', (data) => {
				console.log(`stdout: ${data}`)
			})
			ffmpeg.stderr.on('data', (data) => {
				const stringifiedData = data.toString()
				// console.error(`stderr: ${stringifiedData}`)
				const stringFirstPart = stringifiedData.substring(0,6)
				// console.log('stringFirstPart: ', stringFirstPart)
				if (stringFirstPart === 'frame=') {
					const dataArray = stringifiedData.replace(/ +(?= )/g,'').split(' ')
					// console.log('frames: ', dataArray[1])
					const frames = dataArray[1]
					progress = frames / totalFrames
					console.log('progress: ', progress)
				}
			})
			ffmpeg.on('close', (code) => {
				console.log(`child process exited with code ${code}`)
			})
		})

		response.send(rand)
	}
}

module.exports = MediaController
