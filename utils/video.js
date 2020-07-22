const getFfmpegCommand = (
	source,
	thumbnailRate,
	sourceAndRand
) => {
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
		'10',
		'-hls_playlist_type',
		'event',
		`public/videos/processed/stream/${sourceAndRand}/stream.m3u8`,
	]
}

module.exports = {
	getFfmpegCommand
}