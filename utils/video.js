const AWS = require('aws-sdk')
const fs = require('fs')
const dstorUtils = require('./dstor')
const { uploadToDstor } = dstorUtils
const { DSTOR_API_URL, AWS_KEY, AWS_SECRET } = process.env

const Video = use('App/Models/Video')

const s3 = new AWS.S3({
	accessKeyId: AWS_KEY,
	secretAccessKey: AWS_SECRET,
})

const replaceM3u8Links = (input, hashes) => {
	let newString = input
	for (let i = 0; i < Object.keys(hashes).length; i++) {
		newString = newString.replace(
			`stream${i}.ts\n`,
			`${DSTOR_API_URL}/ipfs/${hashes[i]}\n`
		)
	}
	return newString
}

const getCreateJobJSON = ({ time, userId, source, rand }) => {
	const timeAndRand = `${time}-${rand}`
	return {
		Inputs: [
			{
				Key: `a/${userId}/${source}`,
				FrameRate: 'auto',
				Resolution: 'auto',
				AspectRatio: 'auto',
				Interlaced: 'auto',
				Container: 'auto',
			},
		],
		OutputKeyPrefix: `a/${userId}/${timeAndRand}`, // folders
		Outputs: [
			{
				Key: `/400k/${timeAndRand}`, // folder and specific playlist m3u8 name
				ThumbnailPattern: '/thumbnails/thumb_{count}',
				Rotate: 'auto',
				PresetId: '1607203222250-n0nyn6',
				SegmentDuration: '10',
			},
		],
		Playlists: [
			{
				Format: 'HLSv3',
				Name: `/${timeAndRand}-master`, // folder and master _____.m3u8?
				OutputKeys: [`/400k/${timeAndRand}`], // folder and prefix before ________.ts
			},
		],
		UserMetadata: {
			rand,
			time: time.toString(),
		},
		PipelineId: '1605831556406-woiqni',
	}
}

// get list of objects in a specific folder in an S3 bucket
const getObjectsList = async ({ Bucket, Prefix }) => {
	return new Promise((resolve, reject) => {
		s3.listObjects(
			{
				Bucket,
				Prefix,
			},
			(err, data) => {
				if (err) reject(err)
				resolve(data)
			}
		)
	})
}

const getS3ObjectPromise = (params) => {
	return new Promise((resolve, reject) => {
		s3.getObject(params, (err, data) => {
			if (err) reject(err)
			resolve(data)
		})
	})
}

const getS3ObjectAttempt = async (Key, objectIndex, resultIndex, bucket) => {
	const params = {
		Bucket: bucket,
		Key,
	}
	return new Promise((resolve, reject) => {
		const getS3Object = async (iterator = 0) => {
			try {
				const result = await getS3ObjectPromise(params)
				resolve({
					result,
					resultIndex,
					objectIndex,
					Key,
				})
			} catch (err) {
				console.log('getObject error: ', err)
				if (iterator < 10) {
					setTimeout(() => getS3Object(iterator), 1000)
					iterator++
				} else {
					reject(false)
				}
			}
		}
		getS3Object()
	})
}

const multiTryS3Download = async (
	objectsToGet,
	writePrefix,
	progressObject,
	bucket
) => {
	let promisesToGet = []
	const finalResults = {}
	let writeIterator = 0
	const indicesToGet = objectsToGet.length - 1
	const maxIteration = indicesToGet < 4 ? indicesToGet : 4
	for (let objectIndex = 0; objectIndex <= maxIteration; objectIndex++) {
		const fileKey = objectsToGet[objectIndex].file.Key
		promisesToGet.push(
			getS3ObjectAttempt(fileKey, objectIndex, objectIndex, bucket)
		)
	}
	let masterIterator = maxIteration
	let finished = 0
	while (promisesToGet.length > 0 && writeIterator < objectsToGet.length + 1) {
		console.log('masterIterator: ', masterIterator)
		console.log('writeIterator: ', writeIterator)
		try {
			// await for next resolve
			const value = await Promise.race(promisesToGet)
			const { result, resultIndex, Key, objectIndex } = value
			finalResults[objectIndex] = result.Etag
			fs.writeFile(`${writePrefix}/${Key}`, result.Body, (err) => {
				if (err) {
					console.log(`writeFile error for file ${Key}: `, err)
				} else {
					progressObject.files[Key] = 'DOWNLOADED'
					writeIterator++
				}
			})
			finished++
			if (finished === objectsToGet.length) {
				console.log('FINISHED!')
				console.log('finalResults: ', finalResults)
				return
			}
			if (masterIterator < objectsToGet.length - 1) {
				promisesToGet[resultIndex] = getS3ObjectAttempt(
					objectsToGet[masterIterator].file.Key,
					masterIterator,
					resultIndex,
					bucket
				)
				masterIterator++
			} else {
				promisesToGet[resultIndex] = getS3ObjectAttempt(
					objectsToGet[masterIterator].file.Key,
					masterIterator,
					resultIndex,
					bucket
				)
				const finalValues = await Promise.all(promisesToGet)
				promisesToGet = []
				finalValues.forEach((value) => {
					const { result, resultIndex, Key, objectIndex } = value
					console.log('result is: ', result, 'result index is: ', resultIndex)
					finalResults[objectIndex] = result.Etag
					fs.writeFile(`${writePrefix}/${Key}`, result.Body, async (err) => {
						if (err) {
							console.log('writeFile error: ', err)
						} else {
							console.log('last files being written')
							progressObject.files[Key] = 'DOWNLOADED'
							if (writeIterator === objectsToGet.length - 1) {
								console.log('last file save clause being executed')
								let fileDownloadProgress = 'DOWNLOAD_COMPLETE'
								Object.values(progressObject.files).forEach((status) => {
									if (status !== 'DOWNLOADED') {
										fileDownloadProgress = 'PARTIAL_DOWNLOAD'
									}
								})
								progressObject.progress = fileDownloadProgress

								return progressObject
							}
							writeIterator++
						}
					})
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

const uploadThumbnailsToDstor = async (rand) => {
	const video = await Video.findBy({ rand })
	const ongoingProcessedJson = JSON.parse(video.processed)
	const { files } = ongoingProcessedJson.thumbnails
	let allCompleted = true

	for (const file in files) {
		const filePath = `public/videos/processed/stream/${file}`
		const fileStream = fs.readFileSync(filePath)
		try {
			const folderPathList = file.split('/')
			const fileName = folderPathList[folderPathList.length - 1]
			delete folderPathList[folderPathList.length - 1]
			const folderPath = `/${folderPathList.join('/')}`
			const Hash = await uploadToDstor(fileStream, fileName, folderPath)
			console.log('Hash is: ', Hash)
			ongoingProcessedJson.thumbnails.files[file] = Hash
		} catch (err) {
			console.log('dStor upload failed for ', file, 'with err: ', err)
			allCompleted = false
		}
	}
	ongoingProcessedJson.thumbnails.progress = allCompleted
		? 'FILES_DSTOR_UPLOAD_COMPLETE'
		: 'FILES_DSTOR_UPLOAD_INCOMPLETE'
	video.processed = JSON.stringify(ongoingProcessedJson)
	video.is_active = true
	video.save()
}

const uploadVideoToDstor = async (rand, ongoingProcessedJson) => {
	const { DSTOR_API_URL } = process.env
	const { files } = ongoingProcessedJson.video
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
			ongoingProcessedJson.video.files[file] = Hash
		} catch (err) {
			console.log('dStor upload failed for ', file, 'with err: ', err)
			allCompleted = false
		}
	}
	ongoingProcessedJson.video.progress = allCompleted
		? 'FILES_DSTOR_UPLOAD_COMPLETE'
		: 'FILES_DSTOR_UPLOAD_INCOMPLETE'
	for (const file in ongoingProcessedJson.video.files) {
		const filePathSegments = file.split('/')
		const fileName = filePathSegments[filePathSegments.length - 1]
		playlist.contents = playlist.contents.replace(
			fileName,
			`${DSTOR_API_URL}/ipfs/${ongoingProcessedJson.video.files[file]}`
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
		ongoingProcessedJson.video.files[playlist.path] = Hash
	} catch (err) {
		console.log('dStor upload failed for playlist with err: ', err)
		allCompleted = false
	}
	return
}

module.exports = {
	replaceM3u8Links,
	getCreateJobJSON,
	getObjectsList,
	getS3ObjectPromise,
	getS3ObjectAttempt,
	multiTryS3Download,
	uploadThumbnailsToDstor,
	uploadVideoToDstor,
}
