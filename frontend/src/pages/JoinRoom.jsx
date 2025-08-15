import React, { useState } from 'react'
import toast from 'react-hot-toast';
import {v4 as uuidv4} from 'uuid';
import {useNavigate} from 'react-router-dom';

const JoinRoom = () => {

  const [roomcode, setRoomCode] = useState('');
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  const handleJoinRoom = (e) =>{
    e.preventDefault();
    if(!roomcode || !username){
      toast.error("Please fill in all fields");
      return;
    }
    navigate(`/room/${roomcode}`,{state:{username}});

  }

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!username) {
      toast.error("Please enter your name first.");
      return;
    }
    const newRoomId = uuidv4();
    setRoomCode(newRoomId);
    toast.success("New room code generated!");

  };



    return (
      <div className="flex h-screen w-screen items-center justify-center bg-purple-200">
        <div className=" bg-white pt-10 rounded-2xl px-12 pb-20">
          <div>
            <h1 className="text-black font-bold text-4xl text-center pb-5">
              🎧 Welcome Listeners!
            </h1>
            <p className="text-orange-300 text-[15px] ">
              🔥 Join an existing room to listen to Songs with your friends and
              start collaborating
            </p>
          </div>
          <form onSubmit={handleJoinRoom}>
            <div className="py-5 ">
              <label className="block text-[20px] font-medium text-black-500 pt-4 pb-2">
                Room Code
              </label>
              <input
                className="text-[20px] border border-gray-300 p-4 rounded-md w-full "
                type="text"
                name="roomcode"
                placeholder="Enter Room Code"
                value={roomcode}
                onChange={(e) => {
                  setRoomCode(e.target.value);
                }}
              />
            </div>
            <div className="py-5 ">
              <label className="block text-[20px] font-medium text-black-500 pb-2">
                Your Name
              </label>
              <input
                className="text-[20px] border border-gray-300 p-4 rounded-md w-full "
                type="text"
                name="username"
                placeholder="Enter Your Name"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                }}
              />
            </div>
            <button type='submit' className="cursor-pointer text-[20px] text-white font-semibold border border-purple-300 bg-purple-500 w-full py-3 rounded-2xl mt-[30px] mb-10">
              Join Room
            </button>
            <div className="flex items-center justify-center">
              <div className="border-t border-gray-200 flex-grow"></div>
              <span className="px-4 text-sm text-gray-400 font-medium">OR</span>
              <div className="border-t border-gray-200 flex-grow"></div>
            </div>
            <button
              onClick={handleCreateRoom}
              className="cursor-pointer text-[20px] text-purple-500 font-semibold border-2 border-purple-500  py-3 mt-[30px] w-full rounded-2xl "
            >
              Create Room
            </button>
          </form>
        </div>
      </div>
    );
}

export default JoinRoom
