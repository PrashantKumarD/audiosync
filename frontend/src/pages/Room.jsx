import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import WaveSurfer from "wavesurfer.js";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import io from "socket.io-client";
import toast from "react-hot-toast";
import { MdAudiotrack } from "react-icons/md";
import { IoChatbox, IoSparkles } from "react-icons/io5";
import { IoSparklesSharp } from "react-icons/io5";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://audiosync-tddj.onrender.com";

const socket = io.connect(API_BASE_URL);

const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
};

const Room = () => {
  
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const username = location.state?.username || "Anonymous";

  const [audioUrl, setAudioUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [initialSyncState, setInitialSyncState] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  const waveformRef = useRef(null);
  const wavesurfer = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (roomId && username) {
      socket.emit("join_room", { roomId, username });
    }
  }, [roomId, username]);

  useEffect(() => {
    if (!waveformRef.current) return;
    if (wavesurfer.current) wavesurfer.current.destroy();

    wavesurfer.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#4ade80",
      progressColor: "#10b981",
      height: 100,
      responsive: true,
      interact: true,
    });

    if (audioUrl) wavesurfer.current.load(audioUrl);

    wavesurfer.current.on("play", () => setIsPlaying(true));
    wavesurfer.current.on("pause", () => setIsPlaying(false));
    wavesurfer.current.on("finish", () => setIsPlaying(false));
    wavesurfer.current.on("ready", () =>
      setDuration(wavesurfer.current.getDuration())
    );
    wavesurfer.current.on("audioprocess", () =>
      setCurrentTime(wavesurfer.current.getCurrentTime())
    );

    const handleWaveformClick = () => {
      setTimeout(() => {
        if (wavesurfer.current) {
          const time = wavesurfer.current.getCurrentTime();
          socket.emit("send_seek", { roomId, time });
        }
      }, 0);
    };

    const waveformEl = waveformRef.current;
    waveformEl.addEventListener("click", handleWaveformClick);

    return () => {
      waveformEl.removeEventListener("click", handleWaveformClick);
      if (wavesurfer.current) wavesurfer.current.destroy();
    };
  }, [audioUrl, roomId]);

  useEffect(() => {
    const handleSyncState = (state) => {
      setInitialSyncState(state);
      setAudioUrl(state.currentAudioUrl);
      setParticipants(state.participants);
      setMessages(state.chatHistory || []);
    };
    socket.on("sync_room_state", handleSyncState);

    const handleUpdateParticipants = (pList) => setParticipants(pList);
    socket.on("update_participants", handleUpdateParticipants);

    const handleReceiveMessage = (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    };
    socket.on("receive_message", handleReceiveMessage);

    const handleReceiveAudio = (url) => {
      setAudioUrl(url);
      toast.success("New audio track loaded!");
    };
    socket.on("receive_audio", handleReceiveAudio);

    const handleReceivePlay = (time) => {
      if (wavesurfer.current) {
        const dur = wavesurfer.current.getDuration();
        if (dur > 0) wavesurfer.current.seekTo(time / dur);
        const playPromise = wavesurfer.current.play();
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
      if (wavesurfer.current) wavesurfer.current.pause();
    };
    socket.on("receive_pause", handleReceivePause);

    const handleReceiveSeek = (time) => {
      if (wavesurfer.current) {
        const dur = wavesurfer.current.getDuration();
        if (dur > 0) wavesurfer.current.seekTo(time / dur);
      }
    };
    socket.on("receive_seek", handleReceiveSeek);

    if (wavesurfer.current && initialSyncState) {
      wavesurfer.current.on("ready", () => {
        const state = initialSyncState;
        const dur = wavesurfer.current.getDuration();
        setDuration(dur);
        if (dur > 0) {
          let time = state.isPlaying
            ? state.lastKnownTime +
              (Date.now() - new Date(state.lastKnownTimeUpdatedAt).getTime()) /
                1000
            : state.lastKnownTime;
          wavesurfer.current.seekTo(time / dur);
          setCurrentTime(time);
        }

        if (state.isPlaying) {
          const playPromise = wavesurfer.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((e) => setIsPlaying(false));
          }
        }
        setInitialSyncState(null);
      });
    }

    return () => {
      const events = [
        "sync_room_state",
        "update_participants",
        "receive_message",
        "receive_audio",
        "receive_play",
        "receive_pause",
        "receive_seek",
      ];
      events.forEach((event) => socket.off(event));
    };
  }, [initialSyncState]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const sigRes = await axios.get(
        `${API_BASE_URL}/signature`
      );
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
          onUploadProgress: (p) =>
            setUploadProgress(Math.round((p.loaded * 100) / p.total)),
          timeout: 60000,
        }
      );
      const url = uploadRes.data.secure_url;
      setAudioUrl(url);
      socket.emit("send_audio", { roomId, audioUrl: url });
      setUploadProgress(0);
    } catch (error) {
      console.error("Error uploading audio:", error);
      toast.error("Failed to upload audio.");
      setUploadProgress(0);
    }
  };

  const handlePlayPause = () => {
    if (!wavesurfer.current) return;
    const isPlayingNow = wavesurfer.current.isPlaying();
    if (!isPlayingNow) {
      socket.emit("request_to_play", { roomId });
    } else {
      socket.emit("request_to_pause", { roomId });
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      socket.emit("send_message", { roomId, username, text: newMessage });
      setNewMessage("");
    }
  };

  const handleLogout = () => {
    navigate("/");
    window.location.reload();
  };

  return (
    <div className="flex h-screen w-screen bg-purple-200 text-white">
      
      <aside className="flex w-84 flex-col justify-between bg-white/30 backdrop-blur-md p-4">
        <div>
          <h2 className="mb-4 text-xl text-center text-purple-500 font-bold">
            Room Code
          </h2>
          <input
            type="text"
            readOnly
            value={roomId}
            className="mb-6 w-full text-gray-600 rounded-md border-2 border-purple-400 p-2 text-center font-mono text-sm"
            onClick={(e) => {
              e.target.select();
              navigator.clipboard.writeText(roomId);
              toast.success("Room code copied!");
            }}
          />
          <h2 className="mb-4 text-xl text-cyan-500 font-bold">
            Participants ({participants.length})
          </h2>
          <div className="border border-gray-300 mb-5"></div>
          <ul className="space-y-2">
            {participants.map((p) => (
              <li key={p.socketId} className="flex items-center gap-2">
                <span className="ml-2">👤</span>
                <span className="font-semibold text-[17px] text-green-500">
                  {p.username}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={handleLogout}
          className="w-full rounded-lg bg-red-500 py-2 px-4 font-semibold transition hover:bg-red-600"
        >
          Log Out
        </button>
      </aside>

      
      <main className="flex h-full flex-1 flex-col items-center justify-center p-6">
        <header className="text-3xl font-bold text-pink-400 bg-white/10 backdrop-blur-md p-4 rounded-lg transition-transform duration-200 cursor-pointer hover:scale-105 hover:bg-gray-100">
          🎶RhythmSync
        </header>
        <div className="flex flex-wrap justify-center gap-6 mt-15 mb-15 sm:gap-10 w-full bg-white/10 backdrop-blur rounded-lg">
          <div className="flex items-center gap-2 p-3 text-yellow-500 transition-transform duration-200 transform rounded-lg cursor-pointer hover:scale-105 hover:bg-gray-100">
            <IoSparkles className="text-xl" />
            <span className="font-medium text-gray-800">Custom Rooms</span>
          </div>
          <div className="flex items-center gap-2 p-3 text-green-500 transition-transform duration-200 transform rounded-lg cursor-pointer hover:scale-105 hover:bg-gray-100">
            <MdAudiotrack className="text-xl" />
            <span className="font-medium text-gray-800">Audio Sync</span>
          </div>
          <div className="flex items-center gap-2 p-3 text-orange-500 transition-transform duration-200 transform rounded-lg cursor-pointer hover:scale-105 hover:bg-gray-100">
            <IoChatbox className="text-xl" />
            <span className="font-medium text-gray-800">Room Chat</span>
          </div>
        </div>
        <div className="relative mt-10 flex w-full max-w-3xl flex-col items-center justify-center rounded-lg bg-black px-6 py-12 border-2">
          {uploadProgress > 0 && (
            <p className="text-3xl font-bold text-white">
              Uploading: {uploadProgress}%
            </p>
          )}
          {audioUrl ? (
            <div className="w-full">
              <div
                ref={waveformRef}
                className="w-full py-4 cursor-pointer"
              ></div>
              <div className="mt-2 flex w-full items-center justify-between text-xs font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <div className="mt-4 flex justify-center gap-6">
                <button
                  onClick={handlePlayPause}
                  className="w-32 rounded-lg bg-cyan-500 px-4 py-2 text-lg font-semibold transition hover:bg-cyan-600"
                >
                  {isPlaying ? "⏸️ Pause" : "▶️ Play"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-400 p-8 text-center">
              <h2 className="text-2xl font-semibold text-gray-400">
                No Audio Loaded
              </h2>
              <p className="mt-2 text-gray-500">
                A user can import an audio file to begin.
              </p>
            </div>
          )}
        </div>
        <label className="mt-12 mb-10 cursor-pointer rounded-xl bg-cyan-500 px-10 py-3 text-xl font-semibold text-white transition hover:bg-cyan-600">
          Import Audio
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </main>

      
      <aside className="flex w-102 flex-col bg-white/30 backdrop-blur-md p-4">
        <div className="flex-grow flex flex-col min-h-0 ">
          <h2 className="mb-2 text-center px-10 text-xl text-purple-500 font-bold">
            Chat Window
          </h2>
          <div
            ref={chatContainerRef}
            className="flex-grow overflow-y-auto rounded-md bg-white/30 backdrop-blur-md p-2 space-y-2 border border-purple-300"
          >
            {messages.map((msg, index) => (
              <div key={index} className="text-sm break-words">
                <span className="font-bold text-cyan-300">
                  {msg.username}:{" "}
                </span>
                <span>{msg.text}</span>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-grow rounded-md bg-gray-500 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              type="submit"
              className="rounded-md bg-cyan-500 px-4 py-2 font-semibold transition hover:bg-cyan-600"
            >
              Send
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
};

export default Room;
