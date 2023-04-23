# Sky Scheduler
Like watching YouTube together, but stupidly complicated

## How to set it up
1. Make a playlist\
Get your favourite videos into a playlist.\
When you visit the [example playlist](https://www.youtube.com/playlist?list=PLfWdliuzOIZO_ZsVtGYWmb--2fojcEfEa), you can notice the weird description.\
It gets parsed from top to bottom, and each statement means something about the video IDs below it.\
Whitespace between sections is stylistic only.\
(by default everything is in 4:3)\
`widescreen` -> created for 4:3 video pillarboxed to 16:9, for example [this video](https://www.youtube.com/watch?v=_sQGwDeambg)\
`wvid` -> 16:9 video, automatically adds `widescreen`, for example [this video](https://www.youtube.com/watch?v=ymNFyxvIdaM)\
`taxi` -> weird aspect ratio used for [Vanessa Paradis - Joe Le Taxi](https://www.youtube.com/watch?v=Ulay2FvUEd8)\
`stend` -> start & end in seconds, first number is the start, the second number is the end, used to cut off the end on [this video](https://www.youtube.com/watch?v=NlgmH5q9uNk) for example
2. Run `grab.sh`\
Please create the `data` directory before running this!
4. Modify `config.json` with paths to the new `data` directory and `content.json` file, and change defaults if desired\
there's three SSL modes, `false`, `true` and `same-port`\
`same-port` means that both HTTP and HTTPS will be served over the same (main) port\
`key` and `cert` are the files, `port` and `socket` are for listening
4. Modify `users.json`\
The `password_hash` is the SHA256 encoded password.\
Default hash is for the string `nez`.
5. Run!\
You can now pass your server address as an argument in [this URL](https://nezbedniksk.github.io/Sky-Scheduler-Player/?logo=data%3Aimage%2Fgif%3Bbase64%2CR0lGODlhAQABAIAAAP%2F%2F%2FwAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw%3D%3D&server=http://YOUR.SERVER:PORT/list?station=STATION_NAME).
