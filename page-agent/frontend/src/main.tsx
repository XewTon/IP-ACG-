import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import Splash from './components/Splash'
import WeatherFX from './components/WeatherFX'
import './index.css'

function Root() {
  const [showSplash, setShowSplash] = useState(true)
  return (
    <>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <WeatherFX />
      {showSplash && <Splash onDone={() => setShowSplash(false)} />}
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
