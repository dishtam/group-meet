const express = require('express')
const { Server } = require('socket.io')
const http = require('http')
const mediasoup = require('mediasoup')
const config = require('./config')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: '*' },
})

// MediaSoup Requirements
let worker
const mediasoupWorkers = []
let rooms = new Map() // { roomId: { router, peers: [peerId] } }

;(async () => {
  // Await the creation of the mediasoup worker
  worker = await mediasoup.createWorker()
})()

io.on('connection', (socket) => {
  console.log(`A user with id ${socket.id} joined`)

  socket.on('create-room', async (roomId) => {
    try {
      // Create a router using the media codecs from config.js
      const router = await worker.createRouter(config.mediasoup.routerOptions)
      rooms.set(roomId, { router, peers: [] })
      // Optionally, join the socket to a room for easier broadcasting
      socket.join(roomId)
      socket.emit('room-created', { roomId })
    } catch (error) {
      console.error('Error creating room:', error)
      socket.emit('room-error', 'Error creating room')
    }
  })

  socket.on('join-room', async ({ roomId, peerId }) => {
    const room = rooms.get(roomId)
    if (!room) {
      // Emit a specific error event
      socket.emit('room-error', 'Room not found!')
      return
    }
    try {
      // Add the peer to the room’s peer list
      room.peers.push(peerId)
      // Join the socket to the room for broadcasting purposes
      socket.join(roomId)

      // Await the creation of the WebRTC transport
      const transport = await room.router.createWebRtcTransport({
        appData: { peerId },
        listenInfos: [
          {
            protocol: 'udp',
            // ip: '192.168.0.111',
            ip: '0.0.0.0',
            // announcedAddress: '88.12.10.41',
            announcedAddress: '0.0.0.0'
          },
        ],
      })
      socket.emit('room-joined', {
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
      })
      // Notify other peers in the room that a new peer has joined
      socket.to(roomId).emit('new-peer', peerId)
    } catch (error) {
      console.error('Error joining room:', error)
      socket.emit('room-error', 'Error joining room')
    }
  })
})

server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000')
})
