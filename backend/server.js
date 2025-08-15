import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import Room from "./models/SocketSchema.js"; // Adjust the import path as necessary

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://audiosync-frontend.vercel.app",
      "https://audiosync-frontend-prashant-kumar-dwebedis-projects.vercel.app",
      "https://audiosync-frontend-git-main-prashant-kumar-dwebedis-projects.vercel.app",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 450000, // Close sockets after 45s of inactivity
  })
  .then(() => console.log("MongoDB connected successfully."))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    console.error(
      "Connection string:",
      process.env.MONGO_URI ? "Present" : "Missing"
    );
  });

app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

const { CLOUD_NAME, API_KEY, API_SECRET } = process.env;
cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
});

// Root route to show server status
app.get("/", (req, res) => {
  res.send('backend is running');
});

app.get("/signature", (req, res) => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp },
    API_SECRET
  );
  res.json({ timestamp, signature, cloud_name: CLOUD_NAME, api_key: API_KEY });
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join_room", async ({ roomId, username }) => {
    try {
      socket.join(roomId);

      await Room.findOneAndUpdate(
        { roomId },
        { $setOnInsert: { roomId } },
        { upsert: true, new: true }
      );

      await Room.updateOne(
        { roomId },
        { $pull: { participants: { username } } }
      );

      const room = await Room.findOneAndUpdate(
        { roomId },
        { $addToSet: { participants: { socketId: socket.id, username } } },
        { new: true }
      );

      socket.emit("sync_room_state", room);
      io.to(roomId).emit("update_participants", room.participants);
    } catch (error) {
      console.error("Error joining room:", error);
    }
  });

  socket.on("send_message", async ({ roomId, username, text }) => {
    try {
      const newMessage = { username, text };
      await Room.updateOne({ roomId }, { $push: { chatHistory: newMessage } });
      io.to(roomId).emit("receive_message", newMessage);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  });

  socket.on("send_audio", async ({ roomId, audioUrl }) => {
    try {
      const update = {
        currentAudioUrl: audioUrl,
        isPlaying: false,
        lastKnownTime: 0,
        lastKnownTimeUpdatedAt: Date.now(),
      };
      await Room.updateOne({ roomId }, update);
      io.to(roomId).emit("receive_audio", audioUrl);
    } catch (error) {
      console.error("Error sending audio:", error);
    }
  });

  socket.on("request_to_play", async ({ roomId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        const timeElapsed =
          (Date.now() - new Date(room.lastKnownTimeUpdatedAt).getTime()) / 1000;
        const currentTime = room.isPlaying
          ? room.lastKnownTime + timeElapsed
          : room.lastKnownTime;
        await Room.updateOne(
          { roomId },
          {
            isPlaying: true,
            lastKnownTime: currentTime,
            lastKnownTimeUpdatedAt: Date.now(),
          }
        );
        io.to(roomId).emit("receive_play", currentTime);
      }
    } catch (error) {
      console.error("Error on request_to_play:", error);
    }
  });

  socket.on("request_to_pause", async ({ roomId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        const timeElapsed =
          (Date.now() - new Date(room.lastKnownTimeUpdatedAt).getTime()) / 1000;
        const newTime = room.isPlaying
          ? room.lastKnownTime + timeElapsed
          : room.lastKnownTime;
        await Room.updateOne(
          { roomId },
          {
            isPlaying: false,
            lastKnownTime: newTime,
            lastKnownTimeUpdatedAt: Date.now(),
          }
        );
        io.to(roomId).emit("receive_pause");
      }
    } catch (error) {
      console.error("Error on request_to_pause:", error);
    }
  });

  socket.on("send_seek", async ({ roomId, time }) => {
    try {
      await Room.updateOne(
        { roomId },
        {
          lastKnownTime: time,
          lastKnownTimeUpdatedAt: Date.now(),
        }
      );
      io.to(roomId).emit("receive_seek", time);
    } catch (error) {
      console.error("Error sending seek:", error);
    }
  });

  socket.on("disconnect", async () => {
    try {
      const room = await Room.findOneAndUpdate(
        { "participants.socketId": socket.id },
        { $pull: { participants: { socketId: socket.id } } },
        { new: true }
      );

      if (room) {
        io.to(room.roomId).emit("update_participants", room.participants);
        if (room.participants.length === 0) {
          await Room.deleteOne({ roomId: room.roomId });
          console.log(`Room ${room.roomId} was empty and has been deleted.`);
        }
      }
    } catch (error) {
      console.error("Error on disconnect:", error);
    }
    console.log(`User disconnected: ${socket.id}`);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
