import mongoose from "mongoose";

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
    currentAudioUrl: {
      type: String,
      default: null,
    },
    isPlaying: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Room = mongoose.model("Room", roomSchema);
export default Room;
