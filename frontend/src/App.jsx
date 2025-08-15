import React from 'react'
import JoinRoom from './pages/JoinRoom'
import Room from './pages/Room'
import {Routes,Route} from 'react-router-dom'

const App = () => {
  return (
    <Routes>
      <Route path='/' element={<JoinRoom />} />
      <Route path='/room/:roomId' element={<Room />} />
    </Routes>
  )
}

export default App
