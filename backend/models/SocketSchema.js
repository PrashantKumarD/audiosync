import mongoose from "mongoose";


const messageSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});


const participantSchema = new mongoose.Schema({
  socketId: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
});


const roomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    participants: [participantSchema],
   
    chatHistory: [messageSchema],
    currentAudioUrl: {
      type: String,
      default: null,
    },
    isPlaying: {
      type: Boolean,
      default: false,
    },
    lastKnownTime: {
      type: Number,
      default: 0,
    },
    lastKnownTimeUpdatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    
    timestamps: true,
  }
);

const Room = mongoose.model("Room", roomSchema);
export default Room;
