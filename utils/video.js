const { DSTOR_API_URL } = process.env

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
				ThumbnailPattern: `/${timeAndRand}/thumb_{count}`,
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

module.exports = {
	replaceM3u8Links,
	getCreateJobJSON,
}
