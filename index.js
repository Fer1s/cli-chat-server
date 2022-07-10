const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const cors = require('cors')

const { addUser, removeUser, getUser, getUsersInRoom } = require('./users')

const router = require('./router')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

app.use(cors())
app.use(router)

const usersCooldown = []

io.on('connect', (socket) => {
   socket.on('join', ({ name, room }) => {
      const { error, user } = addUser({ id: socket.id, name, room })

      if (error) {
         return socket.emit('error', error)
      }

      socket.join(user.room)

      socket.emit('message', { user: 'SYSTEM', text: `${user.name}, welcome to room ${user.room}.` })
      socket.emit('message', { user: 'SYSTEM', text: `To see all commands use $help` })
      socket.broadcast.to(user.room).emit('message', { user: 'SYSTEM', text: `${user.name} has joined!` })

      io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) })
   })

   socket.on('sendMessage', (message) => {
      try {
         const user = getUser(socket.id)
         // cooldown
         if (usersCooldown.includes(user.name)) {
            return socket.emit('message', { user: 'SYSTEM', text: 'You are sending messages too fast. Please wait a bit.' })
         }
         usersCooldown.push(user.name)
         setTimeout(() => {
            usersCooldown.splice(usersCooldown.indexOf(user.name), 1)
         }, 1000)
         io.to(user.room).emit('message', { user: user.name, text: message.text })
      } catch (error) {
         console.log(error)
         socket.emit('error', error)
      }
   })

   socket.on('disconnect', () => {
      const user = removeUser(socket.id)

      if (user) {
         io.to(user.room).emit('message', { user: 'SYSTEM', text: `${user.name} has left.` })
         io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) })
      }
   })
})

const PORT = 8081
const HOST = '0.0.0.0';

server.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);
