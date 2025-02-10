import express from 'express'
import { Server } from 'socket.io'
import https from 'httpolyglot'
import fs from 'fs'
import cors from 'cors'

const app = express()

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)

app.get('/', (req, res) => {
  res.send('Hello, Welcome to group-meet')
})

const options = {
  key: fs.readFileSync('./ssl/key.pem', 'utf-8'),
  cert: fs.readFileSync('./ssl/cert.pem', 'utf-8'),
}

const httpsServer = https.createServer(options,app)

httpsServer.listen(3000,()=>{
    console.log('Listening on port 3000')
})

const io = new Server(httpsServer)

const peers = io.of('/group-meet')

