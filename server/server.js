const express = require('express')
const {Server} = require('socket.io')
const http = require('http')
const mediasoup = require('mediasoup')

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// MediaSoup Requirements
let worker;
let rooms = new Map(); // { roomId: { router, peers: [peerId] } 

io.on('connection',(socket)=>{
    console.log(`A user with id ${socket.id} joined`)
    
})

server.listen(3000,()=>{
    console.log('Server is running on http://localhost:3000')
})

