const { DSTOR_API_URL } = process.env

const getFfmpegCommand = (source, thumbnailRate, sourceAndRand) => {
	return [
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
		'16',
		'-start_number',
		'0.25',
		`public/images/videos/thumbnails/${sourceAndRand}-360x240-%d.png`,
		'-f',
		'hls',
		'-hls_time',
		'5',
		'-hls_playlist_type',
		'event',
		`public/videos/processed/stream/${sourceAndRand}/stream.m3u8`,
	]
}

const getCustomStreamTemplate = (hash) => {
	return `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:14
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:EVENT
${DSTOR_API_URL}/ipfs/${hash}
#EXT-X-ENDLIST
`
}

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

const getCreateJobJSON = ({ time, userId, source }) => {
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
		OutputKeyPrefix: `a/${userId}`, // folders
		Outputs: [
			{
				Key: `/${source}/${source}-`, // folder and m3u8 name
				ThumbnailPattern: '',
				Rotate: 'auto',
				PresetId: '1351620000001-200050',
				SegmentDuration: '10',
			},
		],
		Playlists: [
			{
				Format: 'HLSv3',
				Name: `/${source}/${source}`, // folder and _____ name?
				OutputKeys: [`/${source}/${source}-`], // folder and prefix before ________.ts
			},
		],
		UserMetadata: {
			test1: 'test1value',
		},
		PipelineId: '1605831556406-woiqni',
	}
}

module.exports = {
	getFfmpegCommand,
	getCustomStreamTemplate,
	replaceM3u8Links,
	getCreateJobJSON,
}
