import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import io from "socket.io-client";
import toast from "react-hot-toast";
import { MdAudiotrack } from "react-icons/md";
import { IoSparkles } from "react-icons/io5";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://audiosync-tddj.onrender.com";

const socket = io.connect(API_BASE_URL);

const Room = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const username = location.state?.username || "Anonymous";

  const [audioUrl, setAudioUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [participants, setParticipants] = useState([]);

  const audioRef = useRef(null);

  useEffect(() => {
    if (roomId && username) {
      socket.emit("join_room", { roomId, username });
    }
  }, [roomId, username]);

  // Audio element setup
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    if (audioUrl) {
      audio.src = audioUrl;
      audio.load();
    }

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl]);

  useEffect(() => {
    const handleSyncState = (state) => {
      setAudioUrl(state.currentAudioUrl);
      setParticipants(state.participants);
    };
    socket.on("sync_room_state", handleSyncState);

    const handleUpdateParticipants = (pList) => setParticipants(pList);
    socket.on("update_participants", handleUpdateParticipants);

    const handleReceiveAudio = (url) => {
      setAudioUrl(url);
      toast.success("New audio track loaded!");
    };
    socket.on("receive_audio", handleReceiveAudio);

    const handleReceivePlay = () => {
      const audio = audioRef.current;
      if (audio) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.log("Autoplay was prevented by browser.");
            setIsPlaying(false);
          });
        }
      }
    };
    socket.on("receive_play", handleReceivePlay);

    const handleReceivePause = () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
      }
    };
    socket.on("receive_pause", handleReceivePause);

    return () => {
      const events = [
        "sync_room_state",
        "update_participants",
        "receive_audio",
        "receive_play",
        "receive_pause",
      ];
      events.forEach((event) => socket.off(event));
    };
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const sigRes = await axios.get(`${API_BASE_URL}/signature`);
      const { timestamp, signature, cloud_name, api_key } = sigRes.data;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("timestamp", timestamp);
      formData.append("signature", signature);
      formData.append("api_key", api_key);
      formData.append("resource_type", "video");
      const uploadRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloud_name}/video/upload`,
        formData,
        {
          timeout: 60000,
        }
      );
      const url = uploadRes.data.secure_url;
      setAudioUrl(url);
      socket.emit("send_audio", { roomId, audioUrl: url });
      setIsUploading(false);
    } catch (error) {
      console.error("Error uploading audio:", error);
      toast.error("Failed to upload audio.");
      setIsUploading(false);
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      socket.emit("request_to_pause", { roomId });
    } else {
      socket.emit("request_to_play", { roomId });
    }
  };

  const handleLogout = () => {
    navigate("/");
    window.location.reload();
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen bg-purple-200 text-white">
      {/* Sidebar with Room Info */}
      <aside className="flex w-full lg:w-80 flex-col justify-between bg-white/30 backdrop-blur-md p-6">
        <div>
          <h2 className="mb-4 text-xl text-center text-purple-500 font-bold">
            Room Code
          </h2>
          <div className="mb-6">
            <input
              type="text"
              readOnly
              value={roomId}
              className="w-full text-gray-600 rounded-md border-2 border-purple-400 p-3 text-center font-mono text-sm"
            />
          </div>
          <h2 className="mb-4 text-xl text-cyan-500 font-bold">
            Participants ({participants.length})
          </h2>
          <div className="border border-gray-300 mb-5"></div>
          <ul className="space-y-3">
            {participants.map((p) => (
              <li key={p.socketId} className="flex items-center gap-3">
                <span className="text-2xl">👤</span>
                <span className="font-semibold text-lg text-green-500">
                  {p.username}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={handleLogout}
          className="w-full rounded-lg bg-red-500 py-3 px-4 text-lg font-semibold transition hover:bg-red-600"
        >
          Leave Room
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex h-auto lg:h-full flex-1 flex-col items-center justify-center p-8">
        <header className="text-4xl font-bold text-pink-400 bg-white/10 backdrop-blur-md p-6 rounded-lg transition-transform duration-200 cursor-pointer hover:scale-105 mb-8">
          🎶 RhythmSync
        </header>

        <div className="flex flex-wrap justify-center gap-8 mb-12 w-full bg-white/10 backdrop-blur rounded-lg p-4">
          <div className="flex items-center gap-3 p-4 text-yellow-500 transition-transform duration-200 transform rounded-lg cursor-pointer hover:scale-105 hover:bg-gray-100">
            <IoSparkles className="text-2xl" />
            <span className="font-medium text-gray-800 text-lg">
              Custom Rooms
            </span>
          </div>
          <div className="flex items-center gap-3 p-4 text-green-500 transition-transform duration-200 transform rounded-lg cursor-pointer hover:scale-105 hover:bg-gray-100">
            <MdAudiotrack className="text-2xl" />
            <span className="font-medium text-gray-800 text-lg">
              Audio Sync
            </span>
          </div>
        </div>

        {/* Audio Player Section */}
        <div className="relative flex w-full max-w-4xl flex-col items-center justify-center rounded-lg bg-black px-8 py-16 border-2 border-gray-600">
          {isUploading && (
            <div className="text-center mb-8">
              <p className="text-3xl font-bold text-white">Uploading...</p>
            </div>
          )}

          {audioUrl ? (
            <div className="w-full text-center">
              {/* Hidden audio element */}
              <audio ref={audioRef} preload="metadata" />

              {/* Simple Audio Player UI */}
              <div className="w-full bg-gray-800 rounded-lg p-8">
                <h3 className="text-2xl font-semibold text-white mb-8">
                  Audio Player
                </h3>

                {/* Play/Pause button */}
                <button
                  onClick={handlePlayPause}
                  className="w-20 h-20 rounded-full bg-cyan-500 hover:bg-cyan-600 transition flex items-center justify-center text-3xl text-white font-bold shadow-lg"
                >
                  {isPlaying ? "⏸️" : "▶️"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-400 p-12 text-center">
              <h2 className="text-3xl font-semibold text-gray-400 mb-4">
                No Audio Loaded
              </h2>
              <p className="text-xl text-gray-500">
                Upload an audio file to begin synchronized playback.
              </p>
            </div>
          )}
        </div>

        {/* Upload Button */}
        <label className="mt-12 cursor-pointer rounded-xl bg-cyan-500 px-12 py-4 text-xl font-semibold text-white transition hover:bg-cyan-600 shadow-lg">
          Upload Audio File
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </main>
    </div>
  );
};

export default Room;
